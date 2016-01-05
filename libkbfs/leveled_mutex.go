package libkbfs

import (
	"fmt"
	"sync"
)

// The leveledMutex, leveledRWMutex, and lockState types enables a
// lock hierarchy to be checked. For a program (or subsystem), each
// (rw-)mutex must have a unique associated mutexLevel, which means
// that a (rw-)mutex must not be (r-)locked before another (rw-)mutex
// with a lower mutexLevel in a given execution flow. This is achieved
// by creating a new lockState at the start of an execution flow and
// passing it to the (r-)lock/(r-)unlock methods of each (rw-)mutex.
//
// TODO: Since we're keeping around this state, we may as well add
// assertHeld() functions and use them.
//
// TODO: Once this becomes a bottleneck, add a +build production
// version that stubs everything out.

// mutexLevel is the level for a mutex, which must be unique to that
// mutex.
type mutexLevel int

// exclusionState holds the state for a held mutex.
type exclusionState struct {
	// The level of the held mutex.
	level mutexLevel
	// If positive, a reader lock on the mutex is held. Otherwise,
	// a writer lock on the mutex is held.
	//
	// TODO: Turns out we don't really need readerCount anymore,
	// and just whether this is a reader or writer lock.
	readerCount int
}

// lockState holds the info regarding which level mutexes are held or
// not for a particular execution flow.
type lockState struct {
	levelToString func(mutexLevel) string

	// Protects exclusionStates.
	exclusionStatesLock sync.Mutex
	// The stack of held mutexes, ordered by increasing level.
	exclusionStates []exclusionState
}

// makeLevelState returns a new lockState. This must be called at the
// start of a new execution flow and passed to any leveledMutex or
// leveledRWMutex operation during that execution flow.
//
// TODO: Consider add a parameter to set the capacity of
// exclusionStates.
func makeLevelState(levelToString func(mutexLevel) string) *lockState {
	return &lockState{
		levelToString: levelToString,
	}
}

// currLocked returns the current exclusion state, or nil if there is
// none.
func (state *lockState) currLocked() *exclusionState {
	stateCount := len(state.exclusionStates)
	if stateCount == 0 {
		return nil
	}
	return &state.exclusionStates[stateCount-1]
}

func (state *lockState) pushLocked(exclusionState exclusionState) {
	state.exclusionStates = append(state.exclusionStates, exclusionState)
}

func (state *lockState) popLocked() {
	state.exclusionStates = state.exclusionStates[:len(state.exclusionStates)-1]
}

type levelViolationError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	isRLock       bool
	curr          exclusionState
}

func (e levelViolationError) Error() string {
	var prefix, currPrefix string
	if e.isRLock {
		prefix = "R"
	}
	if e.curr.readerCount > 0 {
		currPrefix = "R"
	}
	return fmt.Sprintf("level violation: %s %sLocked after %s %sLocked",
		e.levelToString(e.level), prefix, e.levelToString(e.curr.level),
		currPrefix)
}

func (state *lockState) afterLock(level mutexLevel) error {
	state.exclusionStatesLock.Lock()
	defer state.exclusionStatesLock.Unlock()

	curr := state.currLocked()

	if curr != nil && level <= curr.level {
		return levelViolationError{
			levelToString: state.levelToString,
			level:         level,
			isRLock:       false,
			curr:          *curr,
		}
	}

	state.pushLocked(exclusionState{level: level, readerCount: 0})
	return nil
}

type danglingUnlockError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	isRUnlock     bool
}

func (e danglingUnlockError) Error() string {
	var prefix string
	if e.isRUnlock {
		prefix = "R"
	}
	return fmt.Sprintf("%s %sUnlocked while already unlocked",
		e.levelToString(e.level), prefix)
}

type mismatchedUnlockError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	isRUnlock     bool
	curr          exclusionState
}

func (e mismatchedUnlockError) Error() string {
	var prefix, currPrefix string
	if e.isRUnlock {
		prefix = "R"
	}
	if e.curr.readerCount > 0 {
		currPrefix = "R"
	}
	return fmt.Sprintf(
		"%sUnlock call for %s doesn't match %sLock call for %s",
		prefix, e.levelToString(e.level),
		currPrefix, e.levelToString(e.curr.level))
}

func (state *lockState) beforeUnlock(level mutexLevel) error {
	state.exclusionStatesLock.Lock()
	defer state.exclusionStatesLock.Unlock()

	curr := state.currLocked()

	if curr == nil {
		return danglingUnlockError{
			levelToString: state.levelToString,
			level:         level,
			isRUnlock:     false,
		}
	}

	if level != curr.level || curr.readerCount != 0 {
		return mismatchedUnlockError{
			levelToString: state.levelToString,
			level:         level,
			isRUnlock:     false,
			curr:          *curr,
		}
	}

	state.popLocked()
	return nil
}

type mismatchedRLockError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
}

func (e mismatchedRLockError) Error() string {
	return fmt.Sprintf("%s RLocked while already Locked",
		e.levelToString(e.level))
}

func (state *lockState) afterRLock(level mutexLevel) error {
	state.exclusionStatesLock.Lock()
	defer state.exclusionStatesLock.Unlock()

	curr := state.currLocked()
	if curr != nil && level <= curr.level {
		return levelViolationError{
			levelToString: state.levelToString,
			level:         level,
			isRLock:       true,
			curr:          *curr,
		}
	}

	state.pushLocked(exclusionState{level: level, readerCount: 1})
	return nil
}

func (state *lockState) beforeRUnlock(level mutexLevel) error {
	state.exclusionStatesLock.Lock()
	defer state.exclusionStatesLock.Unlock()

	curr := state.currLocked()

	if curr == nil {
		return danglingUnlockError{
			levelToString: state.levelToString,
			level:         level,
			isRUnlock:     true,
		}
	}

	if level != curr.level || curr.readerCount == 0 {
		return mismatchedUnlockError{
			levelToString: state.levelToString,
			level:         level,
			isRUnlock:     true,
			curr:          *curr,
		}
	}

	curr.readerCount--
	if curr.readerCount == 0 {
		state.popLocked()
	}
	return nil
}

// leveledMutex is a mutex with an associated level, which must be
// unique. Note that unlike sync.Mutex, leveledMutex is a reference
// type and not a value type.
type leveledMutex struct {
	level  mutexLevel
	locker sync.Locker
}

func makeLeveledMutex(level mutexLevel, locker sync.Locker) leveledMutex {
	return leveledMutex{
		level:  level,
		locker: locker,
	}
}

func (m leveledMutex) Lock(lockState *lockState) {
	m.locker.Lock()
	err := lockState.afterLock(m.level)
	if err != nil {
		m.locker.Unlock()
		panic(err)
	}
}

func (m leveledMutex) Unlock(lockState *lockState) {
	err := lockState.beforeUnlock(m.level)
	if err != nil {
		panic(err)
	}
	m.locker.Unlock()
}

// leveledLocker represents an object that can be locked and unlocked
// with a lockState.
type leveledLocker interface {
	Lock(*lockState)
	Unlock(*lockState)
}

// leveledMutex is a reader-writer mutex with an associated level,
// which must be unique. Note that unlike sync.RWMutex, leveledRWMutex
// is a reference type and not a value type.
type leveledRWMutex struct {
	level    mutexLevel
	rwLocker rwLocker
}

func makeLeveledRWMutex(level mutexLevel, rwLocker rwLocker) leveledRWMutex {
	return leveledRWMutex{
		level:    level,
		rwLocker: rwLocker,
	}
}

func (rw leveledRWMutex) Lock(lockState *lockState) {
	rw.rwLocker.Lock()
	err := lockState.afterLock(rw.level)
	if err != nil {
		rw.rwLocker.Unlock()
		panic(err)
	}
}

func (rw leveledRWMutex) Unlock(lockState *lockState) {
	err := lockState.beforeUnlock(rw.level)
	if err != nil {
		panic(err)
	}
	rw.rwLocker.Unlock()
}

func (rw leveledRWMutex) RLock(lockState *lockState) {
	rw.rwLocker.RLock()
	err := lockState.afterRLock(rw.level)
	if err != nil {
		rw.rwLocker.RUnlock()
		panic(err)
	}
}

func (rw leveledRWMutex) RUnlock(lockState *lockState) {
	err := lockState.beforeRUnlock(rw.level)
	if err != nil {
		panic(err)
	}
	rw.rwLocker.RUnlock()
}

func (rw leveledRWMutex) RLocker() leveledLocker {
	return (leveledRLocker)(rw)
}

type leveledRLocker leveledRWMutex

func (r leveledRLocker) Lock(lockState *lockState) {
	(leveledRWMutex)(r).RLock(lockState)
}

func (r leveledRLocker) Unlock(lockState *lockState) {
	(leveledRWMutex)(r).RUnlock(lockState)
}
