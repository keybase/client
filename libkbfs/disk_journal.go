// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
)

// diskJournal stores an ordered list of entries.
//
// The directory layout looks like:
//
// dir/EARLIEST
// dir/LATEST
// dir/0...000
// dir/0...001
// dir/0...fff
//
// Each file in dir is named with an ordinal and contains a generic
// serializable entry object. The files EARLIEST and LATEST point to
// the earliest and latest valid ordinal, respectively.
//
// This class is not goroutine-safe; it assumes that all
// synchronization is done at a higher level.
//
// TODO: Do all high-level operations atomically on the file-system
// level.
//
// TODO: Make IO ops cancellable.
type diskJournal struct {
	codec     Codec
	dir       string
	entryType reflect.Type
}

// makeDiskJournal returns a new diskJournal for the given directory.
func makeDiskJournal(
	codec Codec, dir string, entryType reflect.Type) diskJournal {
	return diskJournal{
		codec:     codec,
		dir:       dir,
		entryType: entryType,
	}
}

// journalOrdinal is the ordinal used for naming journal entries.
//
// TODO: Support pairs, e.g. (MetadataRevision, journalOrdinal).
type journalOrdinal uint64

func makeJournalOrdinal(s string) (journalOrdinal, error) {
	if len(s) != 16 {
		return 0, fmt.Errorf("invalid journal ordinal %q", s)
	}
	u, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return 0, err
	}
	return journalOrdinal(u), nil
}

func (o journalOrdinal) String() string {
	return fmt.Sprintf("%016x", uint64(o))
}

// The functions below are for building various paths for the journal.

func (j diskJournal) earliestPath() string {
	return filepath.Join(j.dir, "EARLIEST")
}

func (j diskJournal) latestPath() string {
	return filepath.Join(j.dir, "LATEST")
}

func (j diskJournal) journalEntryPath(o journalOrdinal) string {
	return filepath.Join(j.dir, o.String())
}

// The functions below are for getting and setting the earliest and
// latest ordinals.

func (j diskJournal) readOrdinal(path string) (
	journalOrdinal, error) {
	buf, err := ioutil.ReadFile(path)
	if err != nil {
		return 0, err
	}
	return makeJournalOrdinal(string(buf))
}

func (j diskJournal) writeOrdinal(
	path string, o journalOrdinal) error {
	return ioutil.WriteFile(path, []byte(o.String()), 0600)
}

func (j diskJournal) readEarliestOrdinal() (
	journalOrdinal, error) {
	return j.readOrdinal(j.earliestPath())
}

func (j diskJournal) writeEarliestOrdinal(o journalOrdinal) error {
	return j.writeOrdinal(j.earliestPath(), o)
}

func (j diskJournal) readLatestOrdinal() (journalOrdinal, error) {
	return j.readOrdinal(j.latestPath())
}

func (j diskJournal) writeLatestOrdinal(o journalOrdinal) error {
	return j.writeOrdinal(j.latestPath(), o)
}

// The functions below are for reading and writing journal entries.

func (j diskJournal) readJournalEntry(o journalOrdinal) (
	interface{}, error) {
	p := j.journalEntryPath(o)
	buf, err := ioutil.ReadFile(p)
	if err != nil {
		return bserverJournalEntry{}, err
	}

	entry := reflect.New(j.entryType)
	err = j.codec.Decode(buf, entry)
	if err != nil {
		return nil, err
	}

	return entry.Elem().Interface(), nil
}

func (j diskJournal) writeJournalEntry(
	o journalOrdinal, entry interface{}) error {
	entryType := reflect.TypeOf(entry)
	if entryType != j.entryType {
		panic(fmt.Errorf("Expected entry type %v, got %v",
			j.entryType, entryType))
	}

	err := os.MkdirAll(j.dir, 0700)
	if err != nil {
		return err
	}

	p := j.journalEntryPath(o)

	buf, err := j.codec.Encode(entry)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(p, buf, 0600)
}

// appendJournalEntry appends the given entry to the journal. If o is
// nil, then if the journal is empty, the new entry will have ordinal
// 0, and otherwise it will have ordinal equal to the successor of the
// latest ordinal. Otherwise, if o is non-nil, then if the journal
// entry, the new entry will have ordinal *o, and otherwise it return
// an error if *o is not the successor of the latest ordinal.
func (j diskJournal) appendJournalEntry(
	o *journalOrdinal, entry interface{}) error {
	// TODO: Consider caching the latest ordinal in memory instead
	// of reading it from disk every time.
	var next journalOrdinal
	lo, err := j.readLatestOrdinal()
	if os.IsNotExist(err) {
		if o != nil {
			next = *o
		} else {
			next = 0
		}
	} else if err != nil {
		return err
	} else {
		next = lo + 1
		if next == 0 {
			// Rollover is almost certainly a bug.
			return fmt.Errorf("Ordinal rollover for %+v", entry)
		}
		if o != nil && next != *o {
			return fmt.Errorf(
				"%v unexpectedly does not follow %v for %+v",
				*o, lo, entry)
		}
	}

	err = j.writeJournalEntry(next, entry)
	if err != nil {
		return err
	}

	_, err = j.readEarliestOrdinal()
	if os.IsNotExist(err) {
		err := j.writeEarliestOrdinal(next)
		if err != nil {
			return err
		}
	} else if err != nil {
		return err
	}
	return j.writeLatestOrdinal(next)
}

func (j diskJournal) journalLength() (uint64, error) {
	first, err := j.readEarliestOrdinal()
	if os.IsNotExist(err) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	last, err := j.readLatestOrdinal()
	if err != nil {
		return 0, err
	}
	return uint64(last - first + 1), nil
}
