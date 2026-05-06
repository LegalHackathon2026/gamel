// app/api/ask/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Force 'groq' for hackathon stability if default not set or failing
const DEFAULT_PROVIDER = 'groq';

async function getEmbeddingGemini(text: string): Promise<number[]> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text.slice(0, 8000));
    return result.embedding.values;
  } catch (e) {
    // Silently skip search if Gemini is failing (Hackathon stability)
    return [];
  }
}

async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error('[Gemini Error]:', err instanceof Error ? err.message : err);
    throw err;
  }
}

async function callGroq(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    console.error('[Groq] GROQ_API_KEY is undefined in process.env');
    throw new Error('GROQ_API_KEY is missing from your .env file.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Groq] API returned ${response.status}: ${errText}`);
      throw new Error(`Groq API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[Groq] Fetch operation failed:', err);
    throw err;
  }
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

const SYSTEM_PROMPT = `You are Gamell AI, a STRICT legal education assistant specializing ONLY in Nigerian law.

### CORE GUARDRAILS:
1. ONLY answer questions related to Nigerian Law, legal rights, and the Nigerian legal system.
2. If a user asks about anything else (e.g., general science, trivia, math, cooking, non-legal advice like "what is fish"), you MUST politely but firmly decline.
3. If declined, use this message: "I am Gamell AI, specialized only in Nigerian legal education. I cannot answer questions outside the scope of Nigerian law."
4. Do not provide "general knowledge" answers for non-legal topics even if you know the answer.

### ROLE FOR LEGAL QUESTIONS:
- Answer clearly, accurately, and in plain language.
- Reference specific Nigerian statutes, court cases, and constitutional provisions.
- Always ground your answer in Nigerian law specifically.
- If context documents are provided, cite them.
- Never fabricate case names, citations, or legal provisions.
- Add a brief note when professional legal advice is recommended.

Formatting:
- Use Markdown to structure your response (headers, bullet points, bold text)
- Keep responses clear, structured, and educational.`;

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  console.log(`[API GET] Fetching history for session: ${sessionId}`);
  
  if (!sessionId) return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from('conversations')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[API GET] Supabase error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  console.log(`[API GET] Found ${data?.length || 0} messages`);
  return NextResponse.json({ history: data });
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const { question, provider = DEFAULT_PROVIDER, sessionId } = await req.json();
    console.log(`[API POST] Question received. Session: ${sessionId}, Provider: ${provider}`);

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

    // 1. Store User Message
    if (sessionId) {
      const { error: insError } = await supabase.from('conversations').insert({
        session_id: sessionId,
        role: 'user',
        content: question
      });
      if (insError) console.error('[API POST] User message store error:', insError);
    }

    // 2. Fetch History for Context (limit to last 5 messages for token efficiency)
    let historyContext = '';
    if (sessionId) {
      const { data: history, error: histError } = await supabase
        .from('conversations')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(6); // Get last 6 to have enough context
      
      if (histError) console.error('[API POST] History fetch error:', histError);
      
      if (history && history.length > 0) {
        // Reverse to get chronological order
        historyContext = history.reverse().map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      }
    }

    // 3. Search for Legal Context
    let results: { id: string; content: string; metadata: Record<string, string>; similarity: number }[] = [];
    try {
      const queryEmbedding = await getEmbeddingGemini(question);
      const { data } = await supabase.rpc('hybrid_search', {
        query_text: question,
        query_embedding: queryEmbedding,
        match_count: 5,
      });
      results = data || [];
    } catch (err) {
      console.warn('[API POST] Search failed, falling back to general knowledge:', err instanceof Error ? err.message : err);
    }

    // 4. Build Structured Prompt
    let finalPrompt = '';
    
    if (historyContext) {
      finalPrompt += `### RECENT CONVERSATION HISTORY\n${historyContext}\n\n`;
    }

    if (results.length > 0) {
      const contextBlocks = results.map((r, i) => {
        const meta = r.metadata || {};
        const source = [meta.case_name, meta.court, meta.year].filter(Boolean).join(' | ');
        return `[Source ${i + 1}${source ? `: ${source}` : ''}]\n${r.content}`;
      }).join('\n\n---\n\n');
      
      finalPrompt += `### LEGAL CONTEXT (Nigerian Law)\nUse these specific documents to ground your answer where possible:\n${contextBlocks}\n\n`;
    }

    finalPrompt += `### CURRENT QUESTION\n${question}`;

    // Generate response
    let answer = '';
    try {
      if (provider === 'groq') answer = await callGroq(finalPrompt, SYSTEM_PROMPT);
      else if (provider === 'claude') answer = await callClaude(finalPrompt, SYSTEM_PROMPT);
      else if (provider === 'openai') answer = await callOpenAI(finalPrompt, SYSTEM_PROMPT);
      else answer = await callGroq(finalPrompt, SYSTEM_PROMPT); // Forced default
    } catch (err) {
      console.warn('[Primary AI Failed] Attempting fallback to Gemini 2.0 Flash...', err instanceof Error ? err.message : '');
      
      try {
        // Fallback to Gemini 2.0 Flash
        answer = await callGemini(finalPrompt, SYSTEM_PROMPT);
        console.log('[Fallback Success] Gemini 2.0 Flash responded.');
      } catch (fallbackErr) {
        console.error('[Total Failure] Both Groq and Gemini failed:', fallbackErr);
        throw new Error('AI services are currently unreachable. Please try again in a few seconds.');
      }
    }

    // 3. Store Assistant Message
    if (sessionId) {
      await supabase.from('conversations').insert({
        session_id: sessionId,
        role: 'assistant',
        content: answer
      });
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
