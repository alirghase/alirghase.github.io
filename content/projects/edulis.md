---
title: Which invasive species near me can I safely eat?
name: Edulis
status: In progress
what: A team of agents that checks local records, the season, the law, water quality and toxic lookalikes before it calls anything edible. If it isn't sure, it says so.
number: How often it calls a protected or toxic lookalike safe to eat. The target is zero
stack:
  - Google ADK
  - Gemini on Vertex AI
  - BigQuery
  - Cloud Run
  - MCP
---
Some invasive species in Britain are good to eat, but it's easy to get wrong: edible Alexanders
looks a lot like hemlock water dropwort, one of the most poisonous plants in the UK. The facts
are public but scattered across a dozen sources, and a general chatbot will happily guess.

Edulis answers with one of three verdicts (**invasive and edible**, **unsure**, or **stop**),
with a source for every claim. It uses free public data from the NBN Atlas, iNaturalist, the
Environment Agency, the Food Standards Agency and Natural England.
