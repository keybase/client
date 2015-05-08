package main

import (
	"github.com/hanwen/go-fuse/fuse"
	"github.com/hanwen/go-fuse/fuse/nodefs"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libkbfs"
	"strings"
	"testing"
)

// Given the list of users, create and return a config suitable for
// unit-testing.
func makeTestConfig(users []string) *libkbfs.ConfigLocal {
	config := libkbfs.NewConfigLocal()

	localUsers := make([]libkbfs.LocalUser, len(users))
	for i := 0; i < len(users); i++ {
		kid := libkbfs.KID("test_sub_key_" + users[i])
		localUsers[i] = libkbfs.LocalUser{
			Name:            users[i],
			Uid:             libkb.UID{byte(i + 1)},
			SubKeys:         []libkbfs.Key{libkbfs.NewKeyFake(kid)},
			DeviceSubkeyKid: kid,
		}
	}
	loggedInUid := localUsers[0].Uid

	// TODO: Consider using fake BlockOps and MDOps instead.
	k := libkbfs.NewKBPKILocal(loggedInUid, localUsers)
	config.SetKBPKI(k)
	config.SetBlockServer(libkbfs.NewFakeBlockServer())
	config.SetMDServer(libkbfs.NewFakeMDServer(config))

	return config
}

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
		t.Fatalf("Mknode failure: %s", code)
	}
	return inode.Node().(*FuseNode)
}

func waitForUpdates(node *FuseNode) {
	c := make(chan struct{})
	node.GetChan().QueueWriteReq(func() { c <- struct{}{} })
	<-c
}

// Test that looking up one's own public directory works.
func TestLookupSelfPublic(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	doLookupOrBust(t, node1, "public")
	root.Ops.Shutdown()
}

// Test that looking up someone else's public directory works.
func TestLookupOtherPublic(t *testing.T) {
	config := makeTestConfig([]string{"test_user1", "test_user2"})

	// First, look up the test_user1/public as test_user1 to
	// create it.

	root := NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user1")
	doLookupOrBust(t, node1, "public")

	// Now, simulate a remount as test_user2.

	config.KBPKI().(*libkbfs.KBPKILocal).LoggedIn = libkb.UID{2}
	config.SetMDCache(libkbfs.NewMDCacheStandard(5000))
	root = NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	// Then, do the lookup again as test_user2.

	node1 = doLookupOrBust(t, root, "test_user1")
	doLookupOrBust(t, node1, "public")
	root.Ops.Shutdown()
}

func checkPathNeedsUpdate(
	t *testing.T, nodes []*FuseNode, update bool, expectedPath string) {
	path := make([]string, 0, len(nodes))

	// The first one (root) should never need an update
	if len(nodes) > 0 && nodes[0].NeedUpdate {
		t.Error("/ unexpectedly needs update")
	}

	for _, n := range nodes[1:] {
		path = append(path, n.PathNode.Name)
		if n.NeedUpdate != update {
			p := n.GetPath(1)
			needs := "needs"
			if update {
				needs = "does not need"
			}
			t.Errorf("%s unexpectedly %s update", p.String(), needs)
		}
	}

	newPath := strings.Join(path, "/")
	if newPath != expectedPath {
		t.Errorf("Expected path %s does not match new path %s",
			expectedPath, newPath)
	}
}

func checkPathBlockPointers(
	t *testing.T, nodes []*FuseNode, newPath libkbfs.Path) {
	// check that the block pointers match all along the path (but
	// skip the first one, because the path doesn't include the root)
	for i, n := range nodes[1:] {
		pn := newPath.Path[i]
		if n.PathNode.BlockPointer != pn.BlockPointer {
			t.Errorf("Unexpected block pointer on node %d: "+
				"expected %v, got %v\n", i, pn.BlockPointer,
				n.PathNode.BlockPointer)
		}
	}
}

// Test that nodes start off as not needing updating, making a
// directory marks the path from the new directory's parent to the
// user root (in this case just one directory) as needing updating,
// and looking up a directory that needs updating marks it as not
// needing updating.
func TestNeedUpdateBasic(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
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

	checkPathNeedsUpdate(t, []*FuseNode{root, node1}, true, "test_user")
	if node2.NeedUpdate {
		t.Error("/test_user/dir unexpectedly needs update")
	}

	// Look up /test_user again.
	node1 = doLookupOrBust(t, root, "test_user")

	checkPathNeedsUpdate(t, []*FuseNode{root, node1}, false, "test_user")
	root.Ops.Shutdown()
}

// Test that nodes start off as not needing updating, making a
// directory marks the path from the new directory's parent to the
// user root as needing updating, and not just the parent.
func TestNeedUpdateAll(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
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
		[]*FuseNode{root, node1, node2, node3, node4}, true,
		"test_user/dir1/dir2/dir3")

	if node5.NeedUpdate {
		t.Error("/test_user/dir4 unexpectedly needs update")
	}
}

// Test that writing a file causes its whole path to need an update
func TestLocalUpdateAll(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	// Make /test_user/dir1/dir2/dir3 and clear their NeedUpdate
	// flags.
	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")
	node3 := doMknodOrBust(t, node2, "file1")

	// write to the file
	node3.Write(nil, []byte{0, 1, 2}, 0, nil)
	root.Ops.Shutdown()

	checkPathNeedsUpdate(t, []*FuseNode{root, node1, node2, node3}, true,
		"test_user/dir1/file1")
}

// Test that a local notification for a path, for which we only have
// nodes for some prefix of the path, works correctly.
func TestPartialLocalUpdate(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")

	// Somewhere else, someone writes test_user/dir1/dir2/dir3
	newPath := libkbfs.Path{node1.Dir, []libkbfs.PathNode{
		node1.PathNode,
		node2.PathNode,
		libkbfs.PathNode{libkbfs.BlockPointer{
			libkbfs.BlockId{104}, 0, 0, libkb.UID{0}, 0}, "dir2"},
		libkbfs.PathNode{libkbfs.BlockPointer{
			libkbfs.BlockId{105}, 0, 0, libkb.UID{0}, 0}, "dir3"},
	}}
	root.Ops.LocalChange(newPath)
	root.Ops.Shutdown()

	nodes := []*FuseNode{root, node1, node2}
	checkPathNeedsUpdate(t, nodes, true, "test_user/dir1")
	checkPathBlockPointers(t, nodes, newPath)
}

// Test that a batch notification for a path, for which we only have
// nodes for some prefix of the path, works correctly.
func TestPartialBatchUpdate(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMkDirOrBust(t, node1, "dir1")

	// Somewhere else, someone creates test_user/dir1/dir2/dir3
	newPath := libkbfs.Path{node1.Dir, []libkbfs.PathNode{
		node1.PathNode,
		node2.PathNode,
		libkbfs.PathNode{libkbfs.BlockPointer{
			libkbfs.BlockId{104}, 0, 0, libkb.UID{0}, 0}, "dir2"},
		libkbfs.PathNode{libkbfs.BlockPointer{
			libkbfs.BlockId{105}, 0, 0, libkb.UID{0}, 0}, "dir3"},
	}}
	root.Ops.BatchChanges(node1.Dir, []libkbfs.Path{newPath})
	root.Ops.Shutdown()

	nodes := []*FuseNode{root, node1, node2}
	checkPathNeedsUpdate(t, nodes, true, "test_user/dir1")
	checkPathBlockPointers(t, nodes, newPath)
}

// Test that a full path batch update, on an existing file, sets
// NeedsUpdate and the BlockPointer correctly on all nodes of the path.
func TestCompleteBatchUpdate(t *testing.T) {
	config := makeTestConfig([]string{"test_user"})

	root := NewFuseRoot(config)
	_ = nodefs.NewFileSystemConnector(root, nil)

	node1 := doLookupOrBust(t, root, "test_user")
	node2 := doMknodOrBust(t, node1, "file1")
	node2.Flush() // noop to force wait on update

	// Construct an updated path using the current node IDs
	newPath := libkbfs.Path{node1.Dir, []libkbfs.PathNode{
		node1.PathNode,
		node2.PathNode,
	}}

	// now write/flush to change IDs
	node2.Write(nil, []byte{0, 1, 2}, 0, nil)
	node2.Flush()

	// finally, update again using the old path, to verify that the
	// IDs change back correctly.
	root.Ops.BatchChanges(node1.Dir, []libkbfs.Path{newPath})
	root.Ops.Shutdown()

	nodes := []*FuseNode{root, node1, node2}
	checkPathNeedsUpdate(t, nodes, true, "test_user/file1")
	checkPathBlockPointers(t, nodes, newPath)
}
