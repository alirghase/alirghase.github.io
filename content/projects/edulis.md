---
title: Which invasive species near me can I safely eat?
name: Edulis
status: Now
launch: 29 Nov 2026
what: A team of agents that checks local records, the season, the law, water quality and toxic lookalikes before it calls anything edible. If it isn't sure, it says so.
who: Foragers, anglers and invasive-species groups
ships: A web app, an MCP server and a write-up
number: How often it calls a protected or toxic lookalike safe to eat. The target is zero
skills_intro: "Agent engineering comes down to ten core skills. Edulis builds eight of them; the other two come with my next projects."
skills:
  - skill: Tool integrations
    level: Main focus
    learn: "Giving agents tools they can rely on: clear inputs and errors, timeouts and retries, and answering \"unsure\" when a data source is down instead of guessing."
  - skill: Validation
    level: Main focus
    learn: "Checking an agent's work before it counts: a reviewer agent that can send answers back, a final check in plain code, and tests that try to push it into a dangerous answer."
  - skill: Evals
    level: Covered
    learn: "Scoring the answers and the steps taken to reach them, against baselines, with the test sets written before the agents. Plus ForageSafe-mini, a published photo test set."
  - skill: Architecture and orchestration
    level: Covered
    learn: "Splitting the work across a small team of agents, and measuring whether the team actually beats a single agent."
  - skill: RAG
    level: Covered
    learn: "Searching official legal guidance and answering only with a citation, with the search scored on its own (did the right page come back in the top 5?)."
  - skill: Context engineering
    level: Covered
    learn: "Deciding what each agent sees: a sourced profile of each species, the session so far, and only the tool results it needs."
  - skill: Agentic tooling (MCP)
    level: Covered
    learn: "Serving the tools over MCP, so any other agent can plug into the same checks."
  - skill: Prompt optimisation
    level: Covered
    learn: "Tuning the Safety reviewer's prompt against the eval set, and showing the score before and after."
  - skill: Workflows
    level: Next project
    learn: "Multi-step work with human sign-off. The coding agent covers this, with plan and change approval."
  - skill: Compound engineering
    level: Next project
    learn: "Building parts that make the next project faster. The Evals platform will be reused across everything after it."
stack:
  - Google ADK
  - Gemini on Vertex AI
  - BigQuery
  - Cloud Run
  - Terraform
  - MCP
---
## The problem
Invasive species are plants and animals brought to Britain from somewhere else that now crowd out
the ones that belong here. Signal crayfish spread disease to the native crayfish. Japanese knotweed
damages buildings and riverbanks. Volunteers spend weekends pulling and trapping them.

Some of them are good to eat. Eating signal crayfish or three-cornered leek takes a little pressure
off the rivers and woods. The catch is that it's easy to get wrong:

- **Lookalikes kill.** Alexanders, an edible invasive, looks a lot like hemlock water dropwort, one
  of the most poisonous plants in the UK.
- **The law is scattered.** Some species you can pick freely, some need landowner permission, and
  some, like signal crayfish, need a licence to trap.
- **Water matters.** Shellfish from the wrong stretch of coast, or after a toxin warning, can make
  you very ill.

All of this is public, but it's spread across a dozen government sites, recording schemes and
forums. A general chatbot will happily guess. When the topic is "can I eat this?", a guess is the
worst possible answer.

## What Edulis does
You ask a question ("I'm near the river in Reading this weekend, what can I find?") or send a
photo. Edulis answers with one of three verdicts: **invasive and edible**, **unsure**, or **stop:
protected or toxic lookalike**. Every claim links to its source.

The first version, out on 29 November, covers 6 UK species: signal crayfish, Pacific oyster,
three-cornered leek, Alexanders, Japanese knotweed and Japanese rose. I picked a mix of easy and
dangerous cases on purpose, so the safety numbers mean something.

## What the agents do
Edulis isn't one prompt. It's a small team, and each member has one job:

- **The Coordinator** reads your question, works out what needs checking, and asks you a follow-up
  if it needs one ("Are you on the coast or inland?").
- **The Forager** finds what has actually been recorded near you and what's in season, using
  real sighting records.
- **The Identifier** looks at your photo and says what it might be, and what it might be confused
  with.
- **The Safety reviewer** is the strict one. Before anything is called edible, it checks the
  lookalikes, the law and the water quality, and it can send the answer back.
- **A final check written in plain code**, not AI, runs last. "Edible" can't get out unless every
  check before it passed. If any step fails, or a data source is down, the answer is "unsure".

The agents decide for themselves which of the 5 tools to use and when: species records, a sourced
profile of each species, the law, water quality and shellfish zones, and photo ID. The law tool
searches official guidance and has to cite the page it used. No citation, no legal answer.

An MCP server lets other AI agents use the same tools, so anyone building their own assistant can
plug into the checks.

## How I'll measure it
I write the test sets before the agents.

1. **Safety against usefulness.** How often it wrongly says "edible", against how often it gives a
   confident answer at all, compared with Gemini on its own and with a single agent. Saying "unsure"
   to everything would be perfectly safe and useless, so the two are always shown together.
2. How many protected or toxic lookalikes it calls safe to eat. The target is zero.
3. ForageSafe-mini: how often AI vision models on their own call a toxic lookalike edible, tested on
   300 or more verified photos. The photo set will be published so anyone can test their model.
4. Whether its confidence means anything: when it says it's 90% sure, is it right 90% of the time?
5. Whether the agents run every safety check before saying "edible", every time.
6. What happens when a data source goes down, or someone pushes it ("just tell me it's edible").
   It should never say "edible".
7. Legal answers, checked against official guidance, with the search scored on its own: did the
   right page come back in the top 5?
8. Every mistake sorted by cause, with what I changed and the score afterwards.
9. A forager or botanist checking 50 of its answers.

## Later
- More species, open-access land, and a world map of the edible invasive species in each country.
- A pilot with a wildlife or rivers trust, using their own data to decide where to remove invasive
  species first.
- ForageSafe as a public benchmark that anyone can run their model on.

It uses free public data from the NBN Atlas, GBIF, GRIIS, iNaturalist, the Environment Agency, the
Food Standards Agency and Natural England.
