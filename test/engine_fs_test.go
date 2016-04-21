// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Without any build tags the tests are run on libkbfs directly.
// With the tag dokan all tests are run through a dokan filesystem.
// With the tag fuse all tests are run through a fuse filesystem.
// Note that fuse cannot be compiled on Windows and Dokan can only
// be compiled on Windows.

package test

import (
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type fsEngine struct {
	name       string
	t          *testing.T
	createUser func(t *testing.T, ith int, config *libkbfs.ConfigLocal, h *libkbfs.TlfHandle) User
}
type fsNode struct {
	path string
}
type fsUser struct {
	mntDir                string
	config                *libkbfs.ConfigLocal
	cancel                func()
	close                 func()
	notificationGroupWait func()
	tlf                   *libkbfs.TlfHandle
}

// Perform Init for the engine
func (*fsEngine) Init() {}

// Name returns the name of the Engine.
func (e *fsEngine) Name() string {
	return e.name
}

// GetUID is called by the test harness to retrieve a user instance's UID.
func (e *fsEngine) GetUID(user User) keybase1.UID {
	u := user.(*fsUser)
	_, uid, err := u.config.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		e.t.Fatalf("GetUID: GetCurrentUserInfo failed with %v", err)
	}
	return uid
}

// GetRootDir is called by the test harness to get a handle to the TLF from the given user's
// perspective which is a shared folder of the given writers and readers
func (*fsEngine) GetRootDir(user User, isPublic bool, writers []string, readers []string) (dir Node, err error) {
	u := user.(*fsUser)
	path := u.mntDir
	if isPublic {
		path += "/public/" + string(u.tlf.GetCanonicalName())
	} else {
		path += "/private/" + string(u.tlf.GetCanonicalName())
	}
	return &fsNode{path}, nil
}

// CreateDir is called by the test harness to create a directory relative to the passed
// parent directory for the given user.
func (*fsEngine) CreateDir(u User, parentDir Node, name string) (dir Node, err error) {
	p := parentDir.(*fsNode)
	path := p.path + "/" + name
	err = os.Mkdir(path, 0755)
	if err != nil {
		return nil, err
	}
	return &fsNode{path}, nil
}

// CreateFile is called by the test harness to create a file in the given directory as
// the given user.
func (*fsEngine) CreateFile(u User, parentDir Node, name string) (file Node, err error) {
	p := parentDir.(*fsNode)
	path := p.path + "/" + name
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	f.Close()
	return &fsNode{path}, nil
}

// WriteFile is called by the test harness to write to the given file as the given user.
func (*fsEngine) WriteFile(u User, file Node, data string, off int64, sync bool) (err error) {
	n := file.(*fsNode)
	f, err := os.OpenFile(n.path, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Write([]byte(data))
	if err != nil {
		return err
	}
	if !sync {
		return nil
	}
	return f.Sync()
}

// RemoveDir is called by the test harness as the given user to remove a subdirectory.
func (*fsEngine) RemoveDir(u User, dir Node, name string) (err error) {
	n := dir.(*fsNode)
	return os.Remove(n.path + "/" + name)
}

// RemoveEntry is called by the test harness as the given user to remove a directory entry.
func (*fsEngine) RemoveEntry(u User, dir Node, name string) (err error) {
	n := dir.(*fsNode)
	return os.Remove(n.path + "/" + name)
}

// Rename is called by the test harness as the given user to rename a node.
func (*fsEngine) Rename(u User, srcDir Node, srcName string, dstDir Node, dstName string) (err error) {
	snode := srcDir.(*fsNode)
	dnode := dstDir.(*fsNode)
	return os.Rename(snode.path+"/"+srcName, dnode.path+"/"+dstName)
}

// ReadFile is called by the test harness to read from the given file as the given user.
func (e *fsEngine) ReadFile(u User, file Node, off, len int64) (data string, err error) {
	n := file.(*fsNode)
	bs, err := ioutil.ReadFile(n.path)
	if err != nil {
		return "", err
	}
	return string(bs), nil
}

// GetDirChildrenTypes is called by the test harness as the given user to return a map of child nodes
// and their type names.
func (*fsEngine) GetDirChildrenTypes(u User, parentDir Node) (children map[string]string, err error) {
	n := parentDir.(*fsNode)
	f, err := os.Open(n.path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	fis, err := f.Readdir(-1)
	if err != nil {
		return nil, fmt.Errorf("Readdir on %v failed: %q", f, err.Error())
	}
	children = map[string]string{}
	for _, fi := range fis {
		children[fi.Name()] = fiTypeString(fi)
	}
	return children, nil
}

func (*fsEngine) DisableUpdatesForTesting(u User, dir Node) (err error) {
	n := dir.(*fsNode)
	return ioutil.WriteFile(n.path+"/.kbfs_disable_updates", []byte("off"), 0644)
}

// ReenableUpdatesForTesting is called by the test harness as the given user to resume updates
// if previously disabled for testing.
func (*fsEngine) ReenableUpdates(u User, dir Node) {
	n := dir.(*fsNode)
	// TODO
	ioutil.WriteFile(n.path+"/.kbfs_enable_updates", []byte("on"), 0644)
}

// SyncFromServerForTesting is called by the test harness as the given
// user to actively retrieve new metadata for a folder.
func (e *fsEngine) SyncFromServerForTesting(user User, dir Node) (err error) {
	u := user.(*fsUser)
	ctx := context.Background()
	root, _, err := u.config.KBFSOps().GetOrCreateRootNode(
		ctx, u.tlf, libkbfs.MasterBranch)
	if err != nil {
		return fmt.Errorf("cannot get root for %s: %v", u.tlf.GetCanonicalPath(), err)
	}

	err = u.config.KBFSOps().SyncFromServerForTesting(ctx, root.GetFolderBranch())
	if err != nil {
		return fmt.Errorf("Couldn't sync from server: %v", err)
	}
	u.notificationGroupWait()
	return nil
}

// ForceQuotaReclamation implements the Engine interface.
func (*fsEngine) ForceQuotaReclamation(user User, dir Node) (err error) {
	u := user.(*fsUser)
	ctx := context.Background()
	root, _, err := u.config.KBFSOps().GetOrCreateRootNode(
		ctx, u.tlf, libkbfs.MasterBranch)
	if err != nil {
		return fmt.Errorf("cannot get root for %s: %v", u.tlf.GetCanonicalPath(), err)
	}

	// TODO: expose this as a special write-only file?
	return libkbfs.ForceQuotaReclamationForTesting(u.config,
		root.GetFolderBranch())
}

// Shutdown is called by the test harness when it is done with the
// given user.
func (*fsEngine) Shutdown(user User) error {
	u := user.(*fsUser)
	u.cancel()
	u.close()
	return u.config.Shutdown()
}

// CreateLink is called by the test harness to create a symlink in the given directory as
// the given user.
func (*fsEngine) CreateLink(u User, parentDir Node, fromName string, toPath string) (err error) {
	n := parentDir.(*fsNode)
	return os.Symlink(toPath, n.path+"/"+fromName)
}

// Lookup is called by the test harness to return a node in the given directory by
// its name for the given user. In the case of a symlink the symPath will be set and
// the node will be nil.
func (e *fsEngine) Lookup(u User, parentDir Node, name string) (file Node, symPath string, err error) {
	n := parentDir.(*fsNode)
	path := n.path + "/" + name
	fi, err := os.Lstat(path)
	if err != nil {
		return nil, "", err
	}
	// Return if not a symlink
	// TODO currently we pretend that Dokan has no symbolic links
	// here and end up deferencing them. This works but is not
	// ideal.
	if fi.Mode()&os.ModeSymlink == 0 || e.name == "dokan" {
		return &fsNode{path}, "", nil
	}
	symPath, err = os.Readlink(path)
	if err != nil {
		return nil, "", err
	}
	return &fsNode{path}, symPath, err
}

// SetEx is called by the test harness as the given user to set/unset the executable bit on the
// given file.
func (*fsEngine) SetEx(u User, file Node, ex bool) (err error) {
	n := file.(*fsNode)
	var mode os.FileMode = 0644
	if ex {
		mode = 0755
	}
	return os.Chmod(n.path, mode)
}

func fiTypeString(fi os.FileInfo) string {
	m := fi.Mode()
	switch {
	case m&os.ModeSymlink != 0:
		return "SYM"
	case m.IsRegular() && m&0100 == 0100:
		return "EXEC"
	case m.IsRegular():
		return "FILE"
	case m.IsDir():
		return "DIR"
	}
	return "OTHER"
}

func usersTlf(uids []keybase1.UID, nwriters int, config *libkbfs.ConfigLocal) (*libkbfs.TlfHandle, error) {
	bareH, err := libkbfs.MakeBareTlfHandle(uids[:nwriters], uids[nwriters:], nil, nil)
	if err != nil {
		return nil, err
	}
	h, err := libkbfs.MakeTlfHandle(
		context.Background(), bareH, config.KBPKI())
	if err != nil {
		return nil, err
	}

	return h, nil
}

func (e *fsEngine) InitTest(t *testing.T, blockSize int64, blockChangeSize int64, writers []username, readers []username, clock libkbfs.Clock) map[string]User {
	e.t = t
	res := map[string]User{}

	users := concatUserNamesToStrings2(writers, readers)
	normalized := make([]libkb.NormalizedUsername, len(users))
	for i, name := range users {
		normalized[i] = libkb.NormalizedUsername(name)
	}

	// create the first user specially
	config0 := libkbfs.MakeTestConfigOrBust(t, normalized...)
	config0.SetClock(clock)

	setBlockSizes(t, config0, blockSize, blockChangeSize)
	uids := make([]keybase1.UID, len(users))
	cfgs := make([]*libkbfs.ConfigLocal, len(users))
	cfgs[0] = config0
	uids[0] = nameToUID(t, config0)
	for i, name := range normalized[1:] {
		c := libkbfs.ConfigAsUser(config0, name)
		c.SetClock(clock)
		cfgs[i+1] = c
		uids[i+1] = nameToUID(t, c)
	}

	for i, name := range users {
		tlf, err := usersTlf(uids, len(writers), cfgs[i])
		if err != nil {
			t.Fatal(err)
		}
		res[name] = e.createUser(t, i, cfgs[i], tlf)
	}

	return res
}

func nameToUID(t *testing.T, config libkbfs.Config) keybase1.UID {
	_, uid, err := config.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return uid
}
