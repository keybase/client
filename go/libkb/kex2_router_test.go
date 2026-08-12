// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/rand"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/stretchr/testify/require"
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
	defer tc.Cleanup()

	mr := NewKexRouter(NewMetaContextTODO(tc.G))
	kt := newKtester()

	m1 := "hello everybody"
	m2 := "goodbye everybody"
	m3 := "plaid shirt"

	// test send 2 messages
	if err := kt.post(mr, []byte(m1)); err != nil {
		require.NoError(t, err)
	}

	if err := kt.post(mr, []byte(m2)); err != nil {
		require.NoError(t, err)
	}

	// test receive 2 messages
	msgs, err := kt.get(mr, 0, 100*time.Millisecond)
	require.NoError(t, err)
	require.Len(t, msgs, 2, "number of messages: %d, expected 2", len(msgs))
	require.Equal(t, m1, string(msgs[0]), "message 0: %q, expected %q", msgs[0], m1)
	require.Equal(t, m2, string(msgs[1]), "message 1: %q, expected %q", msgs[1], m2)

	// test calling receive before send
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		var merr error
		// Very large timeout, for the benefit of CI, which may be slow
		msgs, merr = kt.get(mr, 3, 10*time.Second)
		require.False(t, merr != nil, "receive error: %s", merr)
	}()

	time.Sleep(3 * time.Millisecond)
	if err := kt.post(mr, []byte(m3)); err != nil {
		require.NoError(t, err)
	}

	wg.Wait()
	require.Len(t, msgs, 1, "number of messages: %d, expected 1", len(msgs))
	require.Equal(t, m3, string(msgs[0]), "message: %q, expected %q", msgs[0], m3)

	// test no messages ready
	msgs, err = kt.get(mr, 4, 1*time.Millisecond)
	require.NoError(t, err)
	require.Equal(t, 0, len(msgs), "number of messages: %d, expected 0", len(msgs))
}
