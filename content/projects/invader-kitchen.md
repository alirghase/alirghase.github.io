---
title: Which invasive species near me can I safely eat?
name: Invader Kitchen
status: Now
launch: 14 Nov 2026
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
The first version, out on 14 November, covers 10 UK invasive species: plants, shellfish and
crayfish.

- Ask Invader Kitchen a question and a team of agents works on the answer. A Coordinator passes it
  to a Forager agent, which finds what's near you, in season and on land you can access. An
  Identifier checks photos. A Safety reviewer has to approve anything marked edible, and a check
  written in code runs last. If any step fails, the answer is "unsure".
- Send it a photo and it answers "invasive and edible", "unsure", or "stop: protected or toxic
  lookalike".
- The agents use 8 free data tools: species records, invasive status, a sourced profile of each
  species and its season, the law, water quality, shellfish harvesting zones, open-access land, and
  photo ID.
- An MCP server lets other AI agents use the same tools.

## How I'll measure it
I write the test sets before the agents.

1. Invasive status, checked against official country checklists (GRIIS).
2. How many protected or toxic lookalikes it calls safe to eat. The target is zero.
3. Legal answers, checked against official guidance.
4. Whether the agents run every safety check before saying "edible", every time.
5. What happens when a data source goes down or someone tries to trick it. It should never say
   "edible".
6. ForageSafe-mini: how often AI vision models on their own call a toxic lookalike edible, compared
   with the full system.

## Later
- A world map of the edible invasive species in each country.
- A pilot with a wildlife or rivers trust, using their own data to decide where to remove invasive
  species first.
- ForageSafe as a public benchmark that anyone can run their model on.

It uses free public data from the NBN Atlas, GBIF, GRIIS, iNaturalist, the Environment Agency, the
Food Standards Agency and Natural England.
