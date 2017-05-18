// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"os"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func readAndCompareData(t *testing.T, config Config, ctx context.Context,
	name string, expectedData []byte, user libkb.NormalizedUsername) {
	rootNode := GetRootNodeOrBust(ctx, t, config, name, tlf.Private)

	kbfsOps := config.KBFSOps()
	fileNode, _, err := kbfsOps.Lookup(ctx, rootNode, "a")
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
	changes []NodeChange) {
	t.changes = append(t.changes, changes...)
	t.c <- struct{}{}
}

func (t *testCRObserver) TlfHandleChange(ctx context.Context,
	newHandle *TlfHandle) {
	return
}

func checkStatus(t *testing.T, ctx context.Context, kbfsOps KBFSOps,
	staged bool, headWriter libkb.NormalizedUsername, dirtyPaths []string, fb FolderBranch,
	prefix string) {
	status, _, err := kbfsOps.FolderStatus(ctx, fb)
	require.NoError(t, err)
	assert.Equal(t, status.Staged, staged)
	assert.Equal(t, status.HeadWriter, headWriter)
	checkStringSlices(t, dirtyPaths, status.DirtyPaths)
}

func TestBasicMDUpdate(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

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
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	entries, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Equal(t, 1, len(entries))
	_, ok := entries["a"]
	require.True(t, ok)

	// The status should have fired as well (though in this case the
	// writer is the same as before)
	<-statusChan
	checkStatus(t, ctx, kbfsOps1, false, userName1, nil,
		rootNode1.GetFolderBranch(), "Node 1")
	checkStatus(t, ctx, kbfsOps2, false, userName1, nil,
		rootNode2.GetFolderBranch(), "Node 2")
}

func testMultipleMDUpdates(t *testing.T, unembedChanges bool) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	if unembedChanges {
		bss1, ok1 := config1.BlockSplitter().(*BlockSplitterSimple)
		require.True(t, ok1)
		bss2, ok2 := config2.BlockSplitter().(*BlockSplitterSimple)
		require.True(t, ok2)
		bss1.blockChangeEmbedMaxSize = 3
		bss2.blockChangeEmbedMaxSize = 3
	}

	name := userName1.String() + "," + userName2.String()

	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	// user 1 creates a file
	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// user 2 looks up the directory (and sees the file)
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	// now user 1 renames the old file, and creates a new one
	err = kbfsOps1.Rename(ctx, rootNode1, "a", rootNode1, "b")
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "c", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	kbfsOps2 := config2.KBFSOps()
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	entries, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)
	require.Equal(t, 2, len(entries))
	_, ok := entries["b"]
	require.True(t, ok)
	_, ok = entries["c"]
	require.True(t, ok)
}

func TestMultipleMDUpdates(t *testing.T) {
	testMultipleMDUpdates(t, false)
}

func TestMultipleMDUpdatesUnembedChanges(t *testing.T) {
	testMultipleMDUpdates(t, true)
}

func TestGetTLFCryptKeysWhileUnmergedAfterRestart(t *testing.T) {
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	// enable journaling to see patrick's error
	tempdir, err := ioutil.TempDir(os.TempDir(), "journal_for_gettlfcryptkeys")
	require.NoError(t, err)
	defer func() {
		err := ioutil.RemoveAll(tempdir)
		assert.NoError(t, err)
	}()
	_, err = config1.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	err = config1.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jServer, err := GetJournalServer(config1)
	require.NoError(t, err)
	jServer.onBranchChange = nil
	jServer.onMDFlush = nil
	jServer.EnableAuto(ctx)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	fileNode1, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	_, err = DisableUpdatesForTesting(config1, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	DisableCRForTesting(config1, rootNode1.GetFolderBranch())

	// Wait for "a" to flush to the server.
	err = jServer.Wait(ctx, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err)

	// then user2 write to the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	data2 := []byte{2}
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	require.NoError(t, err)
	checkStatus(t, ctx, kbfsOps2, false, userName1, []string{"u1,u2/a"},
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
	err = jServer.Wait(ctx, rootNode1.GetFolderBranch().Tlf)
	require.NoError(t, err)

	// now re-login u1
	config1B := ConfigAsUser(config1, userName1)
	_, err = config1B.EnableDiskLimiter(tempdir)
	require.NoError(t, err)
	defer CheckConfigAndShutdown(ctx, t, config1B)
	err = config1B.EnableJournaling(
		ctx, tempdir, TLFJournalBackgroundWorkEnabled)
	require.NoError(t, err)
	jServer, err = GetJournalServer(config1B)
	require.NoError(t, err)
	jServer.onBranchChange = nil
	jServer.onMDFlush = nil

	DisableCRForTesting(config1B, rootNode1.GetFolderBranch())

	tlfHandle, err := ParseTlfHandle(ctx, config1B.KBPKI(), name, tlf.Private)
	require.NoError(t, err)

	_, _, err = config1B.KBFSOps().GetTLFCryptKeys(ctx, tlfHandle)
	require.NoError(t, err)
}

// Tests that, in the face of a conflict, a user will commit its
// changes to a private branch, which will persist after restart (and
// the other user will be unaffected).
func TestUnmergedAfterRestart(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	fileNode1, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	_, err = DisableUpdatesForTesting(config1, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	DisableCRForTesting(config1, rootNode1.GetFolderBranch())

	// then user2 write to the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	data2 := []byte{2}
	err = kbfsOps2.Write(ctx, fileNode2, data2, 0)
	require.NoError(t, err)
	checkStatus(t, ctx, kbfsOps2, false, userName1, []string{"u1,u2/a"},
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
	checkStatus(t, ctx, kbfsOps1, false, userName1, []string{"u1,u2/a"},
		rootNode1.GetFolderBranch(), "Node 1 (after write)")
	err = kbfsOps1.SyncAll(ctx, fileNode1.GetFolderBranch())
	require.NoError(t, err)

	checkStatus(t, ctx, kbfsOps1, true, userName1, nil,
		rootNode1.GetFolderBranch(), "Node 1")
	checkStatus(t, ctx, kbfsOps2, false, userName2, nil,
		rootNode2.GetFolderBranch(), "Node 2")

	// now re-login the users, and make sure 1 can see the changes,
	// but 2 can't
	config1B := ConfigAsUser(config1, userName1)
	defer CheckConfigAndShutdown(ctx, t, config1B)
	config2B := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2B)

	DisableCRForTesting(config1B, rootNode1.GetFolderBranch())

	// Keep the config1B node in memory, so it doesn't get garbage
	// collected (preventing notifications)
	rootNode1B := GetRootNodeOrBust(ctx, t, config1B, name, tlf.Private)

	kbfsOps1B := config1B.KBFSOps()
	fileNode1B, _, err := kbfsOps1B.Lookup(ctx, rootNode1B, "a")
	require.NoError(t, err)

	readAndCompareData(t, config1B, ctx, name, data1, userName1)
	readAndCompareData(t, config2B, ctx, name, data2, userName2)

	checkStatus(t, ctx, config1B.KBFSOps(), true, userName1, nil,
		fileNode1B.GetFolderBranch(), "Node 1")
	checkStatus(t, ctx, config2B.KBFSOps(), false, userName2, nil,
		rootNode2.GetFolderBranch(), "Node 2")

	// register as a listener before the unstaging happens
	c := make(chan struct{}, 2)
	cro := &testCRObserver{c, nil}
	config1B.Notifier().RegisterForChanges(
		[]FolderBranch{rootNode1B.GetFolderBranch()}, cro)

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

	// we should have had two updates, one for the unstaging and one
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

	err = config1B.KBFSOps().SyncFromServerForTesting(
		ctx, fileNode1B.GetFolderBranch())
	require.NoError(t, err)
	err = config2B.KBFSOps().
		SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	readAndCompareData(t, config1B, ctx, name, data2, userName2)
	readAndCompareData(t, config2B, ctx, name, data2, userName2)
	checkStatus(t, ctx, config1B.KBFSOps(), false, userName1, nil,
		rootNode1.GetFolderBranch(), "Node 1 (after unstage)")
	checkStatus(t, ctx, config2B.KBFSOps(), false, userName1, nil,
		rootNode2.GetFolderBranch(), "Node 2 (after unstage)")
}

// Tests that multiple users can write to the same file sequentially
// without any problems.
func TestMultiUserWrite(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// then user2 write to the file
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	fileNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
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
	readAndCompareData(t, config2, ctx, name, data2, userName2)

	// A second write by the same user
	data3 := []byte{3}
	err = kbfsOps2.Write(ctx, fileNode2, data3, 0)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, fileNode2.GetFolderBranch())
	require.NoError(t, err)

	readAndCompareData(t, config2, ctx, name, data3, userName2)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	readAndCompareData(t, config1, ctx, name, data3, userName2)
}

func testBasicCRNoConflict(t *testing.T, unembedChanges bool) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	if unembedChanges {
		bss1, ok1 := config1.BlockSplitter().(*BlockSplitterSimple)
		require.True(t, ok1)
		bss2, ok2 := config2.BlockSplitter().(*BlockSplitterSimple)
		require.True(t, ok2)
		// 128 seems to be a good size that works on both 386 and x64
		// platforms.
		bss1.blockChangeEmbedMaxSize = 128
		bss2.blockChangeEmbedMaxSize = 128
	}

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	_, _, err := kbfsOps1.CreateFile(ctx, rootNode1, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)

	// disable updates on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 makes a new file
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a new different file
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "c", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// re-enable updates, and wait for CR to complete
	c <- struct{}{}
	err = RestartCRForTesting(
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// Make sure they both see the same set of children
	expectedChildren := []string{"a", "b", "c"}
	children1, err := kbfsOps1.GetDirChildren(ctx, rootNode1)
	require.NoError(t, err)

	children2, err := kbfsOps2.GetDirChildren(ctx, rootNode2)
	require.NoError(t, err)

	assert.Equal(t, len(expectedChildren), len(children1))

	for _, child := range expectedChildren {
		_, ok := children1[child]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)

	if unembedChanges {
		// Make sure the MD has an unembedded change block.
		md, err := config1.MDOps().GetForTLF(ctx,
			rootNode1.GetFolderBranch().Tlf)
		require.NoError(t, err)
		require.NotEqual(t, zeroPtr, md.data.cachedChanges.Info.BlockPointer)
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
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	mdServ, chForMdServer2 := newMDServerLocalRecordingRegisterForUpdate(
		config2.MDServer().(mdServerLocal))
	config2.SetMDServer(mdServ)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(ctx, dirA1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, "b")
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
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	clock, now := newTestClockAndTimeNow()
	config2.SetClock(clock)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(ctx, dirA1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, "b")
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
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
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
		_, ok := children1[child]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
}

// Tests that two users can create the same file simultaneously, and
// the unmerged user can write to it, and they will be merged into a
// single file.
func TestBasicCRFileCreateUnmergedWriteConflict(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	config2.SetClock(newTestClockNow())

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 creates a file
	_, _, err = kbfsOps1.CreateFile(ctx, dirA1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// User 2 creates the same file, and writes to it.
	fileB2, _, err := kbfsOps2.CreateFile(ctx, dirA2, "b", false, NoExcl)
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
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
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
		_, ok := children1[child]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
}

// Test that two conflict resolutions work correctly.
func TestCRDouble(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config2.SetClock(newTestClockNow())
	name := userName1.String() + "," + userName2.String()

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 creates a new file to start a conflict.
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a couple revisions
	fileNodeC, _, err := kbfsOps2.CreateFile(ctx, rootNode2, "c", false, NoExcl)
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
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// A few merged revisions
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "e", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "f", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	ops := getOps(config2, rootNode.GetFolderBranch().Tlf)
	// Wait for the processor to try to delete the failed revision
	// (which pulls the unmerged MD ops back into the cache).
	ops.fbm.waitForArchives(ctx)
	ops.fbm.waitForDeletingBlocks(ctx)

	// Sync user 1, then start another round of CR.
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err = DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, "g", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// User 2 makes a couple unmerged revisions
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "h", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "i", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Do a second CR.
	c <- struct{}{}
	err = RestartCRForTesting(
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
}

// Tests that two users can make independent writes while forked, and
// conflict resolution will merge them correctly and the rekey bit is
// preserved until rekey.
func TestBasicCRFileConflictWithRekey(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	clock, now := newTestClockAndTimeNow()
	config2.SetClock(clock)
	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(ctx, dirA1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	fileB2, _, err := kbfsOps2.Lookup(ctx, dirA2, "b")
	require.NoError(t, err)

	config2Dev2 := ConfigAsUser(config1, userName2)
	// we don't check the config because this device can't read all of the md blocks.
	defer config2Dev2.Shutdown(ctx)
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
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
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
	_, err = RequestRekeyAndWaitForOneFinishEvent(ctx,
		kbfsOps2Dev2, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err)

	// User 1 syncs
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
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
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	// wait for the rekey to happen
	RequestRekeyAndWaitForOneFinishEvent(ctx,
		config2.KBFSOps(), rootNode2.GetFolderBranch().Tlf)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// Look it up on user 2 dev 2 after syncing.
	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	rootNode2Dev2 := GetRootNodeOrBust(ctx, t, config2Dev2, name, tlf.Private)
	dirA2Dev2, _, err := kbfsOps2Dev2.Lookup(ctx, rootNode2Dev2, "a")
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
		_, ok := children1[child]
		assert.True(t, ok)
	}

	require.Equal(t, children1, children2)
	require.Equal(t, children2, children2Dev2)
}

// Same as above, except the "winner" is the rekey request, and the
// "loser" is the file write.  Regression test for KBFS-773.
func TestBasicCRFileConflictWithMergedRekey(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	session2, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config2.SetClock(newTestClockNow())
	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	fileB1, _, err := kbfsOps1.CreateFile(ctx, dirA1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)

	config2Dev2 := ConfigAsUser(config1, userName2)
	// we don't check the config because this device can't read all of the md blocks.
	defer config2Dev2.Shutdown(ctx)
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
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// disable updates on user1
	c, err := DisableUpdatesForTesting(config1, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config1, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 2 dev 2 should set the rekey bit
	kbfsOps2Dev2 := config2Dev2.KBFSOps()
	_, err = RequestRekeyAndWaitForOneFinishEvent(ctx,
		kbfsOps2Dev2, rootNode2.GetFolderBranch().Tlf)
	require.NoError(t, err)

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
		BackgroundContextWithCancellationDelayer(), config1,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)
	require.NoError(t, err)
	// wait for the rekey to happen
	RequestRekeyAndWaitForOneFinishEvent(ctx,
		config1.KBFSOps(), rootNode1.GetFolderBranch().Tlf)

	err = kbfsOps1.SyncFromServerForTesting(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// Look it up on user 2 dev 2 after syncing.
	err = kbfsOps2Dev2.SyncFromServerForTesting(ctx,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	rootNode2Dev2 := GetRootNodeOrBust(ctx, t, config2Dev2, name, tlf.Private)
	dirA2Dev2, _, err := kbfsOps2Dev2.Lookup(ctx, rootNode2Dev2, "a")
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
		_, ok := children1[child]
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
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	config2.SetClock(newTestClockNow())
	name := userName1.String() + "," + userName2.String()

	// Make the blocks small, with multiple levels of indirection, but
	// make the unembedded size large, so we don't create thousands of
	// unembedded block change blocks.
	blockSize := int64(5)
	bsplit := &BlockSplitterSimple{blockSize, 2, 100 * 1024}
	config1.SetBlockSplitter(bsplit)

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, "a", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	// disable updates and CR on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// User 1 creates a new file to start a conflict.
	_, _, err = kbfsOps1.CreateFile(ctx, rootNode, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode.GetFolderBranch())
	require.NoError(t, err)

	// User 2 does one successful operation to create the first unmerged MD.
	fileNodeB, _, err := kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
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
		BackgroundContextWithCancellationDelayer())
	defer CleanupCancellationDelayer(syncCtx)

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
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
}

// Test that a resolution can be canceled right before the Put due to
// another operation, and then the second resolution includes both
// unmerged operations.  Regression test for KBFS-1133.
func TestCRCanceledAfterNewOperation(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
	config1.MDServer().DisableRekeyUpdatesForTesting()

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)
	_, err := config2.KBPKI().GetCurrentSession(context.Background())
	require.NoError(t, err)
	config2.MDServer().DisableRekeyUpdatesForTesting()

	clock, now := newTestClockAndTimeNow()
	config2.SetClock(clock)
	name := userName1.String() + "," + userName2.String()

	// create and write to a file
	rootNode := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)
	kbfsOps1 := config1.KBFSOps()
	aNode1, _, err := kbfsOps1.CreateFile(ctx, rootNode, "a", false, NoExcl)
	require.NoError(t, err)
	data := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, aNode1, data, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	aNode2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
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
		err = kbfsOps2.SyncFromServerForTesting(putCtx,
			rootNode2.GetFolderBranch())
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
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	c <- struct{}{}
	err = RestartCRForTesting(
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
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
		_, ok := children2[child]
		assert.True(t, ok)
	}
}

// Tests that if a user gets /too/ unmerged, they will have their
// unmerged writes blocked.
func TestBasicCRBlockUnmergedWrites(t *testing.T) {
	// simulate two users
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)

	config2 := ConfigAsUser(config1, userName2)
	defer CheckConfigAndShutdown(ctx, t, config2)

	name := userName1.String() + "," + userName2.String()

	// user1 creates a file in a shared dir
	rootNode1 := GetRootNodeOrBust(ctx, t, config1, name, tlf.Private)

	kbfsOps1 := config1.KBFSOps()
	dirA1, _, err := kbfsOps1.CreateDir(ctx, rootNode1, "a")
	require.NoError(t, err)
	_, _, err = kbfsOps1.CreateFile(ctx, dirA1, "b", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, rootNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	ops2 := getOps(config2, rootNode2.GetFolderBranch().Tlf)
	ops2.cr.maxRevsThreshold = 2
	dirA2, _, err := kbfsOps2.Lookup(ctx, rootNode2, "a")
	require.NoError(t, err)
	_, _, err = kbfsOps2.Lookup(ctx, dirA2, "b")
	require.NoError(t, err)

	// disable updates on user 2
	c, err := DisableUpdatesForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err)

	// One write for user 1
	_, _, err = kbfsOps1.CreateFile(ctx, dirA1, "c", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, dirA1.GetFolderBranch())
	require.NoError(t, err)

	// Two writes for user 2
	_, _, err = kbfsOps2.CreateFile(ctx, dirA2, "d", false, NoExcl)
	require.NoError(t, err)
	err = kbfsOps2.SyncAll(ctx, rootNode2.GetFolderBranch())
	require.NoError(t, err)
	_, _, err = kbfsOps2.CreateFile(ctx, dirA2, "e", false, NoExcl)
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
		err = kbfsOps2.SyncFromServerForTesting(firstPutCtx,
			rootNode2.GetFolderBranch())
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
	_, _, err = kbfsOps2.CreateFile(ctx, dirA2, "f", false, NoExcl)
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
		_, _, err := kbfsOps2.CreateFile(ctx, dirA2, "g", false, NoExcl)
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
	var userName1, userName2 libkb.NormalizedUsername = "u1", "u2"
	config1, _, ctx, cancel := kbfsOpsConcurInit(t, userName1, userName2)
	defer kbfsConcurTestShutdown(t, config1, ctx, cancel)
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
	aNode1, _, err := kbfsOps1.CreateFile(ctx, rootNode, "a", false, NoExcl)
	require.NoError(t, err)
	data := []byte{1, 2, 3, 4, 5}
	err = kbfsOps1.Write(ctx, aNode1, data, 0)
	require.NoError(t, err)
	err = kbfsOps1.SyncAll(ctx, aNode1.GetFolderBranch())
	require.NoError(t, err)

	// look it up on user2
	rootNode2 := GetRootNodeOrBust(ctx, t, config2, name, tlf.Private)

	kbfsOps2 := config2.KBFSOps()
	_, _, err = kbfsOps2.Lookup(ctx, rootNode2, "a")
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
	_, _, err = kbfsOps2.CreateFile(ctx, rootNode2, "b", false, NoExcl)
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
		_, _, err = kbfsOps2.CreateFile(putCtx, rootNode2, "c", false, NoExcl)
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
		BackgroundContextWithCancellationDelayer(), config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err)
	err = kbfsOps2.SyncFromServerForTesting(ctx, rootNode2.GetFolderBranch())
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
		_, ok := children2[child]
		assert.True(t, ok)
	}
}
