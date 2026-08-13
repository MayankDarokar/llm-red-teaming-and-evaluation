# LLM Red-Teaming & Evaluation Agent System

A web-based AI security platform that automatically tests Large Language Models (LLMs) for vulnerabilities, unsafe behavior, and jailbreak susceptibility.

The system acts as an **AI security tester**:

**Target LLM → Adversarial Prompt Generator → LLM Testing → AI Judge → Analysis → Report Dashboard**

## What the Project Does

- Generates adversarial and jailbreak prompts.
- Sends them to a target LLM.
- Evaluates the LLM's responses using an AI Judge.
- Identifies vulnerabilities, unsafe responses, and failures.
- Assigns security/evaluation scores.
- Stores test history and results in a database.
- Provides a dashboard with visualizations and detailed reports.
- Eventually becomes a complete deployed full-stack application.

> **The project does not build an LLM. It builds an automated system that tests and evaluates existing LLMs for security and reliability.**