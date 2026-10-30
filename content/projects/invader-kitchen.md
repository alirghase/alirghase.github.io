---
title: Which invasive species near me can I safely eat?
name: Invader Kitchen
status: Now
launch: 14 Nov 2026
what: An agent that checks local records, the season, the law, water quality and toxic lookalikes before it calls anything edible. If it isn't sure, it says so.
who: Foragers, anglers and invasive-species groups
ships: A web app, an MCP server and a write-up
number: How often it calls a protected or toxic lookalike safe to eat. The target is zero
stack:
  - Google ADK
  - Gemini
  - BigQuery
  - Cloud Run
  - Terraform
  - MCP
---
Some invasive species are edible. Foraging them is only safe if you know what you've found,
whether you're allowed to take it, and whether the water it came from is clean.

## What it does
- Ask Invader Kitchen a question and a team of agents works on the answer. A Forager agent finds
  what's near you, in season and on land you can access. An Identifier checks photos. A Safety
  reviewer has to approve anything marked edible, and a code check runs last. If any step fails,
  the answer is "unsure".
- Send it a photo and it answers "invasive and edible", "unsure", or "stop: protected or toxic
  lookalike".
- An MCP server lets other AI agents use the same tools.

## How I'll measure it
1. Invasive status, checked against official country checklists (GRIIS).
2. How many protected or toxic lookalikes it calls safe to eat. The target is zero.
3. Legal answers, checked against official guidance.
4. Whether the agents check the rules and lookalikes every time before saying "edible".
5. ForageSafe: how often AI vision models on their own call a toxic lookalike edible, compared with
   the full system.

It uses free public data from GBIF, GRIIS, iNaturalist and the Environment Agency.
