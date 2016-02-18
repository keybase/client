package libkbfs

import (
	"reflect"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
)

func totalBlockRefs(m map[BlockID]map[BlockRefNonce]blockRefLocalStatus) int {
	n := 0
	for _, refs := range m {
		n += len(refs)
	}
	return n
}

// Test that quota reclamation works for a simple case where the user
// does a few updates, then lets quota reclamation run, and we make
// sure that all historical blocks have been deleted.
func TestQuotaReclamationSimple(t *testing.T) {
	var userName libkb.NormalizedUsername = "test_user"
	config, _, ctx := kbfsOpsInitNoMocks(t, userName)
	defer CheckConfigAndShutdown(t, config)

	now := time.Now()
	clock := &TestClock{now}
	config.SetClock(clock)

	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, userName.String(), false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}
	err = kbfsOps.RemoveDir(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}

	// Wait for outstanding archives
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Make sure no blocks are deleted before there's a new-enough update.
	bserverLocal, ok := config.BlockServer().(*BlockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	preQR1Blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	ops := kbfsOps.(*KBFSOpsStandard).getOpsByNode(rootNode)
	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for QR: %v", err)
	}

	postQR1Blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	if !reflect.DeepEqual(preQR1Blocks, postQR1Blocks) {
		t.Fatalf("Blocks deleted too early (%v vs %v)!",
			preQR1Blocks, postQR1Blocks)
	}

	// Increase the time and make a new revision, but don't run quota
	// reclamation yet.
	clock.T = now.Add(2 * config.QuotaReclamationMinUnrefAge())
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, "b")
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}

	preQR2Blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for QR: %v", err)
	}

	postQR2Blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	if pre, post := totalBlockRefs(preQR2Blocks),
		totalBlockRefs(postQR2Blocks); post >= pre {
		t.Errorf("Blocks didn't shrink after reclamation: pre: %d, post %d",
			pre, post)
	}
}

// Test that a single quota reclamation run doesn't try to reclaim too
// much quota at once.
func TestQuotaReclamationIncrementalReclamation(t *testing.T) {
	var userName libkb.NormalizedUsername = "test_user"
	config, _, ctx := kbfsOpsInitNoMocks(t, userName)
	defer CheckConfigAndShutdown(t, config)

	now := time.Now()
	clock := &TestClock{now}
	config.SetClock(clock)

	kbfsOps := config.KBFSOps()
	rootNode, _, err :=
		kbfsOps.GetOrCreateRootNode(ctx, userName.String(), false, MasterBranch)
	if err != nil {
		t.Fatalf("Couldn't create folder: %v", err)
	}
	// Do a bunch of operations.
	for i := 0; i < numPointersPerGCThreshold; i++ {
		_, _, err = kbfsOps.CreateDir(ctx, rootNode, "a")
		if err != nil {
			t.Fatalf("Couldn't create dir: %v", err)
		}
		err = kbfsOps.RemoveDir(ctx, rootNode, "a")
		if err != nil {
			t.Fatalf("Couldn't remove dir: %v", err)
		}
	}

	// Increase the time, and make sure that there is still more than
	// one block in the history
	clock.T = now.Add(2 * config.QuotaReclamationMinUnrefAge())

	// Run it.
	ops := kbfsOps.(*KBFSOpsStandard).getOpsByNode(rootNode)
	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for QR: %v", err)
	}

	bserverLocal, ok := config.BlockServer().(*BlockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	b := totalBlockRefs(blocks)
	if b <= 1 {
		t.Errorf("Too many blocks left after first QR: %d", b)
	}

	// Now let it run to completion
	for b > 1 {
		ops.fbm.forceQuotaReclamation()
		err = ops.fbm.waitForQuotaReclamations(ctx)
		if err != nil {
			t.Fatalf("Couldn't wait for QR: %v", err)
		}

		blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
		if err != nil {
			t.Fatalf("Couldn't get blocks: %v", err)
		}
		oldB := b
		b = totalBlockRefs(blocks)
		if b >= oldB {
			t.Fatalf("Blocks didn't shrink after reclamation: %d vs. %d",
				b, oldB)
		}
	}
}
