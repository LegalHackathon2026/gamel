// lib/supabase.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables in lib/supabase.js: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Store document chunks in the Supabase 'documents' table.
 * Expects the table to have: id, content, embedding, metadata.
 */
export async function storeChunks(chunks) {
  const { data, error } = await supabase
    .from("documents")
    .insert(chunks);

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
  return data;
}

/**
 * Log ingestion status to the 'ingestion_logs' table.
 */
export async function logIngestion({ source, sourceType, status, chunkCount, errorMsg }) {
  const { data, error } = await supabase
    .from("ingestion_logs")
    .insert([{
      source,
      source_type: sourceType,
      status,
      chunk_count: chunkCount,
      error_msg: errorMsg,
      created_at: new Date().toISOString()
    }]);

  if (error) {
    console.error("Failed to log ingestion:", error.message);
  }
  return data;
}
