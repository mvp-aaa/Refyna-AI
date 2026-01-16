
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Annotation, Question } from "../types";

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
 * Generate Dynamic Quiz Questions using Gemini 3 Flash with Search grounding
 */
export const generateQuizQuestions = async (category: string, level: string, count: number): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate ${count} unique, high-quality design quiz questions for the category: "${category}" at a "${level}" level. 
      Use Google Search to ensure questions are up-to-date with 2024/2025 trends, accessibility standards (WCAG 2.2), and modern tool practices (Figma, Tailwind, etc).
      Avoid repetitive or generic questions. Ensure variety in topic within the category.
      Provide the response in JSON format.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.INTEGER, description: "Index of the correct option (0-3)" },
              explanation: { type: Type.STRING }
            },
            required: ["text", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const text = response.text || "[]";
    const questions = JSON.parse(text) as Question[];
    return questions.map(q => ({ ...q, id: Math.random().toString(36).substr(2, 9) }));
  } catch (error) {
    console.error("Dynamic quiz generation failed:", error);
    return [];
  }
};

export const analyzeDesignToken = async (tokenCode: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analyze this Figma design token/code snippet for UX best practices and accessibility.
      Code: ${tokenCode}`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 }, 
      }
    });
    return response.text || "Could not analyze design code.";
  } catch (error) {
    console.error("Analysis error:", error);
    return "An error occurred.";
  }
};

export const createChatSession = (initialContext: string): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: `You are Aura, a senior UI/UX designer assistant. Context: ${initialContext.substring(0, 1000)}`,
    }
  });
};

export const analyzeImage = async (file: File): Promise<{ text: string; annotations: Annotation[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const base64Data = await blobToBase64(file);
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: file.type, data: base64Data } },
                { text: `Audit this UI screenshot using Google Search for latest trends and accessibility.` }
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
                    box_2d: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                  }
                }
              }
            }
          }
        }
    });
    const json = JSON.parse(response.text || "{}");
    return { text: json.analysis || "", annotations: json.annotations || [] };
  } catch (error) {
      console.error("Image analysis error", error);
      return { text: "Error.", annotations: [] };
  }
}
