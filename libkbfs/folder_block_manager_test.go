// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"reflect"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
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
func testQuotaReclamation(t *testing.T, ctx context.Context, config Config,
	userName libkb.NormalizedUsername) {
	clock, now := newTestClockAndTimeNow()
	config.SetClock(clock)

	rootNode := GetRootNodeOrBust(t, config, userName.String(), false)
	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateDir(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}
	err = kbfsOps.RemoveDir(ctx, rootNode, "a")
	if err != nil {
		t.Fatalf("Couldn't remove dir: %v", err)
	}

	// Wait for outstanding archives
	err = kbfsOps.SyncFromServerForTesting(ctx, rootNode.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Make sure no blocks are deleted before there's a new-enough update.
	bserverLocal, ok := config.BlockServer().(blockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	preQR1Blocks, err := bserverLocal.getAll(rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	ops := kbfsOps.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode)
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
	clock.Set(now.Add(2 * config.QuotaReclamationMinUnrefAge()))
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

func TestQuotaReclamationSimple(t *testing.T) {
	var userName libkb.NormalizedUsername = "test_user"
	config, _, ctx := kbfsOpsInitNoMocks(t, userName)
	defer CheckConfigAndShutdown(t, config)

	testQuotaReclamation(t, ctx, config, userName)
}

// Just like the simple case, except tests that it unembeds large sets
// of pointers correctly.
func TestQuotaReclamationUnembedded(t *testing.T) {
	var userName libkb.NormalizedUsername = "test_user"
	config, _, ctx := kbfsOpsInitNoMocks(t, userName)
	defer CheckConfigAndShutdown(t, config)

	config.bsplit.(*BlockSplitterSimple).blockChangeEmbedMaxSize = 32

	testQuotaReclamation(t, ctx, config, userName)

	// Make sure the MD has an unembedded change block.
	rootNode := GetRootNodeOrBust(t, config, userName.String(), false)
	md, err := config.MDOps().GetForTLF(ctx, rootNode.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get MD: %v", err)
	}
	if md.data.cachedChanges.Info.BlockPointer == zeroPtr {
		t.Fatalf("No unembedded changes for ops %v", md.data.Changes.Ops)
	}
}

// Test that a single quota reclamation run doesn't try to reclaim too
// much quota at once.
func TestQuotaReclamationIncrementalReclamation(t *testing.T) {
	var userName libkb.NormalizedUsername = "test_user"
	config, _, ctx := kbfsOpsInitNoMocks(t, userName)
	defer CheckConfigAndShutdown(t, config)

	now := time.Now()
	var clock TestClock
	clock.Set(now)
	config.SetClock(&clock)

	rootNode := GetRootNodeOrBust(t, config, userName.String(), false)
	// Do a bunch of operations.
	kbfsOps := config.KBFSOps()
	for i := 0; i < numPointersPerGCThreshold; i++ {
		_, _, err := kbfsOps.CreateDir(ctx, rootNode, "a")
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
	clock.Set(now.Add(2 * config.QuotaReclamationMinUnrefAge()))

	// Run it.
	ops := kbfsOps.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode)
	ops.fbm.forceQuotaReclamation()
	err := ops.fbm.waitForQuotaReclamations(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for QR: %v", err)
	}

	bserverLocal, ok := config.BlockServer().(blockServerLocal)
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

// Test that deleted blocks are correctly flushed from the user cache.
func TestQuotaReclamationDeletedBlocks(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsInitNoMocks(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)

	clock, now := newTestClockAndTimeNow()
	config1.SetClock(clock)

	// Initialize the MD using a different config
	config2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(t, config2)
	config2.SetClock(clock)

	name := u1.String() + "," + u2.String()
	rootNode1 := GetRootNodeOrBust(t, config1, name, false)
	data := []byte{1, 2, 3, 4, 5}
	kbfsOps1 := config1.KBFSOps()
	aNode1, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}
	err = kbfsOps1.Write(ctx, aNode1, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}
	err = kbfsOps1.Sync(ctx, aNode1)
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// Make two more files that share a block, only one of which will
	// be deleted.
	otherData := []byte{5, 4, 3, 2, 1}
	for _, name := range []string{"b", "c"} {
		node, _, err := kbfsOps1.CreateFile(ctx, rootNode1, name, false, NoExcl)
		if err != nil {
			t.Fatalf("Couldn't create dir: %v", err)
		}
		err = kbfsOps1.Write(ctx, node, otherData, 0)
		if err != nil {
			t.Fatalf("Couldn't write file: %v", err)
		}
		err = kbfsOps1.Sync(ctx, node)
		if err != nil {
			t.Fatalf("Couldn't sync file: %v", err)
		}
	}

	// u2 reads the file
	rootNode2 := GetRootNodeOrBust(t, config2, name, false)
	kbfsOps2 := config2.KBFSOps()
	aNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}
	data2 := make([]byte, len(data))
	_, err = kbfsOps2.Read(ctx, aNode2, data2, 0)
	if err != nil {
		t.Fatalf("Couldn't read file: %v", err)
	}
	if !bytes.Equal(data, data2) {
		t.Fatalf("Read bad data: %v", data2)
	}
	bNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "b")
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}
	data2 = make([]byte, len(data))
	_, err = kbfsOps2.Read(ctx, bNode2, data2, 0)
	if err != nil {
		t.Fatalf("Couldn't read file: %v", err)
	}
	if !bytes.Equal(otherData, data2) {
		t.Fatalf("Read bad data: %v", data2)
	}

	// Remove two of the files
	err = kbfsOps1.RemoveEntry(ctx, rootNode1, "a")
	if err != nil {
		t.Fatalf("Couldn't remove file: %v", err)
	}
	err = kbfsOps1.RemoveEntry(ctx, rootNode1, "b")
	if err != nil {
		t.Fatalf("Couldn't remove file: %v", err)
	}

	// Wait for outstanding archives
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Get the current set of blocks
	bserverLocal, ok := config1.BlockServer().(blockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	preQRBlocks, err := bserverLocal.getAll(rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	clock.Set(now.Add(2 * config1.QuotaReclamationMinUnrefAge()))
	ops1 := kbfsOps1.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode1)
	ops1.fbm.forceQuotaReclamation()
	err = ops1.fbm.waitForQuotaReclamations(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for QR: %v", err)
	}

	postQRBlocks, err := bserverLocal.getAll(rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	if pre, post := totalBlockRefs(preQRBlocks),
		totalBlockRefs(postQRBlocks); post >= pre {
		t.Errorf("Blocks didn't shrink after reclamation: pre: %d, post %d",
			pre, post)
	}

	// Sync u2
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Make a file with the other data on node 2, which uses a block
	// for which one reference has been deleted, but the other should
	// still be live.  This will cause one dedup reference, and 3 new
	// blocks (2 from the create, and 1 from the sync).
	dNode, _, err := kbfsOps2.CreateFile(ctx, rootNode2, "d", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create file: %v", err)
	}
	err = kbfsOps2.Write(ctx, dNode, otherData, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}
	err = kbfsOps2.Sync(ctx, dNode)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}
	// Wait for outstanding archives
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Make the same file on node 2, making sure this doesn't try to
	// reuse the same block (i.e., there are only 2 put calls).
	eNode, _, err := kbfsOps2.CreateFile(ctx, rootNode2, "e", false, NoExcl)
	if err != nil {
		t.Fatalf("Couldn't create dir: %v", err)
	}
	err = kbfsOps2.Write(ctx, eNode, data, 0)
	if err != nil {
		t.Fatalf("Couldn't write file: %v", err)
	}

	// Stall the puts that comes as part of the sync call.
	onWriteStalledCh, writeUnstallCh, ctxStall := StallBlockOp(
		ctx, config2, StallableBlockPut)

	// Start the sync and wait for it to stall twice only.
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps2.Sync(ctxStall, eNode)
	}()
	<-onWriteStalledCh
	<-onWriteStalledCh
	writeUnstallCh <- struct{}{}
	writeUnstallCh <- struct{}{}
	// Don't close the channel, we want to make sure other Puts get
	// stalled.
	err = <-errChan
	if err != nil {
		t.Fatalf("Couldn't sync file: %v", err)
	}

	// Wait for outstanding archives
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}

	// Delete any blocks that happened to be put during a failed (due
	// to recoverable block errors) update.
	clock.Set(now.Add(2 * config1.QuotaReclamationMinUnrefAge()))
	ops1.fbm.forceQuotaReclamation()
	err = ops1.fbm.waitForQuotaReclamations(ctx)
	if err != nil {
		t.Fatalf("Couldn't wait for QR: %v", err)
	}

	endBlocks, err := bserverLocal.getAll(rootNode2.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't get blocks: %v", err)
	}

	// There should be exactly 8 extra blocks refs (2 for the create,
	// and 2 for the write/sync, for both files above) as a result of
	// the operations, and exactly one should have more than one
	// reference.
	if pre, post := totalBlockRefs(postQRBlocks),
		totalBlockRefs(endBlocks); post != pre+8 {
		t.Errorf("Different number of blocks than expected: pre: %d, post %d",
			pre, post)
	}
	oneDedupFound := false
	for id, refs := range endBlocks {
		if len(refs) > 2 {
			t.Errorf("Block %v unexpectedly had %d refs %v", id, len(refs), refs)
		} else if len(refs) == 2 {
			if oneDedupFound {
				t.Errorf("Extra dedup block %v with refs %v", id, refs)
			} else {
				oneDedupFound = true
			}
		}
	}
	if !oneDedupFound {
		t.Error("No dedup reference found")
	}
}

// Test that quota reclamation doesn't happen while waiting for a
// requested rekey.
func TestQuotaReclamationFailAfterRekeyRequest(t *testing.T) {
	var u1, u2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx := kbfsOpsConcurInit(t, u1, u2)
	defer CheckConfigAndShutdown(t, config1)
	clock := newTestClockNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2)
	_, uid2, err := config2.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	// Create a shared folder.
	name := u1.String() + "," + u2.String()
	rootNode1 := GetRootNodeOrBust(t, config1, name, false)

	config2Dev2 := ConfigAsUser(config1.(*ConfigLocal), u2)
	defer CheckConfigAndShutdown(t, config2Dev2)

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	_, err = GetRootNodeForTest(config2Dev2, name, false)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %v", err)
	}

	// Request a rekey from the new device, which will only be
	// able to set the rekey bit (copying the root MD).
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	err = kbfsOps2Dev2.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// Make sure QR returns an error.
	ops := config2Dev2.KBFSOps().(*KBFSOpsStandard).getOpsByNode(ctx, rootNode1)
	timer := time.NewTimer(config2Dev2.QuotaReclamationPeriod())
	ops.fbm.reclamationGroup.Add(1)
	err = ops.fbm.doReclamation(timer)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Unexpected rekey error: %v", err)
	}

	// Rekey from another device.
	kbfsOps1 := config1.KBFSOps()
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	err = kbfsOps1.Rekey(ctx, rootNode1.GetFolderBranch().Tlf)
	if err != nil {
		t.Fatalf("Couldn't rekey: %v", err)
	}

	// Retry the QR; should work now.
	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx,
		rootNode1.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	ops.fbm.reclamationGroup.Add(1)
	err = ops.fbm.doReclamation(timer)
	if err != nil {
		t.Fatalf("Unexpected rekey error: %v", err)
	}
}
