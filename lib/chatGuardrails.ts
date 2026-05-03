const LEGAL_TOPIC_PATTERN =
  /\b(law|legal|lawyer|court|judge|justice|constitution|constitutional|right|rights|arrest|bail|police|crime|criminal|civil|contract|agreement|tenant|tenancy|landlord|land|property|employment|labour|labor|dismissal|termination|marriage|divorce|custody|evidence|appeal|sue|lawsuit|statute|act|regulation|offence|offense|detention|charge|compliance|tax|will|probate|inheritance)\b/i;

const NIGERIA_PATTERN =
  /\b(nigeria|nigerian|abuja|lagos|kano|rivers|fct|federal republic of nigeria|supreme court of nigeria|nigerian court of appeal|federal high court of nigeria|high court of lagos state|high court of the fct|acja|efcc|icpc|c of o)\b/i;

const FOREIGN_JURISDICTION_PATTERN =
  /\b(uk|united kingdom|england|wales|scotland|ireland|usa|u\.s\.|united states|canada|india|ghana|kenya|south africa|australia|european union|eu)\b/i;

const UNSAFE_LEGAL_PATTERN =
  /\b(bribe|forg(e|ing|ed)|fake document|backdate|hide assets|launder|money laundering|evade tax|tax evasion|avoid arrest|escape arrest|beat the case|destroy evidence|tamper with evidence|lie to police|lie in court|perjury|bypass the law|smuggle|extort|blackmail|fraud|scam|impersonat(e|ion)|steal identity|hack|cybercrime)\b/i;

const ILLEGAL_INSTRUCTION_PATTERN =
  /\b(how do i|how can i|help me|ways to|best way to|tell me how to)\b/i;

const HIGH_STAKES_PATTERN =
  /\b(arrested|detained|charged|court date|trial|deported|deportation|evicted|termination|fired|dismissed|custody|divorce|probate|inheritance|tax audit|police station|bail|criminal charge)\b/i;

export type GuardrailDecision =
  | { kind: 'allow'; mode: 'nigerian_law'; normalizedQuestion: string }
  | { kind: 'allow'; mode: 'clarify_nigeria'; normalizedQuestion: string }
  | { kind: 'block'; reason: 'non_legal' | 'foreign_law' | 'unsafe_instruction'; message: string };

export function evaluateQuestion(question: string): GuardrailDecision {
  const normalizedQuestion = question.trim().replace(/\s+/g, ' ');
  const looksLegal = LEGAL_TOPIC_PATTERN.test(normalizedQuestion);
  const mentionsNigeria = NIGERIA_PATTERN.test(normalizedQuestion);
  const mentionsForeignJurisdiction = FOREIGN_JURISDICTION_PATTERN.test(normalizedQuestion);
  const looksUnsafe = UNSAFE_LEGAL_PATTERN.test(normalizedQuestion) && ILLEGAL_INSTRUCTION_PATTERN.test(normalizedQuestion);

  if (looksUnsafe) {
    return {
      kind: 'block',
      reason: 'unsafe_instruction',
      message:
        'I can only help with lawful information about Nigerian law. I cannot help with evading the law, hiding wrongdoing, bribery, forgery, or similar conduct. If you want, I can explain the lawful options, penalties, or compliance steps under Nigerian law.',
    };
  }

  if (mentionsForeignJurisdiction && !mentionsNigeria) {
    return {
      kind: 'block',
      reason: 'foreign_law',
      message:
        'This chat is limited to Nigerian law. If you want, ask the question again from a Nigerian-law perspective and include the relevant facts.',
    };
  }

  if (!looksLegal) {
    return {
      kind: 'block',
      reason: 'non_legal',
      message:
        'I am limited to Nigerian law and legal education. Ask me about Nigerian rights, courts, statutes, police procedure, tenancy, employment, contracts, criminal law, or similar legal topics.',
    };
  }

  if (!mentionsNigeria) {
    return {
      kind: 'allow',
      mode: 'clarify_nigeria',
      normalizedQuestion,
    };
  }

  return {
    kind: 'allow',
    mode: 'nigerian_law',
    normalizedQuestion,
  };
}


export function buildClarificationReply(question: string): string {
  return [
    'I can answer that only from a Nigerian-law perspective.',
    'If your question is about Nigeria, ask again with the relevant facts and, where relevant, whether the issue is federal or state-based.',
    `Your question: "${question.trim()}"`,
    '',
    'Example: "Under Nigerian law, can my landlord evict me without notice in Lagos?"',
  ].join('\n');
}

export function buildInsufficientContextReply(): string {
  return [
    'I do not have enough reliable Nigerian legal material in the current knowledge base to answer that safely.',
    'Please ask a narrower Nigerian-law question or add the key facts, such as the state, court stage, contract terms, arrest timeline, or the specific statute or issue involved.',
    '',
    'This is educational information, not legal advice.',
  ].join('\n');
}

export function buildGuardrailPrompt(contextBlock?: string): string {
  const sections = [
    'You are Gamell AI, an educational legal assistant restricted to Nigerian law.',
    'You must answer only within Nigerian law and Nigerian legal institutions.',
    'If the user asks about another country, refuse briefly and say you are limited to Nigerian law.',
    'Do not answer non-legal questions except to redirect the user back to Nigerian law topics.',
    'Never fabricate statutes, sections, case names, case citations, courts, years, or quotations.',
    'Use trusted Nigerian legal sources as the basis for every substantive answer.',
    'If trustworthy Nigerian legal support is insufficient, say so plainly instead of guessing.',
    'Do not give instructions for evading arrest, bribery, forgery, hiding assets, evidence tampering, lying to police, or other unlawful conduct.',
    'Do not present yourself as a lawyer and do not claim to provide legal advice.',
    'Write in plain English and be specific to Nigerian law.',
    'Use this answer structure exactly:',
    '1. Short answer',
    '2. Relevant Nigerian law',
    '3. Practical next steps',
    '4. Important limits',
    '5. This is educational information, not legal advice.',
    'If facts are missing, say which facts matter.',
    'If you mention a source, only mention one that appears in the supplied context.',
  ];

  if (contextBlock) {
    sections.push('Only use the following Nigerian legal materials as authority:');
    sections.push(contextBlock);
  }

  return sections.join('\n');
}

export function buildAnswerPrompt(question: string, contextBlock?: string): string {
  if (!contextBlock) {
    return `Answer this question only if you can do so safely from Nigerian law without inventing authority.\n\nQUESTION: ${question}`;
  }

  return [
    'Answer the question using only the Nigerian legal context below.',
    '',
    'CONTEXT:',
    contextBlock,
    '',
    `QUESTION: ${question}`,
  ].join('\n');
}
