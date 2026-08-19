# Internova Langfuse Observability backend

This module traces the RAG pipeline into Langfuse and exposes a backend-only read API for the Internova admin console.

Public browser code never receives the Langfuse secret key. The FastAPI backend queries Langfuse Public API using Basic Auth.

The router intentionally does not invent a new authentication system. Mount it behind the same admin authorization dependency/middleware already used by Internova.
