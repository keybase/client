// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfssync

import (
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExclusiveLock(t *testing.T) {
	el := makeExclusiveLock()
	el.lock()
	defer el.unlock()

	// This must leave el unlocked.
	require.Panics(t, func() {
		el.lock()
	})
}

type testMutexLevel MutexLevel

const (
	testFirst  testMutexLevel = 1
	testSecond testMutexLevel = 2
	testThird  testMutexLevel = 3
)

func (o testMutexLevel) String() string {
	return fmt.Sprintf("test-lock-%d", int(o))
}

func testMutexLevelToString(o MutexLevel) string {
	return (testMutexLevel(o)).String()
}

func TestLeveledMutexSingleFlow(t *testing.T) {
	mu1 := MakeLeveledMutex(MutexLevel(testFirst), &sync.Mutex{})
	mu2 := MakeLeveledMutex(MutexLevel(testSecond), &sync.Mutex{})
	mu3 := MakeLeveledMutex(MutexLevel(testThird), &sync.Mutex{})

	state := MakeLevelState(testMutexLevelToString)

	for _, mu := range []LeveledMutex{mu1, mu2, mu3} {
		mu.AssertUnlocked(state)
		mu.Lock(state)
		mu.AssertLocked(state)

		defer func(mu LeveledMutex) {
			mu.AssertLocked(state)
			mu.Unlock(state)
			mu.AssertUnlocked(state)
		}(mu)
	}
}

func TestLeveledMutexIncorrect(t *testing.T) {
	mu1 := MakeLeveledMutex(MutexLevel(testFirst), &sync.Mutex{})
	mu2 := MakeLeveledMutex(MutexLevel(testSecond), &sync.Mutex{})
	mu3 := MakeLeveledMutex(MutexLevel(testThird), &sync.Mutex{})

	state := MakeLevelState(testMutexLevelToString)

	require.Panics(t, func() {
		mu1.AssertLocked(state)
	})

	mu2.Lock(state)

	require.Panics(t, func() {
		mu2.AssertUnlocked(state)
	})

	defer func() {
		mu2.Unlock(state)

		require.Panics(t, func() {
			mu2.AssertLocked(state)
		})
	}()

	// This must leave mu1 unlocked.
	require.Panics(t, func() {
		mu1.Lock(state)
	})

	mu3.Lock(state)
	defer mu3.Unlock(state)

	// This must leave mu2 locked.
	require.Panics(t, func() {
		mu2.Unlock(state)
	})
}

// runLockSubsequences() runs all possible subsequences of {mu1, mu2,
// mu3}.Lock() under the given WaitGroup.
func runLockSubsequences(wg *sync.WaitGroup, mu1, mu2, mu3 LeveledLocker) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
		mu2.Lock(state)
		defer mu2.Unlock(state)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
		mu2.Lock(state)
		defer mu2.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu2.Lock(state)
		defer mu2.Unlock(state)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu2.Lock(state)
		defer mu2.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := MakeLevelState(testMutexLevelToString)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()
}

func TestLeveledMutexMultiFlow(t *testing.T) {
	mu1 := MakeLeveledMutex(MutexLevel(testFirst), &sync.Mutex{})
	mu2 := MakeLeveledMutex(MutexLevel(testSecond), &sync.Mutex{})
	mu3 := MakeLeveledMutex(MutexLevel(testThird), &sync.Mutex{})

	var wg sync.WaitGroup
	runLockSubsequences(&wg, mu1, mu2, mu3)
	wg.Wait()
}

func TestLeveledRWMutexSingleFlow(t *testing.T) {
	mu1 := MakeLeveledRWMutex(MutexLevel(testFirst), &sync.RWMutex{})
	mu2 := MakeLeveledRWMutex(MutexLevel(testSecond), &sync.RWMutex{})
	mu3 := MakeLeveledRWMutex(MutexLevel(testThird), &sync.RWMutex{})

	state := MakeLevelState(testMutexLevelToString)

	mu1.AssertUnlocked(state)
	mu1.Lock(state)
	mu1.AssertLocked(state)
	mu1.AssertAnyLocked(state)

	defer func() {
		mu1.AssertLocked(state)
		mu1.AssertAnyLocked(state)
		mu1.Unlock(state)
		mu1.AssertUnlocked(state)
	}()

	mu2.AssertUnlocked(state)
	mu2.RLock(state)
	mu2.AssertRLocked(state)
	mu2.AssertAnyLocked(state)

	defer func() {
		mu2.AssertRLocked(state)
		mu2.AssertAnyLocked(state)
		mu2.RUnlock(state)
		mu2.AssertUnlocked(state)
	}()

	mu3.AssertUnlocked(state)
	mu3.Lock(state)
	mu3.AssertLocked(state)
	mu3.AssertAnyLocked(state)

	defer func() {
		mu3.AssertLocked(state)
		mu3.AssertAnyLocked(state)
		mu3.Unlock(state)
		mu3.AssertUnlocked(state)
	}()
}

func TestLeveledRWMutexIncorrect(t *testing.T) {
	mu1 := MakeLeveledRWMutex(MutexLevel(testFirst), &sync.RWMutex{})
	mu2 := MakeLeveledRWMutex(MutexLevel(testSecond), &sync.RWMutex{})
	mu3 := MakeLeveledRWMutex(MutexLevel(testThird), &sync.RWMutex{})

	state := MakeLevelState(testMutexLevelToString)

	require.Panics(t, func() {
		mu1.AssertLocked(state)
	})
	require.Panics(t, func() {
		mu1.AssertRLocked(state)
	})
	require.Panics(t, func() {
		mu1.AssertAnyLocked(state)
	})

	mu2.RLock(state)

	require.Panics(t, func() {
		mu2.AssertUnlocked(state)
	})

	defer func() {
		mu2.RUnlock(state)
	}()

	require.Panics(t, func() {
		mu2.AssertLocked(state)

		require.Panics(t, func() {
			mu2.AssertLocked(state)
		})
		require.Panics(t, func() {
			mu2.AssertRLocked(state)
		})
		require.Panics(t, func() {
			mu2.AssertAnyLocked(state)
		})
	})

	// This must leave mu2 read-locked.
	require.Panics(t, func() {
		mu2.RLock(state)
	})

	// These must leave mu1 unlocked.
	require.Panics(t, func() {
		mu1.RLock(state)
	})
	require.Panics(t, func() {
		mu1.Lock(state)
	})

	mu3.Lock(state)
	defer mu3.Unlock(state)

	require.Panics(t, func() {
		mu3.AssertRLocked(state)
	})

	// This must leave mu3 locked.
	require.Panics(t, func() {
		mu3.RUnlock(state)
	})

	// These must leave mu2 read-locked.
	require.Panics(t, func() {
		mu2.Unlock(state)
	})
	require.Panics(t, func() {
		mu2.RUnlock(state)
	})
}

func TestLeveledRWMutexMultiFlow(t *testing.T) {
	mu1 := MakeLeveledMutex(MutexLevel(testFirst), &sync.Mutex{})
	mu2 := MakeLeveledRWMutex(MutexLevel(testSecond), &sync.RWMutex{})
	mu3 := MakeLeveledRWMutex(MutexLevel(testThird), &sync.RWMutex{})

	var wg sync.WaitGroup

	runLockSubsequences(&wg, mu1, mu2, mu3)
	runLockSubsequences(&wg, mu1, mu2.RLocker(), mu3)
	runLockSubsequences(&wg, mu1, mu2, mu3.RLocker())
	runLockSubsequences(&wg, mu1, mu2.RLocker(), mu3.RLocker())

	wg.Wait()
}
