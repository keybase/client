// Copyright 2020 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package search

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestProgress(t *testing.T) {
	clock, start := clocktest.NewTestClockAndTimeNow()
	p := NewProgress(clock)

	t.Log("Queue one TLF")
	id1 := tlf.FakeID(1, tlf.Private)
	size1 := uint64(100)
	p.tlfQueue(id1, size1)

	type expectedProg struct {
		currTlf      tlf.ID
		q            []tlf.ID
		overallTotal int64
		overallSoFar int64
		overallEnd   keybase1.Time
		currTotal    int64
		currSoFar    int64
		currEnd      keybase1.Time
	}
	checkStatus := func(e expectedProg) {
		currProg, overallProg, currTlf, q := p.GetStatus()
		require.Len(t, q, len(e.q))
		m := make(map[tlf.ID]bool, len(q))
		for _, id := range q {
			m[id] = true
		}
		for _, id := range e.q {
			delete(m, id)
		}
		require.Len(t, m, 0)
		require.Equal(t, e.currTlf, currTlf)
		require.Equal(t, e.overallTotal, overallProg.BytesTotal)
		require.Equal(t, e.overallSoFar, overallProg.BytesSoFar)
		require.Equal(t, e.overallEnd, overallProg.EndEstimate)
		require.Equal(t, e.currTotal, currProg.BytesTotal)
		require.Equal(t, e.currSoFar, currProg.BytesSoFar)
		require.Equal(t, e.currEnd, currProg.EndEstimate)
	}
	checkStatus(expectedProg{
		q:            []tlf.ID{id1},
		overallTotal: int64(size1),
	})

	t.Log("Start the index")
	err := p.startIndex(id1, size1, indexFull)
	require.NoError(t, err)
	checkStatus(expectedProg{
		currTlf:      id1,
		currTotal:    int64(size1),
		overallTotal: int64(size1),
	})

	t.Log("Index 10 bytes in 1 second")
	clock.Add(1 * time.Second)
	p.indexedBytes(10)
	currEndEstimate := keybase1.ToTime(start.Add(10 * time.Second))
	checkStatus(expectedProg{
		currTlf:      id1,
		currTotal:    int64(size1),
		currSoFar:    10,
		currEnd:      currEndEstimate,
		overallTotal: int64(size1),
		overallSoFar: 10,
		overallEnd:   currEndEstimate,
	})

	t.Log("Queue another TLF")
	id2 := tlf.FakeID(2, tlf.Private)
	size2 := uint64(900)
	p.tlfQueue(id2, size2)
	overallEndEstimate := keybase1.ToTime(start.Add(100 * time.Second))
	checkStatus(expectedProg{
		currTlf:      id1,
		q:            []tlf.ID{id2},
		currTotal:    int64(size1),
		currSoFar:    10,
		currEnd:      currEndEstimate,
		overallTotal: int64(size1 + size2),
		overallSoFar: 10,
		overallEnd:   overallEndEstimate,
	})

	t.Log("Complete first index")
	clock.Add(9 * time.Second)
	p.indexedBytes(90)
	checkStatus(expectedProg{
		currTlf:      id1,
		q:            []tlf.ID{id2},
		currTotal:    int64(size1),
		currSoFar:    int64(size1),
		currEnd:      currEndEstimate,
		overallTotal: int64(size1 + size2),
		overallSoFar: int64(size1),
		overallEnd:   overallEndEstimate,
	})

	err = p.finishIndex(id1)
	require.NoError(t, err)
	checkStatus(expectedProg{
		q:            []tlf.ID{id2},
		overallTotal: int64(size2),
		overallEnd:   overallEndEstimate,
	})
}
