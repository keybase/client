// Copyright 2018 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/keybase/go-codec/codec"
	"github.com/keybase/kbfs/kbfsmd"
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
var minPrevRevisionSlotCounts = [...]uint8{1, 5, 20, 50, 100}

// PrevRevisions tracks several previous versions of a file in order
// of descending revision number, starting with the most recent.
type PrevRevisions []PrevRevisionAndCount

// addRevision returns a copy of `pr` with a new immediately-previous
// revision added, with the existing entries moved or overwritten to
// accomodate the new entry, and with increased counts.  Any existing
// revisions smaller than or equal to minRev will be removed.
func (pr PrevRevisions) addRevision(
	r, minRev kbfsmd.Revision) (ret PrevRevisions) {
	newLength := len(pr)
	if newLength < len(minPrevRevisionSlotCounts) {
		newLength++
	}
	ret = make(PrevRevisions, newLength)
	copy(ret, pr)
	earliestGoodSlot := 0
	numDropped := 0

	for i, prc := range ret {
		if prc.Count == 255 {
			panic("Previous revision count is about to overflow")
		} else if prc.Revision >= r {
			if numDropped > 0 {
				panic("Revision too large after dropping one")
			}
			// The revision number is bigger than expected (e.g. it
			// was made on an unmerged branch)
			ret[i] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
			earliestGoodSlot = i + 1
			continue
		} else if prc.Revision <= minRev {
			// This revision is too old (or is empty), so remove it.
			ret[i] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
			numDropped++
			continue
		} else if numDropped > 0 {
			panic("Once we've dropped one, we should drop all the rest")
		}
		ret[i].Count++
	}

	// Cut out the revisions that are newer than `r` (e.g., because
	// they are from an unmerged branch).
	if earliestGoodSlot > 0 {
		ret = ret[earliestGoodSlot:]
	}

	// Drop revisions off the end that are too old.
	if numDropped == len(ret) {
		// Leave the first slot available for overwriting.
		ret = ret[:1]
	} else if numDropped > 1 {
		ret = ret[:len(ret)-(numDropped-1)]
	}

	for i := len(ret) - 1; i >= 1; i-- {
		toMove := ret[i-1]
		if ret[i].Count == 0 || toMove.Count >= minPrevRevisionSlotCounts[i] {
			ret[i] = toMove
			ret[i-1] = PrevRevisionAndCount{
				Revision: kbfsmd.RevisionUninitialized,
				Count:    0,
			}
		}
	}
	ret[0] = PrevRevisionAndCount{
		Revision: r,
		Count:    1,
	}
	return ret
}
