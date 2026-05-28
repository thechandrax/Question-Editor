import { NextRequest, NextResponse } from 'next/server';

function convertMath(text: string, wrapper: string): string {
    if (wrapper === 'inline_parentheses') {
        return text.replace(/\$(.+?)\$/g, '\\($1\\)');
    }
    return text;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const mathWrapper = (formData.get('math_wrapper') as string) || 'single_dollar';
        const sourceType = (formData.get('source_type') as string) || 'auto';

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const filename = file.name.toLowerCase();
        if (!filename.endsWith('.md') && !filename.endsWith('.txt')) {
            return NextResponse.json({ 
                detail: "Invalid file type. Only MD and TXT are supported in this streamlined parser." 
            }, { status: 400 });
        }

        const text = await file.text();
        const lines = text.split('\n');
        
        const parsedQuestions: any[] = [];
        let currentQ: any = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;

            const qMatch = line.match(/^(?:\$|\\\()\s*(\d+)\s*(?:\.\s*\$|\$\s*\.|\.\s*\\\)|\\\)\s*\.)\s*(.*)/);
            if (qMatch) {
                if (currentQ) {
                    parsedQuestions.push(currentQ);
                }
                currentQ = {
                    id: String(Math.floor(Math.random() * 90000) + 10000),
                    bodyHtml: qMatch[2].trim(),
                    options: [
                        { label: 'A', body_html: '' },
                        { label: 'B', body_html: '' },
                        { label: 'C', body_html: '' },
                        { label: 'D', body_html: '' },
                    ],
                    correctOptionLabel: 'A',
                    solutionText: '',
                    year: '',
                    source: `Native TS Parser (${sourceType})`
                };
                continue;
            }

            if (currentQ) {
                const optMatch = line.match(/^(?:\$|\\\()?\s*\(([a-d])\)\s*(?:\$|\\\))?\s*(.*)/i);
                if (optMatch) {
                    const label = optMatch[1].toUpperCase();
                    const idx = label.charCodeAt(0) - 65;
                    if (idx >= 0 && idx < 4) {
                        currentQ.options[idx].body_html = optMatch[2].trim();
                    }
                    continue;
                }

                const ansMatch = line.match(/^Correct:\s*Option\s*(?:\$|\\\()?\s*\(([a-d])\)\s*(?:\$|\\\))?/i);
                if (ansMatch) {
                    currentQ.correctOptionLabel = ansMatch[1].toUpperCase();
                    continue;
                }

                const hasOpts = currentQ.options.some((opt: any) => opt.body_html !== '');
                if (!hasOpts) {
                    currentQ.bodyHtml += '\n' + line;
                } else {
                    if (!line.toLowerCase().startsWith('correct:')) {
                        currentQ.solutionText += line + '\n';
                    }
                }
            }
        }

        if (currentQ) {
            parsedQuestions.push(currentQ);
        }

        for (const q of parsedQuestions) {
            q.bodyHtml = convertMath(q.bodyHtml.trim(), mathWrapper);
            q.solutionText = convertMath(q.solutionText.trim(), mathWrapper);
            for (const opt of q.options) {
                opt.body_html = convertMath(opt.body_html.trim(), mathWrapper);
            }
        }

        if (parsedQuestions.length === 0) {
            return NextResponse.json({
                message: "Parser failed to extract questions. Please check formatting.",
                questions: []
            });
        }

        return NextResponse.json({ 
            questions: parsedQuestions, 
            message: "Parsed successfully using Native TypeScript MD Parser" 
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
