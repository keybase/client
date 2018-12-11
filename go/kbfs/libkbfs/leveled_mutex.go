// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"sync/atomic"
)

// The leveledMutex, leveledRWMutex, and lockState types enables a
// lock hierarchy to be checked. For a program (or subsystem), each
// (rw-)mutex must have a unique associated mutexLevel, which means
// that a (rw-)mutex must not be (r-)locked before another (rw-)mutex
// with a lower mutexLevel in a given execution flow. This is achieved
// by creating a new lockState at the start of an execution flow and
// passing it to the (r-)lock/(r-)unlock methods of each (rw-)mutex.
//
// TODO: Once this becomes a bottleneck, add a +build production
// version that stubs everything out.

// An exclusiveLock is a lock around something that is expected to be
// accessed exclusively. It immediately panics upon any lock
// contention.
type exclusiveLock struct {
	v *int32
}

func makeExclusiveLock() exclusiveLock {
	return exclusiveLock{
		v: new(int32),
	}
}

func (l exclusiveLock) lock() {
	if !atomic.CompareAndSwapInt32(l.v, 0, 1) {
		panic("unexpected concurrent access")
	}
}

func (l exclusiveLock) unlock() {
	if !atomic.CompareAndSwapInt32(l.v, 1, 0) {
		panic("unexpected concurrent access")
	}
}

// mutexLevel is the level for a mutex, which must be unique to that
// mutex.
type mutexLevel int

// exclusionType is the type of exclusion of a lock. A regular lock
// always uses write exclusion, where only one thing at a time can
// hold the lock, whereas a reader-writer lock can do either write
// exclusion or read exclusion, where only one writer or any number of
// readers can hold the lock.
type exclusionType int

const (
	nonExclusion   exclusionType = 0
	writeExclusion exclusionType = 1
	readExclusion  exclusionType = 2
)

func (et exclusionType) prefix() string {
	switch et {
	case nonExclusion:
		return "Un"
	case writeExclusion:
		return ""
	case readExclusion:
		return "R"
	}
	return fmt.Sprintf("exclusionType{%d}", et)
}

// exclusionState holds the state for a held mutex.
type exclusionState struct {
	// The level of the held mutex.
	level mutexLevel
	// The exclusion type of the held mutex.
	exclusionType exclusionType
}

// lockState holds the info regarding which level mutexes are held or
// not for a particular execution flow.
type lockState struct {
	levelToString func(mutexLevel) string

	// Protects exclusionStates.
	exclusionStatesLock exclusiveLock
	// The stack of held mutexes, ordered by increasing level.
	exclusionStates []exclusionState
}

// makeLevelState returns a new lockState. This must be called at the
// start of a new execution flow and passed to any leveledMutex or
// leveledRWMutex operation during that execution flow.
//
// TODO: Consider adding a parameter to set the capacity of
// exclusionStates.
func makeLevelState(levelToString func(mutexLevel) string) *lockState {
	return &lockState{
		levelToString:       levelToString,
		exclusionStatesLock: makeExclusiveLock(),
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

type levelViolationError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	exclusionType exclusionType
	curr          exclusionState
}

func (e levelViolationError) Error() string {
	return fmt.Sprintf("level violation: %s %sLocked after %s %sLocked",
		e.levelToString(e.level), e.exclusionType.prefix(),
		e.levelToString(e.curr.level), e.curr.exclusionType.prefix())
}

func (state *lockState) doLock(
	level mutexLevel, exclusionType exclusionType, lock sync.Locker) error {
	state.exclusionStatesLock.lock()
	defer state.exclusionStatesLock.unlock()

	curr := state.currLocked()

	if curr != nil && level <= curr.level {
		return levelViolationError{
			levelToString: state.levelToString,
			level:         level,
			exclusionType: exclusionType,
			curr:          *curr,
		}
	}

	lock.Lock()

	state.exclusionStates = append(state.exclusionStates, exclusionState{
		level:         level,
		exclusionType: exclusionType,
	})
	return nil
}

type danglingUnlockError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	exclusionType exclusionType
}

func (e danglingUnlockError) Error() string {
	return fmt.Sprintf("%s %sUnlocked while already unlocked",
		e.levelToString(e.level), e.exclusionType.prefix())
}

type mismatchedUnlockError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	exclusionType exclusionType
	curr          exclusionState
}

func (e mismatchedUnlockError) Error() string {
	return fmt.Sprintf(
		"%sUnlock call for %s doesn't match %sLock call for %s",
		e.exclusionType.prefix(), e.levelToString(e.level),
		e.curr.exclusionType.prefix(), e.levelToString(e.curr.level))
}

func (state *lockState) doUnlock(
	level mutexLevel, exclusionType exclusionType, lock sync.Locker) error {
	state.exclusionStatesLock.lock()
	defer state.exclusionStatesLock.unlock()

	curr := state.currLocked()

	if curr == nil {
		return danglingUnlockError{
			levelToString: state.levelToString,
			level:         level,
			exclusionType: exclusionType,
		}
	}

	if level != curr.level || curr.exclusionType != exclusionType {
		return mismatchedUnlockError{
			levelToString: state.levelToString,
			level:         level,
			exclusionType: exclusionType,
			curr:          *curr,
		}
	}

	lock.Unlock()

	state.exclusionStates = state.exclusionStates[:len(state.exclusionStates)-1]
	return nil
}

// getExclusionType returns returns the exclusionType for the given
// mutexLevel, or nonExclusion if there is none.
func (state *lockState) getExclusionType(level mutexLevel) exclusionType {
	state.exclusionStatesLock.lock()
	defer state.exclusionStatesLock.unlock()

	// Not worth it to do anything more complicated than a
	// brute-force search.
	for _, state := range state.exclusionStates {
		if state.level > level {
			break
		}
		if state.level == level {
			return state.exclusionType
		}
	}

	return nonExclusion
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
	err := lockState.doLock(m.level, writeExclusion, m.locker)
	if err != nil {
		panic(err)
	}
}

func (m leveledMutex) Unlock(lockState *lockState) {
	err := lockState.doUnlock(m.level, writeExclusion, m.locker)
	if err != nil {
		panic(err)
	}
}

type unexpectedExclusionError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
	exclusionType exclusionType
}

func (e unexpectedExclusionError) Error() string {
	return fmt.Sprintf("%s unexpectedly %sLocked",
		e.levelToString(e.level), e.exclusionType.prefix())
}

// AssertUnlocked does nothing if m is unlocked with respect to the
// given lockState. Otherwise, it panics.
func (m leveledMutex) AssertUnlocked(lockState *lockState) {
	et := lockState.getExclusionType(m.level)
	if et != nonExclusion {
		panic(unexpectedExclusionError{
			levelToString: lockState.levelToString,
			level:         m.level,
			exclusionType: et,
		})
	}
}

type unexpectedExclusionTypeError struct {
	levelToString         func(mutexLevel) string
	level                 mutexLevel
	expectedExclusionType exclusionType
	exclusionType         exclusionType
}

func (e unexpectedExclusionTypeError) Error() string {
	return fmt.Sprintf(
		"%s unexpectedly not %sLocked; instead it is %sLocked",
		e.levelToString(e.level),
		e.expectedExclusionType.prefix(),
		e.exclusionType.prefix())
}

// AssertLocked does nothing if m is locked with respect to the given
// lockState. Otherwise, it panics.
func (m leveledMutex) AssertLocked(lockState *lockState) {
	et := lockState.getExclusionType(m.level)
	if et != writeExclusion {
		panic(unexpectedExclusionTypeError{
			levelToString: lockState.levelToString,
			level:         m.level,
			expectedExclusionType: writeExclusion,
			exclusionType:         et,
		})
	}
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
	err := lockState.doLock(rw.level, writeExclusion, rw.rwLocker)
	if err != nil {
		panic(err)
	}
}

func (rw leveledRWMutex) Unlock(lockState *lockState) {
	err := lockState.doUnlock(rw.level, writeExclusion, rw.rwLocker)
	if err != nil {
		panic(err)
	}
}

func (rw leveledRWMutex) RLock(lockState *lockState) {
	err := lockState.doLock(rw.level, readExclusion, rw.rwLocker.RLocker())
	if err != nil {
		panic(err)
	}
}

func (rw leveledRWMutex) RUnlock(lockState *lockState) {
	err := lockState.doUnlock(rw.level, readExclusion, rw.rwLocker.RLocker())
	if err != nil {
		panic(err)
	}
}

// AssertUnlocked does nothing if m is unlocked with respect to the
// given lockState. Otherwise, it panics.
func (rw leveledRWMutex) AssertUnlocked(lockState *lockState) {
	et := lockState.getExclusionType(rw.level)
	if et != nonExclusion {
		panic(unexpectedExclusionError{
			levelToString: lockState.levelToString,
			level:         rw.level,
			exclusionType: et,
		})
	}
}

// AssertLocked does nothing if m is locked with respect to the given
// lockState. Otherwise, it panics.
func (rw leveledRWMutex) AssertLocked(lockState *lockState) {
	et := lockState.getExclusionType(rw.level)
	if et != writeExclusion {
		panic(unexpectedExclusionTypeError{
			levelToString: lockState.levelToString,
			level:         rw.level,
			expectedExclusionType: writeExclusion,
			exclusionType:         et,
		})
	}
}

// AssertRLocked does nothing if m is r-locked with respect to the
// given lockState. Otherwise, it panics.
func (rw leveledRWMutex) AssertRLocked(lockState *lockState) {
	et := lockState.getExclusionType(rw.level)
	if et != readExclusion {
		panic(unexpectedExclusionTypeError{
			levelToString: lockState.levelToString,
			level:         rw.level,
			expectedExclusionType: readExclusion,
			exclusionType:         et,
		})
	}
}

type unexpectedNonExclusionError struct {
	levelToString func(mutexLevel) string
	level         mutexLevel
}

func (e unexpectedNonExclusionError) Error() string {
	return fmt.Sprintf("%s unexpectedly unlocked", e.levelToString(e.level))
}

// AssertAnyLocked does nothing if m is locked or r-locked with
// respect to the given lockState. Otherwise, it panics.
func (rw leveledRWMutex) AssertAnyLocked(lockState *lockState) {
	et := lockState.getExclusionType(rw.level)
	if et == nonExclusion {
		panic(unexpectedNonExclusionError{
			levelToString: lockState.levelToString,
			level:         rw.level,
		})
	}
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
