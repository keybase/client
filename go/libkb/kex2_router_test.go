// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"testing"
	"time"

	"crypto/rand"

	"github.com/keybase/client/go/kex2"
)

type ktester struct {
	sender   kex2.DeviceID
	receiver kex2.DeviceID
	I        kex2.SessionID
	seqno    kex2.Seqno
}

func newKtester() *ktester {
	kt := &ktester{}
	if _, err := rand.Read(kt.sender[:]); err != nil {
		panic(err)
	}
	if _, err := rand.Read(kt.receiver[:]); err != nil {
		panic(err)
	}
	if _, err := rand.Read(kt.I[:]); err != nil {
		panic(err)
	}

	return kt
}

func (k *ktester) post(mr kex2.MessageRouter, b []byte) error {
	k.seqno++
	return mr.Post(k.I, k.sender, k.seqno, b)
}

func (k *ktester) get(mr kex2.MessageRouter, low kex2.Seqno, poll time.Duration) ([][]byte, error) {
	return mr.Get(k.I, k.receiver, low, poll)
}

func TestKex2Router(t *testing.T) {
	tc := SetupTest(t, "kex2 router", 1)
	mr := NewKexRouter(tc.G)
	kt := newKtester()

	m1 := "hello everybody"
	m2 := "goodbye everybody"
	m3 := "plaid shirt"

	// test send 2 messages
	if err := kt.post(mr, []byte(m1)); err != nil {
		t.Fatal(err)
	}

	if err := kt.post(mr, []byte(m2)); err != nil {
		t.Fatal(err)
	}

	// test receive 2 messages
	msgs, err := kt.get(mr, 0, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 2 {
		t.Fatalf("number of messages: %d, expected 2", len(msgs))
	}
	if string(msgs[0]) != m1 {
		t.Errorf("message 0: %q, expected %q", msgs[0], m1)
	}
	if string(msgs[1]) != m2 {
		t.Errorf("message 1: %q, expected %q", msgs[1], m2)
	}

	// test calling receive before send
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		var merr error
		// Very large timeout, for the benefit of CI, which may be slow
		msgs, merr = kt.get(mr, 3, 10*time.Second)
		if merr != nil {
			t.Errorf("receive error: %s", merr)
		}
	}()

	time.Sleep(3 * time.Millisecond)
	if err := kt.post(mr, []byte(m3)); err != nil {
		t.Fatal(err)
	}

	wg.Wait()
	if len(msgs) != 1 {
		t.Fatalf("number of messages: %d, expected 1", len(msgs))
	}
	if string(msgs[0]) != m3 {
		t.Errorf("message: %q, expected %q", msgs[0], m3)
		t.Errorf("Full message vector was: %v\n", msgs)
	}

	// test no messages ready
	msgs, err = kt.get(mr, 4, 1*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 0 {
		t.Errorf("number of messages: %d, expected 0", len(msgs))
	}
}
