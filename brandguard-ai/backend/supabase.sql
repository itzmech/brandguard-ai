create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'changes_requested')),
  findings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
