import { GoogleGenAI, Type, Chat } from "@google/genai";
import { ImageSize, Annotation } from "../types";

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
 * Deep analysis using Gemini 3 Pro with Thinking capability
 */
export const analyzeDesignToken = async (tokenCode: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this Figma design token/code snippet for UX best practices, accessibility, and visual harmony. Provide a concise but critical review. \n\n Code: ${tokenCode}`,
      config: {
        thinkingConfig: { thinkingBudget: 16000 }, // Use thinking for deep analysis
      }
    });
    return response.text || "Could not analyze token.";
  } catch (error) {
    console.error("Analysis error:", error);
    return "An error occurred while analyzing the design.";
  }
};

/**
 * Quick UI suggestions using Flash Lite
 */
export const getQuickSuggestion = async (context: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: `Give a short, single-sentence UI design tip regarding: ${context}. Be witty and concise.`,
    });
    return response.text || "Simplify the layout for better clarity.";
  } catch (error) {
    return "Try simplifying the layout.";
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
      systemInstruction: `You are Aura, a world-class senior UI/UX designer. 
      You are currently reviewing a design provided by the user. 
      Context of the design: ${initialContext.substring(0, 2000)}.
      
      Your goal is to help the user improve their design. 
      Be critical but constructive. Focus on whitespace, typography, accessibility, and visual hierarchy.
      Keep your responses conversational and helpful.
      `,
    }
  });
};

/**
 * Generate a visual improvement using Image Generation model
 */
export const generateDesignVariant = async (prompt: string, size: ImageSize = ImageSize.K1): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [{ text: `A high fidelity UI design interface. ${prompt}` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: size,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image gen error:", error);
    return null;
  }
};

/**
 * Analyze an uploaded image with structured output
 */
export const analyzeImage = async (file: File): Promise<{ text: string; annotations: Annotation[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
                    text: `Analyze this UI design screenshot.
                    1. Provide a concise critique on whitespace, typography, and colors.
                    2. Identify 3 specific areas that need improvement. Return bounding box coordinates (ymin, xmin, ymax, xmax) for these areas on a scale of 0 to 100.
                    `
                }
            ]
        },
        config: {
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
                    box_2d: {
                      type: Type.ARRAY,
                      items: { type: Type.INTEGER },
                      description: "Bounding box coordinates [ymin, xmin, ymax, xmax] in percentages (0-100)"
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
      text: json.analysis || "Analysis failed.",
      annotations: json.annotations || []
    };
  } catch (error) {
      console.error("Image analysis error", error);
      return { text: "Failed to analyze image.", annotations: [] };
  }
}