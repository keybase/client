// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"net"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

// fakeLogContext satisfies libkb.LogContext so tests can build a real
// libkb.LoopbackListener without standing up a full libkb.GlobalContext.
type fakeLogContext struct{}

func (fakeLogContext) GetLog() logger.Logger { return logger.NewNull() }

// trackingConn is a minimal net.Conn whose only job is recording whether
// Close was called on it. The embedded nil net.Conn satisfies the interface;
// none of these tests exercise Read/Write on it (that would panic), only
// Close, which is all resetLocked ever calls on the connection it tears
// down.
type trackingConn struct {
	net.Conn
	closed atomic.Bool
}

func (c *trackingConn) Close() error {
	c.closed.Store(true)
	return nil
}

// resetConnStateForTest snapshots every package-level var the epoch/reset
// mechanism touches, clears it to a known-empty state for the test, and
// restores the original values on cleanup. These are the real production
// globals (guarded by connMutex / initMutex), not a test-only copy — tests
// seed them directly instead of routing through ensureConnection's dial
// machinery, then exercise the real Reset/ResetIfCurrent/ReadArr/WriteArr/
// LastReadEpoch functions against that seeded state.
func resetConnStateForTest(t *testing.T) {
	t.Helper()

	connMutex.Lock()
	savedConn := conn
	savedEpoch := connEpoch
	savedLastRead := lastReadEpoch
	savedKbCtx := kbCtx
	conn = nil
	connEpoch = 0
	lastReadEpoch = 0
	connMutex.Unlock()

	initMutex.Lock()
	savedInitComplete := initComplete
	initMutex.Unlock()

	t.Cleanup(func() {
		connMutex.Lock()
		conn = savedConn
		connEpoch = savedEpoch
		lastReadEpoch = savedLastRead
		kbCtx = savedKbCtx
		connMutex.Unlock()

		initMutex.Lock()
		initComplete = savedInitComplete
		initMutex.Unlock()
	})
}

// setConn seeds the package-level conn/connEpoch under connMutex, exactly
// the state ensureConnection would leave behind after a successful dial.
func setConn(c net.Conn, epoch int64) {
	connMutex.Lock()
	conn = c
	connEpoch = epoch
	connMutex.Unlock()
}

func getConnState() (net.Conn, int64) {
	connMutex.Lock()
	defer connMutex.Unlock()
	return conn, connEpoch
}

// Test 1: ResetIfCurrent closes the connection when the epoch matches the
// live one, and is a no-op that leaves the connection intact when the epoch
// is stale.
func TestResetIfCurrent_MatchingVsStaleEpoch(t *testing.T) {
	resetConnStateForTest(t)

	t.Run("matching epoch closes", func(t *testing.T) {
		c := &trackingConn{}
		setConn(c, 5)

		if err := ResetIfCurrent(5); err != nil {
			t.Fatalf("ResetIfCurrent returned error: %v", err)
		}
		if !c.closed.Load() {
			t.Error("expected connection to be closed when epoch matches, but it was not")
		}
		if gotConn, _ := getConnState(); gotConn != nil {
			t.Error("expected conn to be nil after a matching-epoch reset")
		}
	})

	t.Run("stale epoch is a no-op", func(t *testing.T) {
		c := &trackingConn{}
		setConn(c, 6)

		if err := ResetIfCurrent(5); err != nil {
			t.Fatalf("ResetIfCurrent returned error: %v", err)
		}
		if c.closed.Load() {
			t.Error("expected connection to be left open on a stale epoch, but it was closed")
		}
		gotConn, gotEpoch := getConnState()
		if gotConn != c {
			t.Error("expected conn to be left untouched on a stale epoch")
		}
		if gotEpoch != 6 {
			t.Errorf("expected epoch to remain 6, got %d", gotEpoch)
		}
	})
}

// Test 2: the exact interleaving the mechanism exists to prevent. Caller A
// captures epoch N against connection A. Before A calls ResetIfCurrent, a
// redial happens (simulating some other caller recovering first), advancing
// to a new connection at epoch N+1. A's stale ResetIfCurrent(N) must not
// close the new connection.
func TestResetIfCurrent_StaleEpochDoesNotClobberRedial(t *testing.T) {
	resetConnStateForTest(t)

	connA := &trackingConn{}
	setConn(connA, 1)

	// Caller A observes a failure on connA and captures its epoch, exactly
	// as ReadArr/WriteArr do under connMutex before releasing it.
	capturedEpoch := int64(1)

	// A redial happens concurrently, before A gets to call ResetIfCurrent:
	// this is what ensureConnection leaves behind after a successful dial.
	connB := &trackingConn{}
	setConn(connB, 2)

	// A's stale complaint must be a no-op.
	if err := ResetIfCurrent(capturedEpoch); err != nil {
		t.Fatalf("ResetIfCurrent returned error: %v", err)
	}

	if connB.closed.Load() {
		t.Fatal("stale ResetIfCurrent closed the redialed connection")
	}
	if connA.closed.Load() {
		t.Error("connA should not be reachable/closed either; it was already superseded")
	}
	gotConn, gotEpoch := getConnState()
	if gotConn != connB {
		t.Error("expected the live connection to still be connB")
	}
	if gotEpoch != 2 {
		t.Errorf("expected epoch to remain 2, got %d", gotEpoch)
	}
}

// Test 3: two callers both holding epoch N. The first reset closes the
// connection; the second, redundant call against the same (now-stale-by-
// virtue-of-nil-conn but epoch-matching) state must be harmless and must
// not panic.
func TestResetIfCurrent_DoubleResetSameEpochIsHarmless(t *testing.T) {
	resetConnStateForTest(t)

	c := &trackingConn{}
	setConn(c, 3)

	if err := ResetIfCurrent(3); err != nil {
		t.Fatalf("first ResetIfCurrent returned error: %v", err)
	}
	if !c.closed.Load() {
		t.Fatal("expected first ResetIfCurrent to close the connection")
	}

	// resetLocked does not touch connEpoch, so the second caller, which
	// captured the same epoch, still matches and will re-enter resetLocked
	// with conn == nil.
	if err := ResetIfCurrent(3); err != nil {
		t.Fatalf("second ResetIfCurrent returned error (should be a harmless no-op): %v", err)
	}
	if gotConn, _ := getConnState(); gotConn != nil {
		t.Error("expected conn to remain nil after the redundant reset")
	}
}

// Test 4: Reset is the unconditional escape hatch used by invalidate/
// destroy/engineReset. It must close whatever connection is current
// regardless of any epoch bookkeeping.
func TestReset_UnconditionallyClosesCurrentConnection(t *testing.T) {
	resetConnStateForTest(t)

	c := &trackingConn{}
	setConn(c, 42)

	if err := Reset(); err != nil {
		t.Fatalf("Reset returned error: %v", err)
	}
	if !c.closed.Load() {
		t.Error("expected Reset to unconditionally close the current connection")
	}
	if gotConn, _ := getConnState(); gotConn != nil {
		t.Error("expected conn to be nil after Reset")
	}
}

// Test 5: connEpoch is monotonically increasing and never reused across
// redials. This drives the real ensureConnection dial path (not a
// reimplementation of it) against a real libkb.LoopbackListener, so the
// increment under test is the actual production statement.
func TestEnsureConnection_EpochMonotonicAcrossRedials(t *testing.T) {
	resetConnStateForTest(t)

	ll := libkb.NewLoopbackListener(fakeLogContext{})
	t.Cleanup(func() { _ = ll.Close() })

	// Drain the Accept() side in the background so Dial() (called inside
	// ensureConnection) doesn't block forever; ensureConnection only needs
	// the dial to succeed, not a live peer.
	go func() {
		for {
			if _, err := ll.Accept(); err != nil {
				return
			}
		}
	}()

	connMutex.Lock()
	kbCtx = &libkb.GlobalContext{LoopbackListener: ll}
	connMutex.Unlock()
	setInited()

	seen := map[int64]bool{}
	var prev int64 = -1
	for i := 0; i < 20; i++ {
		connMutex.Lock()
		conn = nil // force ensureConnection to dial again
		err := ensureConnection()
		gotEpoch := connEpoch
		connMutex.Unlock()

		if err != nil {
			t.Fatalf("ensureConnection failed on iteration %d: %v", i, err)
		}
		if gotEpoch <= prev {
			t.Fatalf("epoch did not strictly increase: prev=%d got=%d", prev, gotEpoch)
		}
		if seen[gotEpoch] {
			t.Fatalf("epoch %d reused across redials", gotEpoch)
		}
		seen[gotEpoch] = true
		prev = gotEpoch
	}
}

// Test 6: LastReadEpoch reflects the epoch of the connection the most
// recent ReadArr call actually used.
func TestReadArr_LastReadEpochMatchesConnectionUsed(t *testing.T) {
	resetConnStateForTest(t)

	savedBuffer := buffer
	buffer = make([]byte, 4096)
	t.Cleanup(func() { buffer = savedBuffer })

	NotifyJSReady() // sync.Once; safe to call unconditionally

	local, remote := net.Pipe()
	t.Cleanup(func() { _ = local.Close(); _ = remote.Close() })

	setConn(remote, 9)

	go func() {
		_, _ = local.Write([]byte("hello"))
	}()

	data, err := ReadArr()
	if err != nil {
		t.Fatalf("ReadArr returned error: %v", err)
	}
	if string(data) != "hello" {
		t.Fatalf("unexpected data: %q", data)
	}

	if got := LastReadEpoch(); got != 9 {
		t.Errorf("expected LastReadEpoch to be 9, got %d", got)
	}

	// Now redial to a new connection/epoch and read again; LastReadEpoch
	// must track the new one, not the old.
	local2, remote2 := net.Pipe()
	t.Cleanup(func() { _ = local2.Close(); _ = remote2.Close() })
	setConn(remote2, 10)

	go func() {
		_, _ = local2.Write([]byte("world"))
	}()

	if _, err := ReadArr(); err != nil {
		t.Fatalf("second ReadArr returned error: %v", err)
	}
	if got := LastReadEpoch(); got != 10 {
		t.Errorf("expected LastReadEpoch to be 10 after redial, got %d", got)
	}
}

// Test 7: concurrent redials and resets from multiple goroutines must not
// panic, deadlock, or leave torn state, under -race.
func TestConcurrentRedialsAndResets(t *testing.T) {
	resetConnStateForTest(t)

	ll := libkb.NewLoopbackListener(fakeLogContext{})
	t.Cleanup(func() { _ = ll.Close() })

	go func() {
		for {
			if _, err := ll.Accept(); err != nil {
				return
			}
		}
	}()

	connMutex.Lock()
	kbCtx = &libkb.GlobalContext{LoopbackListener: ll}
	connMutex.Unlock()
	setInited()

	const goroutines = 20
	const iterations = 100

	var wg sync.WaitGroup
	wg.Add(goroutines * 3)

	// Redialers: mimic the lazy-init pattern ReadArr/WriteArr use.
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				connMutex.Lock()
				if conn == nil {
					_ = ensureConnection()
				}
				connMutex.Unlock()
			}
		}()
	}

	// Failure-driven resetters: capture an epoch, then race to reset it.
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				connMutex.Lock()
				epoch := connEpoch
				connMutex.Unlock()
				_ = ResetIfCurrent(epoch)
			}
		}()
	}

	// Unconditional resetters: e.g. concurrent invalidate/engineReset.
	for g := 0; g < goroutines; g++ {
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				_ = Reset()
			}
		}()
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("concurrent redial/reset test deadlocked")
	}

	// No torn state: the mechanism must still be usable afterward. A fresh
	// dial must succeed and report a strictly higher epoch than any seen
	// mid-run.
	connMutex.Lock()
	preEpoch := connEpoch
	conn = nil
	err := ensureConnection()
	postEpoch := connEpoch
	postConn := conn
	connMutex.Unlock()

	if err != nil {
		t.Fatalf("post-concurrency ensureConnection failed: %v", err)
	}
	if postConn == nil {
		t.Fatal("post-concurrency conn is nil after a successful dial")
	}
	if postEpoch <= preEpoch {
		t.Fatalf("post-concurrency epoch did not advance: pre=%d post=%d", preEpoch, postEpoch)
	}
}
