# query-forge

A small tool for getting better at PostgreSQL. It does two things:

- **Generate**: describe what you want in plain English and get a Postgres query for your schema, with an explanation of how it works. You can run it, tweak it, and fix it when it breaks.
- **Practice**: pick a topic (joins, group by, CTEs, window functions, ...) and a difficulty, solve the exercise, and get your answer checked against the real result set.

Every query runs in the browser on [PGlite](https://pglite.dev), which is real Postgres compiled to WASM. There's no database to set up, and you can't break anything.

## Stack

- React + Vite on the frontend, with CodeMirror for the editor
- Express on the backend (only used to talk to the Gemini API)
- PGlite in a web worker for running SQL

## Running it

Coming soon.
