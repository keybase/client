package libkb

import (
	"fmt"
	"sync"
)

type VerboseLockRelease = func()

type VerboseLock struct {
	mu    sync.Mutex
	level VDebugLevel
	name  string
}

func NewVerboseLock(level VDebugLevel, name string) *VerboseLock {
	return &VerboseLock{
		level: level,
		name:  name,
	}
}

func (l *VerboseLock) Acquire(mctx MetaContext, reasonFormat string, args ...interface{}) (release VerboseLockRelease) {
	reason := fmt.Sprintf(reasonFormat, args...)
	log := func(symbol string, word string) {
		mctx.VLogf(l.level, "%v VerboseLock [%v] %v: %v", symbol, l.name, word, reason)
	}
	log("+", "acquiring")
	l.mu.Lock()
	log("|", "acquired")
	return func() {
		l.mu.Unlock()
		log("-", "released")
	}
}
