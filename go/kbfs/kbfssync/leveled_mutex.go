// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

import (
	"fmt"
	"sync"
	"sync/atomic"
)

// The LeveledMutex, LeveledRWMutex, and LockState types enables a
// lock hierarchy to be checked. For a program (or subsystem), each
// (rw-)mutex must have a unique associated MutexLevel, which means
// that a (rw-)mutex must not be (r-)locked before another (rw-)mutex
// with a lower MutexLevel in a given execution flow. This is achieved
// by creating a new LockState at the start of an execution flow and
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

// MutexLevel is the level for a mutex, which must be unique to that
// mutex.
type MutexLevel int

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
	level MutexLevel
	// The exclusion type of the held mutex.
	exclusionType exclusionType
}

// LockState holds the info regarding which level mutexes are held or
// not for a particular execution flow.
type LockState struct {
	levelToString func(MutexLevel) string

	// Protects exclusionStates.
	exclusionStatesLock exclusiveLock
	// The stack of held mutexes, ordered by increasing level.
	exclusionStates []exclusionState
}

// MakeLevelState returns a new LockState. This must be called at the
// start of a new execution flow and passed to any LeveledMutex or
// LeveledRWMutex operation during that execution flow.
//
// TODO: Consider adding a parameter to set the capacity of
// exclusionStates.
func MakeLevelState(levelToString func(MutexLevel) string) *LockState {
	return &LockState{
		levelToString:       levelToString,
		exclusionStatesLock: makeExclusiveLock(),
	}
}

// currLocked returns the current exclusion state, or nil if there is
// none.
func (state *LockState) currLocked() *exclusionState {
	stateCount := len(state.exclusionStates)
	if stateCount == 0 {
		return nil
	}
	return &state.exclusionStates[stateCount-1]
}

type levelViolationError struct {
	levelToString func(MutexLevel) string
	level         MutexLevel
	exclusionType exclusionType
	curr          exclusionState
}

func (e levelViolationError) Error() string {
	return fmt.Sprintf("level violation: %s %sLocked after %s %sLocked",
		e.levelToString(e.level), e.exclusionType.prefix(),
		e.levelToString(e.curr.level), e.curr.exclusionType.prefix())
}

func (state *LockState) doLock(
	level MutexLevel, exclusionType exclusionType, lock sync.Locker) error {
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
	levelToString func(MutexLevel) string
	level         MutexLevel
	exclusionType exclusionType
}

func (e danglingUnlockError) Error() string {
	return fmt.Sprintf("%s %sUnlocked while already unlocked",
		e.levelToString(e.level), e.exclusionType.prefix())
}

type mismatchedUnlockError struct {
	levelToString func(MutexLevel) string
	level         MutexLevel
	exclusionType exclusionType
	curr          exclusionState
}

func (e mismatchedUnlockError) Error() string {
	return fmt.Sprintf(
		"%sUnlock call for %s doesn't match %sLock call for %s",
		e.exclusionType.prefix(), e.levelToString(e.level),
		e.curr.exclusionType.prefix(), e.levelToString(e.curr.level))
}

func (state *LockState) doUnlock(
	level MutexLevel, exclusionType exclusionType, lock sync.Locker) error {
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
// MutexLevel, or nonExclusion if there is none.
func (state *LockState) getExclusionType(level MutexLevel) exclusionType {
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

// LeveledMutex is a mutex with an associated level, which must be
// unique. Note that unlike sync.Mutex, LeveledMutex is a reference
// type and not a value type.
type LeveledMutex struct {
	level  MutexLevel
	locker sync.Locker
}

// MakeLeveledMutex makes a mutex with the given level, backed by the
// given locker.
func MakeLeveledMutex(level MutexLevel, locker sync.Locker) LeveledMutex {
	return LeveledMutex{
		level:  level,
		locker: locker,
	}
}

// Lock locks the associated locker.
func (m LeveledMutex) Lock(lockState *LockState) {
	err := lockState.doLock(m.level, writeExclusion, m.locker)
	if err != nil {
		panic(err)
	}
}

// Unlock locks the associated locker.
func (m LeveledMutex) Unlock(lockState *LockState) {
	err := lockState.doUnlock(m.level, writeExclusion, m.locker)
	if err != nil {
		panic(err)
	}
}

type unexpectedExclusionError struct {
	levelToString func(MutexLevel) string
	level         MutexLevel
	exclusionType exclusionType
}

func (e unexpectedExclusionError) Error() string {
	return fmt.Sprintf("%s unexpectedly %sLocked",
		e.levelToString(e.level), e.exclusionType.prefix())
}

// AssertUnlocked does nothing if m is unlocked with respect to the
// given LockState. Otherwise, it panics.
func (m LeveledMutex) AssertUnlocked(lockState *LockState) {
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
	levelToString         func(MutexLevel) string
	level                 MutexLevel
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
// LockState. Otherwise, it panics.
func (m LeveledMutex) AssertLocked(lockState *LockState) {
	et := lockState.getExclusionType(m.level)
	if et != writeExclusion {
		panic(unexpectedExclusionTypeError{
			levelToString:         lockState.levelToString,
			level:                 m.level,
			expectedExclusionType: writeExclusion,
			exclusionType:         et,
		})
	}
}

// LeveledLocker represents an object that can be locked and unlocked
// with a LockState.
type LeveledLocker interface {
	Lock(*LockState)
	Unlock(*LockState)
}

// LeveledRWMutex is a reader-writer mutex with an associated level,
// which must be unique. Note that unlike sync.RWMutex, LeveledRWMutex
// is a reference type and not a value type.
type LeveledRWMutex struct {
	level    MutexLevel
	rwLocker rwLocker
}

// MakeLeveledRWMutex makes a reader-writer mutex with the given
// level, backed by the given rwLocker.
func MakeLeveledRWMutex(level MutexLevel, rwLocker rwLocker) LeveledRWMutex {
	return LeveledRWMutex{
		level:    level,
		rwLocker: rwLocker,
	}
}

// Lock locks the associated locker.
func (rw LeveledRWMutex) Lock(lockState *LockState) {
	err := lockState.doLock(rw.level, writeExclusion, rw.rwLocker)
	if err != nil {
		panic(err)
	}
}

// Unlock unlocks the associated locker.
func (rw LeveledRWMutex) Unlock(lockState *LockState) {
	err := lockState.doUnlock(rw.level, writeExclusion, rw.rwLocker)
	if err != nil {
		panic(err)
	}
}

// RLock locks the associated locker for reading.
func (rw LeveledRWMutex) RLock(lockState *LockState) {
	err := lockState.doLock(rw.level, readExclusion, rw.rwLocker.RLocker())
	if err != nil {
		panic(err)
	}
}

// RUnlock unlocks the associated locker for reading.
func (rw LeveledRWMutex) RUnlock(lockState *LockState) {
	err := lockState.doUnlock(rw.level, readExclusion, rw.rwLocker.RLocker())
	if err != nil {
		panic(err)
	}
}

// AssertUnlocked does nothing if m is unlocked with respect to the
// given LockState. Otherwise, it panics.
func (rw LeveledRWMutex) AssertUnlocked(lockState *LockState) {
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
// LockState. Otherwise, it panics.
func (rw LeveledRWMutex) AssertLocked(lockState *LockState) {
	et := lockState.getExclusionType(rw.level)
	if et != writeExclusion {
		panic(unexpectedExclusionTypeError{
			levelToString:         lockState.levelToString,
			level:                 rw.level,
			expectedExclusionType: writeExclusion,
			exclusionType:         et,
		})
	}
}

// AssertRLocked does nothing if m is r-locked with respect to the
// given LockState. Otherwise, it panics.
func (rw LeveledRWMutex) AssertRLocked(lockState *LockState) {
	et := lockState.getExclusionType(rw.level)
	if et != readExclusion {
		panic(unexpectedExclusionTypeError{
			levelToString:         lockState.levelToString,
			level:                 rw.level,
			expectedExclusionType: readExclusion,
			exclusionType:         et,
		})
	}
}

type unexpectedNonExclusionError struct {
	levelToString func(MutexLevel) string
	level         MutexLevel
}

func (e unexpectedNonExclusionError) Error() string {
	return fmt.Sprintf("%s unexpectedly unlocked", e.levelToString(e.level))
}

// AssertAnyLocked does nothing if m is locked or r-locked with
// respect to the given LockState. Otherwise, it panics.
func (rw LeveledRWMutex) AssertAnyLocked(lockState *LockState) {
	et := lockState.getExclusionType(rw.level)
	if et == nonExclusion {
		panic(unexpectedNonExclusionError{
			levelToString: lockState.levelToString,
			level:         rw.level,
		})
	}
}

// RLocker implements the RWMutex interface for LeveledRMMutex.
func (rw LeveledRWMutex) RLocker() LeveledLocker {
	return (leveledRLocker)(rw)
}

type leveledRLocker LeveledRWMutex

func (r leveledRLocker) Lock(lockState *LockState) {
	(LeveledRWMutex)(r).RLock(lockState)
}

func (r leveledRLocker) Unlock(lockState *LockState) {
	(LeveledRWMutex)(r).RUnlock(lockState)
}
