package libkbfs

import (
	"testing"

	"golang.org/x/net/context"
)

func readAndCompareData(t *testing.T, config Config, ctx context.Context,
	h *TlfHandle, expectedData []byte, user string) {
	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Errorf("Couldn't get folder: %v", err)
	}
	fileNode, _, err := kbfsOps.Lookup(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't lookup file: %v", err)
	}
	data := make([]byte, 1)
	_, err = kbfsOps.Read(ctx, fileNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't read file: %v", err)
	}
	if data[0] != expectedData[0] {
		t.Errorf("User %s didn't see own data: %v", user, data)
	}
}

// Tests that, in the face of a conflict, a user will commit its
// changes to a private branch, which will persist after restart (and
// the other user will be unaffected).
func TestUnmergedAfterRestart(t *testing.T) {
	// simulate two users
	userName1, userName2 := "u1", "u2"
	config1, uid1, ctx := kbfsOpsConcurInit(t, userName1, userName2)
	defer config1.KBFSOps().(*KBFSOpsStandard).Shutdown()

	config2 := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2.KBFSOps().(*KBFSOpsStandard).Shutdown()
	uid2, err := config2.KBPKI().GetLoggedInUser(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	h := NewTlfHandle()
	h.Writers = append(h.Writers, uid1)
	h.Writers = append(h.Writers, uid2)

	// user1 creates a file in a shared dir
	kbfsOps1 := config1.KBFSOps()
	rootNode1, _, err :=
		kbfsOps1.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Errorf("Couldn't create folder: %v", err)
	}
	fileNode1, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}

	// then user2 write to the file
	kbfsOps2 := config2.KBFSOps()
	rootNode2, _, err :=
		kbfsOps2.GetOrCreateRootNodeForHandle(ctx, h, MasterBranch)
	if err != nil {
		t.Errorf("Couldn't create folder: %v", err)
	}
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	if err != nil {
		t.Fatalf("Couldn't lookup file: %v", err)
	}
	data2 := []byte{2}
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}
	err = kbfsOps2.Sync(ctx, fileNode2)
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// Now when user 1 tries to write to file 1 and sync, it will
	// become unmerged.  TODO: once we have push notifications
	// implemented, we'll have to do something more clever here to
	// ensure user 1 doesn't see user 2's write.
	data1 := []byte{1}
	err = kbfsOps1.Write(ctx, fileNode1, data1, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}

	err = kbfsOps1.Sync(ctx, fileNode1)
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// now re-login the users, and make sure 1 can see the changes,
	// but 2 can't
	config1B := ConfigAsUser(config1.(*ConfigLocal), userName1)
	defer config1B.KBFSOps().(*KBFSOpsStandard).Shutdown()
	config2B := ConfigAsUser(config1.(*ConfigLocal), userName2)
	defer config2B.KBFSOps().(*KBFSOpsStandard).Shutdown()

	readAndCompareData(t, config1B, ctx, h, data1, userName1)
	readAndCompareData(t, config2B, ctx, h, data2, userName2)
}
