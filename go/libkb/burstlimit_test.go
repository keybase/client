package libkb

import (
	"testing"
	"time"
)

func TestBurstLimiter(t *testing.T) {
	b := NewBurstLimiter(5, 1*time.Second)
	for i := 0; i < 5; i++ {
		if b.Wait(1*time.Millisecond) == false {
			t.Errorf("expected to be able to get request %d immediately", i)
		}
	}

	if b.Wait(10 * time.Millisecond) {
		t.Errorf("expected no requests available for 1s, but got one after 10ms")
	}

	if !b.Wait(1 * time.Second) {
		t.Errorf("expected a request ready after waiting 1s")
	}
}
