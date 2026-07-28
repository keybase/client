// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"bytes"
	"errors"
	"net"
	"os"
	"os/exec"
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
// Close was called on it, and how many times. The embedded nil net.Conn
// satisfies the interface; none of these tests exercise Read/Write on it
// (that would panic), only Close, which is all resetLocked ever calls on the
// connection it tears down.
type trackingConn struct {
	net.Conn
	closed atomic.Bool
	closes atomic.Int32
}

func (c *trackingConn) Close() error {
	c.closes.Add(1)
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
//
// One piece of state this cannot restore: any test that calls NotifyJSReady
// closes the package-level jsReadyCh via a sync.Once, and that close is
// irreversible for the life of the test binary. Later tests that call
// ReadArr never block on jsReadyCh regardless of what this helper resets.
// A test that needs ReadArr to actually block on JS readiness must therefore
// run in a fresh process and guard itself with requireJSNotYetReady, which
// hard-fails rather than silently passing for the wrong reason. See
// TestReadArr_BlocksUntilJSReady.
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

// jsReadyFired reports whether NotifyJSReady has already run in this process.
// sync.Once has no query API, but the observable effect — jsReadyCh being
// closed — does: a receive on a closed channel never blocks.
func jsReadyFired() bool {
	select {
	case <-jsReadyCh:
		return true
	default:
		return false
	}
}

// requireJSNotYetReady hard-fails a test that depends on ReadArr blocking
// before JS readiness when NotifyJSReady has already fired in this process.
// The close is irreversible (sync.Once + close of a package-level channel),
// so once any earlier test has called NotifyJSReady, ReadArr sails straight
// past `<-jsReadyCh` and a "did ReadArr block?" assertion would pass
// vacuously. Failing loudly here is the point: a future test must not
// silently prove nothing.
func requireJSNotYetReady(t *testing.T) {
	t.Helper()
	if jsReadyFired() {
		t.Fatal("NotifyJSReady has already fired in this process; jsReadyCh is " +
			"closed irreversibly, so a pre-ready blocking assertion cannot be " +
			"trusted here. Run this test in a fresh process (see " +
			"TestReadArr_BlocksUntilJSReady).")
	}
}

// setupReadArrBuffer installs a test-sized read buffer for ReadArr (normally
// allocated by Init, which these tests never call) and restores the original.
func setupReadArrBuffer(t *testing.T, size int) {
	t.Helper()
	savedBuffer := buffer
	buffer = make([]byte, size)
	t.Cleanup(func() { buffer = savedBuffer })
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
//
// The assertions here are deliberately ones a no-op resetLocked would fail:
// the connection is closed exactly once (not zero times, not twice), and
// connEpoch is left alone by the reset itself. That last point is not
// incidental — only ensureConnection advances the epoch, which is precisely
// why the second caller's captured epoch still matches and this double-reset
// path is reachable at all. If resetLocked ever started bumping connEpoch,
// the second call would take the stale branch instead and this test would
// catch the change in meaning.
func TestResetIfCurrent_DoubleResetSameEpochIsHarmless(t *testing.T) {
	resetConnStateForTest(t)

	c := &trackingConn{}
	setConn(c, 3)

	if didReset := ResetIfCurrentDidReset(3); !didReset {
		t.Fatal("expected the first ResetIfCurrent to report that it acted")
	}
	if got := c.closes.Load(); got != 1 {
		t.Fatalf("expected the first reset to close the connection exactly once, got %d closes", got)
	}
	gotConn, gotEpoch := getConnState()
	if gotConn != nil {
		t.Fatal("expected conn to be nil after the first reset")
	}
	if gotEpoch != 3 {
		t.Fatalf("expected reset to leave connEpoch at 3 (only ensureConnection advances it), got %d", gotEpoch)
	}

	// The second caller captured the same epoch, so it still matches and
	// re-enters resetLocked — this time with conn == nil.
	if didReset := ResetIfCurrentDidReset(3); !didReset {
		t.Fatal("expected the second ResetIfCurrent to still match the (unadvanced) epoch")
	}
	if got := c.closes.Load(); got != 1 {
		t.Errorf("expected the redundant reset to be observably a no-op (still 1 close), got %d closes", got)
	}
	gotConn, gotEpoch = getConnState()
	if gotConn != nil {
		t.Error("expected conn to remain nil after the redundant reset")
	}
	if gotEpoch != 3 {
		t.Errorf("expected connEpoch to remain 3 after the redundant reset, got %d", gotEpoch)
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

	setupReadArrBuffer(t, 4096)

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

// Test 7: concurrency through the real entry points. Earlier revisions of
// this test took connMutex in its own goroutines and called ensureConnection
// directly, which is not how anything in production reaches it — that
// demonstrated the test's own lock discipline, not the callers'. This drives
// ReadArr / WriteArr / Reset / ResetIfCurrent instead, so the lazy-init,
// epoch-capture and failure-reset code under test is the code that actually
// ships.
//
// The goroutine mix mirrors production exactly: ONE permanent ReadArr caller
// (a single serial reader loop on both platforms), many concurrent WriteArr
// callers, and concurrent resetters. It is deliberately not N concurrent
// readers: ReadArr reads into the shared package-level `buffer`, so a second
// concurrent reader is a genuine data race on that buffer (verified: -race
// flags keybase.go's `currentConn.Read(buffer)` against its own
// `copy(out, buffer[:n])`). The per-call copy ReadArr returns bounds the
// blast radius of such a regression — a caller's slice can never be
// retroactively rewritten by a later read, see
// TestReadArr_ReturnsPrivateCopy — but it does not make concurrent ReadArr
// safe, and asserting otherwise here would be asserting a property the code
// does not have.
func TestConcurrentReadWriteAndResetsThroughRealEntryPoints(t *testing.T) {
	resetConnStateForTest(t)
	setupReadArrBuffer(t, 4096)
	NotifyJSReady()

	// Peers send only 'R' bytes and the app only ever sends 'W' bytes, so any
	// byte the reader sees that isn't 'R' means a frame got crossed or the
	// shared buffer got garbled.
	peerPayload := bytes.Repeat([]byte{'R'}, 128)
	appPayload := bytes.Repeat([]byte{'W'}, 96)

	ll := libkb.NewLoopbackListener(fakeLogContext{})
	t.Cleanup(func() { _ = ll.Close() })

	// Every accepted peer is recorded so teardown can poke it (see below).
	var peerMu sync.Mutex
	var peers []net.Conn
	pokeAllPeers := func() {
		peerMu.Lock()
		snapshot := append([]net.Conn(nil), peers...)
		peerMu.Unlock()
		// Fire-and-forget: LoopbackConn.Write parks on an unbuffered channel
		// until its partner reads, so a poke at a connection nobody is reading
		// must not block the poker.
		for _, pc := range snapshot {
			go func(pc net.Conn) { _, _ = pc.Write(peerPayload) }(pc)
		}
	}

	// Accept every dial ensureConnection makes. Each peer gets one proactive
	// payload (so the reader loop has something to return) and then drains
	// whatever WriteArr sends, so LoopbackConn.Write — which blocks on an
	// unbuffered channel until its partner reads — can always make progress.
	// A peer whose app-side conn is reset while its proactive Write is still
	// parked stays parked; that is bounded at one goroutine per redial and
	// dies with the test process.
	go func() {
		for {
			peer, err := ll.Accept()
			if err != nil {
				return
			}
			peerMu.Lock()
			peers = append(peers, peer)
			peerMu.Unlock()
			go func(pc net.Conn) { _, _ = pc.Write(peerPayload) }(peer)
			go func(pc net.Conn) {
				sink := make([]byte, 4096)
				for {
					if _, err := pc.Read(sink); err != nil {
						return
					}
				}
			}(peer)
		}
	}()

	connMutex.Lock()
	kbCtx = &libkb.GlobalContext{LoopbackListener: ll}
	connMutex.Unlock()
	setInited()

	const writers = 8
	const resetters = 4
	const iterations = 60

	stop := make(chan struct{})
	var reads, writes atomic.Int64

	// The single permanent reader.
	readerDone := make(chan struct{})
	go func() {
		defer close(readerDone)
		for {
			select {
			case <-stop:
				return
			default:
			}
			data, err := ReadArr()
			if err != nil {
				continue
			}
			if len(data) == 0 {
				continue
			}
			reads.Add(1)
			if i := bytes.IndexFunc(data, func(r rune) bool { return r != 'R' }); i >= 0 {
				t.Errorf("ReadArr returned a garbled slice: byte %d is %q, want all 'R'", i, data[i])
				return
			}
		}
	}()

	var wg sync.WaitGroup

	for g := 0; g < writers; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				if err := WriteArr(appPayload); err == nil {
					writes.Add(1)
				}
			}
		}()
	}

	// Failure-driven resetters: capture an epoch the way ReadArr/WriteArr do,
	// then race to reset it.
	for g := 0; g < resetters; g++ {
		wg.Add(1)
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
	for g := 0; g < resetters; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				_ = Reset()
			}
		}()
	}

	workersDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(workersDone)
	}()

	select {
	case <-workersDone:
	case <-time.After(60 * time.Second):
		t.Fatal("concurrent read/write/reset test deadlocked")
	}

	// Unblock the reader, which is very likely parked in conn.Read. Closing
	// the app-side conn does not help: LoopbackConn.Read blocks on the
	// *partner's* channel, so only the peer writing (or closing) wakes it.
	// Poke every peer until the reader observes stop and returns.
	close(stop)
	deadline := time.After(30 * time.Second)
	for {
		select {
		case <-readerDone:
			goto readerStopped
		case <-deadline:
			t.Fatal("reader loop did not stop")
		case <-time.After(20 * time.Millisecond):
			pokeAllPeers()
		}
	}
readerStopped:

	if reads.Load() == 0 {
		t.Error("no ReadArr call ever returned data; the test never exercised the read path")
	}
	if writes.Load() == 0 {
		t.Error("no WriteArr call ever succeeded; the test never exercised the write path")
	}

	// No torn state: the mechanism must still be usable afterward. A fresh
	// write must succeed and drive a redial to a strictly higher epoch.
	_, preEpoch := getConnState()
	if err := Reset(); err != nil {
		t.Fatalf("post-concurrency Reset failed: %v", err)
	}
	if err := WriteArr(appPayload); err != nil {
		t.Fatalf("post-concurrency WriteArr failed: %v", err)
	}
	postConn, postEpoch := getConnState()
	if postConn == nil {
		t.Fatal("post-concurrency conn is nil after a successful WriteArr redial")
	}
	if postEpoch <= preEpoch {
		t.Fatalf("post-concurrency epoch did not advance: pre=%d post=%d", preEpoch, postEpoch)
	}
}

// readSignalConn wraps a net.Conn and closes entered the first time Read is
// called, letting a test observe "the reader has entered conn.Read" without
// racing on it.
type readSignalConn struct {
	net.Conn
	entered chan struct{}
	once    sync.Once
}

func (c *readSignalConn) Read(p []byte) (int, error) {
	c.once.Do(func() { close(c.entered) })
	return c.Conn.Read(p)
}

// Test 8: the regression this whole mechanism guards against. ReadArr must
// capture lastReadEpoch from the connection/epoch pair it is actually about
// to read from, before that read can be raced by a redial — not after
// currentConn.Read returns, and not from whatever connEpoch happens to be
// when the async caller gets around to reading it back.
//
// This interleaves a redial with an in-flight ReadArr: the reader parks in
// Read() on connA/epoch A, a redial swaps in connB/epoch B while the read is
// still outstanding, and only then does connA's peer supply the bytes that
// unblock it. LastReadEpoch() must report A (the connection actually read
// from), not B (the connection live at the time the caller happens to check).
//
// Falsified: moving `lastReadEpoch = currentEpoch` in ReadArr to after
// currentConn.Read returns (the exact regression this guards against) makes
// this test fail, reporting epoch B instead of A.
func TestReadArr_LastReadEpochCapturedBeforeRaceableRead(t *testing.T) {
	resetConnStateForTest(t)

	setupReadArrBuffer(t, 4096)

	NotifyJSReady() // sync.Once; safe to call unconditionally; see the note
	// on resetConnStateForTest above about why this can't be undone.

	localA, remoteA := net.Pipe()
	t.Cleanup(func() { _ = localA.Close(); _ = remoteA.Close() })

	entered := make(chan struct{})
	setConn(&readSignalConn{Conn: remoteA, entered: entered}, 100)

	type readResult struct {
		data []byte
		err  error
	}
	resultCh := make(chan readResult, 1)
	go func() {
		data, err := ReadArr()
		resultCh <- readResult{data, err}
	}()

	// Wait until the reader has actually entered conn.Read on connA/epoch
	// 100 (and, in correct code, has already captured lastReadEpoch=100
	// under connMutex before releasing it and blocking here).
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("ReadArr never entered conn.Read")
	}

	// A redial races in while the read above is still outstanding, exactly
	// as ensureConnection would do for a concurrent WriteArr/ReadArr caller
	// recovering from a failure on a different connection.
	localB, remoteB := net.Pipe()
	t.Cleanup(func() { _ = localB.Close(); _ = remoteB.Close() })
	setConn(remoteB, 101)

	// Only now does connA's peer supply the bytes that unblock the
	// already-in-flight Read on connA.
	go func() { _, _ = localA.Write([]byte("hello")) }()

	var res readResult
	select {
	case res = <-resultCh:
	case <-time.After(5 * time.Second):
		t.Fatal("ReadArr did not return")
	}
	if res.err != nil {
		t.Fatalf("ReadArr returned error: %v", res.err)
	}
	if string(res.data) != "hello" {
		t.Fatalf("unexpected data: %q", res.data)
	}

	if got := LastReadEpoch(); got != 100 {
		t.Errorf("expected LastReadEpoch to report the epoch actually read from (100), got %d", got)
	}
}

// erroringReadConn's Read always fails, driving ReadArr's error path.
type erroringReadConn struct {
	trackingConn
}

func (c *erroringReadConn) Read(p []byte) (int, error) {
	return 0, errors.New("simulated read error")
}

// Test 9: ReadArr's error path (a real production caller of ResetIfCurrent,
// keybase.go ~:681) must reset the connection it just failed to read from.
func TestReadArr_ErrorPathResetsConnection(t *testing.T) {
	resetConnStateForTest(t)

	setupReadArrBuffer(t, 4096)

	NotifyJSReady()

	c := &erroringReadConn{}
	setConn(c, 7)

	if _, err := ReadArr(); err == nil {
		t.Fatal("expected ReadArr to return an error")
	}

	if !c.closed.Load() {
		t.Error("expected ReadArr's error path to reset (close) the connection it read from")
	}
	if gotConn, _ := getConnState(); gotConn != nil {
		t.Error("expected conn to be nil after ReadArr's error-path reset")
	}
}

// shortWriteConn's Write always reports writing one byte fewer than given,
// with no error, driving WriteArr's short-write path.
type shortWriteConn struct {
	trackingConn
}

func (c *shortWriteConn) Write(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	return len(p) - 1, nil
}

// Test 10: WriteArr's short-write path (a real production caller of
// ResetIfCurrent, keybase.go ~:610) must reset the connection rather than
// leave the peer's framer holding a partial frame.
func TestWriteArr_ShortWriteResetsConnection(t *testing.T) {
	resetConnStateForTest(t)

	c := &shortWriteConn{}
	setConn(c, 11)

	if err := WriteArr([]byte("hello world")); err == nil {
		t.Fatal("expected WriteArr to return an error on a short write")
	}

	if !c.closed.Load() {
		t.Error("expected WriteArr's short-write path to reset (close) the connection")
	}
	if gotConn, _ := getConnState(); gotConn != nil {
		t.Error("expected conn to be nil after WriteArr's short-write reset")
	}
}

// Test 11: ResetIfCurrentDidReset reports whether it actually reset the
// connection (epoch matched) as opposed to being a stale no-op, which is
// exactly what platform readers (Kb.mm, KbModule.kt) now gate their local
// parser reset on.
func TestResetIfCurrentDidReset_ReportsWhetherItActed(t *testing.T) {
	resetConnStateForTest(t)

	t.Run("matching epoch resets and reports true", func(t *testing.T) {
		c := &trackingConn{}
		setConn(c, 20)

		if didReset := ResetIfCurrentDidReset(20); !didReset {
			t.Error("expected ResetIfCurrentDidReset to report true for a matching epoch")
		}
		if !c.closed.Load() {
			t.Error("expected the connection to be closed when epoch matches")
		}
	})

	t.Run("stale epoch is a no-op and reports false", func(t *testing.T) {
		c := &trackingConn{}
		setConn(c, 21)

		if didReset := ResetIfCurrentDidReset(20); didReset {
			t.Error("expected ResetIfCurrentDidReset to report false for a stale epoch")
		}
		if c.closed.Load() {
			t.Error("expected the connection to be left open on a stale epoch")
		}
	})
}

// Test 12: ReadArr returns the caller its own copy, not a view of the shared
// package-level `buffer` (commit 731f1074f9). The distinguishing property is
// that a slice already handed out cannot be retroactively rewritten by a
// later read into that same buffer — which is what a returned `buffer[:n]`
// view would do, silently, to bytes the caller has not finished with.
//
// This is deliberately serial. The single-permanent-reader invariant makes a
// second concurrent ReadArr a data race on `buffer` itself (see the comment
// on TestConcurrentReadWriteAndResetsThroughRealEntryPoints), so the copy is
// not what makes concurrency safe; it is what keeps a regression in that
// invariant from corrupting data the caller already owns.
//
// Falsified: replacing ReadArr's `out := make([]byte, n); copy(out,
// buffer[:n]); return out, nil` with `return buffer[:n], nil` makes both
// assertions below fail.
func TestReadArr_ReturnsPrivateCopy(t *testing.T) {
	resetConnStateForTest(t)
	setupReadArrBuffer(t, 4096)
	NotifyJSReady()

	local, remote := net.Pipe()
	t.Cleanup(func() { _ = local.Close(); _ = remote.Close() })
	setConn(remote, 1)

	first := bytes.Repeat([]byte{'a'}, 64)
	go func() { _, _ = local.Write(first) }()

	got, err := ReadArr()
	if err != nil {
		t.Fatalf("ReadArr returned error: %v", err)
	}
	if !bytes.Equal(got, first) {
		t.Fatalf("unexpected first read: %q", got)
	}

	// A later read into the shared buffer must not touch the slice already
	// handed out. Same length, different content, so a buffer view would be
	// rewritten in place with no length change to hint at it.
	second := bytes.Repeat([]byte{'b'}, 64)
	go func() { _, _ = local.Write(second) }()
	if _, err := ReadArr(); err != nil {
		t.Fatalf("second ReadArr returned error: %v", err)
	}
	if !bytes.Equal(got, first) {
		t.Errorf("a later ReadArr rewrote a slice already returned to the caller: %q", got)
	}

	// Nor may anything else scribbling on the shared buffer reach it.
	for i := range buffer {
		buffer[i] = 'z'
	}
	if !bytes.Equal(got, first) {
		t.Errorf("returned slice aliases the shared buffer: %q", got)
	}
}

// blockingShortWriteConn parks in Write until release is closed, signalling
// entry on entered, and then reports a short write (one byte fewer than
// asked, no error) to drive WriteArr's short-write reset path.
type blockingShortWriteConn struct {
	trackingConn
	entered chan struct{}
	release chan struct{}
	once    sync.Once
}

func (c *blockingShortWriteConn) Write(p []byte) (int, error) {
	c.once.Do(func() { close(c.entered) })
	<-c.release
	if len(p) == 0 {
		return 0, nil
	}
	return len(p) - 1, nil
}

// Test 13: the mirror image of Test 8, on the write side. WriteArr captures
// connEpoch under connMutex alongside the connection it is about to write to,
// and its short-write path hands that captured epoch to ResetIfCurrent. If it
// instead called Reset(), or re-read connEpoch at reset time, a write that
// fails on an already-superseded connection would tear down the healthy one a
// concurrent reader just dialed — which is the original bug (f57a55cf69) in
// the opposite direction.
//
// The interleaving: a write parks in conn.Write on connA/epoch 200; a redial
// swaps in connB/epoch 201 while it is still outstanding; only then does the
// write complete, short. connB must survive untouched.
//
// Falsified two ways, each making this test fail by closing connB and nilling
// conn: (1) replacing `ResetIfCurrent(currentEpoch)` in WriteArr's short-write
// branch with `Reset()`, and (2) re-reading the live connEpoch at reset time
// instead of using the epoch captured before the write.
func TestWriteArr_ShortWriteEpochCapturedBeforeRaceableWrite(t *testing.T) {
	resetConnStateForTest(t)

	connA := &blockingShortWriteConn{
		entered: make(chan struct{}),
		release: make(chan struct{}),
	}
	setConn(connA, 200)

	errCh := make(chan error, 1)
	go func() { errCh <- WriteArr([]byte("hello world")) }()

	// Wait until the writer is actually inside conn.Write on connA/epoch 200
	// (and, in correct code, has already captured currentEpoch=200 under
	// connMutex before releasing it).
	select {
	case <-connA.entered:
	case <-time.After(5 * time.Second):
		t.Fatal("WriteArr never entered conn.Write")
	}

	// A redial races in while the write above is still outstanding, exactly
	// as ensureConnection would do for a concurrent ReadArr caller recovering
	// from a failure on a different connection.
	connB := &trackingConn{}
	setConn(connB, 201)

	// Only now does the write complete — short, so WriteArr takes its reset
	// path with the stale epoch it captured before the redial.
	close(connA.release)

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatal("expected WriteArr to return an error on a short write")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("WriteArr did not return")
	}

	if connB.closed.Load() {
		t.Fatal("a stale short write tore down the connection a concurrent caller had redialed")
	}
	gotConn, gotEpoch := getConnState()
	if gotConn != connB {
		t.Errorf("expected the live connection to still be connB, got %v", gotConn)
	}
	if gotEpoch != 201 {
		t.Errorf("expected epoch to remain 201, got %d", gotEpoch)
	}
	if connA.closes.Load() != 0 {
		t.Errorf("expected the stale ResetIfCurrent to be a complete no-op, but connA was closed %d times",
			connA.closes.Load())
	}
}

// jsReadyChildEnv, when set, tells the re-executed test binary to run the
// child half of the JS-readiness test rather than skipping it.
const jsReadyChildEnv = "KEYBASE_BIND_JSREADY_CHILD"

// Test 14 (parent): ReadArr blocks on jsReadyCh until NotifyJSReady fires.
// This gates the entire startup handshake — until JS says it is ready, the Go
// side must not pull bytes off the loopback that nothing is there to receive.
//
// It cannot run in-process: NotifyJSReady is a sync.Once that closes a
// package-level channel, so the first test in this binary to call it makes
// `<-jsReadyCh` a no-op forever afterward and any "did it block?" assertion
// would pass vacuously. So re-exec this same test binary and run the child
// half in a fresh process where the once has not fired. requireJSNotYetReady
// in the child is the backstop: if that assumption is ever broken, the child
// hard-fails instead of quietly proving nothing.
//
// Falsified: deleting `<-jsReadyCh` from ReadArr makes the child fail with
// "ReadArr returned before JS signalled ready", failing this parent too.
func TestReadArr_BlocksUntilJSReady(t *testing.T) {
	if os.Getenv(jsReadyChildEnv) != "" {
		t.Skip("this is the parent half; the child runs as TestReadArrJSReadyChild")
	}
	if _, err := os.Stat(os.Args[0]); err != nil {
		t.Skipf("cannot re-exec the test binary (%v)", err)
	}

	cmd := exec.Command(os.Args[0], "-test.run=^TestReadArrJSReadyChild$", "-test.v") //nolint:gosec // G204: Re-execs this test binary itself with constant flags; no external input
	cmd.Env = append(os.Environ(), jsReadyChildEnv+"=1")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("child process failed: %v\n--- child output ---\n%s", err, out)
	}
	if !bytes.Contains(out, []byte("PASS")) {
		t.Fatalf("child process did not report PASS\n--- child output ---\n%s", out)
	}
}

// Test 14 (child): runs only in the re-executed process spawned by
// TestReadArr_BlocksUntilJSReady, where NotifyJSReady has not yet fired.
func TestReadArrJSReadyChild(t *testing.T) {
	if os.Getenv(jsReadyChildEnv) == "" {
		t.Skip("child half; spawned by TestReadArr_BlocksUntilJSReady")
	}
	// The whole point of the subprocess. If this ever trips, some earlier
	// test in the child's -test.run set called NotifyJSReady and the
	// assertions below would be meaningless.
	requireJSNotYetReady(t)

	resetConnStateForTest(t)
	setupReadArrBuffer(t, 4096)

	local, remote := net.Pipe()
	t.Cleanup(func() { _ = local.Close(); _ = remote.Close() })
	setConn(remote, 1)

	type readResult struct {
		data []byte
		err  error
	}
	resultCh := make(chan readResult, 1)
	go func() {
		data, err := ReadArr()
		resultCh <- readResult{data, err}
	}()

	// Bytes are available on the connection the whole time, so the only thing
	// that can keep ReadArr from returning is the jsReadyCh gate.
	go func() { _, _ = local.Write([]byte("hello")) }()

	select {
	case res := <-resultCh:
		t.Fatalf("ReadArr returned before JS signalled ready: data=%q err=%v", res.data, res.err)
	case <-time.After(500 * time.Millisecond):
	}

	NotifyJSReady()

	select {
	case res := <-resultCh:
		if res.err != nil {
			t.Fatalf("ReadArr returned error after NotifyJSReady: %v", res.err)
		}
		if string(res.data) != "hello" {
			t.Fatalf("unexpected data after NotifyJSReady: %q", res.data)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("ReadArr did not return after NotifyJSReady")
	}

	if !jsReadyFired() {
		t.Error("expected jsReadyFired to report true after NotifyJSReady")
	}
}
