module.exports = {
  // Lint and fix TypeScript files (with type checking)
  '**/*.ts': ['eslint --fix --max-warnings=50', 'prettier --write'],
  // Lint and fix JavaScript files
  '**/*.js': ['eslint --fix --max-warnings=50', 'prettier --write'],
  // Format JSON files only (no linting needed)
  '**/*.json': ['prettier --write'],
  // Format Markdown files only (no linting needed)
  '**/*.md': ['prettier --write'],
};
