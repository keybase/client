// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testJournalEntry struct {
	I int
}

func TestDiskJournalClear(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "disk_journal")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	codec := kbfscodec.NewMsgpack()
	j := makeDiskJournal(codec, tempdir, reflect.TypeOf(testJournalEntry{}))

	o, err := j.appendJournalEntry(nil, testJournalEntry{1})
	require.NoError(t, err)
	require.Equal(t, journalOrdinal(0), o)

	o, err = j.appendJournalEntry(nil, testJournalEntry{2})
	require.NoError(t, err)
	require.Equal(t, journalOrdinal(1), o)

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
	j := makeDiskJournal(codec, oldDir, reflect.TypeOf(testJournalEntry{}))
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
	j := makeDiskJournal(codec, oldDir, reflect.TypeOf(testJournalEntry{}))
	require.Equal(t, oldDir, j.dir)

	o, err := j.appendJournalEntry(nil, testJournalEntry{1})
	require.NoError(t, err)
	require.Equal(t, journalOrdinal(0), o)

	moveOldDir, err := j.move(newDir)
	require.NoError(t, err)
	require.Equal(t, oldDir, moveOldDir)
	require.Equal(t, newDir, j.dir)

	entry, err := j.readJournalEntry(o)
	require.NoError(t, err)
	require.Equal(t, testJournalEntry{1}, entry)
}
