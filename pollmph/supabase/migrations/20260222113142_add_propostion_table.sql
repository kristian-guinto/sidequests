create table public.propositions (
    id bigserial primary key,
    proposition_id text not null unique,
    proposition_text text not null,
    search_queries text[] not null
);

alter table public.sentiments 
add constraint fk_proposition_id 
foreign key (proposition_id) 
references public.propositions(proposition_id) 
on update cascade
on delete set null;