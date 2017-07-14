package libkb

import (
	"sync"

	"golang.org/x/net/context"
)

// A guard used to tell background tasks to stay off the sigchain
// while the user is changing their sigchain on purpose.
// Don't treat this as a lock, it's very sloppy.
// The guard exists to avoid races where an intentional action like provisioning
// loads the sigchain, but then it gets changed by a background task,
// so the intentional action would fail.
// This is just an atomic bool. Intentional actions can acquire it
// multiple times, release it even when others have it,
// so it's sloppy, but you'll never deadlock.
type LocalSigchainGuard struct {
	Contextified
	mu       sync.Mutex
	acquired bool
}

func NewLocalSigchainGuard(g *GlobalContext) *LocalSigchainGuard {
	return &LocalSigchainGuard{
		Contextified: NewContextified(g),
		acquired:     false,
	}
}

func (l *LocalSigchainGuard) Set(ctx context.Context, reason string) {
	l.G().Log.CDebugf(ctx, "LocalSigchainGuard#Set(%v)", reason)
	l.mu.Lock()
	defer l.mu.Unlock()
	l.acquired = true
}

func (l *LocalSigchainGuard) Clear(ctx context.Context, reason string) {
	l.G().Log.CDebugf(ctx, "LocalSigchainGuard#Clear(%v)", reason)
	l.mu.Lock()
	defer l.mu.Unlock()
	l.acquired = false
}

func (l *LocalSigchainGuard) IsAvailable(ctx context.Context, reason string) bool {
	l.mu.Lock()
	acquired := l.acquired
	l.mu.Unlock()
	l.G().Log.CDebugf(ctx, "LocalSigchainGuard#IsAvailable(%v) -> %v", reason, !acquired)
	return !acquired
}
