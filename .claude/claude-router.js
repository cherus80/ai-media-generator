module.exports = {
  project: 'AI Media Generator (web)',
  routes: [
    {
      name: 'frontend',
      description: 'React/Vite UI, Zustand, Tailwind',
      keywords: ['react', 'component', 'ui', 'vite', 'tailwind'],
      hooks: ['development-tools/lint-on-save']
    },
    {
      name: 'backend',
      description: 'FastAPI, Celery, PostgreSQL, Redis, anti-abuse',
      keywords: ['fastapi', 'celery', 'postgres', 'redis', 'billing', 'yookassa'],
      hooks: ['post-tool/run-tests-after-changes', 'security/security-scanner']
    },
    {
      name: 'ai-processing',
      description: 'Virtual try-on, kie.ai integration, queues',
      keywords: ['try-on', 'kie', 'image', 'credits'],
      hooks: ['development/artifacts-builder']
    },
    {
      name: 'security',
      description: 'Hardening, rate limiting, device fingerprinting',
      keywords: ['security', 'abuse', 'fraud', 'fingerprint', 'compliance'],
      hooks: ['security/security-scanner']
    },
    {
      name: 'devops',
      description: 'Docker, nginx, VPS, backups',
      keywords: ['docker', 'nginx', 'deploy', 'vps'],
      hooks: ['git-workflow/smart-commit']
    }
  ]
};
