// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func readAndCompareData(ctx context.Context, t *testing.T, config Config,
	name string, expectedData []byte, user kbname.NormalizedUsername) {
	rootNode := GetRootNodeOrBust(ctx, t, config, name, tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.Lookup(ctx, rootNode, testPPS("a"))
	require.NoError(t, err)
	data := make([]byte, 1)
	_, err = kbfsOps.Read(ctx, fileNode, data, 0)
	require.NoError(t, err)
	assert.Equal(t, expectedData[0], data[0])
}

type testCRObserver struct {
	c       chan<- struct{}
	changes []NodeChange
}

func (t *testCRObserver) LocalChange(ctx context.Context, node Node,
	write WriteRange) {
	// ignore
}

func (t *testCRObserver) BatchChanges(ctx context.Context,
	changes []NodeChange, _ []NodeID) {
	t.changes = append(t.changes, changes...)
	if len(changes) > 0 {
		t.c <- struct{}{}
	}
}

func (t *testCRObserver) TlfHandleChange(ctx context.Context,
	newHandle *tlfhandle.Handle) {
}

func checkStatus(ctx context.Context, t *testing.T, kbfsOps KBFSOps,
	staged bool, headWriter kbname.NormalizedUsername, dirtyPaths []string, fb data.FolderBranch,
	prefix string) {
	status, _, err := kbfsOps.FolderStatus(ctx, fb)
	require.NoError(t, err)
	assert.Equal(t, status.Staged, staged)
	assert.Equal(t, status.HeadWriter, headWriter)
	checkStringSlices(t, dirtyPaths, status.DirtyPaths)
}

func TestBasicMDUpdate(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, statusChan, err := kbfsOps2.FolderStatus(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// user 1 creates a file
	kbfsOps1 := config1.KBFSOps()
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	entries, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Equal(t, 1, len(entries))
	_, ok := entries[rootNode2.ChildName("a")]
	require.True(t, ok)

	// The status should have fired as well (though in this case the
	// writer is the same as before)
	<-statusChan
	checkStatus(ctx, t, kbfsOps1, false, userName1, nil,
		rootNode1.GetFolderBranch(), "Node 1")
	checkStatus(ctx, t, kbfsOps2, false, userName1, nil,
		rootNode2.GetFolderBranch(), "Node 2")
}

func testMultipleMDUpdates(t *testing.T, unembedChanges bool) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	if unembedChanges {
		bss1, ok1 := config1.BlockSplitter().(*data.BlockSplitterSimple)
		require.True(t, ok1)
		bss2, ok2 := config2.BlockSplitter().(*data.BlockSplitterSimple)
		require.True(t, ok2)
		bss1.SetBlockChangeEmbedMaxSizeForTesting(3)
		bss2.SetBlockChangeEmbedMaxSizeForTesting(3)
	}

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	// user 1 creates a file
	_, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// user 2 looks up the directory (and sees the file)
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	// now user 1 renames the old file, and creates a new one
	err = kbfsOps1.Rename(ctx, rootNode1, testPPS("a"), rootNode1, testPPS("b"))
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, testPPS("c"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	kbfsOps2 := config2.KBFSOps()
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	entries, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Equal(t, 2, len(entries))
	_, ok := entries[rootNode2.ChildName("b")]
	require.True(t, ok)
	_, ok = entries[rootNode2.ChildName("c")]
	require.True(t, ok)
}

func TestMultipleMDUpdates(t *testing.T) {
	testMultipleMDUpdates(t, false)
}

func TestMultipleMDUpdatesUnembedChanges(t *testing.T) {
	testMultipleMDUpdates(t, true)
}

func TestGetTLFCryptKeysWhileUnmergedAfterRestart(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_for_gettlfcryptkeys")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()

	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	// enable journaling to see patrick's error
	err = config1.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config1.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jManager, err := GetJournalManager(config1)
	require.NoError(t, err)
	jManager.onBranchChange = nil
	jManager.onMDFlush = nil
	err = jManager.EnableAuto(ctx)
	require.NoError(t, err)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	fileNode1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	_, err = DisableUpdatesForTesting(config1, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config1, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// Wait for "a" to flush to the server.
	err = jManager.Wait(ctx, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err)

	// then user2 write to the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	data2 := []byte{2}
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	require.NoError(t, err)
	checkStatus(ctx, t, kbfsOps2, false, userName1, []string{"u1,u2/a"},
		rootNode2.GetFolderBranch(), "Node 2 (after write)")
	err = kbfsOps2.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err)

	// Now when user 1 tries to write to file 1 and sync, it will
	// become unmerged.
	data1 := []byte{1}
	err = kbfsOps1.Write(ctx, fileNode1, data1, 0)
	require.NoError(t, err)
	// sync the file from u1 so that we get a clean exit state
	err = kbfsOps1.SyncAll(ctx, fileNode1.GetFolderBranch())
	require.NoError(t, err)

	// Wait for the conflict to be detected.
	err = jManager.Wait(ctx, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err)

	// now re-login u1
	config1B := ConfigAsUser(config1, userName1)
	err = config1B.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	defer CheckConfigAndShutdown(ctx, t, config1B)
	err = config1B.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jManager, err = GetJournalManager(config1B)
	require.NoError(t, err)
	jManager.onBranchChange = nil
	jManager.onMDFlush = nil

	err = DisableCRForTesting(config1B, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	tlfHandle, err := tlfhandle.ParseHandle(
		ctx, config1B.KBPKI(), config1B.MDOps(), nil, name, tlf.Private)
	require.NoError(t, err)

	_, _, err = config1B.KBFSOps().GetTLFCryptKeys(ctx, tlfHandle)
	require.NoError(t, err)
}

// Tests that, in the face of a conflict, a user will commit its
// changes to a private branch, which will persist after restart (and
// the other user will be unaffected).
func TestUnmergedAfterRestart(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	fileNode1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	_, err = DisableUpdatesForTesting(config1, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config1, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// then user2 write to the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	data2 := []byte{2}
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	require.NoError(t, err)
	checkStatus(ctx, t, kbfsOps2, false, userName1, []string{"u1,u2/a"},
		rootNode2.GetFolderBranch(), "Node 2 (after write)")
	err = kbfsOps2.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err)

	// Now when user 1 tries to write to file 1 and sync, it will
	// become unmerged.  Because this happens in the same goroutine as
	// the above Sync, we can be sure that the updater on client 1
	// hasn't yet seen the MD update, and so its Sync will present a
	// conflict.
	data1 := []byte{1}
	err = kbfsOps1.Write(ctx, fileNode1, data1, 0)
	require.NoError(t, err)
	checkStatus(ctx, t, kbfsOps1, false, userName1, []string{"u1,u2/a"},
		rootNode1.GetFolderBranch(), "Node 1 (after write)")
	err = kbfsOps1.SyncAll(ctx, fileNode1.GetFolderBranch())
	require.NoError(t, err)

	checkStatus(ctx, t, kbfsOps1, true, userName1, nil,
		rootNode1.GetFolderBranch(), "Node 1")
	checkStatus(ctx, t, kbfsOps2, false, userName2, nil,
		rootNode2.GetFolderBranch(), "Node 2")

	// now re-login the users, and make sure 1 can see the changes,
	// but 2 can't
	config1B := ConfigAsUser(config1, userName1)
	defer CheckConfigAndShutdown(ctx, t, config1B)
	config2B := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2B)

	err = DisableCRForTesting(config1B, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// Keep the config1B node in memory, so it doesn't get garbage
	// collected (preventing notifications)
	rootNode1B := GetRootNodeOrBust(ctx, t, config1B, name, tlf.Private)

	kbfsOps1B := config1B.KBFSOps()
	fileNode1B, _, err := kbfsOps1B.Lookup(ctx, rootNode1B, testPPS("a"))
	require.NoError(t, err)

	readAndCompareData(ctx, t, config1B, name, data1, userName1)
	readAndCompareData(ctx, t, config2B, name, data2, userName2)

	checkStatus(ctx, t, config1B.KBFSOps(), true, userName1, nil,
		fileNode1B.GetFolderBranch(), "Node 1")
	checkStatus(ctx, t, config2B.KBFSOps(), false, userName2, nil,
		rootNode2.GetFolderBranch(), "Node 2")

	// register as a listener before the unstaging happens
	c := make(chan struct{}, 2)
	cro := &testCRObserver{c, nil}
	err = config1B.Notifier().RegisterForChanges(
		[]data.FolderBranch{rootNode1B.GetFolderBranch()}, cro)
	require.NoError(t, err)

	ops1B := getOps(config1B, fileNode1B.GetFolderBranch().Tlf)
	ops2B := getOps(config2B, fileNode1B.GetFolderBranch().Tlf)
	lState := makeFBOLockState()
	require.Equal(t, ops1B.getLatestMergedRevision(lState), ops2B.getCurrMDRevision(lState))

	// Unstage user 1's changes, and make sure everyone is back in
	// sync.  TODO: remove this once we have automatic conflict
	// resolution.
	err = config1B.KBFSOps().UnstageForTesting(ctx,
		rootNode1B.GetFolderBranch())
	require.NoError(t, err)

	// we should have had at least two updates, one for the unstaging and one
	// for the fast-forward
	select {
	case <-c:
	default:
		t.Fatal("No update!")
	}
	select {
	case <-c:
	default:
		t.Fatal("No 2nd update!")
	}
	// make sure we see two sync op changes, on the same node
	assert.Equal(t, 2, len(cro.changes))
	var n Node
	for _, change := range cro.changes {
		if n == nil {
			n = change.Node
		} else {
			assert.Equal(t, n.GetID(), change.Node.GetID())
		}
	}

	err = config1B.KBFSOps().SyncFromServer(
		ctx, fileNode1B.GetFolderBranch(), nil)
	require.NoError(t, err)
	err = config2B.KBFSOps().
		SyncFromServer(ctx,
			rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	readAndCompareData(ctx, t, config1B, name, data2, userName2)
	readAndCompareData(ctx, t, config2B, name, data2, userName2)
	checkStatus(ctx, t, config1B.KBFSOps(), false, userName1, nil,
		rootNode1.GetFolderBranch(), "Node 1 (after unstage)")
	checkStatus(ctx, t, config2B.KBFSOps(), false, userName1, nil,
		rootNode2.GetFolderBranch(), "Node 2 (after unstage)")
}

// Tests that multiple users can write to the same file sequentially
// without any problems.
func TestMultiUserWrite(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// then user2 write to the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)

	data2 := []byte{2}
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	require.NoError(t, err)
	// Write twice to make sure that multiple write operations within
	// a sync work when the writer is changing.
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err)
	readAndCompareData(ctx, t, config2, name, data2, userName2)

	// A second write by the same user
	data3 := []byte{3}
	err = kbfsOps2.Write(ctx, fileNode2, data3, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err)

	readAndCompareData(ctx, t, config2, name, data3, userName2)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)
	readAndCompareData(ctx, t, config1, name, data3, userName2)
}

func testBasicCRNoConflict(t *testing.T, unembedChanges bool) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	if unembedChanges {
		bss1, ok1 := config1.BlockSplitter().(*data.BlockSplitterSimple)
		require.True(t, ok1)
		bss2, ok2 := config2.BlockSplitter().(*data.BlockSplitterSimple)
		require.True(t, ok2)
		// 128 seems to be a good size that works on both 386 and x64
		// platforms.
		bss1.SetBlockChangeEmbedMaxSizeForTesting(128)
		bss2.SetBlockChangeEmbedMaxSizeForTesting(128)
	}

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)

	// disable updates on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 makes a new file
	_, _, err = kbfsOps1.CreateFile(
		ctx, rootNode1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a new different file
	_, _, err = kbfsOps2.CreateFile(
		ctx, rootNode2, testPPS("c"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// re-enable updates, and wait for CR to complete
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	// Make sure they both see the same set of children
	expectedChildren := []string{"a", "b", "c"}
	children1, err := kbfsOps1.GetDirChildren(ctx, rootNode1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)

	assert.Equal(t, len(expectedChildren), len(children1))

	for _, child := range expectedChildren {
		_, ok := children1[rootNode1.ChildName(child)]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)

	if unembedChanges {
		// Make sure the MD has an unembedded change block.
		md, err := config1.MDOps().GetForTLF(ctx,
			rootNode1.GetFolderBranch().Tlf, nil)
		require.NoError(t, err)
		require.NotEqual(t, data.ZeroPtr, md.data.cachedChanges.Info.BlockPointer)
	}
}

// Tests that two users can make independent writes while forked, and
// conflict resolution will merge them correctly.
func TestBasicCRNoConflict(t *testing.T) {
	testBasicCRNoConflict(t, false)
}

// Tests same as above, with unembedded block changes
func TestBasicCRNoConflictWithUnembeddedBlockChanges(t *testing.T) {
	testBasicCRNoConflict(t, true)
}

type registerForUpdateRecord struct {
	id       tlf.ID
	currHead kbfsmd.Revision
}

type mdServerLocalRecordingRegisterForUpdate struct {
	mdServerLocal
	ch chan<- registerForUpdateRecord
}

// newMDServerLocalRecordingRegisterForUpdate returns a wrapper of
// MDServerLocal that records RegisterforUpdate calls.
func newMDServerLocalRecordingRegisterForUpdate(mdServerRaw mdServerLocal) (
	mdServer mdServerLocalRecordingRegisterForUpdate,
	records <-chan registerForUpdateRecord) {
	ch := make(chan registerForUpdateRecord, 8)
	ret := mdServerLocalRecordingRegisterForUpdate{mdServerRaw, ch}
	return ret, ch
}

func (md mdServerLocalRecordingRegisterForUpdate) RegisterForUpdate(
	ctx context.Context,
	id tlf.ID, currHead kbfsmd.Revision) (<-chan error, error) {
	md.ch <- registerForUpdateRecord{id: id, currHead: currHead}
	return md.mdServerLocal.RegisterForUpdate(ctx, id, currHead)
}

func TestCRFileConflictWithMoreUpdatesFromOneUser(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	mdServ, chForMdServer2 := newMDServerLocalRecordingRegisterForUpdate(
		config2.MDServer().(mdServerLocal))
	config2.SetMDServer(mdServ)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, testPPS("b"))
	require.NoError(t, err)

	// disable updates on user 2
	chForEnablingUpdates, err := DisableUpdatesForTesting(
		config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 writes the file
	data := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, fileB1, data, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, fileB1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a few changes in the file
	for i := byte(0); i < 4; i++ {
		// This makes sure the unmerged head of user 2 is ahead of (has large
		// revision than) the merged master branch, so we can test that we properly
		// fetch updates when unmerged revision number is greater than merged
		// revision number (regression in KBFS-1206).

		data = []byte{1, 2, 3, 4, i}
		err = kbfsOps2.Write(ctx, fileB2, data, 0)
		require.NoError(t, err)

		err = kbfsOps2.SyncAll(ctx, fileB2.GetFolderBranch())
		require.NoError(t, err)
	}

	chForEnablingUpdates <- struct{}{}

	equal := false

	// check for at most 4 times. This should be sufficiently long for client get
	// latest merged revision and register with that
	for i := 0; i < 4; i++ {
		record := <-chForMdServer2
		mergedRev, err := mdServ.getCurrentMergedHeadRevision(
			ctx, rootNode2.GetFolderBranch().Tlf)
		require.NoError(t, err)
		if record.currHead == mergedRev {
			equal = true
			break
		}
	}

	require.True(t, equal)
}

// Tests that two users can make independent writes while forked, and
// conflict resolution will merge them correctly.
func TestBasicCRFileConflict(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	clock, now := clocktest.NewTestClockAndTimeNow()
	config2.SetClock(clock)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(
		ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, testPPS("b"))
	require.NoError(t, err)

	// disable updates on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 writes the file
	data1 := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, fileB1, data1, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, fileB1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a new different file
	data2 := []byte{5, 4, 3, 2, 1}
	err = kbfsOps2.Write(ctx, fileB2, data2, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileB2.GetFolderBranch())
	require.NoError(t, err)

	// re-enable updates, and wait for CR to complete
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	cre := WriterDeviceDateConflictRenamer{}
	// Make sure they both see the same set of children
	expectedChildren := []string{
		"b",
		cre.ConflictRenameHelper(now, "u2", "dev1", "b"),
	}
	children1, err := kbfsOps1.GetDirChildren(ctx, dirA1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, dirA2)
	require.NoError(t, err)

	assert.Equal(t, len(expectedChildren), len(children1))

	for _, child := range expectedChildren {
		_, ok := children1[dirA1.ChildName(child)]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
}

// Tests that if CR fails enough times it will stop trying,
// and that we can move the conflicts out of the way.
func TestBasicCRFailureAndFixing(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_for_fail_fix")
	defer os.RemoveAll(tempdir)

	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	// Enable journaling on user 2
	require.NoError(t, err)
	err = config2.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config2.EnableJournaling(ctx, tempdir,
		TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jManager, err := GetJournalManager(config2)
	require.NoError(t, err)
	err = jManager.EnableAuto(ctx)
	require.NoError(t, err)

	clock, now := clocktest.NewTestClockAndTimeNow()
	config2.SetClock(clock)

	name := userName1.String() + "," + userName2.String()

	t.Log("User 1 creates a file a/b.")
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(
		ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	t.Log("User 2 looks up file a/b.")
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, testPPS("b"))
	require.NoError(t, err)

	err = SetCRFailureForTesting(ctx, config2, rootNode2.GetFolderBranch(),
		alwaysFailCR)
	require.NoError(t, err)

	t.Log("Disable updates on user 2.")
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("User 1 writes to file a/b.")
	data1 := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, fileB1, data1, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, fileB1.GetFolderBranch())
	require.NoError(t, err)

	t.Log("User 2 writes to file a/b without having heard user 1's update.")
	data2 := []byte{5, 4, 3, 2, 1}
	err = kbfsOps2.Write(ctx, fileB2, data2, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileB2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Reenable updates and wait for CR to fail.")
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Try to SyncFromServer on user 2.")
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.Equal(t, &ErrStillStagedAfterCR{}, err)

	ops, ok := config2.KBFSOps().(*KBFSOpsStandard)
	require.True(t, ok)
	fbo := ops.getOpsNoAdd(ctx, rootNode2.GetFolderBranch())

	t.Log("Write a bunch more files as user 2, creating more conflicts.")
	for i := 0; i < maxConflictResolutionAttempts; i++ {
		fileName := fmt.Sprintf("file%d", i)
		newFile, _, err := kbfsOps2.CreateFile(
			ctx, dirA2, testPPS(fileName), false, NoExcl)
		require.NoError(t, err, "Loop %d", i)
		err = kbfsOps2.SyncAll(ctx, newFile.GetFolderBranch())
		require.NoError(t, err, "Loop %d", i)
		err = fbo.cr.Wait(ctx)
		require.NoError(t, err, "Loop %d", i)
	}

	t.Log("Check that there is conflict state in the CR DB.")
	crdb := config2.GetConflictResolutionDB()
	crData, err := crdb.Get(fbo.id().Bytes(), nil)
	require.NoError(t, err)
	require.NotZero(t, len(crData))

	t.Log("Clear the conflict state and re-enable CR.")
	err = fbo.clearConflictView(ctx)
	require.NoError(t, err)

	err = SetCRFailureForTesting(ctx, config2, rootNode2.GetFolderBranch(),
		doNotAlwaysFailCR)
	require.NoError(t, err)

	t.Log("Trigger CR and wait for it to resolve.")
	dirA2, _, err = kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(
		ctx, dirA2, testPPS("newFile"), false, NoExcl)
	require.NoError(t, err)

	err = kbfsOps2.SyncAll(ctx, dirA2.GetFolderBranch())
	require.NoError(t, err)
	err = fbo.cr.Wait(ctx)
	require.NoError(t, err)

	t.Log("Verify that the conflict is resolved.")
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	t.Log("Check that the directories match on the 2 users.")

	children1, err := kbfsOps1.GetDirChildren(ctx, dirA1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, dirA2)
	require.NoError(t, err)

	require.Equal(t, children2, children1)

	t.Log("Verify we can access the conflict folder through another handle")
	dateStr := now.UTC().Format("2006-01-02")
	h, err := tlfhandle.ParseHandle(
		ctx, config2.KBPKI(), config2.MDOps(), nil,
		name+" (local conflicted copy "+dateStr+")", tlf.Private)
	require.NoError(t, err)
	b, ok := data.MakeConflictBranchName(h)
	require.True(t, ok)

	rootNodeConflict, _, err := kbfsOps2.GetRootNode(ctx, h, b)
	require.NoError(t, err)
	dirAConflict, _, err := kbfsOps2.Lookup(ctx, rootNodeConflict, testPPS("a"))
	require.NoError(t, err)
	fileBConflict, _, err := kbfsOps2.Lookup(ctx, dirAConflict, testPPS("b"))
	require.NoError(t, err)

	gotData2 := make([]byte, len(data2))
	_, err = kbfsOps2.Read(ctx, fileBConflict, gotData2, 0)
	require.NoError(t, err)
	require.Equal(t, data2, gotData2)
}

// Tests that two users can create the same file simultaneously, and
// the unmerged user can write to it, and they will be merged into a
// single file.
func TestBasicCRFileCreateUnmergedWriteConflict(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	config2.SetClock(clocktest.NewTestClockNow())

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 creates the same file, and writes to it.
	fileB2, _, err := kbfsOps2.CreateFile(
		ctx, dirA2, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	data2 := []byte{5, 4, 3, 2, 1}
	err = kbfsOps2.Write(ctx, fileB2, data2, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileB2.GetFolderBranch())
	require.NoError(t, err)

	// re-enable updates, and wait for CR to complete
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	// Make sure they both see the same set of children
	expectedChildren := []string{
		"b",
	}
	children1, err := kbfsOps1.GetDirChildren(ctx, dirA1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, dirA2)
	require.NoError(t, err)

	assert.Equal(t, len(expectedChildren), len(children1))

	for _, child := range expectedChildren {
		_, ok := children1[dirA1.ChildName(child)]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
}

// Test that two conflict resolutions work correctly.
func TestCRDouble(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config2.SetClock(clocktest.NewTestClockNow())
	name := userName1.String() + "," + userName2.String()

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 creates a new file to start a conflict.
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a couple revisions
	fileNodeC, _, err := kbfsOps2.CreateFile(
		ctx, rootNode2, testPPS("c"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.Write(ctx, fileNodeC, []byte{0}, 0)
	require.NoError(t, err)

	var wg sync.WaitGroup
	syncCtx, cancel := context.WithCancel(ctx)

	// Cancel this revision after the Put happens, to force the
	// background block manager to try to clean up.
	onSyncStalledCh, syncUnstallCh, syncCtx := StallMDOp(
		syncCtx, config2, StallableMDAfterPutUnmerged, 1)

	wg.Add(1)
	go func() {
		defer wg.Done()
		err = kbfsOps2.SyncAll(syncCtx, fileNodeC.GetFolderBranch())
		// Even though internally folderBranchOps ignores the
		// cancellation error when putting on an unmerged branch, the
		// wrapper function *might* still return it.
		if err != nil {
			assert.Equal(t, context.Canceled, err)
		}
	}()
	<-onSyncStalledCh
	cancel()
	close(syncUnstallCh)
	wg.Wait()

	// Sync for real to clear out the dirty files.
	err = kbfsOps2.SyncAll(ctx, fileNodeC.GetFolderBranch())
	require.NoError(t, err)

	// Do one CR.
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	// A few merged revisions
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("e"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("f"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	ops := getOps(config2, rootNode.GetFolderBranch().Tlf)
	// Wait for the processor to try to delete the failed revision
	// (which pulls the unmerged MD ops back into the cache).
	err = ops.fbm.waitForArchives(ctx)
	require.NoError(t, err)
	err = ops.fbm.waitForDeletingBlocks(ctx)
	require.NoError(t, err)

	// Sync user 1, then start another round of CR.
	err = kbfsOps1.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err = DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, testPPS("g"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a couple unmerged revisions
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("h"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("i"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Do a second CR.
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
}

// Tests that two users can make independent writes while forked, and
// conflict resolution will merge them correctly and the rekey bit is
// preserved until rekey.
func TestBasicCRFileConflictWithRekey(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	clock, now := clocktest.NewTestClockAndTimeNow()
	config2.SetClock(clock)
	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(
		ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, testPPS("b"))
	require.NoError(t, err)

	config2Dev2 := ConfigAsUser(config1, userName2)
	// we don't check the config because this device can't read all of
	// the md blocks.
	defer func() { _ = config2Dev2.Shutdown(ctx) }()
	config2Dev2.MDServer().DisableRekeyUpdatesForTesting()

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, session2.UID)
	AddDeviceForLocalUserOrBust(t, config2, session2.UID)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, session2.UID)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user2 device 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	_, err = GetRootNodeForTest(ctx, config2Dev2, name, tlf.Private)
	require.IsType(t, NeedSelfRekeyError{}, err)

	// User 2 syncs
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	// disable updates on user2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 writes the file
	data1 := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, fileB1, data1, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, fileB1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 dev 2 should set the rekey bit
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _ = RequestRekeyAndWaitForOneFinishEvent(ctx,
		kbfsOps2Dev2, rootNode2.GetFolderBranch().Tlf)

	// User 1 syncs
	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	// User 2 makes a new different file
	data2 := []byte{5, 4, 3, 2, 1}
	err = kbfsOps2.Write(ctx, fileB2, data2, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileB2.GetFolderBranch())
	require.NoError(t, err)

	// re-enable updates, and wait for CR to complete.
	// this should also cause a rekey of the folder.
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
	// wait for the rekey to happen
	_, _ = RequestRekeyAndWaitForOneFinishEvent(ctx,
		config2.KBFSOps(), rootNode2.GetFolderBranch().Tlf)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	// Look it up on user 2 dev 2 after syncing.
	err = kbfsOps2Dev2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
	rootNode2Dev2 := GetRootNodeOrBust(ctx, t, config2Dev2, name, tlf.Private)
	dirA2Dev2, _, err := kbfsOps2Dev2.Lookup(ctx, rootNode2Dev2, testPPS("a"))
	require.NoError(t, err)

	cre := WriterDeviceDateConflictRenamer{}
	// Make sure they all see the same set of children
	expectedChildren := []string{
		"b",
		cre.ConflictRenameHelper(now, "u2", "dev1", "b"),
	}
	children1, err := kbfsOps1.GetDirChildren(ctx, dirA1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, dirA2)
	require.NoError(t, err)

	children2Dev2, err := kbfsOps2Dev2.GetDirChildren(ctx, dirA2Dev2)
	require.NoError(t, err)

	assert.Equal(t, len(expectedChildren), len(children1))

	for _, child := range expectedChildren {
		_, ok := children1[dirA1.ChildName(child)]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
	require.Equal(t, children2, children2Dev2)
}

// Same as above, except the "winner" is the rekey request, and the
// "loser" is the file write.  Regression test for KBFS-773.
func TestBasicCRFileConflictWithMergedRekey(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config2.SetClock(clocktest.NewTestClockNow())
	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(
		ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)

	config2Dev2 := ConfigAsUser(config1, userName2)
	// we don't check the config because this device can't read all of
	// the md blocks.
	defer func() { _ = config2Dev2.Shutdown(ctx) }()
	config2Dev2.MDServer().DisableRekeyUpdatesForTesting()

	// Now give u2 a new device.  The configs don't share a Keybase
	// Daemon so we have to do it in all places.
	AddDeviceForLocalUserOrBust(t, config1, session2.UID)
	AddDeviceForLocalUserOrBust(t, config2, session2.UID)
	devIndex := AddDeviceForLocalUserOrBust(t, config2Dev2, session2.UID)
	SwitchDeviceForLocalUserOrBust(t, config2Dev2, devIndex)

	// user2 device 2 should be unable to read the data now since its device
	// wasn't registered when the folder was originally created.
	_, err = GetRootNodeForTest(ctx, config2Dev2, name, tlf.Private)
	require.IsType(t, NeedSelfRekeyError{}, err)

	// User 2 syncs
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	// disable updates on user1
	c, err := DisableUpdatesForTesting(config1, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config1, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 2 dev 2 should set the rekey bit
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, _ = RequestRekeyAndWaitForOneFinishEvent(ctx,
		kbfsOps2Dev2, rootNode2.GetFolderBranch().Tlf)

	// User 1 writes the file
	data1 := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, fileB1, data1, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, fileB1.GetFolderBranch())
	require.NoError(t, err)

	// re-enable updates, and wait for CR to complete.
	// this should also cause a rekey of the folder.
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config1,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)
	// wait for the rekey to happen
	_, _ = RequestRekeyAndWaitForOneFinishEvent(ctx,
		config1.KBFSOps(), rootNode1.GetFolderBranch().Tlf)

	err = kbfsOps1.SyncFromServer(ctx,
		rootNode1.GetFolderBranch(), nil)
	require.NoError(t, err)

	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	// Look it up on user 2 dev 2 after syncing.
	err = kbfsOps2Dev2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
	rootNode2Dev2 := GetRootNodeOrBust(ctx, t, config2Dev2, name, tlf.Private)
	dirA2Dev2, _, err := kbfsOps2Dev2.Lookup(ctx, rootNode2Dev2, testPPS("a"))
	require.NoError(t, err)

	// Make sure they all see the same set of children
	expectedChildren := []string{
		"b",
	}
	children1, err := kbfsOps1.GetDirChildren(ctx, dirA1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, dirA2)
	require.NoError(t, err)

	children2Dev2, err := kbfsOps2Dev2.GetDirChildren(ctx, dirA2Dev2)
	require.NoError(t, err)

	assert.Equal(t, len(expectedChildren), len(children1))

	for _, child := range expectedChildren {
		_, ok := children1[dirA1.ChildName(child)]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
	require.Equal(t, children2, children2Dev2)
}

// Test that, when writing multiple blocks in parallel under conflict
// resolution, one error will cancel the remaining puts and the block
// server will be consistent.
func TestCRSyncParallelBlocksErrorCleanup(t *testing.T) {
	t.Skip("Broken due to KBFS-1193")

	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config2.SetClock(clocktest.NewTestClockNow())
	name := userName1.String() + "," + userName2.String()

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit, err := data.NewBlockSplitterSimpleExact(blockSize, 2, 100*1024)
	require.NoError(t, err)
	config1.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 creates a new file to start a conflict.
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// User 2 does one successful operation to create the first unmerged MD.
	fileNodeB, _, err := kbfsOps2.CreateFile(
		ctx, rootNode2, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 2 writes some data
	fileBlocks := int64(maxParallelBlockPuts + 5)
	var data []byte
	for i := int64(0); i < blockSize*fileBlocks; i++ {
		data = append(data, byte(i))
	}
	err = kbfsOps2.Write(ctx, fileNodeB, data, 0)
	require.NoError(t, err)

	// Start the sync and wait for it to stall.
	var wg sync.WaitGroup
	wg.Add(1)
	syncCtx, cancel := context.WithCancel(
		libcontext.BackgroundContextWithCancellationDelayer())
	defer func() {
		err := libcontext.CleanupCancellationDelayer(syncCtx)
		require.NoError(t, err)
	}()

	// Now user 2 makes a big write where most of the blocks get canceled.
	// We only need to know the first time we stall.
	onSyncStalledCh, syncUnstallCh, syncCtx := StallBlockOp(
		syncCtx, config2, StallableBlockPut, 2)

	var syncErr error
	go func() {
		defer wg.Done()

		syncErr = kbfsOps2.SyncAll(syncCtx, fileNodeB.GetFolderBranch())
	}()
	// Wait for 2 of the blocks and let them go
	<-onSyncStalledCh
	<-onSyncStalledCh
	syncUnstallCh <- struct{}{}
	syncUnstallCh <- struct{}{}

	// Wait for the rest of the puts (this indicates that the first
	// two succeeded correctly and two more were sent to replace them)
	for i := 0; i < maxParallelBlockPuts; i++ {
		<-onSyncStalledCh
	}
	// Cancel so all other block puts fail
	cancel()
	close(syncUnstallCh)
	wg.Wait()

	require.Equal(t, context.Canceled, syncErr)

	// Get the mdWriterLock to be sure the sync has exited (since the
	// cleanup logic happens in a background goroutine)
	ops := getOps(config2, rootNode2.GetFolderBranch().Tlf)
	lState := makeFBOLockState()
	ops.mdWriterLock.Lock(lState)
	ops.mdWriterLock.Unlock(lState)

	// The state checker will make sure those blocks from
	// the failed sync get cleaned up.

	for i := int64(0); i < blockSize*fileBlocks; i++ {
		data[i] = byte(i + 10)
	}
	err = kbfsOps2.Write(ctx, fileNodeB, data, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileNodeB.GetFolderBranch())
	require.NoError(t, err)

	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
}

// Test that a resolution can be canceled right before the Put due to
// another operation, and then the second resolution includes both
// unmerged operations.  Regression test for KBFS-1133.
func TestCRCanceledAfterNewOperation(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	clock, now := clocktest.NewTestClockAndTimeNow()
	config2.SetClock(clock)
	name := userName1.String() + "," + userName2.String()

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	aNode1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	data := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, aNode1, data, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	aNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 truncates file a.
	err = kbfsOps1.Truncate(ctx, aNode1, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 writes to the file, creating a conflict.
	data2 := []byte{5, 4, 3, 2, 1}
	err = kbfsOps2.Write(ctx, aNode2, data2, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, aNode2.GetFolderBranch())
	require.NoError(t, err)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(context.Background(), config2, StallableMDResolveBranch, 1)

	var wg sync.WaitGroup
	putCtx, cancel2 := context.WithCancel(putCtx)
	wg.Add(1)
	go func() {
		defer wg.Done()

		c <- struct{}{}
		// Make sure the CR gets done with a context we can use for
		// stalling.
		err = RestartCRForTesting(putCtx, config2,
			rootNode2.GetFolderBranch())
		assert.NoError(t, err)
		err = kbfsOps2.SyncFromServer(putCtx,
			rootNode2.GetFolderBranch(), nil)
		assert.Error(t, err)
	}()
	<-onPutStalledCh
	cancel2()
	close(putUnstallCh)
	wg.Wait()

	// Disable again
	c, err = DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Do a second operation and complete the resolution.
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	// Now there should be a conflict file containing data2.
	cre := WriterDeviceDateConflictRenamer{}
	// Make sure they both see the same set of children
	expectedChildren := []string{
		"a",
		cre.ConflictRenameHelper(now, "u2", "dev1", "a"),
		"b",
	}
	children2, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	assert.Equal(t, len(expectedChildren), len(children2))
	for _, child := range expectedChildren {
		_, ok := children2[rootNode2.ChildName(child)]
		assert.True(t, ok)
	}
}

// Tests that if a user gets /too/ unmerged, they will have their
// unmerged writes blocked.
func TestBasicCRBlockUnmergedWrites(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateFile(ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	ops2 := getOps(config2, rootNode2.GetFolderBranch().Tlf)
	ops2.cr.maxRevsThreshold = 2
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	_, _, err = kbfsOps2.Lookup(ctx, dirA2, testPPS("b"))
	require.NoError(t, err)

	// disable updates on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// One write for user 1
	_, _, err = kbfsOps1.CreateFile(ctx, dirA1, testPPS("c"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, dirA1.GetFolderBranch())
	require.NoError(t, err)

	// Two writes for user 2
	_, _, err = kbfsOps2.CreateFile(ctx, dirA2, testPPS("d"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(ctx, dirA2, testPPS("e"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Start CR, but cancel it before it completes, which should lead
	// to it locking next time (since it has seen how many revisions
	// are outstanding).
	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(context.Background(), config2, StallableMDResolveBranch, 1)

	var wg sync.WaitGroup
	firstPutCtx, cancel := context.WithCancel(putCtx)
	wg.Add(1)
	go func() {
		defer wg.Done()

		// Make sure the CR gets done with a context we can use for
		// stalling.
		err = RestartCRForTesting(firstPutCtx, config2,
			rootNode2.GetFolderBranch())
		if !assert.NoError(t, err) {
			return
		}
		err = kbfsOps2.SyncFromServer(firstPutCtx,
			rootNode2.GetFolderBranch(), nil)
		if !assert.Error(t, err) {
			return
		}
		err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
		if !assert.NoError(t, err) {
			return
		}
	}()
	<-onPutStalledCh
	cancel()
	putUnstallCh <- struct{}{}
	wg.Wait()

	// Pretend that CR was canceled by another write.
	_, _, err = kbfsOps2.CreateFile(ctx, dirA2, testPPS("f"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Now restart CR, and make sure it blocks all writes.
	wg.Add(1)
	go func() {
		defer wg.Done()

		// Make sure the CR gets done with a context we can use for
		// stalling.
		err = RestartCRForTesting(putCtx, config2,
			rootNode2.GetFolderBranch())
		if !assert.NoError(t, err) {
			return
		}
	}()
	<-onPutStalledCh
	c <- struct{}{}

	// Now try to write again
	writeErrCh := make(chan error, 1)
	go func() {
		_, _, err := kbfsOps2.CreateFile(
			ctx, dirA2, testPPS("g"), false, NoExcl)
		assert.NoError(t, err)
		err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
		require.NoError(t, err)
		writeErrCh <- err
	}()

	// For now, assume we're blocked if the write doesn't go through
	// in 20ms.  TODO: instruct mdWriterLock to know for sure how many
	// goroutines it's blocking?
	timer := time.After(20 * time.Millisecond)
	select {
	case <-writeErrCh:
		t.Fatalf("Write finished without blocking")
	case <-timer:
	}

	// Finish the CR.
	close(putUnstallCh)
	wg.Wait()

	// Now the write can finish
	err = <-writeErrCh
	require.NoError(t, err)
}

// Test that an umerged put can be canceled, and the conflict
// resolution will fix the resulting weird state.
func TestUnmergedPutAfterCanceledUnmergedPut(t *testing.T) {
	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	name := userName1.String() + "," + userName2.String()

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	aNode1, _, err := kbfsOps1.CreateFile(
		ctx, rootNode, testPPS("a"), false, NoExcl)
	require.NoError(t, err)
	data := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, aNode1, data, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 truncates file a.
	err = kbfsOps1.Truncate(ctx, aNode1, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 creates a file to start a conflict branch.
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	onPutStalledCh, putUnstallCh, putCtx :=
		StallMDOp(ctx, config2, StallableMDPutUnmerged, 1)

	var wg sync.WaitGroup
	putCtx, cancel2 := context.WithCancel(putCtx)
	wg.Add(1)
	go func() {
		defer wg.Done()
		_, _, err = kbfsOps2.CreateFile(
			putCtx, rootNode2, testPPS("c"), false, NoExcl)
		require.NoError(t, err)
		err = kbfsOps2.SyncAll(putCtx, rootNode2.GetFolderBranch())
		// Even though internally folderBranchOps ignores the
		// cancellation error when putting on an unmerged branch, the
		// wrapper function *might* still return it.
		if err != nil {
			assert.Equal(t, context.Canceled, err)
		}

	}()
	<-onPutStalledCh
	cancel2()
	close(putUnstallCh)
	wg.Wait()

	// At this point, the local unmerged head doesn't match the
	// server's unmerged head, but CR will fix it up.

	c <- struct{}{}
	err = RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServer(ctx,
		rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)

	// Make sure they both see the same set of children.
	expectedChildren := []string{
		"a",
		"b",
		"c",
	}
	children2, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	assert.Equal(t, len(expectedChildren), len(children2))
	for _, child := range expectedChildren {
		_, ok := children2[rootNode2.ChildName(child)]
		assert.True(t, ok)
	}
}

func TestForceStuckConflict(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_for_stuck_cr")
	defer os.RemoveAll(tempdir)
	require.NoError(t, err)

	var u1 kbname.NormalizedUsername = "u1"
	config, _, ctx, cancel := kbfsOpsConcurInit(t, u1)
	defer kbfsConcurTestShutdown(ctx, t, config, cancel)

	t.Log("Enable journaling")
	err = config.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jManager, err := GetJournalManager(config)
	require.NoError(t, err)
	err = jManager.EnableAuto(ctx)
	require.NoError(t, err)

	name := "u1"
	h, err := tlfhandle.ParseHandle(
		ctx, config.KBPKI(), config.MDOps(), nil, name, tlf.Private)
	require.NoError(t, err)
	kbfsOps := config.KBFSOps()

	t.Log("Initialize the TLF")
	rootNode, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, data.MasterBranch)
	require.NoError(t, err)
	_, _, err = kbfsOps.CreateDir(ctx, rootNode, testPPS("a"))
	require.NoError(t, err)
	err = kbfsOps.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	t.Log("Force a conflict")
	tlfID := rootNode.GetFolderBranch().Tlf
	err = kbfsOps.ForceStuckConflictForTesting(ctx, tlfID)
	require.NoError(t, err)

	t.Log("Ensure conflict files are there")
	children, err := kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	require.Len(t, children, 1+(maxConflictResolutionAttempts+1))

	t.Log("Clear conflict view")
	err = kbfsOps.ClearConflictView(ctx, tlfID)
	require.NoError(t, err)

	t.Log("Ensure conflict files are gone")
	children, err = kbfsOps.GetDirChildren(ctx, rootNode)
	require.NoError(t, err)
	require.Len(t, children, 1)
}

// Tests that if clearing a CR conflict can fast-forward if needed.
func TestBasicCRFailureClearAndFastForward(t *testing.T) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_for_fail_fix")
	defer os.RemoveAll(tempdir)

	// simulate two users
	var userName1, userName2 kbname.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(ctx, t, config1, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	// Enable journaling on user 2
	require.NoError(t, err)
	err = config2.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config2.EnableJournaling(ctx, tempdir,
		TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jManager, err := GetJournalManager(config2)
	require.NoError(t, err)
	err = jManager.EnableAuto(ctx)
	require.NoError(t, err)

	name := userName1.String() + "," + userName2.String()

	t.Log("User 1 creates a file a/b.")
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, testPPS("a"))
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(
		ctx, dirA1, testPPS("b"), false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	t.Log("User 2 looks up the file node.")
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)
	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, testPPS("a"))
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, testPPS("b"))
	require.NoError(t, err)

	t.Log("Force a conflict")
	tlfID := rootNode2.GetFolderBranch().Tlf
	err = kbfsOps2.ForceStuckConflictForTesting(ctx, tlfID)
	require.NoError(t, err)

	t.Log("User 1 updates mod time on a/b.")

	mtime := time.Now()
	for i := 0; i < fastForwardRevThresh+2; i++ {
		mtime = mtime.Add(1 * time.Minute)
		err = kbfsOps1.SetMtime(ctx, fileB1, &mtime)
		require.NoError(t, err)
		err = kbfsOps1.SyncAll(ctx, fileB1.GetFolderBranch())
		require.NoError(t, err)
	}

	t.Log("Ensure only conflict files are in the conflict view")
	children, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Len(t, children, 1+(maxConflictResolutionAttempts+1))

	// Expect updates for each of the unmerged revisions, plus exactly
	// one for the fast forward (but not more).  However, if the
	// conflict file nodes haven't been garbage collected yet, we
	// might get 3x that (one batch for each sync op, one for each
	// remove op, and one for each resolution op), so allow some
	// wiggle room.  This still isn't big enough to hold all of the
	// changes we'd get in a non-fast-forward though.
	numUpdatesExpected := 3*(maxConflictResolutionAttempts+1) + 1
	c := make(chan struct{}, numUpdatesExpected)
	cro := &testCRObserver{c, nil}
	err = config2.Notifier().RegisterForChanges(
		[]data.FolderBranch{rootNode2.GetFolderBranch()}, cro)
	require.NoError(t, err)

	t.Log("Clear the conflict state and re-enable CR.")
	err = kbfsOps2.ClearConflictView(ctx, tlfID)
	require.NoError(t, err)

	t.Log("Ensure conflict files are gone")
	children, err = kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Len(t, children, 1)

	ei, err := kbfsOps2.Stat(ctx, fileB2)
	require.NoError(t, err)
	require.Equal(t, mtime.UnixNano(), ei.Mtime)

	err = kbfsOps2.SyncFromServer(ctx, rootNode2.GetFolderBranch(), nil)
	require.NoError(t, err)
}
