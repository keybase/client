# Contributing to Keybase Client

Thank you for your interest in contributing to the Keybase client! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Good First Issues](#good-first-issues)
- [Security](#security)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions with other contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone git@github.com:YOUR_USERNAME/client-fork.git
   cd client-fork
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream git@github.com:keycase/client-fork.git
   ```
4. **Keep your fork updated**:
   ```bash
   git fetch upstream
   git checkout master
   git merge upstream/master
   ```

## Development Setup

### Prerequisites

- **Go 1.19+** for backend development
- **Node.js 14+** and **Yarn** for frontend development
- **Xcode** (macOS) for iOS development
- **Android Studio** for Android development
- **Docker** (optional) for containerized development

### Building the Project

#### Go/Backend
```bash
cd go
go install -tags production github.com/keybase/client/go/keybase
```

#### React Native (Mobile)
```bash
cd shared
yarn install
# iOS
cd ios && pod install
# Android
cd android && ./gradlew assembleDebug
```

#### Electron (Desktop)
```bash
cd shared
yarn install
yarn run package
```

### Pre-commit Hooks

We use pre-commit hooks to ensure code quality:

```bash
# Install pre-commit
pip install pre-commit  # or: brew install pre-commit

# Set up hooks
pre-commit install
```

## How to Contribute

### Finding Work

1. **Check existing issues** on GitHub
2. **Look for TODO/FIXME comments** in the code:
   ```bash
   grep -r "TODO\|FIXME" --include="*.go" --include="*.js" --include="*.tsx"
   ```
3. **Review recent commits** for areas being actively developed
4. **Ask in discussions** if you need guidance

### Types of Contributions

- **Bug Fixes**: Address issues reported in GitHub Issues
- **Feature Implementation**: Work on planned features
- **Documentation**: Improve code comments, READMEs, and guides
- **Testing**: Add unit tests, integration tests, or e2e tests
- **Performance**: Optimize slow code paths
- **Refactoring**: Clean up technical debt

## Code Style Guidelines

### Go Code Style

- Follow standard Go formatting (`go fmt`)
- Use meaningful variable and function names
- Add comments for exported functions
- Keep functions focused and small
- Run `go vet` and `golint` before committing

Example:
```go
// GetUserByID retrieves a user by their ID from the database
func GetUserByID(ctx context.Context, userID string) (*User, error) {
    // Implementation here
}
```

### JavaScript/TypeScript Style

- Use TypeScript where possible
- Follow the existing ESLint configuration
- Use functional components for React
- Keep components small and focused
- Use meaningful prop names

Example:
```typescript
interface UserProfileProps {
  userId: string
  onUpdate: (user: User) => void
}

export const UserProfile: React.FC<UserProfileProps> = ({userId, onUpdate}) => {
  // Component implementation
}
```

### Commit Messages

- Use clear, descriptive commit messages
- Start with a verb in present tense
- Keep the first line under 72 characters
- Reference issue numbers when applicable

Good examples:
```
Add user authentication to chat module (#1234)
Fix memory leak in attachment uploader
Update dependencies for security patches
Refactor inbox rendering for better performance
```

## Testing

### Running Tests

#### Go Tests
```bash
cd go
go test ./...
# Or for a specific package
go test ./chat/...
```

#### JavaScript Tests
```bash
cd shared
yarn test
```

### Writing Tests

- Write tests for new features
- Add tests when fixing bugs (to prevent regression)
- Aim for meaningful test coverage, not 100% coverage
- Use table-driven tests in Go where appropriate
- Mock external dependencies

Example Go test:
```go
func TestGetUserByID(t *testing.T) {
    tests := []struct {
        name    string
        userID  string
        want    *User
        wantErr bool
    }{
        {
            name:   "valid user",
            userID: "user123",
            want:   &User{ID: "user123", Name: "Test User"},
        },
        {
            name:    "invalid user",
            userID:  "",
            wantErr: true,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := GetUserByID(context.Background(), tt.userID)
            if (err != nil) != tt.wantErr {
                t.Errorf("GetUserByID() error = %v, wantErr %v", err, tt.wantErr)
            }
            if !reflect.DeepEqual(got, tt.want) {
                t.Errorf("GetUserByID() = %v, want %v", got, tt.want)
            }
        })
    }
}
```

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write code
   - Add tests
   - Update documentation

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add feature: description of your changes"
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template
   - Link related issues

### PR Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Related Issues
Fixes #(issue number)

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
```

### Review Process

- PRs will be reviewed by maintainers
- Address feedback constructively
- Keep PRs focused and small when possible
- Be patient - reviews may take time

## Good First Issues

Here are areas particularly suitable for new contributors:

### Documentation
- Add missing documentation for Go packages
- Improve inline code comments
- Create examples for common use cases
- Update outdated documentation

### Small Bug Fixes
- Fix TODO/FIXME items in non-critical paths
- Address linting warnings
- Fix typos and improve error messages
- Clean up deprecated code

### Testing
- Add unit tests for untested functions
- Improve test coverage in chat modules
- Add integration tests for API endpoints
- Create test fixtures and helpers

### UI Improvements
- Fix minor UI inconsistencies
- Improve accessibility
- Add loading states
- Enhance error handling displays

### Example Good First Issue

**Issue: Add unit tests for `go/chat/attachments/uploader.go`**

The attachment uploader has several TODO comments indicating missing tests. This would be a great first contribution:

1. Review the existing code in `uploader.go`
2. Identify untested functions
3. Write comprehensive unit tests
4. Mock external dependencies (S3, file system)
5. Ensure tests cover error cases

## Security

### Reporting Security Issues

**Do not report security vulnerabilities through public GitHub issues.**

Instead, please report them to the maintainers directly through:
- Private message to repository maintainers
- Security advisory feature on GitHub

### Security Best Practices

When contributing:
- Never commit secrets, API keys, or passwords
- Use environment variables for sensitive configuration
- Follow cryptographic best practices
- Validate and sanitize all user input
- Be careful with error messages (don't leak sensitive info)

## Platform-Specific Guidelines

### iOS/macOS Development
- Test on multiple iOS versions
- Follow Apple's Human Interface Guidelines
- Use Swift where appropriate
- Test on both iPhone and iPad

### Android Development
- Test on multiple Android versions
- Follow Material Design guidelines
- Consider different screen sizes
- Test on both phones and tablets

### Windows Development
- Test on Windows 10 and 11
- Handle path separators correctly
- Consider UAC requirements
- Test with different user permissions

## Getting Help

If you need help:
1. Check existing documentation
2. Search closed issues for similar problems
3. Ask in GitHub Discussions
4. Reach out to maintainers

## Recognition

Contributors will be recognized in:
- Release notes
- Contributors list
- Project documentation

Thank you for contributing to make Keybase better for everyone!

## License

By contributing, you agree that your contributions will be licensed under the BSD 3-Clause License.