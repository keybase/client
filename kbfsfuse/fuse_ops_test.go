package main

import (
	"testing"
	"time"

	"github.com/hanwen/go-fuse/fuse"
	"github.com/hanwen/go-fuse/fuse/nodefs"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func doLookupOrBust(t *testing.T, parent *FuseNode, name string) *FuseNode {
	var attr fuse.Attr
	inode, code := parent.Lookup(&attr, name, nil)
	if code != fuse.OK {
		t.Fatalf("Lookup failure: %s", code)
	}
	return inode.Node().(*FuseNode)
}

func doMkDirOrBust(t *testing.T, parent *FuseNode, name string) *FuseNode {
	inode, code := parent.Mkdir(name, 0, nil)
	if code != fuse.OK {
		t.Fatalf("Mkdir failure: %s", code)
	}
	return inode.Node().(*FuseNode)
}

func doMknodOrBust(t *testing.T, parent *FuseNode, name string) *FuseNode {
	inode, code := parent.Mknod(name, 0, 0, nil)
	if code != fuse.OK {
		t.Fatalf("Mknod failure: %s", code)
	}
	return inode.Node().(*FuseNode)
}

func waitForUpdates(node *FuseNode) {
	c := make(chan struct{})
	node.getChan().QueueWriteReq(func() { c <- struct{}{} })
	<-c
}

// Test that looking up one's own public directory works.
func TestLookupSelfPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	doLookupOrBust(t, node1, "public")
	root.Ops.Shutdown()
}

// Test that looking up someone else's public directory works.
func TestLookupOtherPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user1", "test_user2")

	// First, look up the test_user1/public as test_user1 to
	// create it.

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user1")
	doLookupOrBust(t, node1, "public")

	// Now, simulate a remount as test_user2.

	config.KBPKI().(*libkbfs.KBPKILocal).LoggedIn = keybase1.MakeTestUID(2)
	config.SetMDCache(libkbfs.NewMDCacheStandard(5000))
	root = NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	// Then, do the lookup again as test_user2.

	node1 = doLookupOrBust(t, root, "test_user1")
	doLookupOrBust(t, node1, "public")
	root.Ops.Shutdown()
}

// Test that looking up someone else's private file doesn't work.
func TestLookupOtherPrivateFile(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user1", "test_user2")

	// First, look up the test_user1/public as test_user1 to
	// create it.

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user1")
	doMknodOrBust(t, node1, "privfile")

	// Now, simulate a remount as test_user2.

	config.KBPKI().(*libkbfs.KBPKILocal).LoggedIn = keybase1.MakeTestUID(2)
	config.SetMDCache(libkbfs.NewMDCacheStandard(5000))
	root = NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	// Then, do the lookup again as test_user2.

	node1 = doLookupOrBust(t, root, "test_user1")
	var attr fuse.Attr
	_, code := node1.Lookup(&attr, "privfile", nil)
	if code != fuse.EACCES {
		t.Fatalf("Private lookup didn't return permission denied: %s", code)
	}
	root.Ops.Shutdown()
}

func checkPathNeedsUpdate(t *testing.T, nodes []*FuseNode, update bool) {
	// The first one (root) should never need an update
	if len(nodes) > 0 && nodes[0].NeedUpdate {
		t.Error("/ unexpectedly needs update")
	}

	for i, n := range nodes[1:] {
		if n.NeedUpdate != update {
			needs := "needs"
			if update {
				needs = "does not need"
			}
			t.Errorf("Node %d unexpectedly %s update", i, needs)
		}
	}
}

// Test that nodes start off as not needing updating, making a
// directory marks the path from the new directory's parent to the
// user root (in this case just one directory) as needing updating,
// and looking up a directory that needs updating marks it as not
// needing updating.
func TestNeedUpdateBasic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	if root.NeedUpdate {
		t.Error("/ unexpectedly needs update")
	}

	// Look up /test_user.
	node1 := doLookupOrBust(t, root, "test_user")

	if root.NeedUpdate {
		t.Error("/ unexpectedly needs update")
	}

	// Make /test_user/dir.
	node2 := doMkDirOrBust(t, node1, "dir")
	waitForUpdates(node1)

	checkPathNeedsUpdate(t, []*FuseNode{root, node1, node2}, true)

	// Look up /test_user again.
	node1 = doLookupOrBust(t, root, "test_user")

	checkPathNeedsUpdate(t, []*FuseNode{root, node1}, false)
	root.Ops.Shutdown()
}

// Test that nodes start off as not needing updating, making a
// directory marks the path from the new directory's parent to the
// user root as needing updating, and not just the parent.
func TestNeedUpdateAll(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	// Make /test_user/dir1/dir2/dir3 and clear their NeedUpdate
	// flags.

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")
	node3 := doMkDirOrBust(t, node2, "dir2")
	node4 := doMkDirOrBust(t, node3, "dir3")

	node1 = doLookupOrBust(t, root, "test_user")
	node2 = doLookupOrBust(t, node1, "dir1")
	node3 = doLookupOrBust(t, node2, "dir2")
	node4 = doLookupOrBust(t, node3, "dir3")

	// Make /test_user/dir1/dir2/dir3/dir4.
	node5 := doMkDirOrBust(t, node4, "dir4")
	root.Ops.Shutdown()

	checkPathNeedsUpdate(t,
		[]*FuseNode{root, node1, node2, node3, node4, node5}, true)
}

// Test that writing a file causes its whole path to need an update
func TestLocalUpdateAll(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	// Make /test_user/dir1/dir2/dir3 and clear their NeedUpdate
	// flags.
	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")
	node3 := doMknodOrBust(t, node2, "file1")

	// write to the file
	node3.Write(nil, []byte{0, 1, 2}, 0, nil)
	root.Ops.Shutdown()

	checkPathNeedsUpdate(t, []*FuseNode{root, node1, node2, node3}, true)
}

// Test that a local notification for a path, for which we only have
// nodes for some prefix of the path, works correctly.
func TestPartialLocalUpdate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")
	// lookup node2 again to ensure that BatchChanges has taken effect
	node2 = doLookupOrBust(t, node1, "dir1")

	// Somewhere else, someone writes test_user/dir1/dir2/dir3
	newPath := libkbfs.Path{
		TopDir: node1.getTopDir(),
		// Only the Name fields are used.
		Path: []libkbfs.PathNode{
			libkbfs.PathNode{Name: ""},
			libkbfs.PathNode{Name: "dir1"},
			libkbfs.PathNode{Name: "dir2"},
			libkbfs.PathNode{Name: "dir3"},
		},
	}
	root.Ops.LocalChange(root.Ops.ctx, newPath)
	root.Ops.Shutdown()

	nodes := []*FuseNode{root, node1, node2}
	checkPathNeedsUpdate(t, nodes, true)
}

// Test that a batch notification for a path, for which we only have
// nodes for some prefix of the path, works correctly.
func TestPartialBatchUpdate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")

	// Somewhere else, someone creates test_user/dir1/dir2/dir3
	newPath := libkbfs.Path{
		TopDir: node1.getTopDir(),
		// Only the Name fields are used.
		Path: []libkbfs.PathNode{
			libkbfs.PathNode{Name: ""},
			libkbfs.PathNode{Name: "dir1"},
			libkbfs.PathNode{Name: "dir2"},
			libkbfs.PathNode{Name: "dir3"},
		}}
	root.Ops.BatchChanges(root.Ops.ctx, node1.getTopDir(),
		[]libkbfs.Path{newPath})
	root.Ops.Shutdown()

	nodes := []*FuseNode{root, node1, node2}
	checkPathNeedsUpdate(t, nodes, true)
}

func testCompleteBatchUpdate(t *testing.T, root *FuseNode, folderName string) {
	node1 := doLookupOrBust(t, root, folderName)
	node2 := doMknodOrBust(t, node1, "file1")
	node2.Flush() // noop to force wait on update

	// Construct an updated path using the current node IDs
	newPath := libkbfs.Path{
		TopDir: node1.getTopDir(),
		Path: []libkbfs.PathNode{
			libkbfs.PathNode{Name: ""},
			libkbfs.PathNode{Name: "file1"},
		},
	}

	// now write/flush to change IDs
	node2.Write(nil, []byte{0, 1, 2}, 0, nil)
	node2.Flush()

	// finally, update again using the old path, to verify that the
	// IDs change back correctly.
	root.Ops.BatchChanges(root.Ops.ctx, node1.getTopDir(),
		[]libkbfs.Path{newPath})
	root.Ops.Shutdown()

	nodes := []*FuseNode{root, node1, node2}
	checkPathNeedsUpdate(t, nodes, true)
}

// Test that a full path batch update, on an existing file in a
// private directory, sets NeedsUpdate correctly on all nodes of the
// path.
func TestCompleteBatchUpdatePrivate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)
	testCompleteBatchUpdate(t, root, "test_user")
}

// Test that a full path batch update, on an existing file in a public
// directory, sets NeedsUpdate correctly on all nodes of the path.
func TestCompleteBatchUpdatePublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	userRoot := doLookupOrBust(t, root, "test_user")
	testCompleteBatchUpdate(t, userRoot, "public")
}

// Test that setting the mtime works
func TestSetMtime(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMknodOrBust(t, node1, "file1")

	var attr fuse.Attr
	_, code := node1.Lookup(&attr, "file1", nil)
	if code != fuse.OK {
		t.Fatalf("Initial lookup failure: %s", code)
	}

	loc, _ := time.LoadLocation("Local")
	newMtime := time.Date(1980, time.April, 4, 10, 52, 00, 00, loc)
	code = node2.Utimens(nil, nil, &newMtime, nil)
	if code != fuse.OK {
		t.Fatalf("Utimens failure: %s", code)
	}

	// Do another lookup and make sure we get this same time
	_, code = node1.Lookup(&attr, "file1", nil)
	if code != fuse.OK {
		t.Fatalf("Initial lookup failure: %s", code)
	}

	if attr.ModTime().UnixNano() != newMtime.UnixNano() {
		t.Errorf("Wrong mtime; expected %s, got %s", newMtime, attr.ModTime())
	}

	root.Ops.Shutdown()
}
