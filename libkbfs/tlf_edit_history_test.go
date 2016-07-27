// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"reflect"
	"testing"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

func TestBasicTlfEditHistory(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer CheckConfigAndShutdown(t, config1)

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
		Filepath: name + "/a",
		Type:     FileCreated,
	}}
	expectedEdits[uid2] = TlfEditList{{
		Filepath: name + "/b",
		Type:     FileCreated,
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
