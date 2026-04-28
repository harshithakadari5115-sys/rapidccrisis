import { GoogleGenAI } from '@google/genai';

// Initialize exactly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function detectEmergencyInText(text: string): Promise<{ isEmergency: boolean; type: string; confidence: number }> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following text and determine if it indicates an emergency.
    Text: "${text}"
    Respond in JSON format: { "isEmergency": boolean, "type": "fire" | "medical" | "security" | "none", "confidence": number }`
    });
    
    const body = response.text;
    if (!body) return { isEmergency: false, type: 'none', confidence: 0 };
    const jsonStr = body.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('AI Analysis Error:', error);
    return { isEmergency: false, type: 'none', confidence: 0 };
  }
}

export async function getTacticalAdvice(type: string, location: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide brief, tactical instruction for an emergency responder for a ${type} emergency at ${location}. 
      Max 3 bullet points. Focus on safety and immediate actions. No yapping.`
    });
    return response.text || "Standard protocols active. Secure perimeter.";
  } catch (error) {
    console.error('Tactical Advice Error:', error);
    return "Proceed with caution. Follow standard safety SOPs.";
  }
}
