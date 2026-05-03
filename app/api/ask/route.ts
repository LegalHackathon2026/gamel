import { NextRequest, NextResponse } from 'next/server';
import {
  buildClarificationReply,
  buildGuardrailPrompt,
  buildInsufficientContextReply,
  evaluateQuestion,
} from '@/lib/chatGuardrails';

type GroundedSource = {
  id: string;
  title: string;
  url: string;
};

const TRUSTED_NIGERIAN_LAW_SOURCE_PATTERN =
  /(lawpavilion\.com|lawnigeria\.com|nigerialii\.org|judiciary\.gov\.ng|supremecourt\.gov\.ng|natassembly\.gov\.ng|placng\.org|fmj\.gov\.ng|nigerianlawguru\.com)/i;

function isTrustedNigerianLawUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_NIGERIAN_LAW_SOURCE_PATTERN.test(hostname);
  } catch {
    return false;
  }
}

function normalizeGroundedSources(groundingMetadata: any): GroundedSource[] {
  const chunks = groundingMetadata?.groundingChunks || [];

  return chunks
    .map((chunk: any, index: number) => {
      const web = chunk?.web;
      if (!web?.uri || !web?.title) return null;

      return {
        id: `web_${index}`,
        title: web.title,
        url: web.uri,
      } satisfies GroundedSource;
    })
    .filter((source: GroundedSource | null): source is GroundedSource => source !== null);
}

async function callGeminiWithGoogleSearch(prompt: string, systemPrompt: string): Promise<{
  answer: string;
  sources: GroundedSource[];
}> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Search grounding failed: ${errorText}`);
  }

  const data = await response.json();
  const answer =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('') || '';

  return {
    answer,
    sources: normalizeGroundedSources(data?.candidates?.[0]?.groundingMetadata),
  };
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const { question } = await req.json();

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const guardrailDecision = evaluateQuestion(question);

    if (guardrailDecision.kind === 'block') {
      return NextResponse.json({
        answer: guardrailDecision.message,
        sources: [],
        meta: {
          provider: 'gemini',
          retrievedChunks: 0,
          elapsedMs: Date.now() - start,
          guardrail: guardrailDecision.reason,
        },
      });
    }

    if (guardrailDecision.mode === 'clarify_nigeria') {
      return NextResponse.json({
        answer: buildClarificationReply(question),
        sources: [],
        meta: {
          provider: 'gemini',
          retrievedChunks: 0,
          elapsedMs: Date.now() - start,
          guardrail: 'clarify_nigeria',
        },
      });
    }

    const systemPrompt = [
      buildGuardrailPrompt(),
      'Use Google Search grounding as your source of authority.',
      'Rely only on Nigerian legal authorities or reputable Nigerian legal reference sources.',
      'Prefer Nigerian statutes, Nigerian courts, Nigerian government sources, and reputable Nigerian legal publishers.',
      'If you cannot find reliable Nigerian legal web sources, say so plainly and do not guess.',
    ].join('\n');

    const prompt = [
      `Answer this question strictly from Nigerian law: ${guardrailDecision.normalizedQuestion}`,
      'Use Google Search grounding if needed.',
      'Only rely on Nigerian legal sources or reputable Nigerian legal publishers.',
      'If the answer depends on state law, say so and identify the state-specific issue.',
    ].join('\n');

    let result: Awaited<ReturnType<typeof callGeminiWithGoogleSearch>>;
    try {
      result = await callGeminiWithGoogleSearch(prompt, systemPrompt);
    } catch (err) {
      console.warn('Google grounding unavailable:', err);
      return NextResponse.json({
        answer: buildInsufficientContextReply(),
        sources: [],
        meta: {
          provider: 'gemini',
          retrievedChunks: 0,
          elapsedMs: Date.now() - start,
          guardrail: 'google_grounding_unavailable',
        },
      });
    }

    const trustedSources = result.sources.filter((source) => isTrustedNigerianLawUrl(source.url));
    const hasOnlyTrustedSources = result.sources.length > 0 && trustedSources.length === result.sources.length;

    if (!result.answer || !hasOnlyTrustedSources) {
      return NextResponse.json({
        answer: buildInsufficientContextReply(),
        sources: [],
        meta: {
          provider: 'gemini',
          retrievedChunks: trustedSources.length,
          elapsedMs: Date.now() - start,
          guardrail: 'insufficient_nigerian_web_context',
        },
      });
    }

    return NextResponse.json({
      answer: result.answer,
      sources: trustedSources.map((source) => ({
        id: source.id,
        metadata: {
          document_title: source.title,
          source: source.url,
          uri: source.url,
          doc_type: 'web_grounding',
          jurisdiction: 'Nigeria',
        },
        similarity: 0.9,
        preview: source.title,
      })),
      meta: {
        provider: 'gemini',
        retrievedChunks: trustedSources.length,
        elapsedMs: Date.now() - start,
        guardrail: 'web_grounding',
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
