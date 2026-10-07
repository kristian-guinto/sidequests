create table public.weekly_summaries (
    id bigserial primary key,
    proposition_id text not null unique,
    week_start date not null,
    week_end date not null,
    summary text, 
    key_drivers text,
    trend_verdict text,
    outlook text,
    created_at timestamptz default now(),

    constraint fk_proposition_id
        foreign key (proposition_id)
        references public.propositions(proposition_id)
        on delete cascade
);

create unique index idx_weekly_summaries_unique
    on public.weekly_summaries (proposition_id, week_end);

create index idx_weekly_summaries_proposition_id
    on public.weekly_summaries (proposition_id, week_end desc);
