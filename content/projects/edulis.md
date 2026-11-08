---
title: Which invasive species near me can I safely eat?
name: Edulis
status: Now
launch: 29 Nov 2026
what: A team of agents that checks local records, the season, the law, water quality and toxic lookalikes before it calls anything edible. If it isn't sure, it says so.
who: Foragers, anglers and invasive-species groups
ships: A web app, an MCP server and a write-up
number: How often it calls a protected or toxic lookalike safe to eat. The target is zero
stack:
  - Google ADK
  - Gemini on Vertex AI
  - BigQuery
  - Cloud Run
  - Terraform
  - MCP
---
Some invasive species are edible. Foraging them is only safe if you know what you've found,
whether you're allowed to take it, and whether the water it came from is clean.

## What it does
The first version, out on 29 November, covers 6 UK invasive species, including
crayfish and shellfish.

- Ask Edulis a question and a team of agents works on the answer. A Coordinator passes it
  to a Forager agent, which finds what's near you and in season. An
  Identifier checks photos. A Safety reviewer has to approve anything marked edible, and a check
  written in code runs last. If any step fails, the answer is "unsure".
- Send it a photo and it answers "invasive and edible", "unsure", or "stop: protected or toxic
  lookalike".
- The agents use 5 free data tools: species records, a sourced profile of each species with its
  season and lookalikes, the law, water quality (including shellfish harvesting zones), and photo ID.
- An MCP server lets other AI agents use the same tools.

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
7. Legal answers, checked against official guidance.
8. Every mistake sorted by cause, with what I changed and the score afterwards.
9. A forager or botanist checking 50 of its answers.

## Later
- More species, open-access land, and a world map of the edible invasive species in each country.
- A pilot with a wildlife or rivers trust, using their own data to decide where to remove invasive
  species first.
- ForageSafe as a public benchmark that anyone can run their model on.

It uses free public data from the NBN Atlas, GBIF, GRIIS, iNaturalist, the Environment Agency, the
Food Standards Agency and Natural England.
