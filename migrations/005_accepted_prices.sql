-- Stocke les prix réellement acceptés par les clients.
-- Utilisé comme few-shot context pour l'agent de tarification.
create table if not exists accepted_prices (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid references missions(id) on delete set null,
  category     text not null,
  quartier     text not null default 'Cocody',
  urgency      text not null default 'medium',
  hours        float not null default 2,
  materials_count int not null default 0,
  description_short text,
  final_price  int not null,
  artisan_percoit int,
  created_at   timestamptz default now()
);

create index if not exists accepted_prices_category_idx on accepted_prices(category);
create index if not exists accepted_prices_created_at_idx on accepted_prices(created_at desc);

-- RLS : lecture publique (l'agent pricing tourne côté serveur avec service role)
alter table accepted_prices enable row level security;
create policy "service role full access" on accepted_prices
  using (true) with check (true);
