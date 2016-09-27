// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"os"
	"reflect"

	"github.com/keybase/go-codec/codec"

	"github.com/keybase/kbfs/kbfscodec"
)

// An mdIDJournal wraps a diskJournal to provide a persistent list of
// MdIDs (with possible other fields in the future) with sequential
// MetadataRevisions for a single branch.
//
// TODO: Write unit tests for this. For now, we're relying on
// md_journal.go's unit tests.
type mdIDJournal struct {
	j diskJournal
}

// An mdIDJournalEntry is, for now, just an MdID. In the future, it
// may contain more fields. However, make sure that new fields don't
// depend on the ID, as the mdJournal may change the ID when
// converting to a branch.
type mdIDJournalEntry struct {
	ID MdID

	codec.UnknownFieldSetHandler
}

func makeMdIDJournal(codec kbfscodec.Codec, dir string) mdIDJournal {
	j := makeDiskJournal(codec, dir, reflect.TypeOf(mdIDJournalEntry{}))
	return mdIDJournal{j}
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

func (j mdIDJournal) readEarliestRevision() (MetadataRevision, error) {
	o, err := j.j.readEarliestOrdinal()
	if os.IsNotExist(err) {
		return MetadataRevisionUninitialized, nil
	} else if err != nil {
		return MetadataRevisionUninitialized, err
	}
	return ordinalToRevision(o)
}

func (j mdIDJournal) writeEarliestRevision(r MetadataRevision) error {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return err
	}
	return j.j.writeEarliestOrdinal(o)
}

func (j mdIDJournal) readLatestRevision() (MetadataRevision, error) {
	o, err := j.j.readLatestOrdinal()
	if os.IsNotExist(err) {
		return MetadataRevisionUninitialized, nil
	} else if err != nil {
		return MetadataRevisionUninitialized, err
	}
	return ordinalToRevision(o)
}

func (j mdIDJournal) writeLatestRevision(r MetadataRevision) error {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return err
	}
	return j.j.writeLatestOrdinal(o)
}

func (j mdIDJournal) readJournalEntry(r MetadataRevision) (
	mdIDJournalEntry, error) {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return mdIDJournalEntry{}, err
	}
	e, err := j.j.readJournalEntry(o)
	if err != nil {
		return mdIDJournalEntry{}, err
	}

	return e.(mdIDJournalEntry), nil
}

// All functions below are public functions.

func (j mdIDJournal) length() (uint64, error) {
	return j.j.length()
}

func (j mdIDJournal) end() (MetadataRevision, error) {
	last, err := j.readLatestRevision()
	if err != nil {
		return MetadataRevisionUninitialized, err
	}
	if last == MetadataRevisionUninitialized {
		return MetadataRevisionUninitialized, nil
	}

	return last + 1, nil
}

func (j mdIDJournal) getEarliestEntry() (
	entry mdIDJournalEntry, exists bool, err error) {
	earliestRevision, err := j.readEarliestRevision()
	if err != nil {
		return mdIDJournalEntry{}, false, err
	} else if earliestRevision == MetadataRevisionUninitialized {
		return mdIDJournalEntry{}, false, nil
	}
	entry, err = j.readJournalEntry(earliestRevision)
	if err != nil {
		return mdIDJournalEntry{}, false, err
	}
	return entry, true, err
}

func (j mdIDJournal) getLatestEntry() (
	entry mdIDJournalEntry, exists bool, err error) {
	latestRevision, err := j.readLatestRevision()
	if err != nil {
		return mdIDJournalEntry{}, false, err
	} else if latestRevision == MetadataRevisionUninitialized {
		return mdIDJournalEntry{}, false, nil
	}
	entry, err = j.readJournalEntry(latestRevision)
	if err != nil {
		return mdIDJournalEntry{}, false, err
	}
	return entry, true, err
}

func (j mdIDJournal) getEntryRange(start, stop MetadataRevision) (
	MetadataRevision, []mdIDJournalEntry, error) {
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

	var entries []mdIDJournalEntry
	for i := start; i <= stop; i++ {
		entry, err := j.readJournalEntry(i)
		if err != nil {
			return MetadataRevisionUninitialized, nil, err
		}
		entries = append(entries, entry)
	}
	return start, entries, nil
}

func (j mdIDJournal) replaceHead(entry mdIDJournalEntry) error {
	o, err := j.j.readLatestOrdinal()
	if err != nil {
		return err
	}
	return j.j.writeJournalEntry(o, entry)
}

func (j mdIDJournal) append(r MetadataRevision, entry mdIDJournalEntry) error {
	o, err := revisionToOrdinal(r)
	if err != nil {
		return err
	}
	_, err = j.j.appendJournalEntry(&o, entry)
	return err
}

func (j mdIDJournal) removeEarliest() (empty bool, err error) {
	return j.j.removeEarliest()
}

func (j mdIDJournal) clear() error {
	return j.j.clearOrdinals()
}

func (j *mdIDJournal) move(newDir string) (oldDir string, err error) {
	return j.j.move(newDir)
}
