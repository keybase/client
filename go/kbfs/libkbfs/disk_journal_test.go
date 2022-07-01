// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testJournalEntry struct {
	I int
}

func requireEqualOrdinal(t *testing.T, o journalOrdinal, err error,
	oDisk journalOrdinal, errDisk error) {
	require.Equal(t, oDisk, o)
	if ioutil.IsNotExist(err) && ioutil.IsNotExist(errDisk) {
		return
	}
	require.NoError(t, err)
	require.NoError(t, errDisk)
}

// TestDiskJournalOrdinals makes sure the in-memory ordinals stay in
// sync with the on-disk ones.
func TestDiskJournalOrdinals(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_journal")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	codec := kbfscodec.NewMsgpack()
	j, err := makeDiskJournal(
		codec, tempdir, reflect.TypeOf(testJournalEntry{}))
	require.NoError(t, err)

	readEarliest := func() (journalOrdinal, error) {
		earliest, err := j.readEarliestOrdinal()
		earliestDisk, errDisk := j.readEarliestOrdinalFromDisk()
		requireEqualOrdinal(t, earliest, err, earliestDisk, errDisk)
		return earliest, err
	}

	readLatest := func() (journalOrdinal, error) {
		latest, err := j.readLatestOrdinal()
		latestDisk, errDisk := j.readLatestOrdinalFromDisk()
		requireEqualOrdinal(t, latest, err, latestDisk, errDisk)
		return latest, err
	}

	expectEmpty := func() {
		_, err = readEarliest()
		require.True(t, ioutil.IsNotExist(err))
		_, err = readLatest()
		require.True(t, ioutil.IsNotExist(err))
	}

	expectRange := func(
		expectedEarliest, expectedLatest journalOrdinal) {
		earliest, err := readEarliest()
		require.NoError(t, err)
		require.Equal(t, expectedEarliest, earliest)

		latest, err := readLatest()
		require.NoError(t, err)
		require.Equal(t, expectedLatest, latest)
	}

	expectEmpty()

	o, err := j.appendJournalEntry(nil, testJournalEntry{1})
	require.NoError(t, err)
	require.Equal(t, firstValidJournalOrdinal, o)

	expectRange(firstValidJournalOrdinal, firstValidJournalOrdinal)

	o, err = j.appendJournalEntry(nil, testJournalEntry{1})
	require.NoError(t, err)
	require.Equal(t, firstValidJournalOrdinal+1, o)

	expectRange(firstValidJournalOrdinal, firstValidJournalOrdinal+1)

	empty, err := j.removeEarliest()
	require.NoError(t, err)
	require.False(t, empty)

	expectRange(firstValidJournalOrdinal+1, firstValidJournalOrdinal+1)

	err = j.clear()
	require.NoError(t, err)

	expectEmpty()
}

func TestDiskJournalClear(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_journal")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	codec := kbfscodec.NewMsgpack()
	j, err := makeDiskJournal(
		codec, tempdir, reflect.TypeOf(testJournalEntry{}))
	require.NoError(t, err)

	o, err := j.appendJournalEntry(nil, testJournalEntry{1})
	require.NoError(t, err)
	require.Equal(t, firstValidJournalOrdinal, o)

	o, err = j.appendJournalEntry(nil, testJournalEntry{2})
	require.NoError(t, err)
	require.Equal(t, firstValidJournalOrdinal+1, o)

	err = j.clear()
	require.NoError(t, err)

	_, err = ioutil.Stat(tempdir)
	require.True(t, ioutil.IsNotExist(err))
}

func TestDiskJournalMoveEmpty(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_journal")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	oldDir := filepath.Join(tempdir, "journaldir")
	newDir := oldDir + ".new"

	codec := kbfscodec.NewMsgpack()
	j, err := makeDiskJournal(
		codec, oldDir, reflect.TypeOf(testJournalEntry{}))
	require.NoError(t, err)
	require.Equal(t, oldDir, j.dir)

	moveOldDir, err := j.move(newDir)
	require.NoError(t, err)
	require.Equal(t, oldDir, moveOldDir)
	require.Equal(t, newDir, j.dir)
}

func TestDiskJournalMove(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_journal")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	oldDir := filepath.Join(tempdir, "journaldir")
	newDir := oldDir + ".new"

	codec := kbfscodec.NewMsgpack()
	j, err := makeDiskJournal(
		codec, oldDir, reflect.TypeOf(testJournalEntry{}))
	require.NoError(t, err)
	require.Equal(t, oldDir, j.dir)

	o, err := j.appendJournalEntry(nil, testJournalEntry{1})
	require.NoError(t, err)
	require.Equal(t, firstValidJournalOrdinal, o)

	moveOldDir, err := j.move(newDir)
	require.NoError(t, err)
	require.Equal(t, oldDir, moveOldDir)
	require.Equal(t, newDir, j.dir)

	entry, err := j.readJournalEntry(o)
	require.NoError(t, err)
	require.Equal(t, testJournalEntry{1}, entry)
}
