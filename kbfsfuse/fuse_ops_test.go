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

func checkNodesNeedUpdate(t *testing.T, nodes []*FuseNode, update []bool) {
	for i, n := range nodes {
		if n.NeedUpdate != update[i] {
			needs := "needs"
			if update[i] {
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

	checkNodesNeedUpdate(t, []*FuseNode{root, node1, node2},
		[]bool{false, true, false})

	// Look up /test_user again.
	node1 = doLookupOrBust(t, root, "test_user")

	checkNodesNeedUpdate(t, []*FuseNode{root, node1}, []bool{false, false})
	root.Ops.Shutdown()
}

// Test that nodes start off as not needing updating, making a
// directory marks the path from the new directory's parent to the
// user root as needing updating, and not just the parent.
func testNeedUpdateAll(t *testing.T, root *FuseNode) {
	// Make dir1/dir2/dir3 and clear their NeedUpdate
	// flags.
	node1 := doMkDirOrBust(t, root, "dir1")
	node2 := doMkDirOrBust(t, node1, "dir2")
	node3 := doMkDirOrBust(t, node2, "dir3")

	node1 = doLookupOrBust(t, root, "dir1")
	node2 = doLookupOrBust(t, node1, "dir2")
	node3 = doLookupOrBust(t, node2, "dir3")

	// Make /test_user/dir1/dir2/dir3/dir4.
	node4 := doMkDirOrBust(t, node3, "dir4")
	root.Ops.Shutdown()

	checkNodesNeedUpdate(t,
		[]*FuseNode{node1, node2, node3, node4},
		[]bool{false, false, true, false})
}

func TestNeedUpdateAllPrivate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	userRoot := doLookupOrBust(t, root, "test_user")
	testNeedUpdateAll(t, userRoot)
}

func TestNeedUpdateAllPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, *BServerRemote, "test_user")

	root := NewFuseRoot(context.Background(), config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	userRoot := doLookupOrBust(t, root, "test_user")
	publicRoot := doLookupOrBust(t, userRoot, "public")
	testNeedUpdateAll(t, publicRoot)
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

	checkNodesNeedUpdate(t, []*FuseNode{root, node1, node2, node3},
		[]bool{false, true, true, true})
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
