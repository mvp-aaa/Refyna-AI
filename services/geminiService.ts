
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ImageSize, Annotation, UserFeedback } from "../types";

// Helper to base64 encode blobs
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Deep analysis using Gemini 3 Pro with Thinking capability and Search grounding
 */
export const analyzeDesignToken = async (tokenCode: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this Figma design token/code snippet for UX best practices, accessibility (WCAG), and modern visual harmony. 
      Use Google Search to cross-reference the latest design patterns for this specific context.
      Code: ${tokenCode}`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget
      }
    });
    return response.text || "Could not analyze design code.";
  } catch (error) {
    console.error("Analysis error:", error);
    return "An error occurred while analyzing the design code.";
  }
};

/**
 * Initialize a Chat Session with Gemini 3 Pro
 */
export const createChatSession = (initialContext: string): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: `You are Refyna, a world-class senior UI/UX designer. 
      You are currently reviewing a design provided by the user. 
      Context of the design: ${initialContext.substring(0, 2000)}.
      
      Your goal is to help the user improve their design. 
      Be critical but constructive. Focus on whitespace, typography, accessibility, and visual hierarchy.
      Use Google Search to find current industry benchmarks and real-world examples to support your advice.
      Keep your responses conversational and helpful.
      `,
    }
  });
};

/**
 * Analyze an uploaded image with structured output and thinking.
 */
export const analyzeImage = async (file: File, priorFeedback: UserFeedback[] = []): Promise<{ text: string; annotations: Annotation[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const goodFeedback = priorFeedback
    .filter(f => f.rating === 'good')
    .map(f => f.suggestion)
    .slice(-5);

  const memoryContext = goodFeedback.length > 0
    ? `Preferences: The user values ${goodFeedback.join('; ')}.`
    : "";

  try {
    const base64Data = await blobToBase64(file);
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: file.type,
                        data: base64Data
                    }
                },
                {
                    text: `Audit this UI screenshot.
                    ${memoryContext}
                    1. Provide a concise critique on whitespace, typography, and color contrast.
                    2. Identify exactly 3 critical areas for improvement. 
                    3. Use bounding boxes [ymin, xmin, ymax, xmax] in percentages (0-100).
                    4. Reference latest design trends from 2024-2025 using Google Search.
                    `
                }
            ]
        },
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 32768 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: { type: Type.STRING },
              annotations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                    confidenceScore: { type: Type.INTEGER },
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: "[ymin, xmin, ymax, xmax] (0-100)"
                    }
                  }
                }
              }
            }
          }
        }
    });
    
    const text = response.text || "{}";
    const json = JSON.parse(text);
    
    return {
      text: json.analysis || "Audit summary not generated.",
      annotations: json.annotations || []
    };
  } catch (error) {
      console.error("Image analysis error", error);
      return { text: "Failed to process image audit.", annotations: [] };
  }
}
