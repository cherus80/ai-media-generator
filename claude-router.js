#!/usr/bin/env node

/**
 * Claude Code Router - Intelligent Agent/Skill/Hook Selector
 * Usage: node claude-router.js "your task description"
 */

const projectIndex = require('./.claude/project-index.json');

const routes = {
  frontend: {
    keywords: ['ui', 'интерфейс', 'кнопка', 'дизайн', 'react', 'typescript', 'component', 'css', 'tailwind'],
    agents: ['frontend-developer', 'ui-ux-designer'],
    skills: ['development/artifacts-builder', 'creative-design/theme-factory'],
    hooks: ['development-tools/lint-on-save', 'post-tool/format-javascript-files'],
    description: '🎨 Frontend/UI Development'
  },
  
  backend: {
    keywords: ['api', 'endpoint', 'база', 'fastapi', 'python', 'sqlalchemy', 'pydantic', 'db'],
    agents: ['backend-architect', 'fullstack-developer'],
    skills: ['development/mcp-builder'],
    hooks: ['post-tool/run-tests-after-changes', 'security/security-scanner'],
    description: '⚙️ Backend/API Development'
  },
  
  tryOn: {
    keywords: ['фото', 'примерка', 'обработка', 'загрузка', 'upload', 'photo', 'kie.ai', 'face', 'pose'],
    agents: ['ai-engineer', 'prompt-engineer', 'backend-architect'],
    skills: ['development/webapp-testing'],
    hooks: ['automation/telegram-notifications'],
    description: '📸 Image Processing / Virtual Try-On'
  },
  
  telegram: {
    keywords: ['telegram', 'бот', 'уведомление', 'webhook', 'webApp', 'tg bot'],
    agents: ['backend-architect', 'fullstack-developer'],
    hooks: ['automation/telegram-notifications', 'automation/telegram-detailed-notifications'],
    description: '📱 Telegram Bot / Notifications'
  },
  
  testing: {
    keywords: ['тест', 'ошибка', 'bug', 'debug', 'quality', 'test', 'error'],
    agents: ['test-engineer-debugger', 'backend-architect'],
    hooks: ['testing/test-runner', 'security/security-scanner'],
    description: '🧪 Testing & Debugging'
  },
  
  devops: {
    keywords: ['docker', 'deploy', 'vps', 'production', 'environment', '.env', 'docker-compose', 'portainer'],
    agents: ['devops-engineer', 'deployment-engineer'],
    hooks: ['git-workflow/smart-commit', 'automation/telegram-notifications'],
    description: '🚀 Deployment / DevOps'
  }
};

function detectRoute(userQuery) {
  const query = userQuery.toLowerCase();
  let bestMatch = { route: 'backend', score: 0 };

  for (const [routeName, config] of Object.entries(routes)) {
    const matchScore = config.keywords.filter(kw => query.includes(kw)).length;
    if (matchScore > bestMatch.score) {
      bestMatch = { route: routeName, score: matchScore };
    }
  }

  return routes[bestMatch.route];
}

function generateReport(userQuery) {
  const route = detectRoute(userQuery);
  
  console.log('\n✅ CLAUDE CODE ROUTING SUGGESTION\n');
  console.log(`📌 Task: "${userQuery}"\n`);
  console.log(`${route.description}\n`);
  console.log(`🤖 Agents: ${route.agents.join(', ')}`);
  console.log(`🎨 Skills: ${route.skills.join(', ')}`);
  console.log(`🪝 Hooks: ${route.hooks.join(', ')}`);
  console.log('\n🔗 Use project-index.json for file paths\n');
}

const userQuery = process.argv[2];
if (userQuery) {
  generateReport(userQuery);
} else {
  console.log('Usage: node claude-router.js "your task description"');
}

module.exports = { detectRoute, generateReport };
