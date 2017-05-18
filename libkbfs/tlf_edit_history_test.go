// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// truncateTlfWriterEditsTimestamps is a helper function to truncate
// timestamps to second resolution. This is needed because some
// methods of storing timestamps (e.g., relying on the filesystem) are
// lossy.
func truncateTLFWriterEditsTimestamps(edits TlfWriterEdits) TlfWriterEdits {
	roundedEdits := make(TlfWriterEdits)
	for k, editList := range edits {
		roundedEditList := make(TlfEditList, len(editList))
		for i, edit := range editList {
			edit.LocalTime = edit.LocalTime.Truncate(time.Second)
			roundedEditList[i] = edit
		}
		roundedEdits[k] = roundedEditList
	}
	return roundedEdits
}

func TestBasicTlfEditHistory(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	clock, now := newTestClockAndTimeNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	// user 1 creates a file
	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	kbfsOps2 := config2.KBFSOps()
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	session1, err := config1.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	uid1 := session1.UID
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	uid2 := session2.UID

	// Each user should see 1 create edit for each user
	expectedEdits := make(TlfWriterEdits)
	expectedEdits[uid1] = TlfEditList{{
		Filepath:  name + "/a",
		Type:      FileCreated,
		LocalTime: now,
	}}
	expectedEdits[uid2] = TlfEditList{{
		Filepath:  name + "/b",
		Type:      FileCreated,
		LocalTime: now,
	}}

	edits1, err := kbfsOps1.GetEditHistory(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	edits2, err := kbfsOps2.GetEditHistory(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	require.Equal(t,
		truncateTLFWriterEditsTimestamps(expectedEdits),
		truncateTLFWriterEditsTimestamps(edits1),
		"User1 has unexpected edit history")
	require.Equal(t,
		truncateTLFWriterEditsTimestamps(expectedEdits),
		truncateTLFWriterEditsTimestamps(edits2),
		"User2 has unexpected edit history")
}

func testDoTlfEdit(t *testing.T, ctx context.Context, tlfName string,
	kbfsOps KBFSOps, rootNode Node, i int, uid keybase1.UID, now time.Time,
	createRemainders map[keybase1.UID]int, edits TlfWriterEdits) {
	err := kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// Sometimes mix it up with a different operation.
	if i%(len(createRemainders)*2) == createRemainders[uid] {
		_, _, err := kbfsOps.CreateDir(ctx, rootNode, fmt.Sprintf("dir%d", i))
		require.NoError(t, err)
		err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
		require.NoError(t, err)
	}

	if i%len(createRemainders) == createRemainders[uid] {
		// Creates a new file.
		fileName := fmt.Sprintf("file%d", i)
		_, _, err := kbfsOps.CreateFile(ctx, rootNode,
			fileName, false, NoExcl)
		require.NoError(t, err)
		err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
		require.NoError(t, err)
		if i >= 70 {
			edits[uid] = append(edits[uid], TlfEdit{
				Filepath:  tlfName + "/" + fileName,
				Type:      FileCreated,
				LocalTime: now,
			})
		}
		return
	}

	// Write to an old file.
	fileName := fmt.Sprintf("file%d", i-50)
	fileNode, _, err := kbfsOps.Lookup(ctx, rootNode, fileName)
	require.NoError(t, err)
	err = kbfsOps.Write(ctx, fileNode, []byte{0}, 0)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, fileNode.GetFolderBranch())
	require.NoError(t, err)
	if i >= 70 {
		edits[uid] = append(edits[uid], TlfEdit{
			Filepath:  tlfName + "/" + fileName,
			Type:      FileModified,
			LocalTime: now,
		})
	}
}

func TestLongTlfEditHistory(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	// Need to increase the timeout, since this test takes longer
	// than usual.
	//
	// TODO: Make this test not take so long.
	timeoutCtx, cancel := context.WithTimeout(
		context.Background(), 3*individualTestTimeout)
	ctx, err := NewContextWithCancellationDelayer(NewContextReplayable(
		timeoutCtx, func(c context.Context) context.Context {
			return c
		}))
	if err != nil {
		cancel()
		panic(err)
	}
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	clock, now := newTestClockAndTimeNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	kbfsOps2 := config2.KBFSOps()

	// First create 50 files.  These creates won't be part of the
	// history.
	i := 0
	for ; i < 50; i++ {
		_, _, err := kbfsOps1.CreateFile(ctx, rootNode1,
			fmt.Sprintf("file%d", i), false, NoExcl)
		require.NoError(t, err)
		err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
		require.NoError(t, err)
	}

	session1, err := config1.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	uid1 := session1.UID
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	uid2 := session2.UID
	createRemainders := map[keybase1.UID]int{
		uid1: 0,
		uid2: 1,
	}

	// Now alternately create and edit files between the two users.
	expectedEdits := make(TlfWriterEdits)
	for ; i < 90; i++ {
		// This will alternate creates and modifies.
		now = now.Add(1 * time.Minute)
		clock.Set(now)

		// User 1
		testDoTlfEdit(t, ctx, name, kbfsOps1, rootNode1, i, uid1, now,
			createRemainders, expectedEdits)
		// User 2
		testDoTlfEdit(t, ctx, name, kbfsOps2, rootNode2, i, uid2, now,
			createRemainders, expectedEdits)
	}

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	edits1, err := kbfsOps1.GetEditHistory(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	edits2, err := kbfsOps2.GetEditHistory(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	require.Equal(t,
		truncateTLFWriterEditsTimestamps(expectedEdits),
		truncateTLFWriterEditsTimestamps(edits1),
		"User1 has unexpected edit history")
	require.Equal(t,
		truncateTLFWriterEditsTimestamps(expectedEdits),
		truncateTLFWriterEditsTimestamps(edits2),
		"User2 has unexpected edit history")

	now = now.Add(1 * time.Minute)
	clock.Set(now)

	// Now make sure removes, renames, and subsequent edits get
	// applied correctly.
	rmIndex := 9
	renameIndex := 19
	editIndex := 4
	rmFile1 := filepath.Base(expectedEdits[uid1][rmIndex].Filepath)
	rmFile2 := filepath.Base(expectedEdits[uid2][rmIndex].Filepath)
	renameFile := filepath.Base(expectedEdits[uid1][renameIndex].Filepath)
	editFile := filepath.Base(expectedEdits[uid2][editIndex].Filepath)

	// Expect some new edits
	expectedEdits[uid1] = append(expectedEdits[uid1][:rmIndex],
		expectedEdits[uid1][rmIndex+1:]...)
	expectedEdits[uid2] = append(expectedEdits[uid2][:rmIndex],
		expectedEdits[uid2][rmIndex+1:]...)
	renameIndex--
	expectedEdits[uid1][renameIndex].Filepath = name + "/" + renameFile + ".New"
	newEdit := expectedEdits[uid2][editIndex]
	newEdit.Type = FileModified
	newEdit.LocalTime = clock.Now()
	expectedEdits[uid2] = append(expectedEdits[uid2][:editIndex],
		expectedEdits[uid2][editIndex+1:]...)
	expectedEdits[uid2] = append(expectedEdits[uid2], newEdit)

	// Two older edits are now on the fronts of the lists.
	oldNow := expectedEdits[uid1][0].LocalTime.Add(-1 * time.Minute)
	expectedEdits[uid1] = append([]TlfEdit{{
		Filepath:  name + "/file19",
		Type:      FileModified,
		LocalTime: oldNow,
	}}, expectedEdits[uid1]...)
	expectedEdits[uid2] = append([]TlfEdit{{
		Filepath:  name + "/file69",
		Type:      FileCreated,
		LocalTime: oldNow,
	}}, expectedEdits[uid2]...)

	err = kbfsOps1.RemoveEntry(ctx, rootNode1, rmFile1)
	require.NoError(t, err)
	err = kbfsOps1.RemoveEntry(ctx, rootNode1, rmFile2)
	require.NoError(t, err)
	err = kbfsOps1.Rename(ctx, rootNode1, renameFile, rootNode1,
		renameFile+".New")
	require.NoError(t, err)

	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	editNode, _, err := kbfsOps2.Lookup(ctx, rootNode2, editFile)
	require.NoError(t, err)
	err = kbfsOps2.Write(ctx, editNode, []byte{1}, 1)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, editNode.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	edits1, err = kbfsOps1.GetEditHistory(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	edits2, err = kbfsOps2.GetEditHistory(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	require.Equal(t,
		truncateTLFWriterEditsTimestamps(expectedEdits),
		truncateTLFWriterEditsTimestamps(edits1),
		"User1 has unexpected edit history")
	require.Equal(t,
		truncateTLFWriterEditsTimestamps(expectedEdits),
		truncateTLFWriterEditsTimestamps(edits2),
		"User2 has unexpected edit history")
}
