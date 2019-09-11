// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/stretchr/testify/require"
)

func checkRevRevisions(
	t *testing.T, pr PrevRevisions, minRev kbfsmd.Revision,
	maxRev kbfsmd.Revision, numRevisions int) {
	// Make sure the revisions are in descending order, and the counts
	// are in increasing order.
	maxMin := kbfsmd.Revision(
		minPrevRevisionSlotCounts[len(minPrevRevisionSlotCounts)-1])
	shouldBeFull := maxRev-minRev >= maxMin
	if shouldBeFull {
		require.Len(t, pr, len(minPrevRevisionSlotCounts))
	}
	require.Equal(t, uint8(1), pr[0].Count)
	for i, r := range pr {
		require.True(t, r.Revision > minRev)
		require.True(t, r.Revision <= maxRev)
		if i > 0 {
			require.True(t, r.Revision < pr[i-1].Revision)
			require.True(t, r.Count > pr[i-1].Count)
		}
	}
}

func TestPrevRevisions(t *testing.T) {
	var pr PrevRevisions
	t.Log("Add the first set of revisions")
	var i int
	for ; i < len(minPrevRevisionSlotCounts); i++ {
		rev := kbfsmd.Revision((i + 1) * 2)
		pr = pr.AddRevision(rev, 0)
		require.Len(t, pr, i+1)
		checkRevRevisions(t, pr, 0, rev, i+1)
	}
	t.Log("The next set will start replacing the prev ones")
	for ; i < len(minPrevRevisionSlotCounts)*2; i++ {
		rev := kbfsmd.Revision((i + 1) * 2)
		pr = pr.AddRevision(rev, 0)
		require.Len(t, pr, len(minPrevRevisionSlotCounts))
		checkRevRevisions(t, pr, 0, rev, i+1)
	}
	maxMin := int(minPrevRevisionSlotCounts[len(minPrevRevisionSlotCounts)-1])
	t.Log("Exceed the maximum min count")
	for ; i < maxMin+1; i++ {
		rev := kbfsmd.Revision((i + 1) * 2)
		pr = pr.AddRevision(rev, 0)
		require.Len(t, pr, len(minPrevRevisionSlotCounts))
		checkRevRevisions(t, pr, 0, rev, i+1)
	}
	t.Log("Exceed the maximum min count by even more")
	for ; i < maxMin*2+1; i++ {
		rev := kbfsmd.Revision((i + 1) * 2)
		pr = pr.AddRevision(rev, 0)
		require.Len(t, pr, len(minPrevRevisionSlotCounts))
		checkRevRevisions(t, pr, 0, rev, i+1)
	}
	t.Log("Garbage collect past the oldest revision")
	gcRev := pr[len(pr)-1].Revision + 1
	i++
	rev := kbfsmd.Revision((i + 1) * 2)
	pr = pr.AddRevision(rev, gcRev)
	require.Len(t, pr, len(minPrevRevisionSlotCounts))
	checkRevRevisions(t, pr, gcRev, rev, i+1)
	t.Log("Garbage collect past the final two revisions")
	gcRev = pr[len(pr)-2].Revision + 1
	i++
	rev = kbfsmd.Revision((i + 1) * 2)
	pr = pr.AddRevision(rev, gcRev)
	require.Len(t, pr, len(minPrevRevisionSlotCounts)-1)
	checkRevRevisions(t, pr, gcRev, rev, i+1)
	t.Log("Garbage collect everything")
	gcRev = pr[0].Revision
	i++
	rev = kbfsmd.Revision((i + 1) * 2)
	pr = pr.AddRevision(rev, gcRev)
	require.Len(t, pr, 1)
	checkRevRevisions(t, pr, gcRev, rev, i+1)

	t.Log("Fill it up again")
	for j := kbfsmd.Revision(1); j < 5; j++ {
		pr = pr.AddRevision(rev+j, gcRev)
	}

	t.Log("A lower revision number wipes everything out")
	rev--
	pr = pr.AddRevision(rev, gcRev)
	require.Len(t, pr, 1)
}
