
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractProductInfo = async (base64Image: string): Promise<ExtractionResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Analyze this food product label or delivery note. Extract the product name, expiration date (DLC/DDM), lot number (batch code), and general food category (e.g., Meat, Dairy, Veg, Dry). If the date is not found, leave it empty. Format as JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            expiryDate: { type: Type.STRING, description: "Format YYYY-MM-DD" },
            lotNumber: { type: Type.STRING },
            category: { type: Type.STRING },
          },
          required: ["name", "category"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text.trim()) as ExtractionResult;
    }
    return null;
  } catch (error) {
    console.error("Error extracting product info:", error);
    return null;
  }
};
