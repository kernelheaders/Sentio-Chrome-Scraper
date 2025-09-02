# Contributing to Sentio Chrome Extension

We welcome contributions to the Sentio Chrome Extension! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Chrome/Chromium browser for testing
- Git

### Setting up Development Environment

1. **Fork and clone the repository**
```bash
git clone https://github.com/your-username/sentio-chrome-extension.git
cd sentio-chrome-extension
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment**
```bash
cp .env.example .env
# Edit .env with appropriate values
```

4. **Build and test**
```bash
npm run build:dev
npm test
```

5. **Load extension in Chrome**
- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `build` folder

## 📋 Contribution Guidelines

### Types of Contributions

We accept the following types of contributions:

- 🐛 **Bug fixes** - Fix issues in existing functionality
- ✨ **New features** - Add new capabilities (must align with project goals)
- 📚 **Documentation** - Improve or add documentation
- 🧪 **Tests** - Add or improve test coverage
- ⚡ **Performance** - Optimize existing code
- 🔒 **Security** - Address security vulnerabilities

### What We Don't Accept

- Features that compromise user lock-in mechanisms
- Changes that allow offline operation
- Local data storage or export functionality
- Bypass mechanisms for API authentication
- Features that conflict with Chrome Web Store policies

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `bugfix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/improvements

### 2. Development Process

1. **Write code following our standards**
   - Use ESLint configuration
   - Follow existing code patterns
   - Add appropriate comments
   - Ensure security best practices

2. **Add tests**
   - Unit tests for new functions
   - Integration tests for features
   - Security tests for sensitive code
   - Performance tests for optimizations

3. **Update documentation**
   - Update README if needed
   - Add/update code comments
   - Update API documentation
   - Add changelog entries

### 3. Code Quality Checks

Before submitting, ensure your code passes all checks:

```bash
# Linting
npm run lint

# Type checking (if applicable)
npm run type-check

# Tests
npm test

# Build
npm run build

# Security audit
npm audit
```

### 4. Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build/maintenance tasks

Examples:
```
feat(api): add job retry mechanism
fix(content): resolve DOM extraction timeout
docs(readme): update installation instructions
```

### 5. Pull Request Process

1. **Create Pull Request**
   - Use descriptive title
   - Fill out PR template completely
   - Link related issues
   - Add appropriate labels

2. **PR Requirements**
   - All tests must pass
   - Code coverage maintained/improved
   - Security review completed
   - Documentation updated
   - No merge conflicts

3. **Review Process**
   - At least one maintainer review required
   - Security review for sensitive changes
   - Performance review for optimization PRs
   - All feedback addressed

## 🧪 Testing Guidelines

### Test Structure

```
tests/
├── unit/                 # Unit tests
├── integration/          # Integration tests
├── security/            # Security tests
├── performance/         # Performance benchmarks
└── fixtures/            # Test data
```

### Writing Tests

1. **Unit Tests**
```javascript
describe('ApiClient', () => {
  it('should validate API key format', async () => {
    const result = await apiClient.validateApiKey('invalid');
    expect(result).toBe(false);
  });
});
```

2. **Integration Tests**
```javascript
describe('Job Execution Flow', () => {
  it('should complete full job lifecycle', async () => {
    // Test complete flow from job receipt to result submission
  });
});
```

3. **Security Tests**
```javascript
describe('Security', () => {
  it('should not expose API key in error messages', () => {
    // Test for sensitive data leaks
  });
});
```

### Test Coverage

Maintain minimum test coverage levels:
- **Unit tests**: 90% line coverage
- **Integration tests**: Critical paths covered
- **Security tests**: All sensitive functions

## 🔒 Security Guidelines

### Security Requirements

1. **API Key Security**
   - Never log or expose API keys
   - Use encryption for storage
   - Implement proper rotation

2. **Data Protection**
   - No sensitive data in logs
   - Secure data transmission
   - Immediate cleanup after use

3. **Input Validation**
   - Validate all inputs
   - Sanitize user data
   - Prevent injection attacks

4. **Error Handling**
   - No sensitive info in error messages
   - Proper error logging
   - Graceful failure modes

### Security Review Process

1. **Automated Scanning**
   - ESLint security rules
   - Dependency vulnerability scans
   - Code pattern analysis

2. **Manual Review**
   - Security team review for sensitive changes
   - Threat modeling for new features
   - Penetration testing for major releases

## 📝 Documentation Standards

### Code Documentation

1. **Function Documentation**
```javascript
/**
 * Validate API key format and authenticate with server
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} True if valid, false otherwise
 * @throws {Error} When network request fails
 */
async function validateApiKey(apiKey) {
  // Implementation
}
```

2. **Class Documentation**
```javascript
/**
 * Secure API client for Sentio service
 * Handles authentication, rate limiting, and error recovery
 */
class ApiClient {
  // Implementation
}
```

### README Updates

- Keep README.md current with features
- Update installation instructions
- Maintain accurate API documentation
- Include troubleshooting guides

## 🚨 Reporting Issues

### Bug Reports

Use the bug report template and include:
- Chrome version and OS
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
- Screenshots (if relevant)

### Security Vulnerabilities

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email security@sentio.com
2. Include detailed vulnerability description
3. Provide proof of concept (if safe)
4. Allow 90 days for response before disclosure

### Feature Requests

Use the feature request template and include:
- Clear description of the feature
- Use case and business value
- Proposed implementation approach
- Consideration of user lock-in implications

## 👥 Community Guidelines

### Code of Conduct

We follow the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

Key points:
- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment
- Report violations to conduct@sentio.com

### Communication

- **GitHub Issues**: Bug reports, feature requests
- **Pull Requests**: Code discussions
- **Email**: Security issues, private matters
- **Discord**: Community chat (invite on request)

### Recognition

Contributors are recognized through:
- GitHub contributor graphs
- Changelog acknowledgments
- Annual contributor awards
- Referral bonuses for significant contributions

## 📚 Resources

### Documentation

- [Chrome Extension Development](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Web Scraping Ethics](https://blog.apify.com/web-scraping-ethics/)
- [Security Best Practices](https://owasp.org/www-project-top-ten/)

### Tools

- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Extension Development Tools](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)
- [Security Testing Tools](https://owasp.org/www-community/Free_for_Open_Source_Application_Security_Tools)

### Learning Resources

- [JavaScript Best Practices](https://github.com/ryanmcdermott/clean-code-javascript)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Security Guidelines](https://github.com/OWASP/CheatSheetSeries)

## 🎉 Recognition

We appreciate all contributions! Contributors will be:

- Listed in our contributors section
- Mentioned in release notes
- Eligible for contributor swag
- Invited to contributor-only events

Thank you for helping make Sentio Chrome Extension better! 🚀

---

**Questions?** Feel free to reach out:
- Email: dev@sentio.com
- GitHub: Create an issue with the "question" label
- Discord: Request invite via GitHub issue