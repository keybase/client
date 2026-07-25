package libkb

import (
	"context"
	"testing"
	"time"
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

func TestProofCheckFlightUnusableResultFallsThrough(t *testing.T) {
	pc := NewProofCache(nil, 10)
	t0 := time.Now()

	mine, _ := pc.CheckFlightBegin("k", t0, t0)
	// Owner was canceled, so its result can't stand in for anyone else.
	mine.finish(nil, nil, false)

	_, theirs := pc.CheckFlightBegin("k", t0, t0)
	if theirs == nil {
		t.Fatal("expected to find the flight")
	}
	if _, _, usable := theirs.wait(context.Background()); usable {
		t.Fatal("canceled result must not be usable")
	}
}
