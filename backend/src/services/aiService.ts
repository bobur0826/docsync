// backend/src/services/aiService.ts

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { sql } from '../db/client.js';

// Lazy clients — only instantiated when an API key is actually present
function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateDocumentSummary(params: {
  docNumber: string;
  title: string;
  discipline: string;
  docType: string;
  project: string;
  version: string;
  status: string;
}): Promise<string> {
  const prompt = `You are a technical document management assistant for engineering projects.

Generate a concise one-paragraph plain-English summary of the following engineering document based on its metadata. Focus on what this document likely contains and its purpose in the project lifecycle.

Document Number: ${params.docNumber}
Title: ${params.title}
Discipline: ${params.discipline}
Document Type: ${params.docType}
Project: ${params.project}
Current Version: ${params.version}
Status: ${params.status}

Write the summary as if explaining it to a project stakeholder who is not deeply technical.`;

  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

export async function generateAndStoreEmbedding(
  documentId: string,
  tenantId: string,
  text: string
): Promise<void> {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'placeholder') {
    return; // Skip embeddings in dev without real keys
  }
  try {
    const response = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    const embedding = response.data[0].embedding;
    const vectorLiteral = `[${embedding.join(',')}]`;

    await sql`
      UPDATE documents
      SET embedding = ${vectorLiteral}::vector
      WHERE id = ${documentId} AND tenant_id = ${tenantId}
    `;
  } catch {
    // Silently skip if pgvector not installed
  }
}

export async function semanticSearch(
  tenantId: string,
  projectId: string | null,
  query: string,
  limit = 10
): Promise<{ id: string; docNumber: string; title: string; similarity: number }[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const embedding = response.data[0].embedding;
  const vectorLiteral = `[${embedding.join(',')}]`;

  if (projectId) {
    const rows = await sql<{ id: string; docNumber: string; title: string; similarity: number }[]>`
      SELECT id, doc_number, title,
             1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
      FROM documents
      WHERE tenant_id = ${tenantId}
        AND project_id = ${projectId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;
    return rows;
  }

  const rows = await sql<{ id: string; docNumber: string; title: string; similarity: number }[]>`
    SELECT id, doc_number, title,
           1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM documents
    WHERE tenant_id = ${tenantId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT ${limit}
  `;
  return rows;
}
