// app/api/ask/route.ts
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_PROVIDER = process.env.DEFAULT_AI_PROVIDER || 'gemini';

async function getEmbeddingGemini(text: string): Promise<number[]> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text.slice(0, 8000));
  return result.embedding.values;
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callClaude(prompt: string, systemPrompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });
  return (response.content[0] as { text: string }).text;
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1500,
  });
  return response.choices[0].message.content || '';
}

const SYSTEM_PROMPT = `You are Gamell AI, a legal education assistant specializing in Nigerian law.

Your role:
- Answer questions about Nigerian law clearly, accurately, and in plain language
- Reference specific Nigerian statutes, court cases, and constitutional provisions
- Explain legal concepts accessibly - the user may not have a law background
- Always ground your answer in Nigerian law specifically
- If context documents are provided, cite them
- Never fabricate case names, citations, or legal provisions
- Add a brief note when professional legal advice is recommended

Keep responses clear, structured, and educational.`;

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const { question, provider = DEFAULT_PROVIDER, sessionId } = await req.json();

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Import supabase server client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Embed the question
    let queryEmbedding: number[] = [];
    let results: { id: string; content: string; metadata: Record<string, string>; similarity: number }[] = [];

    try {
      queryEmbedding = await getEmbeddingGemini(question);

      const { data } = await supabase.rpc('hybrid_search', {
        query_text: question,
        query_embedding: queryEmbedding,
        match_count: 5,
      });
      results = data || [];
    } catch {
      // If embedding/search fails (e.g. no documents yet), continue without context
      console.warn('Vector search skipped - no documents or embedding error');
    }

    // Build prompt
    let prompt = question;
    if (results.length > 0) {
      const context = results.map((r, i) => {
        const meta = r.metadata || {};
        const source = [meta.case_name, meta.court, meta.year].filter(Boolean).join(' | ');
        return `[Source ${i + 1}${source ? `: ${source}` : ''}]\n${r.content}`;
      }).join('\n\n---\n\n');

      prompt = `Answer the question using the Nigerian legal context below.\n\nCONTEXT:\n${context}\n\nQUESTION: ${question}`;
    }

    // Generate response
    let answer = '';
    try {
      if (provider === 'claude') answer = await callClaude(prompt, SYSTEM_PROMPT);
      else if (provider === 'openai') answer = await callOpenAI(prompt, SYSTEM_PROMPT);
      else answer = await callGemini(prompt, SYSTEM_PROMPT);
    } catch (err) {
      // Fallback to Gemini
      if (provider !== 'gemini') {
        answer = await callGemini(prompt, SYSTEM_PROMPT);
      } else {
        throw err;
      }
    }

    return NextResponse.json({
      answer,
      sources: results.map(r => ({
        id: r.id,
        metadata: r.metadata,
        similarity: r.similarity,
        preview: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
      })),
      meta: {
        provider,
        retrievedChunks: results.length,
        elapsedMs: Date.now() - start,
      },
    });
  } catch (err: unknown) {
    console.error('Error in /api/ask:', err);
    return NextResponse.json(
      { error: 'Failed to process question', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
