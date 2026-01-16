import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Types for audio processing
interface AudioContexts {
  input: AudioContext;
  output: AudioContext;
  inputNode: GainNode;
  outputNode: GainNode;
}

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioContexts: AudioContexts | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private cleanupCallbacks: (() => void)[] = [];

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private async setupAudioContexts(): Promise<AudioContexts> {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const inputCtx = new AudioContextClass({ sampleRate: 16000 });
    const outputCtx = new AudioContextClass({ sampleRate: 24000 });
    
    const inputNode = inputCtx.createGain();
    const outputNode = outputCtx.createGain();

    return { input: inputCtx, output: outputCtx, inputNode, outputNode };
  }

  private createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return {
      data: base64,
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const numChannels = 1;
    const sampleRate = 24000;
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  public async connect(
    onMessage: (text: string, isUser: boolean) => void,
    onStatusChange: (connected: boolean) => void,
    voiceName: string = 'Fenrir'
  ) {
    try {
      this.audioContexts = await this.setupAudioContexts();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create a deferred promise mechanism to avoid using 'sessionPromise' 
      // inside the object configuration before it is defined.
      let sessionResolver: (value: any) => void = () => {};
      const deferredSession = new Promise<any>((resolve) => {
        sessionResolver = resolve;
      });

      const connectionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are a senior UI/UX designer assistant named Aura. You are helpful, concise, and focus on visual design, accessibility, and modern aesthetics. Keep responses brief and conversational. When the user shares a design, assume you are looking at it and provide specific feedback on layout, color, and typography.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
          },
        },
        callbacks: {
          onopen: () => {
            onStatusChange(true);
            if (!this.audioContexts || !this.stream) return;

            // Setup Input Streaming
            const source = this.audioContexts.input.createMediaStreamSource(this.stream);
            const scriptProcessor = this.audioContexts.input.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = this.createBlob(inputData);
              // Use the deferred promise here which is safe to reference
              deferredSession.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(this.audioContexts.input.destination);
            
            // Cleanup for this specific connection
            this.cleanupCallbacks.push(() => {
              source.disconnect();
              scriptProcessor.disconnect();
            });
          },
          onmessage: async (msg: LiveServerMessage) => {
             // Handle Audio Output
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData && this.audioContexts) {
                this.nextStartTime = Math.max(this.nextStartTime, this.audioContexts.output.currentTime);
                const audioBuffer = await this.decodeAudioData(
                  this.decode(audioData),
                  this.audioContexts.output
                );
                
                const source = this.audioContexts.output.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.audioContexts.outputNode);
                source.connect(this.audioContexts.output.destination); // Connect to speakers
                
                source.addEventListener('ended', () => this.sources.delete(source));
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
             }

             // Handle Interruption
             if (msg.serverContent?.interrupted) {
               this.sources.forEach(s => s.stop());
               this.sources.clear();
               this.nextStartTime = 0;
             }
          },
          onclose: () => onStatusChange(false),
          onerror: (e) => console.error("Live API Error", e)
        }
      });

      // Resolve the deferred promise once the actual connection is established
      connectionPromise.then((session) => {
        sessionResolver(session);
        this.session = session;
      });
      
      await connectionPromise;

    } catch (error) {
      console.error("Failed to connect to Live API", error);
      onStatusChange(false);
    }
  }

  public async sendImage(base64Data: string) {
    if (!this.session) return;
    
    // Ensure clean base64
    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    this.session.sendRealtimeInput({
      media: {
        mimeType: 'image/jpeg',
        data: cleanBase64
      }
    });
  }

  public disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.cleanupCallbacks.forEach(cb => cb());
    this.cleanupCallbacks = [];
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    if (this.audioContexts) {
      this.audioContexts.input.close();
      this.audioContexts.output.close();
    }
    this.session = null;
  }
}