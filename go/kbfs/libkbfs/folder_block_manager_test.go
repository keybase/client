// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"bytes"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func totalBlockRefs(m map[kbfsblock.ID]blockRefMap) int {
	n := 0
	for _, refs := range m {
		n += len(refs)
	}
	return n
}

// Test that quota reclamation works for a simple case where the user
// does a few updates, then lets quota reclamation run, and we make
// sure that all historical blocks have been deleted.
func testQuotaReclamation(ctx context.Context, t *testing.T, config Config,
	userName kbname.NormalizedUsername) (
	ops *folderBranchOps, preBlocks map[kbfsblock.ID]blockRefMap) {
	clock, now := clocktest.NewTestClockAndTimeNow()
	config.SetClock(clock)

	rootNode := GetRootNodeOrBust(
		ctx, t, config, userName.String(), tlf.Private)
	kbfsOps := config.KBFSOps()
	_, _, err := kbfsOps.CreateDir(ctx, rootNode, testPPS("a"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync all: %v", err)
	err = kbfsOps.RemoveDir(ctx, rootNode, testPPS("a"))
	require.NoError(t, err, "Couldn't remove dir: %+v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync all: %v", err)

	// Wait for outstanding archives
	err = kbfsOps.SyncFromServer(ctx,
		rootNode.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	// Make sure no blocks are deleted before there's a new-enough update.
	bserver := config.BlockServer()
	if jbserver, ok := bserver.(journalBlockServer); ok {
		bserver = jbserver.BlockServer
	}
	bserverLocal, ok := bserver.(blockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	preQR1Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	ops = kbfsOps.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode)
	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	postQR1Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	if !reflect.DeepEqual(preQR1Blocks, postQR1Blocks) {
		t.Fatalf("Blocks deleted too early (%v vs %v)!",
			preQR1Blocks, postQR1Blocks)
	}

	// Increase the time and make a new revision, but don't run quota
	// reclamation yet.
	clock.Set(now.Add(2 * config.Mode().QuotaReclamationMinUnrefAge()))
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, testPPS("b"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync all: %v", err)

	preQR2Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	return ops, preQR2Blocks
}

func ensureFewerBlocksPostQR(
	ctx context.Context, t *testing.T, config *ConfigLocal,
	ops *folderBranchOps, preBlocks map[kbfsblock.ID]blockRefMap) {
	ops.fbm.forceQuotaReclamation()
	err := ops.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	bserver := config.BlockServer()
	if jbserver, ok := bserver.(journalBlockServer); ok {
		bserver = jbserver.BlockServer
	}
	bserverLocal, ok := bserver.(blockServerLocal)
	require.True(t, ok)

	postBlocks, err := bserverLocal.getAllRefsForTest(ctx, ops.id())
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	pre, post := totalBlockRefs(preBlocks), totalBlockRefs(postBlocks)
	require.True(t, post < pre,
		"Blocks didn't shrink after reclamation: pre: %d, post %d",
		pre, post)
}

func TestQuotaReclamationSimple(t *testing.T) {
	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	ops, preBlocks := testQuotaReclamation(ctx, t, config, userName)
	ensureFewerBlocksPostQR(ctx, t, config, ops, preBlocks)
}

type modeTestWithNoTimedQR struct {
	InitMode
}

func (mtwmpl modeTestWithNoTimedQR) QuotaReclamationPeriod() time.Duration {
	return 0
}

type modeTestWithMaxPtrsLimit struct {
	InitMode
}

func (mtwmpl modeTestWithMaxPtrsLimit) MaxBlockPtrsToManageAtOnce() int {
	return 1
}

func TestQuotaReclamationConstrained(t *testing.T) {
	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)
	config.SetMode(modeTestWithNoTimedQR{config.Mode()})
	originalMode := config.Mode()
	config.SetMode(modeTestWithMaxPtrsLimit{originalMode})

	ops, preBlocks := testQuotaReclamation(ctx, t, config, userName)

	// Unconstrain it for the final QR.
	config.SetMode(originalMode)
	ensureFewerBlocksPostQR(ctx, t, config, ops, preBlocks)
}

// Just like the simple case, except tests that it unembeds large sets
// of pointers correctly.
func TestQuotaReclamationUnembedded(t *testing.T) {
	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	config.bsplit.(*data.BlockSplitterSimple).
		SetBlockChangeEmbedMaxSizeForTesting(32)

	ops, preBlocks := testQuotaReclamation(ctx, t, config, userName)
	ensureFewerBlocksPostQR(ctx, t, config, ops, preBlocks)

	// Make sure the MD has an unembedded change block.
	md, err := config.MDOps().GetForTLF(ctx, ops.id(), nil)
	require.NoError(t, err, "Couldn't get MD: %+v", err)
	if md.data.cachedChanges.Info.BlockPointer == data.ZeroPtr {
		t.Fatalf("No unembedded changes for ops %v", md.data.Changes.Ops)
	}
}

// Just like the simple case, except tests that it unembeds large sets
// of pointers correctly.
func TestQuotaReclamationUnembeddedJournal(t *testing.T) {
	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkPaused)
	require.NoError(t, err)

	config.bsplit.(*data.BlockSplitterSimple).
		SetBlockChangeEmbedMaxSizeForTesting(32)

	rootNode := GetRootNodeOrBust(
		ctx, t, config, userName.String(), tlf.Private)
	jManager, err := GetJournalManager(config)
	require.NoError(t, err)
	jManager.PauseBackgroundWork(ctx, rootNode.GetFolderBranch().Tlf)

	ops, _ := testQuotaReclamation(ctx, t, config, userName)

	t.Log("Check that the latest merged revision didn't get updated")
	rev := ops.getLatestMergedRevision(makeFBOLockState())
	require.Equal(t, kbfsmd.RevisionInitial, rev)

	jManager.ResumeBackgroundWork(ctx, ops.id())
	err = jManager.Wait(ctx, ops.id())
	require.NoError(t, err)
}

// Test that a single quota reclamation run doesn't try to reclaim too
// much quota at once.
func TestQuotaReclamationIncrementalReclamation(t *testing.T) {
	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)

	now := time.Now()
	var clock clocktest.TestClock
	clock.Set(now)
	config.SetClock(&clock)

	// Allow for big embedded block changes, so they don't confuse our
	// block-checking logic.
	config.bsplit.(*data.BlockSplitterSimple).
		SetBlockChangeEmbedMaxSizeForTesting(16 << 20)

	rootNode := GetRootNodeOrBust(
		ctx, t, config, userName.String(), tlf.Private)
	// Do a bunch of operations.
	kbfsOps := config.KBFSOps()
	testPointersPerGCThreshold := 10
	for i := 0; i < testPointersPerGCThreshold; i++ {
		_, _, err := kbfsOps.CreateDir(ctx, rootNode, testPPS("a"))
		require.NoError(t, err, "Couldn't create dir: %+v", err)
		err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
		require.NoError(t, err, "Couldn't sync all: %v", err)
		err = kbfsOps.RemoveDir(ctx, rootNode, testPPS("a"))
		require.NoError(t, err, "Couldn't remove dir: %+v", err)
		err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
		require.NoError(t, err, "Couldn't sync all: %v", err)
	}

	// Increase the time, and make sure that there is still more than
	// one block in the history
	clock.Set(now.Add(2 * config.Mode().QuotaReclamationMinUnrefAge()))

	// Run it.
	ops := kbfsOps.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode)
	ops.fbm.numPointersPerGCThreshold = testPointersPerGCThreshold
	ops.fbm.forceQuotaReclamation()
	err := ops.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	bserverLocal, ok := config.BlockServer().(blockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	b := totalBlockRefs(blocks)
	if b <= 1 {
		t.Errorf("Too many blocks left after first QR: %d", b)
	}

	// Now let it run to completion
	for b > 1 {
		ops.fbm.forceQuotaReclamation()
		err = ops.fbm.waitForQuotaReclamations(ctx)
		require.NoError(t, err, "Couldn't wait for QR: %+v", err)

		blocks, err := bserverLocal.getAllRefsForTest(
			ctx, rootNode.GetFolderBranch().Tlf)
		require.NoError(t, err, "Couldn't get blocks: %+v", err)
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
	var u1, u2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsInitNoMocks(t, u1, u2)
	defer kbfsTestShutdownNoMocks(ctx, t, config1, cancel)

	clock, now := clocktest.NewTestClockAndTimeNow()
	config1.SetClock(clock)

	// Initialize the MD using a different config
	config2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	config2.SetClock(clock)

	name := u1.String() + "," + u2.String()
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	data1 := []byte{1, 2, 3, 4, 5}
	kbfsOps1 := config1.KBFSOps()
	aNode1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	err = kbfsOps1.Write(ctx, aNode1, data1, 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %+v", err)

	// Make two more files that share a block, only one of which will
	// be deleted.
	otherData := []byte{5, 4, 3, 2, 1}
	for _, name := range []data.PathPartString{testPPS("b"), testPPS("c")} {
		node, _, err := kbfsOps1.CreateFile(ctx, rootNode1, name, false, NoExcl)
		require.NoError(t, err, "Couldn't create dir: %+v", err)
		err = kbfsOps1.Write(ctx, node, otherData, 0)
		require.NoError(t, err, "Couldn't write file: %+v", err)
		err = kbfsOps1.SyncAll(ctx, node.GetFolderBranch())
		require.NoError(t, err, "Couldn't sync file: %+v", err)
	}

	// u2 reads the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)
	kbfsOps2 := config2.KBFSOps()
	aNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	data2 := make([]byte, len(data1))
	_, err = kbfsOps2.Read(ctx, aNode2, data2, 0)
	require.NoError(t, err, "Couldn't read file: %+v", err)
	if !bytes.Equal(data1, data2) {
		t.Fatalf("Read bad data: %v", data2)
	}
	bNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("b"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	data2 = make([]byte, len(data1))
	_, err = kbfsOps2.Read(ctx, bNode2, data2, 0)
	require.NoError(t, err, "Couldn't read file: %+v", err)
	if !bytes.Equal(otherData, data2) {
		t.Fatalf("Read bad data: %v", data2)
	}

	// Remove two of the files
	err = kbfsOps1.RemoveEntry(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err, "Couldn't remove file: %+v", err)
	err = kbfsOps1.RemoveEntry(ctx, rootNode1, testPPS("b"))
	require.NoError(t, err, "Couldn't remove file: %+v", err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %+v", err)

	// Wait for outstanding archives
	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	// Get the current set of blocks
	bserverLocal, ok := config1.BlockServer().(blockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	preQRBlocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	clock.Set(now.Add(2 * config1.Mode().QuotaReclamationMinUnrefAge()))
	ops1 := kbfsOps1.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode1)
	ops1.fbm.forceQuotaReclamation()
	err = ops1.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	postQRBlocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	if pre, post := totalBlockRefs(preQRBlocks),
		totalBlockRefs(postQRBlocks); post >= pre {
		t.Errorf("Blocks didn't shrink after reclamation: pre: %d, post %d",
			pre, post)
	}

	// Sync u2
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	// Make a file with the other data on node 2, which uses a block
	// for which one reference has been deleted, but the other should
	// still be live.  This will cause one dedup reference, and 3 new
	// blocks (2 from the create, and 1 from the sync).
	dNode, _, err := kbfsOps2.CreateFile(
		ctx, rootNode2, testPPS("d"), false, NoExcl)
	require.NoError(t, err, "Couldn't create file: %+v", err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %+v", err)
	err = kbfsOps2.Write(ctx, dNode, otherData, 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)
	err = kbfsOps2.SyncAll(ctx, dNode.GetFolderBranch())
	require.NoError(t, err, "Couldn't write file: %+v", err)
	// Wait for outstanding archives
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	// Make the same file on node 2, making sure this doesn't try to
	// reuse the same block (i.e., there are only 2 put calls).
	eNode, _, err := kbfsOps2.CreateFile(
		ctx, rootNode2, testPPS("e"), false, NoExcl)
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err, "Couldn't sync file: %+v", err)
	err = kbfsOps2.Write(ctx, eNode, data1, 0)
	require.NoError(t, err, "Couldn't write file: %+v", err)

	// Stall the puts that comes as part of the sync call.
	oldBServer := config2.BlockServer()
	defer config2.SetBlockServer(oldBServer)
	onWriteStalledCh, writeUnstallCh, ctxStall := StallBlockOp(
		ctx, config2, StallableBlockPut, 2)

	// Start the sync and wait for it to stall twice only.
	errChan := make(chan error)
	go func() {
		errChan <- kbfsOps2.SyncAll(ctxStall, eNode.GetFolderBranch())
	}()
	<-onWriteStalledCh
	<-onWriteStalledCh
	writeUnstallCh <- struct{}{}
	writeUnstallCh <- struct{}{}
	// Don't close the channel, we want to make sure other Puts get
	// stalled.
	err = <-errChan
	require.NoError(t, err, "Couldn't sync file: %+v", err)

	// Wait for outstanding archives
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	// Delete any blocks that happened to be put during a failed (due
	// to recoverable block errors) update.
	clock.Set(now.Add(2 * config1.Mode().QuotaReclamationMinUnrefAge()))
	ops1.fbm.forceQuotaReclamation()
	err = ops1.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	endBlocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

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
		areAllRefsArchived := true
		for _, ref := range refs {
			if ref.Status != archivedBlockRef {
				areAllRefsArchived = false
				break
			}
		}
		if areAllRefsArchived {
			continue
		}
		if len(refs) > 2 {
			t.Errorf("Block %v unexpectedly had %d refs %+v", id, len(refs), refs)
		} else if len(refs) == 2 {
			if oneDedupFound {
				t.Errorf("Extra dedup block %v with refs %+v", id, refs)
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
	var u1, u2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, u1, u2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	clock := clocktest.NewTestClockNow()
	config1.SetClock(clock)

	config2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	uid2 := session2.UID

	// Create a shared folder.
	name := u1.String() + "," + u2.String()
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	config2Dev2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(ctx, t, config2Dev2)

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, uid2)
	AddDeviceForLocalUserOrBust(t, config2, uid2)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, uid2)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	_, err = GetRootNodeForTest(ctx, config2Dev2, name, tlf.Private)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Got unexpected error when reading with new key: %+v", err)
	}

	// Request a rekey from the new device, which will only be
	// able to set the rekey bit (copying the root MD).
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, err = RequestRekeyAndWaitForOneFinishEvent(ctx,
		kbfsOps2Dev2, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't rekey: %+v", err)

	// Make sure QR returns an error.
	ops := config2Dev2.KBFSOps().(*KBFSOpsStandard).getOpsByNode(ctx, rootNode1)
	timer := time.NewTimer(config2Dev2.Mode().QuotaReclamationPeriod())
	ops.fbm.reclamationGroup.Add(1)
	err = ops.fbm.doReclamation(timer)
	if _, ok := err.(NeedSelfRekeyError); !ok {
		t.Fatalf("Unexpected rekey error: %+v", err)
	}

	// Rekey from another device.
	kbfsOps1 := config1.KBFSOps()
	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)
	_, err = RequestRekeyAndWaitForOneFinishEvent(ctx,
		kbfsOps1, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't rekey: %+v", err)

	// Retry the QR; should work now.
	err = kbfsOps2Dev2.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)
	ops.fbm.reclamationGroup.Add(1)
	err = ops.fbm.doReclamation(timer)
	require.NoError(t, err, "Unexpected rekey error: %+v", err)
}

type modeTestWithQR struct {
	InitMode
}

func (mtwqr modeTestWithQR) IsTestMode() bool {
	return true
}

// Test that quota reclamation doesn't run unless the current head is
// at least the minimum needed age.
func TestQuotaReclamationMinHeadAge(t *testing.T) {
	var u1, u2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, u1, u2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	clock := clocktest.NewTestClockNow()
	config1.SetClock(clock)
	// Re-enable QR in test mode.
	config1.SetMode(modeTestWithQR{NewInitModeFromType(InitDefault)})

	config2 := ConfigAsUser(config1, u2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := u1.String() + "," + u2.String()

	// u1 does the writes, and u2 tries to do the QR.
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)
	err = kbfsOps1.RemoveDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err, "Couldn't remove dir: %+v", err)

	// Increase the time and make a new revision, and make sure quota
	// reclamation doesn't run.
	clock.Add(2 * config2.Mode().QuotaReclamationMinUnrefAge())
	_, _, err = kbfsOps1.CreateDir(ctx, rootNode1, testPPS("b"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)

	// Wait for outstanding archives
	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	kbfsOps2 := config2.KBFSOps()
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	// Make sure no blocks are deleted before there's a new-enough update.
	bserverLocal, ok := config2.BlockServer().(blockServerLocal)
	if !ok {
		t.Fatalf("Bad block server")
	}
	preQR1Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	ops := kbfsOps2.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode2)
	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	postQR1Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	if !reflect.DeepEqual(preQR1Blocks, postQR1Blocks) {
		t.Fatalf("Blocks deleted too early (%v vs %v)!",
			preQR1Blocks, postQR1Blocks)
	}

	// Increase the time again and make sure it does run.
	clock.Add(2 * config2.Mode().QuotaReclamationMinHeadAge())

	preQR2Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	postQR2Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	if pre, post := totalBlockRefs(preQR2Blocks),
		totalBlockRefs(postQR2Blocks); post >= pre {
		t.Errorf("Blocks didn't shrink after reclamation: pre: %d, post %d",
			pre, post)
	}

	// If u2 does a write, we don't have to wait the minimum head age.
	_, _, err = kbfsOps2.CreateDir(ctx, rootNode2, testPPS("c"))
	require.NoError(t, err, "Couldn't create dir: %+v", err)

	// Wait for outstanding archives
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err, "Couldn't sync from server: %+v", err)

	clock.Add(2 * config2.Mode().QuotaReclamationMinUnrefAge())

	preQR3Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	ops.fbm.forceQuotaReclamation()
	err = ops.fbm.waitForQuotaReclamations(ctx)
	require.NoError(t, err, "Couldn't wait for QR: %+v", err)

	postQR3Blocks, err := bserverLocal.getAllRefsForTest(
		ctx, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err, "Couldn't get blocks: %+v", err)

	if pre, post := totalBlockRefs(preQR3Blocks),
		totalBlockRefs(postQR3Blocks); post >= pre {
		t.Errorf("Blocks didn't shrink after reclamation: pre: %d, post %d",
			pre, post)
	}
}

// Test that quota reclamation makes GCOps to account for other GCOps,
// to make sure clients don't waste time scanning over a bunch of old
// GCOps when there is nothing to be done.
func TestQuotaReclamationGCOpsForGCOps(t *testing.T) {
	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)
	clock := clocktest.NewTestClockNow()
	config.SetClock(clock)

	rootNode := GetRootNodeOrBust(
		ctx, t, config, userName.String(), tlf.Private)
	kbfsOps := config.KBFSOps()
	ops := kbfsOps.(*KBFSOpsStandard).getOpsByNode(ctx, rootNode)
	// This threshold isn't exact; in this case it works out to 3
	// pointers per GC.
	ops.fbm.numPointersPerGCThreshold = 1

	numCycles := 4
	for i := 0; i < numCycles; i++ {
		_, _, err := kbfsOps.CreateDir(ctx, rootNode, testPPS("a"))
		require.NoError(t, err, "Couldn't create dir: %+v", err)
		err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
		require.NoError(t, err, "Couldn't sync all: %v", err)
		err = kbfsOps.RemoveDir(ctx, rootNode, testPPS("a"))
		require.NoError(t, err, "Couldn't remove dir: %+v", err)
		err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
		require.NoError(t, err, "Couldn't sync all: %v", err)
	}
	clock.Add(2 * config.Mode().QuotaReclamationMinUnrefAge())

	// Make sure the head has a GCOp that doesn't point to just the
	// previous revision.
	md, err := config.MDOps().GetForTLF(
		ctx, rootNode.GetFolderBranch().Tlf, nil)
	require.NoError(t, err, "Couldn't get MD: %+v", err)

	// Run reclamation until the head doesn't change anymore, which
	// should cover revision #3, as well as the two subsequent GCops.
	lastRev := md.Revision()
	count := 0
	for {
		ops.fbm.forceQuotaReclamation()
		err = ops.fbm.waitForQuotaReclamations(ctx)
		require.NoError(t, err, "Couldn't wait for QR: %+v", err)

		md, err = config.MDOps().GetForTLF(
			ctx, rootNode.GetFolderBranch().Tlf, nil)
		require.NoError(t, err, "Couldn't get MD: %+v", err)

		if md.Revision() == lastRev {
			break
		}
		lastRev = md.Revision()
		count++
		if count == numCycles {
			// Increase the clock so now we can GC all those GCOps.
			clock.Add(2 * config.Mode().QuotaReclamationMinUnrefAge())
		}
	}

	if g, e := count, numCycles+1; g != e {
		t.Fatalf("Wrong number of forced QRs: %d vs %d", g, e)
	}

	if g, e := len(md.data.Changes.Ops), 1; g != e {
		t.Fatalf("Unexpected number of ops: %d vs %d", g, e)
	}

	gcOp, ok := md.data.Changes.Ops[0].(*GCOp)
	if !ok {
		t.Fatalf("No GCOp: %s", md.data.Changes.Ops[0])
	}

	if g, e := gcOp.LatestRev, md.Revision()-1; g != e {
		t.Fatalf("Last GCOp revision was unexpected: %d vs %d", g, e)
	}
}

func TestFolderBlockManagerCleanSyncCache(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_server")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		require.NoError(t, err)
	}()

	var userName kbname.NormalizedUsername = "test_user"
	config, _, ctx, cancel := kbfsOpsInitNoMocks(t, userName)
	defer kbfsTestShutdownNoMocks(ctx, t, config, cancel)
	config.SetVLogLevel(libkb.VLog2String)

	// Test the pointer-constraint logic.
	config.SetMode(modeTestWithMaxPtrsLimit{config.Mode()})

	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.loadSyncedTlfsLocked()
	require.NoError(t, err)
	config.diskCacheMode = DiskCacheModeLocal
	err = config.MakeDiskBlockCacheIfNotExists()
	require.NoError(t, err)
	dbc := config.DiskBlockCache()
	oldBserver := config.BlockServer()
	config.SetBlockServer(bserverPutToDiskCache{config.BlockServer(), dbc})
	defer config.SetBlockServer(oldBserver)

	t.Log("Make a synced private TLF")
	rootNode := GetRootNodeOrBust(
		ctx, t, config, userName.String(), tlf.Private)
	kbfsOps := config.KBFSOps()
	_, err = config.SetTlfSyncState(
		ctx, rootNode.GetFolderBranch().Tlf, FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
	require.NoError(t, err)
	aNode, _, err := kbfsOps.CreateDir(ctx, rootNode, testPPS("a"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	status := dbc.Status(ctx)
	require.Equal(t, uint64(2), status[syncCacheName].NumBlocks)

	t.Log("Make a second revision that will unref some blocks")
	_, _, err = kbfsOps.CreateDir(ctx, aNode, testPPS("b"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Wait for cleanup")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	// 3 blocks == root, a and b, without the old unref'd blocks.
	status = dbc.Status(ctx)
	require.Equal(t, uint64(3), status[syncCacheName].NumBlocks)

	t.Log("Add two empty files, to cause deduplication")
	_, _, err = kbfsOps.CreateFile(ctx, aNode, testPPS("c"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps.CreateFile(ctx, aNode, testPPS("d"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Logf("Remove one file, but not the other")
	err = kbfsOps.RemoveEntry(ctx, aNode, testPPS("d"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Wait for cleanup")
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	// 4 blocks == root, a, b, and d without the old unref'd blocks.
	status = dbc.Status(ctx)
	require.Equal(t, uint64(4), status[syncCacheName].NumBlocks)

	t.Log("Test another TLF that isn't synced until after a few revisions")
	rootNode = GetRootNodeOrBust(ctx, t, config, userName.String(), tlf.Public)
	aNode, _, err = kbfsOps.CreateDir(ctx, rootNode, testPPS("a"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	bNode, _, err := kbfsOps.CreateDir(ctx, aNode, testPPS("b"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	lastRev, err := dbc.GetLastUnrefRev(
		ctx, rootNode.GetFolderBranch().Tlf, DiskBlockSyncCache)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.RevisionUninitialized, lastRev)

	t.Log("Set new TLF to syncing, and add a new revision")
	_, err = config.SetTlfSyncState(
		ctx, rootNode.GetFolderBranch().Tlf, FolderSyncConfig{
			Mode: keybase1.FolderSyncMode_ENABLED,
		})
	require.NoError(t, err)
	_, _, err = kbfsOps.CreateDir(ctx, bNode, testPPS("c"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps.SyncFromServer(ctx, rootNode.GetFolderBranch(), nil)
	require.NoError(t, err)
	lastRev, err = dbc.GetLastUnrefRev(
		ctx, rootNode.GetFolderBranch().Tlf, DiskBlockSyncCache)
	require.NoError(t, err)
	require.Equal(t, kbfsmd.Revision(4), lastRev)
}
