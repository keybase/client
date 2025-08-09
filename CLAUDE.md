# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Go Backend Development (in `/go/` directory)
```bash
# Build
go install -tags production github.com/keybase/client/go/keybase

# Test
make test              # Run all tests
make testclean        # Clean test environment  
make cover            # Run tests with coverage

# Lint & Format
make fmt              # Format Go code
make vet              # Run go vet
make golangci-lint-nonkbfs  # Lint non-KBFS code
make golangci-lint-kbfs     # Lint KBFS code

# Service
keybase service       # Run local service
keybase ctl --help    # Control service
```

### React/React Native Development (in `/shared/` directory)
```bash
# Desktop Development
yarn start            # Start desktop app in dev mode
yarn start-hot        # Start with hot reloading
yarn build-dev        # Build development version
yarn build-prod       # Build production version

# Mobile Development  
yarn rn-start         # Start React Native packager
yarn rn-gobuild-ios   # Build Go components for iOS
yarn rn-gobuild-android # Build Go components for Android
yarn pod-install      # Install iOS CocoaPods

# Code Quality
yarn lint             # ESLint with TypeScript
yarn prettier-write-all # Format all code
yarn tsc              # TypeScript compilation check
yarn coverage         # TypeScript coverage
```

### Protocol Generation (in `/protocol/` directory)
```bash
make build            # Generate protocol files from AVDL
make clean            # Clean generated files
```

## Architecture Overview

**Keybase is a cryptographic communication platform with a service-based architecture:**

1. **Local Service Pattern**: A persistent Go service runs locally, handling all cryptographic operations, user management, and data storage. Multiple clients (CLI, desktop GUI, mobile apps) connect to this single service via RPC.

2. **Protocol-Driven Communication**: All inter-component communication uses AVDL (Avro IDL) defined protocols in `/protocol/`. These definitions auto-generate code for Go, TypeScript, and other languages, ensuring type-safe RPC across all platforms.

3. **Component Structure**:
   - `/go/`: Core service implementation including crypto operations, chat backend, KBFS (encrypted filesystem), Git integration, and Stellar wallet
   - `/shared/`: React-based frontend code shared between desktop (Electron) and mobile (React Native) apps
   - `/protocol/`: AVDL protocol definitions that generate bindings for all platforms
   - `/osx/`, `/android/`, `/ios/`: Platform-specific native code and build configurations

4. **Key Design Patterns**:
   - **Monorepo**: All platforms developed in single repository for consistency
   - **Code Generation**: Protocol definitions generate type-safe bindings automatically
   - **Service Abstraction**: Frontend apps are thin clients; all business logic in Go service
   - **Cross-Platform Code Sharing**: React components shared between desktop and mobile

5. **Security Architecture**:
   - All cryptographic operations handled by Go service (never in frontend)
   - Local key storage with platform-specific secure storage integration
   - Export-controlled cryptographic software with code signing for releases

When making changes:
- Protocol changes require regenerating bindings (`make build` in `/protocol/`)
- Go service changes may require restarting the service
- Frontend changes in `/shared/` affect both desktop and mobile apps
- Always run appropriate linters before committing (Go: `make fmt vet`, JS/TS: `yarn lint`)