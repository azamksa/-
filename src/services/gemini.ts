import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processTextForReading(text: string): Promise<{ text: string, wasTranslated: boolean }> {
  // التحقق مما إذا كان النص يحتوي على نسبة كبيرة من الحروف العربية
  // إذا كان كذلك، نتجاوز الترجمة لتجنب ترجمة نص عربي أصلاً
  const arabicRegex = /[\u0600-\u06FF]/g;
  const matches = text.match(arabicRegex);
  const isArabic = matches && matches.length > (text.length * 0.1);

  if (isArabic) {
    return { text, wasTranslated: false };
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate the following text to Arabic. Only return the Arabic translation, nothing else. Do not add any conversational filler.\n\nText: ${text}`,
  });
  
  return { text: response.text?.trim() || text, wasTranslated: true };
}

export async function generateSpeech(text: string, voiceName: string = 'Kore'): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("لم يتم توليد الصوت بنجاح");
  }
  
  return base64Audio;
}
