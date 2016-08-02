// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	kbfsOps2 := config2.KBFSOps()
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	_, uid1, err := config1.KBPKI().GetCurrentUserInfo(context.Background())
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())

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
	if err != nil {
		t.Fatalf("Couldn't get history: %v", err)
	}
	edits2, err := kbfsOps2.GetEditHistory(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't get history: %v", err)
	}

	if !reflect.DeepEqual(expectedEdits, edits1) {
		t.Fatalf("User1 has unexpected edit history: %v", edits1)
	}
	if !reflect.DeepEqual(expectedEdits, edits2) {
		t.Fatalf("User2 has unexpected edit history: %v", edits2)
	}
}

func testDoTlfEdit(t *testing.T, ctx context.Context, tlfName string,
	kbfsOps KBFSOps, rootNode Node, i int, uid keybase1.UID, now time.Time,
	createRemainders map[keybase1.UID]int, edits TlfWriterEdits) {
	err := kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Sometimes mix it up with a different operation.
	if i%(len(createRemainders)*2) == createRemainders[uid] {
		_, _, err := kbfsOps.CreateDir(ctx, rootNode, fmt.Sprintf("dir%d", i))
		if err != nil {
			t.Fatalf("Couldn't mkdir: %v", err)
		}
	}

	if i%len(createRemainders) == createRemainders[uid] {
		// Creates a new file.
		fileName := fmt.Sprintf("file%d", i)
		_, _, err := kbfsOps.CreateFile(ctx, rootNode,
			fileName, false, NoExcl)
		if err != nil {
			t.Fatalf("Couldn't create file: %v", err)
		}
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
	if err != nil {
		t.Fatalf("Couldn't lookup old file: %v", err)
	}
	err = kbfsOps.Write(ctx, fileNode, []byte{0}, 0)
	if err != nil {
		t.Fatalf("Couldn't write old file: %v", err)
	}
	err = kbfsOps.Sync(ctx, fileNode)
	if err != nil {
		t.Fatalf("Couldn't sync old file: %v", err)
	}
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
		if err != nil {
			t.Fatalf("Couldn't create file: %v", err)
		}
	}

	_, uid1, err := config1.KBPKI().GetCurrentUserInfo(context.Background())
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
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
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	edits1, err := kbfsOps1.GetEditHistory(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't get history: %v", err)
	}
	edits2, err := kbfsOps2.GetEditHistory(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't get history: %v", err)
	}

	if !reflect.DeepEqual(expectedEdits, edits1) {
		t.Fatalf("User1 has unexpected edit history: %v  \n\n %v", expectedEdits, edits1)
	}
	if !reflect.DeepEqual(expectedEdits, edits2) {
		t.Fatalf("User2 has unexpected edit history: %v", edits2)
	}
}
