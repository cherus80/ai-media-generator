---
name: artifacts-builder
description: Build production-ready React components and FastAPI endpoints with complete implementation including tests, types, and documentation.
---

# Artifacts Builder Skill

This skill creates complete, production-ready code artifacts for the AI Media Generator project.

## Capabilities

### React Component Artifact
Creates a complete React component with:
- TypeScript interface for props
- Tailwind CSS styling
- State management (Zustand if needed)
- Error boundaries and loading states
- Accessibility attributes (ARIA labels)
- Unit test skeleton (Jest + React Testing Library)
- Usage example in comments

### FastAPI Endpoint Artifact
Creates a complete API endpoint with:
- Pydantic request/response schemas
- FastAPI route with dependency injection
- Service layer implementation
- SQLAlchemy model (if DB interaction)
- Error handling with structured exceptions
- Async/await patterns
- Unit tests with pytest
- API documentation (docstrings)

### Celery Task Artifact
Creates an async task with:
- Task definition with retry logic
- Error handling and logging
- Progress tracking (if applicable)
- Integration with external APIs
- Unit tests with mocked dependencies

## Usage Pattern

1. Identify the artifact type needed
2. Gather requirements (props, API params, DB schema)
3. Generate complete implementation
4. Include all related files (types, tests, schemas)
5. Provide usage examples

## Example Output Structure

### React Component
```
frontend/src/components/feature/
  ├── ComponentName.tsx
  ├── ComponentName.test.tsx
  └── types.ts
```

### API Endpoint
```
backend/app/
  ├── api/v1/endpoints/feature.py
  ├── schemas/feature.py
  ├── services/feature_service.py
  └── tests/test_feature.py
```

## Quality Standards

- ✅ Full code (no truncation or `... existing code ...`)
- ✅ Type safety (TypeScript/Pydantic)
- ✅ Error handling (try/catch, structured exceptions)
- ✅ Tests included (aim for critical path coverage)
- ✅ Documentation (JSDoc/docstrings)
- ✅ Follow project patterns (see existing code)

Reference CODE_RULES.md for quality requirements.
