// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"os"
	"reflect"
)

// An mdServerBranchJournal wraps a diskJournal to provide a
// persistent list of MdIDs with sequential MetadataRevisions for a
// single branch.
//
// TODO: Consider future-proofing this in case we want to journal
// other stuff besides metadata puts. But doing so would be difficult,
// since then we would require the ordinals to be something other than
// MetadataRevisions.
type mdServerBranchJournal struct {
	j diskJournal
}

func makeMDServerBranchJournal(codec Codec, dir string) mdServerBranchJournal {
	j := makeDiskJournal(codec, dir, reflect.TypeOf(MdID{}))
	return mdServerBranchJournal{j}
}

func ordinalToRevision(o journalOrdinal) (MetadataRevision, error) {
	r := MetadataRevision(o)
	if r < MetadataRevisionInitial {
		return MetadataRevisionUninitialized,
			fmt.Errorf("Cannot convert ordinal %s to a MetadataRevision", o)
	}
	return r, nil
}

func revisionToOrdinal(r MetadataRevision) (journalOrdinal, error) {
	if r < MetadataRevisionInitial {
		return journalOrdinal(0),
			fmt.Errorf("Cannot convert revision %s to an ordinal", r)
	}
	return journalOrdinal(r), nil
}

// TODO: Consider caching the values returned by the read functions
// below in memory.

func (j mdServerBranchJournal) readEarliestRevision() (
	MetadataRevision, error) {
	o, err := j.j.readEarliestOrdinal()
	if os.IsNotExist(err) {
		return MetadataRevisionUninitialized, nil
	} else if err != nil {
		return MetadataRevisionUninitialized, err
	}
	return ordinalToRevision(o)
}

func (j mdServerBranchJournal) writeEarliestRevision(r MetadataRevision) error {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return err
	}
	return j.j.writeEarliestOrdinal(o)
}

func (j mdServerBranchJournal) readLatestRevision() (
	MetadataRevision, error) {
	o, err := j.j.readLatestOrdinal()
	if os.IsNotExist(err) {
		return MetadataRevisionUninitialized, nil
	} else if err != nil {
		return MetadataRevisionUninitialized, err
	}
	return ordinalToRevision(o)
}

func (j mdServerBranchJournal) writeLatestRevision(r MetadataRevision) error {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return err
	}
	return j.j.writeLatestOrdinal(o)
}

func (j mdServerBranchJournal) readMdID(r MetadataRevision) (MdID, error) {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return MdID{}, err
	}
	e, err := j.j.readJournalEntry(o)
	if err != nil {
		return MdID{}, err
	}

	// TODO: Validate MdID?
	return e.(MdID), nil
}

// All functions below are public functions.

func (j mdServerBranchJournal) journalLength() (uint64, error) {
	return j.j.journalLength()
}

func (j mdServerBranchJournal) getHead() (MdID, error) {
	latestRevision, err := j.readLatestRevision()
	if err != nil {
		return MdID{}, err
	} else if latestRevision == MetadataRevisionUninitialized {
		return MdID{}, nil
	}
	return j.readMdID(latestRevision)
}

func (j mdServerBranchJournal) getRange(
	start, stop MetadataRevision) (MetadataRevision, []MdID, error) {
	earliestRevision, err := j.readEarliestRevision()
	if err != nil {
		return MetadataRevisionUninitialized, nil, err
	} else if earliestRevision == MetadataRevisionUninitialized {
		return MetadataRevisionUninitialized, nil, nil
	}

	latestRevision, err := j.readLatestRevision()
	if err != nil {
		return MetadataRevisionUninitialized, nil, err
	} else if latestRevision == MetadataRevisionUninitialized {
		return MetadataRevisionUninitialized, nil, nil
	}

	if start < earliestRevision {
		start = earliestRevision
	}

	if stop > latestRevision {
		stop = latestRevision
	}

	if stop < start {
		return MetadataRevisionUninitialized, nil, nil
	}

	var mdIDs []MdID
	for i := start; i <= stop; i++ {
		mdID, err := j.readMdID(i)
		if err != nil {
			return MetadataRevisionUninitialized, nil, err
		}
		mdIDs = append(mdIDs, mdID)
	}
	return start, mdIDs, nil
}

func (j mdServerBranchJournal) append(r MetadataRevision, mdID MdID) error {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return err
	}
	return j.j.appendJournalEntry(&o, mdID)
}
