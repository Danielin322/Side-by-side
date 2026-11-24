// Whole-note embeddings with Cohere Embed Multilingual on Amazon Bedrock. One note = one vector, no chunking.

import { InvokeModelCommand, type BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

export const EMBED_DIM = 1024;
// The same input type for stored notes and new notes: we compare note to note, not a short query to a long document.
const INPUT_TYPE = "classification";
const MAX_TEXTS_PER_CALL = 96; // Cohere's limit per request

export async function embedNotes(client: BedrockRuntimeClient, modelId: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_TEXTS_PER_CALL) {
    const batch = texts.slice(i, i + MAX_TEXTS_PER_CALL);
    const res = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({ texts: batch, input_type: INPUT_TYPE, truncate: "END" }),
      }),
    );
    const parsed = JSON.parse(new TextDecoder().decode(res.body)) as { embeddings?: unknown };
    const embeddings = parsed.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
      throw new Error(`Embedding response had ${Array.isArray(embeddings) ? embeddings.length : "no"} vectors for ${batch.length} texts`);
    }
    for (const v of embeddings) {
      if (!Array.isArray(v) || v.length !== EMBED_DIM) throw new Error(`Expected ${EMBED_DIM}-dim vectors, got ${Array.isArray(v) ? v.length : typeof v}`);
      out.push(v as number[]);
    }
  }
  return out;
}
