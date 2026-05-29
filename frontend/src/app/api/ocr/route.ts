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
    
    // We use gemini-2.5-flash as it is extremely fast and free, and phenomenal at OCR
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Remove the data:image/jpeg;base64, prefix
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `You are an expert Math and Text OCR system. 
    Analyze the provided image and extract all text, math equations, and tables perfectly.
    
    1. Strict Rules for Writing Numbers and Mathematical Expressions:
    (i) Numbers must be written in the format $0$., $1$., $2$., $\\dots$, $9$. Writing them as 0, 1, 2 without the required formatting is not permitted.
    (ii) For equations: Write $2 + 3 = 5$
    (iii) For decimals: Write $3.14$, $0.5$
    (iv) For fractions: Write $\\frac{1}{2}$
    (v) Whenever ordinal numbers such as \\(1\\text{st}\\), \\(2\\text{nd}\\), \\(3\\text{rd}\\), \\(4\\text{th}\\), \\(5\\text{th}\\), etc. appear, they must be written in proper LaTeX superscript format such as \\(1^{\\text{st}}\\), \\(2^{\\text{nd}}\\), \\(3^{\\text{rd}}\\), \\(4^{\\text{th}}\\), \\(5^{\\text{th}}\\), and so on.
    (vi) Whenever a table appears in a question,the entire table must be enclosed within \\( \\) LaTeX delimiters and written using proper LaTeX table formatting such as \\begin{array}{|c|c|...|}.
    (vii) Serial numbers must also be enclosed $1$., $2$., $3$., etc., $(i)$., $[i]$., $(a)$., $2.1$., etc.
    
    2. The following guidelines must be strictly followed:
    (i) If any question contains images in the PDF. Then write the question in text-only form, and at each location where an image appears, insert [Insert Image].
    (ii) If any Bengali mathematical digit appears, it must be written in English numerals.
    Example: If Bengali numerals such as $১.$, $২.$, $৩.$, $৪.$, $৫.$, etc. appear, they must be written as $1.$, $2.$, $3.$, $4.$, $5.$, etc. respectively.
    (iii) Chemical symbols must be written in the format $\\text{H}_2$, $\\text{C}$, $\\text{N}_2$. Writing them as $H_2$, $C$, or $N_2$ is not permitted.
    
    3. All mathematical numbers, digits, values, symbols, and expressions must be strictly enclosed within $...$. This rule applies everywhere in the content, including within sentences, statements, equations, lists, and examples.
    
    4. Do not use any of the following LaTeX environments or formatting symbols: "\\boxed{...}", "$$...$$", "\\[...\\]", "###" (strongly recommended).
    
    5. Do not include introductory text like "Here is the extracted text". ONLY output the extracted content itself.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ]);

    let responseText = result.response.text();
    
    // Automatically convert any $$ block math to \( inline math
    responseText = responseText.replace(/\$\$([\s\S]*?)\$\$/g, '\\($1\\)');
    
    // Also convert any \[ \] block math to \( \) inline math just in case Gemini uses them
    responseText = responseText.replace(/\\\[([\s\S]*?)\\\]/g, '\\($1\\)');

    return NextResponse.json({ result: responseText });

  } catch (error: unknown) {
    console.error("Gemini OCR Error:", error);
    const err = error as Error;
    return NextResponse.json({ error: err.message || 'Failed to process image with Gemini' }, { status: 500 });
  }
}
