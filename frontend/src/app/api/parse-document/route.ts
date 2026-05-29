import { NextRequest, NextResponse } from 'next/server';

interface Option {
    label: string;
    body_html: string;
}

interface Question {
    id: string;
    bodyHtml: string;
    options: Option[];
    correctOptionLabel: string;
    solutionText: string;
    year: string;
    source: string;
}

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

        let text = await file.text();
        
        // Clean up messy OCR wrappers around array environments (e.g. ($$ \begin{array} ... \end{array} $$))
        // and replace them with standard inline \( ... \) wrappers. (The frontend will render them as centered BlockMath).
        text = text.replace(/(?:\(\$\$|\$\$|\$|\\\()\s*(\\begin\{[a-zA-Z*]+\}[\s\S]*?\\end\{[a-zA-Z*]+\})\s*(?:\$\$\)|\$\$|\$|\\\))/g, '\\($1\\)');
        
        const lines = text.split('\n');
        
        const parsedQuestions: Question[] = [];
        let currentQ: Question | null = null;
        let lastQNum: number | null = null;
        let hasCorrectAns = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const qMatch = line.match(/^(?:\$|\\\()\s*(\d+)\s*(?:\.\s*\$|\$\s*\.|\.\s*\\\)|\\\)\s*\.)\s*(.*)/);
            if (qMatch) {
                let isBulletPoint = false;
                const newNum = parseInt(qMatch[1], 10);

                if (currentQ && lastQNum !== null) {
                    const hasOpts = currentQ.options.some((opt: Option) => opt.body_html !== '');
                    const prevLine = i > 0 ? lines[i-1].trim() : '';
                    const isConsecutive = prevLine !== '' && !prevLine.match(/^Correct:\s*Option/i);
                    
                    if (newNum !== lastQNum + 1) {
                        if (!hasOpts || isConsecutive || newNum <= lastQNum) {
                            isBulletPoint = true;
                        }
                    } else {
                        if (isConsecutive) {
                            if (!hasOpts || hasCorrectAns) {
                                isBulletPoint = true;
                            }
                        }
                    }
                }

                if (!isBulletPoint) {
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
                    lastQNum = newNum;
                    hasCorrectAns = false;
                    continue;
                }
                // If it IS a bullet point, let it fall through to be added to bodyHtml/solutionText
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
                    hasCorrectAns = true;
                    continue;
                }

                const hasOpts = currentQ.options.some((opt: Option) => opt.body_html !== '');
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

    } catch (error: unknown) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }
}
