---
title: Which invasive species near me can I safely eat?
name: Invader Kitchen
status: Now
launch: 14 Nov 2026
what: An agent that checks local records, the season, the legal rules, water quality and toxic lookalikes before it ever says "edible", and says "unsure" when it can't be sure.
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
Some invasive species are edible. But foraging is only safe if you're sure what you've found,
where you're allowed to take it, and whether the water it came from is clean.

## What it does
- **Ask Invader Kitchen:** an agent that plans each answer step by step: nearby records → season
  → legal rules → water quality → lookalike check. If any step fails, it says "unsure" instead of
  guessing.
- **A photo check:** "invasive and edible", "unsure", or **"stop: protected or toxic lookalike"**.
- **A world map** of the most invasive edible species in each country.
- **An MCP server**, so other AI agents can use the same tools.

## How I'll know it works
1. Invasive status checked against official country checklists (GRIIS).
2. **Zero** protected or toxic lookalikes called safe to eat.
3. Legal answers checked against official guidance.
4. The agent **always** checks the rules and lookalikes before saying "edible".

Built on free public data: GBIF, GRIIS, iNaturalist and the Environment Agency.
