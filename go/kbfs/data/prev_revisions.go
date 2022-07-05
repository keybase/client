// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package data

import (
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/go-codec/codec"
)

// PrevRevisionAndCount track the MD version of a previous revision of
// a dir entry, and how many revisions ago that was from the current
// revision.
type PrevRevisionAndCount struct {
	Revision kbfsmd.Revision `codec:"r"`
	Count    uint8           `codec:"c"`

	codec.UnknownFieldSetHandler
}

// minPrevRevisionSlotCounts defines the "min count" of each
// corresponding entry in a `PrevRevisions` slice.  The length of
// `minPrevRevisionSlotCounts` is the max length of a `PrevRevisions`
// slice.
var minPrevRevisionSlotCounts = [...]uint8{1, 5, 10, 25, 100}

// PrevRevisions tracks several previous versions of a file in order
// of descending revision number, starting with the most recent.
type PrevRevisions []PrevRevisionAndCount

// AddRevision returns a copy of `pr` with a new immediately-previous
// revision added, with the existing entries moved or overwritten to
// accomodate the new entry, and with increased counts.  Any existing
// revisions smaller than or equal to minRev will be removed.
func (pr PrevRevisions) AddRevision(
	r, minRev kbfsmd.Revision) (ret PrevRevisions) {
	newLength := len(pr)
	if newLength < len(minPrevRevisionSlotCounts) {
		newLength++
	}
	ret = make(PrevRevisions, newLength)
	copy(ret, pr)
	earliestGoodSlot := 0
	numDropped := 0

	// First we eliminate any revisions in the current list that don't
	// make sense anymore, either because they're greater or equal to
	// `r`, or they're smaller or equal to `minRev` (and thus have
	// been GC'd).  For example:
	//
	// pr = [27, 25, 15, 10, 5] (revision numbers only)
	// r  = 27
	// minRev = 11
	//
	// After this next block, we should have:
	//
	// ret = [0, 25, 15, 0, 0]
	// earliestGoodSlot = 1
	// numDropped = 2
	//
	// Then the next block of code will trim it appropriately.
	for i, prc := range ret {
		switch {
		case prc.Count == 255:
			// This count on this revision is too large, so remove it
			// before it overflows.  This may happen when revisions
			// are repeatedly overwritten when on an unmerged branch,
			// as in the case below.
			ret[i] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
			numDropped++
			continue
		case prc.Revision >= r:
			if numDropped > 0 {
				panic("Revision too large after dropping one")
			}
			// The revision number is bigger than expected (e.g. it
			// was made on an unmerged branch).
			ret[i] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
			earliestGoodSlot = i + 1
			continue
		case prc.Revision <= minRev:
			// This revision is too old (or is empty), so remove it.
			ret[i] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
			numDropped++
			continue
		case numDropped > 0:
			panic("Once we've dropped one, we should drop all the rest")
		}
		// `minRev` < `prc.Revision` < `r`, so we keep it in the new
		// slice and increment its count.
		ret[i].Count++
	}

	// Cut out the revisions that are newer than `r` (e.g., because
	// they are from an unmerged branch).
	//
	// Continuing the example above, this code will leave us with:
	//
	// ret = [25, 15, 0, 0]
	if earliestGoodSlot > 0 {
		if earliestGoodSlot == len(ret) {
			// Always leave at least one empty slot.
			earliestGoodSlot--
		}
		ret = ret[earliestGoodSlot:]
	}

	// Drop revisions off the end that are too old, but leave an empty
	// slot available at the end for shifting everything over and
	// putting `r` in slot 0.
	//
	// Continuing the example above, this code will leave us with:
	//
	// ret = [25, 15, 0]
	if numDropped == len(ret) {
		// Leave the first slot available for overwriting.
		ret = ret[:1]
	} else if numDropped > 1 {
		ret = ret[:len(ret)-(numDropped-1)]
	}

	// Starting at the end, shift revisions to the right if either a)
	// that slot is already empty or b) they satisfy the count of the
	// slot to the right.  If a revision is not going to shifted, but
	// it is too close (in terms of count) to the revision on its
	// right, just drop it and let the other revisions slide over --
	// this makes sure we have a nicely-spaced set of revision numbers
	// even when the total number of revisions for the entry is small.
	//
	// Continuing the example above, this code will leave us with:
	//
	// ret = [0, 25, 15]
	for i := len(ret) - 1; i >= 1; i-- {
		// Check if we can shift over the entry in slot i-1.
		minCount := minPrevRevisionSlotCounts[i]
		if ret[i].Count == 0 || ret[i-1].Count >= minCount {
			ret[i], ret[i-1] = ret[i-1], PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
		} else if ret[i].Count-ret[i-1].Count < minCount/5 {
			// This revision is not being shifted, but it's
			// uncomfortablely close to its neighbor on the right, so
			// just drop it.
			ret[i-1] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
		}
	}

	// Finally, overwrite whatever's left in the first slot with `r`
	// and a count of 1.
	//
	// Continuing the example above, this code will leave us with:
	//
	// ret = [27, 25, 15]
	ret[0] = PrevRevisionAndCount{
		Revision: r,
		Count:    1,
	}
	return ret
}
