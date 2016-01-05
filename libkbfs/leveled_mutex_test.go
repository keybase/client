package libkbfs

import (
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

type testMutexLevel mutexLevel

const (
	testFirst  testMutexLevel = 1
	testSecond                = 2
	testThird                 = 3
	testFourth                = 4
)

func (o testMutexLevel) String() string {
	return fmt.Sprintf("test-lock-%d", int(o))
}

func testMutexLevelToString(o mutexLevel) string {
	return (testMutexLevel(o)).String()
}

func TestLeveledMutexSingleFlow(t *testing.T) {
	mu1 := makeLeveledMutex(mutexLevel(testFirst), &sync.Mutex{})
	mu2 := makeLeveledMutex(mutexLevel(testSecond), &sync.Mutex{})
	mu3 := makeLeveledMutex(mutexLevel(testThird), &sync.Mutex{})

	state := makeLevelState(testMutexLevelToString)

	mu1.Lock(state)
	defer mu1.Unlock(state)

	mu2.Lock(state)
	defer mu2.Unlock(state)

	mu3.Lock(state)
	defer mu3.Unlock(state)
}

func TestLeveledMutexIncorrect(t *testing.T) {
	mu1 := makeLeveledMutex(mutexLevel(testFirst), &sync.Mutex{})
	mu2 := makeLeveledMutex(mutexLevel(testSecond), &sync.Mutex{})
	mu3 := makeLeveledMutex(mutexLevel(testThird), &sync.Mutex{})

	state := makeLevelState(testMutexLevelToString)

	mu2.Lock(state)
	defer mu2.Unlock(state)

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
func runLockSubsequences(wg *sync.WaitGroup, mu1, mu2, mu3 leveledLocker) {
	wg.Add(1)
	go func() {
		defer wg.Done()
		state := makeLevelState(testMutexLevelToString)
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
		state := makeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
		mu2.Lock(state)
		defer mu2.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := makeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := makeLevelState(testMutexLevelToString)
		mu2.Lock(state)
		defer mu2.Unlock(state)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := makeLevelState(testMutexLevelToString)
		mu1.Lock(state)
		defer mu1.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := makeLevelState(testMutexLevelToString)
		mu2.Lock(state)
		defer mu2.Unlock(state)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		state := makeLevelState(testMutexLevelToString)
		mu3.Lock(state)
		defer mu3.Unlock(state)
	}()
}

func TestLeveledMutexMultiFlow(t *testing.T) {
	mu1 := makeLeveledMutex(mutexLevel(testFirst), &sync.Mutex{})
	mu2 := makeLeveledMutex(mutexLevel(testSecond), &sync.Mutex{})
	mu3 := makeLeveledMutex(mutexLevel(testThird), &sync.Mutex{})

	var wg sync.WaitGroup
	runLockSubsequences(&wg, mu1, mu2, mu3)
	wg.Wait()
}

func TestLeveledRWMutexSingleFlow(t *testing.T) {
	mu1 := makeLeveledRWMutex(mutexLevel(testFirst), &sync.RWMutex{})
	mu2 := makeLeveledRWMutex(mutexLevel(testSecond), &sync.RWMutex{})
	mu3 := makeLeveledRWMutex(mutexLevel(testThird), &sync.RWMutex{})

	state := makeLevelState(testMutexLevelToString)

	mu1.Lock(state)
	defer mu1.Unlock(state)

	mu2.RLock(state)
	defer mu2.RUnlock(state)

	mu3.Lock(state)
	defer mu3.Unlock(state)
}

func TestLeveledRWMutexIncorrect(t *testing.T) {
	mu1 := makeLeveledRWMutex(mutexLevel(testFirst), &sync.RWMutex{})
	mu2 := makeLeveledRWMutex(mutexLevel(testSecond), &sync.RWMutex{})
	mu3 := makeLeveledRWMutex(mutexLevel(testThird), &sync.RWMutex{})

	state := makeLevelState(testMutexLevelToString)

	mu2.RLock(state)
	defer mu2.RUnlock(state)

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
	mu1 := makeLeveledMutex(mutexLevel(testFirst), &sync.Mutex{})
	mu2 := makeLeveledRWMutex(mutexLevel(testSecond), &sync.RWMutex{})
	mu3 := makeLeveledRWMutex(mutexLevel(testThird), &sync.RWMutex{})

	var wg sync.WaitGroup

	runLockSubsequences(&wg, mu1, mu2, mu3)
	runLockSubsequences(&wg, mu1, mu2.RLocker(), mu3)
	runLockSubsequences(&wg, mu1, mu2, mu3.RLocker())
	runLockSubsequences(&wg, mu1, mu2.RLocker(), mu3.RLocker())

	wg.Wait()
}
