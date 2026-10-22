import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Review } from './types';

type ReviewInput = Pick<Review, 'content' | 'findings'>;

let supabase: SupabaseClient | undefined;

function getSupabaseClient(): SupabaseClient {
  if (supabase) {
    return supabase;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase is not configured');
  }

  supabase = createClient(url, serviceKey);
  return supabase;
}

export async function createReview(input: ReviewInput): Promise<Review> {
  const { data, error } = await getSupabaseClient()
    .from('reviews')
    .insert({
      content: input.content,
      status: 'draft',
      findings: input.findings,
    })
    .select('id, content, status, findings, updated_at')
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Review creation returned no data');
  }

  return data;
}

export async function getReview(id: string): Promise<Review | null> {
  const { data, error } = await getSupabaseClient()
    .from('reviews')
    .select('id, content, status, findings, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateReview(
  id: string,
  input: ReviewInput,
): Promise<Review | null> {
  const { data, error } = await getSupabaseClient()
    .from('reviews')
    .update({
      content: input.content,
      findings: input.findings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .not('status', 'in', '(pending_approval,approved)')
    .select('id, content, status, findings, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function changeReviewStatus(
  id: string,
  status: Review['status'],
  allowedCurrentStatuses: Review['status'][],
): Promise<Review | null> {
  const { data, error } = await getSupabaseClient()
    .from('reviews')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', allowedCurrentStatuses)
    .select('id, content, status, findings, updated_at')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
