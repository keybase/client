// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func TestBasicTlfEditHistory(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer CheckConfigAndShutdown(t, config1)

	clock, now := newTestClockAndTimeNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer CheckConfigAndShutdown(t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(t, config1, name, false)
	rootNode2 := GetRootNodeOrBust(t, config2, name, false)

	// user 1 creates a file
	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)

	kbfsOps2 := config2.KBFSOps()
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	_, uid1, err := config1.KBPKI().GetCurrentUserInfo(context.Background())
	require.NoError(t, err)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	require.NoError(t, err)

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

	require.Equal(t, expectedEdits, edits1, "User1 has unexpected edit history")
	require.Equal(t, expectedEdits, edits2, "User2 has unexpected edit history")
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
	}

	if i%len(createRemainders) == createRemainders[uid] {
		// Creates a new file.
		fileName := fmt.Sprintf("file%d", i)
		_, _, err := kbfsOps.CreateFile(ctx, rootNode,
			fileName, false, NoExcl)
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
	err = kbfsOps.Sync(ctx, fileNode)
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
	config1, _, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer CheckConfigAndShutdown(t, config1)

	clock, now := newTestClockAndTimeNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer CheckConfigAndShutdown(t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(t, config1, name, false)
	rootNode2 := GetRootNodeOrBust(t, config2, name, false)
	kbfsOps1 := config1.KBFSOps()
	kbfsOps2 := config2.KBFSOps()

	// First create 50 files.  These creates won't be part of the
	// history.
	i := 0
	for ; i < 50; i++ {
		_, _, err := kbfsOps1.CreateFile(ctx, rootNode1,
			fmt.Sprintf("file%d", i), false, NoExcl)
		require.NoError(t, err)
	}

	_, uid1, err := config1.KBPKI().GetCurrentUserInfo(context.Background())
	require.NoError(t, err)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	require.NoError(t, err)
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

	require.Equal(t, expectedEdits, edits1, "User1 has unexpected edit history")
	require.Equal(t, expectedEdits, edits2, "User2 has unexpected edit history")
}
