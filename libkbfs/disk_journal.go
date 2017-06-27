// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strconv"

	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/pkg/errors"
)

// journalOrdinal is the ordinal used for naming journal entries.
type journalOrdinal uint64

// TODO: Define the zero journalOrdinal as invalid, once no existing
// journals use them.

const firstValidJournalOrdinal journalOrdinal = 1

func makeJournalOrdinal(s string) (journalOrdinal, error) {
	if len(s) != 16 {
		return 0, errors.Errorf("invalid journal ordinal %q", s)
	}
	u, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return 0, errors.Wrapf(err, "failed to parse %q", s)
	}
	return journalOrdinal(u), nil
}

func (o journalOrdinal) String() string {
	return fmt.Sprintf("%016x", uint64(o))
}

// diskJournal stores an ordered list of entries in a directory, which
// is assumed to not be used by anything else.
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
	codec     kbfscodec.Codec
	dir       string
	entryType reflect.Type

	// The journal must be considered empty when either
	// earliestValid or latestValid is false.

	earliestValid bool
	earliest      journalOrdinal

	latestValid bool
	latest      journalOrdinal
}

// makeDiskJournal returns a new diskJournal for the given directory.
func makeDiskJournal(
	codec kbfscodec.Codec, dir string, entryType reflect.Type) (
	*diskJournal, error) {
	j := &diskJournal{
		codec:     codec,
		dir:       dir,
		entryType: entryType,
	}

	earliest, err := j.readEarliestOrdinalFromDisk()
	if ioutil.IsNotExist(err) {
		// Continue with j.earliestValid = false.
	} else if err != nil {
		return nil, err
	} else {
		j.earliestValid = true
		j.earliest = earliest
	}

	latest, err := j.readLatestOrdinalFromDisk()
	if ioutil.IsNotExist(err) {
		// Continue with j.latestValid = false.
	} else if err != nil {
		return nil, err
	} else {
		j.latestValid = true
		j.latest = latest
	}

	return j, nil
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

// The functions below are for reading and writing the earliest and
// latest ordinals. The read functions may return an error for which
// ioutil.IsNotExist() returns true.

func (j diskJournal) readOrdinalFromDisk(path string) (journalOrdinal, error) {
	buf, err := ioutil.ReadFile(path)
	if err != nil {
		return 0, err
	}
	return makeJournalOrdinal(string(buf))
}

func (j *diskJournal) writeOrdinalToDisk(path string, o journalOrdinal) error {
	return ioutil.WriteSerializedFile(path, []byte(o.String()), 0600)
}

func (j diskJournal) readEarliestOrdinalFromDisk() (journalOrdinal, error) {
	return j.readOrdinalFromDisk(j.earliestPath())
}

func (j diskJournal) readLatestOrdinalFromDisk() (journalOrdinal, error) {
	return j.readOrdinalFromDisk(j.latestPath())
}

func (j diskJournal) empty() bool {
	return !j.earliestValid || !j.latestValid
}

// TODO: Change {read,write}{Earliest,Latest}Ordinal() to
// {get,set}{Earliest,Latest}Ordinal(), and have the getters return an
// isValid bool, or an invalid journalOrdinal instead of an error.

func (j diskJournal) readEarliestOrdinal() (journalOrdinal, error) {
	if j.empty() {
		return journalOrdinal(0), errors.WithStack(os.ErrNotExist)
	}
	return j.earliest, nil
}

func (j *diskJournal) writeEarliestOrdinal(o journalOrdinal) error {
	err := j.writeOrdinalToDisk(j.earliestPath(), o)
	if err != nil {
		return err
	}
	j.earliestValid = true
	j.earliest = o
	return nil
}

func (j diskJournal) readLatestOrdinal() (journalOrdinal, error) {
	if j.empty() {
		return journalOrdinal(0), errors.WithStack(os.ErrNotExist)
	}
	return j.latest, nil
}

func (j *diskJournal) writeLatestOrdinal(o journalOrdinal) error {
	err := j.writeOrdinalToDisk(j.latestPath(), o)
	if err != nil {
		return err
	}
	j.latestValid = true
	j.latest = o
	return nil
}

// clear completely removes the journal directory.
func (j *diskJournal) clear() error {
	// Clear ordinals first to not leave the journal in a weird
	// state if we crash in the middle of removing the files,
	// assuming that file removal is atomic.
	err := ioutil.Remove(j.earliestPath())
	if err != nil {
		return err
	}

	// If we crash here, on the next startup the journal will
	// still be considered empty.

	j.earliestValid = false
	j.earliest = journalOrdinal(0)

	err = ioutil.Remove(j.latestPath())
	if err != nil {
		return err
	}

	j.latestValid = false
	j.latest = journalOrdinal(0)

	// j.dir will be recreated on the next call to
	// writeJournalEntry (via kbfscodec.SerializeToFile), which
	// must always come before any ordinal write.
	return ioutil.RemoveAll(j.dir)
}

// removeEarliest removes the earliest entry in the journal. If that
// entry was the last one, clear() is also called, and true is
// returned.
func (j *diskJournal) removeEarliest() (empty bool, err error) {
	if j.empty() {
		// TODO: Return a more meaningful error.
		return false, errors.WithStack(os.ErrNotExist)
	}

	if j.earliest == j.latest {
		err := j.clear()
		if err != nil {
			return false, err
		}
		return true, nil
	}

	oldEarliest := j.earliest

	err = j.writeEarliestOrdinal(oldEarliest + 1)
	if err != nil {
		return false, err
	}

	// Garbage-collect the old entry. If we crash here and leave
	// behind an entry, it'll be cleaned up the next time clear()
	// is called.
	p := j.journalEntryPath(oldEarliest)
	err = ioutil.Remove(p)
	if err != nil {
		return false, err
	}

	return false, nil
}

// The functions below are for reading and writing journal entries.

func (j diskJournal) readJournalEntry(o journalOrdinal) (interface{}, error) {
	p := j.journalEntryPath(o)
	entry := reflect.New(j.entryType)
	err := kbfscodec.DeserializeFromFile(j.codec, p, entry)
	if err != nil {
		return nil, err
	}

	return entry.Elem().Interface(), nil
}

func (j *diskJournal) writeJournalEntry(
	o journalOrdinal, entry interface{}) error {
	entryType := reflect.TypeOf(entry)
	if entryType != j.entryType {
		panic(errors.Errorf("Expected entry type %v, got %v",
			j.entryType, entryType))
	}

	return kbfscodec.SerializeToFile(j.codec, entry, j.journalEntryPath(o))
}

// appendJournalEntry appends the given entry to the journal. If o is
// nil, then if the journal is empty, the new entry will have ordinal
// 0, and otherwise it will have ordinal equal to the successor of the
// latest ordinal. Otherwise, if o is non-nil, then if the journal is
// empty, the new entry will have ordinal *o, and otherwise it returns
// an error if *o is not the successor of the latest ordinal. If
// successful, appendJournalEntry returns the ordinal of the
// just-appended entry.
func (j *diskJournal) appendJournalEntry(
	o *journalOrdinal, entry interface{}) (journalOrdinal, error) {
	var next journalOrdinal
	if j.empty() {
		if o != nil {
			next = *o
		} else {
			next = firstValidJournalOrdinal
		}
	} else {
		next = j.latest + 1
		if next == 0 {
			// Rollover is almost certainly a bug.
			return 0, errors.Errorf(
				"Ordinal rollover for %+v", entry)
		}
		if o != nil && next != *o {
			return 0, errors.Errorf(
				"%v unexpectedly does not follow %v for %+v",
				*o, j.latest, entry)
		}
	}

	err := j.writeJournalEntry(next, entry)
	if err != nil {
		return 0, err
	}

	if j.empty() {
		err := j.writeEarliestOrdinal(next)
		if err != nil {
			return 0, err
		}
	}
	err = j.writeLatestOrdinal(next)
	if err != nil {
		return 0, err
	}
	return next, nil
}

// move moves the journal to the given directory, which should share
// the same parent directory as the current journal directory.
func (j *diskJournal) move(newDir string) (oldDir string, err error) {
	err = ioutil.Rename(j.dir, newDir)
	if err != nil && !ioutil.IsNotExist(err) {
		return "", err
	}
	oldDir = j.dir
	j.dir = newDir
	return oldDir, nil
}

func (j diskJournal) length() uint64 {
	if j.empty() {
		return 0
	}
	return uint64(j.latest - j.earliest + 1)
}
