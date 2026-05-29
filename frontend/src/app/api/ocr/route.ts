import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, apiKey } = body; // image is a base64 string
    
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Use provided key from frontend
    const key = apiKey || process.env.GEMINI_API_KEY;
    
    if (!key) {
      return NextResponse.json({ error: 'No Gemini API key provided' }, { status: 401 });
    }

    const genAI = new GoogleGenerativeAI(key);
    
    // We use gemini-1.5-flash-latest as it is extremely fast and free, and phenomenal at OCR
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    // Remove the data:image/jpeg;base64, prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an expert Math and Text OCR system. 
    Analyze the provided image and extract all text, math equations, and tables perfectly.
    
    RULES:
    1. Output standard Markdown.
    2. Enclose all inline math in \\( and \\)
    3. Enclose all block math (equations on their own line) in \\[ and \\] or $$ and $$
    4. If there is a table, output a standard Markdown table or a LaTeX \\begin{array} block.
    5. Do not include introductory text like "Here is the extracted text". ONLY output the extracted content itself.
    6. Ensure that math formulas are transcribed exactly as they appear.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ]);

    const responseText = result.response.text();

    return NextResponse.json({ result: responseText });

  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process image with Gemini' }, { status: 500 });
  }
}
