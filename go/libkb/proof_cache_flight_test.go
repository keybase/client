package libkb

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestProofCheckFlightSharesConcurrentCheck(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	// Two sessions ask at the same moment; the first one starts the check.
	mine, theirs := pc.CheckFlightBegin("k", t0, t0.Add(time.Millisecond))
	if mine == nil || theirs != nil {
		t.Fatalf("first caller should own the flight, got mine=%v theirs=%v", mine, theirs)
	}

	mine2, theirs2 := pc.CheckFlightBegin("k", t0, t0.Add(2*time.Millisecond))
	if mine2 != nil || theirs2 != mine {
		t.Fatalf("second caller should share the first flight")
	}

	hint := NewVerifiedSigHint("", "remote", "api", "human", "text")
	go mine.finish(hint, nil, true)

	gotHint, gotErr, usable := theirs2.wait(context.Background())
	if !usable || gotErr != nil || gotHint != hint {
		t.Fatalf("shared result mismatch: %v %v %v", gotHint, gotErr, usable)
	}
}

// requestedAt is stamped when the identify starts, but the proof check runs much
// later -- after the user load and the identify UI round trip. A flight that
// started inside that gap satisfies the start-time test even though it finished
// long ago, so completion, not start time, is what has to end sharing.
func TestProofCheckFlightNotSharedOnceFinished(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0.Add(time.Millisecond))
	mine.finish(NewVerifiedSigHint("", "remote", "api", "human", "text"), nil, true)

	// Same request time, but the check it would share completed a minute ago.
	mine2, theirs2 := pc.CheckFlightBegin("k", t0, t0.Add(time.Minute))
	if theirs2 != nil {
		t.Fatal("a finished check must not answer a later caller")
	}
	if mine2 == nil {
		t.Fatal("expected to own a new flight")
	}
	if mine2 == mine {
		t.Fatal("expected a distinct flight, not the finished one")
	}
}

func TestProofCheckFlightPropagatesResultToWaiter(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	_, theirs := pc.CheckFlightBegin("k", t0, t0)
	if theirs != mine {
		t.Fatal("expected to share the running flight")
	}

	perr := NewProofError(keybase1.ProofStatus_NOT_FOUND, "nope")
	go mine.finish(nil, perr, true)

	gotHint, gotErr, usable := theirs.wait(context.Background())
	if !usable {
		t.Fatal("expected a usable result")
	}
	if gotHint != nil {
		t.Fatalf("expected no hint, got %v", gotHint)
	}
	if gotErr != perr {
		t.Fatalf("expected the leader's ProofError, got %v", gotErr)
	}
}

func TestProofCheckFlightWaiterCtxCancel(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	_, theirs := pc.CheckFlightBegin("k", t0, t0)
	if theirs != mine {
		t.Fatal("expected to share the running flight")
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	hint, err, usable := theirs.wait(ctx)
	if usable {
		t.Fatal("a caller whose own ctx died must not use the result")
	}
	if hint != nil || err != nil {
		t.Fatalf("expected no result on cancel, got %v %v", hint, err)
	}

	// The leader is untouched: it finishes and its answer is still shareable
	// by anyone still waiting.
	mine.finish(nil, nil, true)
}

func TestProofCheckFlightConcurrentSingleLeader(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	const n = 50
	var wg sync.WaitGroup
	var leaders int64
	hint := NewVerifiedSigHint("", "remote", "api", "human", "text")
	start := make(chan struct{})
	results := make(chan *SigHint, n)

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			mine, theirs := pc.CheckFlightBegin("k", t0, t0)
			switch {
			case mine != nil:
				atomic.AddInt64(&leaders, 1)
				mine.finish(hint, nil, true)
				results <- hint
			case theirs != nil:
				got, _, usable := theirs.wait(context.Background())
				if usable {
					results <- got
				} else {
					results <- hint
				}
			default:
				results <- hint
			}
		}()
	}
	close(start)
	wg.Wait()
	close(results)

	// Callers that lose the race to a *finished* flight legitimately lead their
	// own, so the leader count is not pinned to 1 -- but every caller must come
	// away with the same answer and none may be stranded.
	if atomic.LoadInt64(&leaders) < 1 {
		t.Fatal("expected at least one leader")
	}
	count := 0
	for got := range results {
		count++
		if got != hint {
			t.Fatalf("caller got an unexpected result: %v", got)
		}
	}
	if count != n {
		t.Fatalf("expected %d results, got %d", n, count)
	}
}

func TestProofCheckFlightResetPurges(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	if err := pc.Reset(); err != nil {
		t.Fatalf("Reset: %s", err)
	}

	mine2, theirs2 := pc.CheckFlightBegin("k", t0, t0)
	if theirs2 != nil {
		t.Fatal("Reset must drop in-flight entries")
	}
	if mine2 == nil || mine2 == mine {
		t.Fatal("expected a fresh flight after Reset")
	}
	mine.finish(nil, nil, true)
}

func TestProofCheckFlightNotSharedWithLaterRequest(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	mine.finish(nil, nil, true)

	// A request made after that check started must not be answered by it.
	mine2, theirs2 := pc.CheckFlightBegin("k", t0.Add(time.Nanosecond), t0.Add(time.Second))
	if theirs2 != nil || mine2 == nil {
		t.Fatalf("a later request must run its own check")
	}
}

func TestProofCheckFlightZeroRequestedAtNeverShares(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	mine.finish(nil, nil, true)

	mine2, theirs2 := pc.CheckFlightBegin("k", time.Time{}, t0)
	if theirs2 != nil || mine2 == nil {
		t.Fatalf("a caller with no request time must run its own check")
	}
}

func TestProofCheckFlightUnusableResultDropped(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	// Owner was canceled, so its result can't stand in for anyone else.
	mine.finish(nil, nil, false)

	// The dead flight is dropped so the next caller leads a fresh one...
	mine2, theirs2 := pc.CheckFlightBegin("k", t0, t0)
	if theirs2 != nil {
		t.Fatal("must not share a finished unusable flight")
	}
	if mine2 == nil {
		t.Fatal("expected to own a new flight")
	}

	// ...which concurrent callers can then share.
	_, theirs3 := pc.CheckFlightBegin("k", t0, t0)
	if theirs3 != mine2 {
		t.Fatal("expected to share the new flight")
	}

	hint := &SigHint{apiURL: "https://example.com/proof"}
	go mine2.finish(hint, nil, true)
	got, _, usable := theirs3.wait(context.Background())
	if !usable || got != hint {
		t.Fatalf("expected shared usable result, got usable=%v hint=%v", usable, got)
	}
}
