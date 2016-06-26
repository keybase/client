// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

// LibKBFS implements the Engine interface for direct test harness usage of libkbfs.
type LibKBFS struct {
	// hack: hold references on behalf of the test harness
	refs map[libkbfs.Config]map[libkbfs.Node]bool
	// channels used to re-enable updates if disabled
	updateChannels map[libkbfs.Config]map[libkbfs.FolderBranch]chan<- struct{}
	// test object, mostly for logging
	t *testing.T
}

// Check that LibKBFS fully implements the Engine interface.
var _ Engine = (*LibKBFS)(nil)

// Name returns the name of the Engine.
func (k *LibKBFS) Name() string {
	return "libkbfs"
}

// Init implements the Engine interface.
func (k *LibKBFS) Init() {
	// Initialize reference holder and channels maps
	k.refs = make(map[libkbfs.Config]map[libkbfs.Node]bool)
	k.updateChannels =
		make(map[libkbfs.Config]map[libkbfs.FolderBranch]chan<- struct{})
}

// InitTest implements the Engine interface.
func (k *LibKBFS) InitTest(t *testing.T, blockSize int64, blockChangeSize int64,
	users []libkb.NormalizedUsername,
	clock libkbfs.Clock) map[libkb.NormalizedUsername]User {
	// Start a new log for this test.
	k.t = t
	k.t.Log("\n------------------------------------------")
	userMap := make(map[libkb.NormalizedUsername]User)
	// create the first user specially
	config := libkbfs.MakeTestConfigOrBust(t, users...)

	// Set the block sizes, if any
	if blockSize > 0 || blockChangeSize > 0 {
		if blockSize == 0 {
			blockSize = 512 * 1024
		}
		if blockChangeSize < 0 {
			panic("Can't handle negative blockChangeSize")
		}
		if blockChangeSize == 0 {
			blockChangeSize = 8 * 1024
		}
		// TODO: config option for max embed size.
		bsplit, err := libkbfs.NewBlockSplitterSimple(blockSize,
			uint64(blockChangeSize), config.Codec())
		if err != nil {
			panic(fmt.Sprintf("Couldn't make block splitter for block size %d,"+
				" blockChangeSize %d: %v", blockSize, blockChangeSize, err))
		}
		config.SetBlockSplitter(bsplit)
	}

	config.SetClock(clock)
	userMap[users[0]] = config
	k.refs[config] = make(map[libkbfs.Node]bool)
	k.updateChannels[config] = make(map[libkbfs.FolderBranch]chan<- struct{})

	if len(users) == 1 {
		return userMap
	}

	// create the rest of the users as copies of the original config
	for _, name := range users[1:] {
		c := libkbfs.ConfigAsUser(config, name)
		c.SetClock(clock)
		userMap[name] = c
		k.refs[c] = make(map[libkbfs.Node]bool)
		k.updateChannels[c] = make(map[libkbfs.FolderBranch]chan<- struct{})
	}
	return userMap
}

// GetUID implements the Engine interface.
func (k *LibKBFS) GetUID(u User) (uid keybase1.UID) {
	config, ok := u.(libkbfs.Config)
	if !ok {
		panic("passed parameter isn't a config object")
	}
	var err error
	_, uid, err = config.KBPKI().GetCurrentUserInfo(context.Background())
	if err != nil {
		panic(err.Error())
	}
	return uid
}

func parseTlfHandle(
	ctx context.Context, kbpki libkbfs.KBPKI, tlfName string, isPublic bool) (
	h *libkbfs.TlfHandle, err error) {
	// Limit to one non-canonical name for now.
outer:
	for i := 0; i < 2; i++ {
		h, err = libkbfs.ParseTlfHandle(ctx, kbpki, tlfName, isPublic)
		switch err := err.(type) {
		case nil:
			break outer
		case libkbfs.TlfNameNotCanonical:
			tlfName = err.NameToTry
		default:
			return nil, err
		}
	}
	if err != nil {
		return nil, err
	}
	return h, nil
}

// GetFavorites implements the Engine interface.
func (k *LibKBFS) GetFavorites(u User, public bool) (map[string]bool, error) {
	config := u.(*libkbfs.ConfigLocal)
	ctx := context.Background()
	favorites, err := config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return nil, err
	}
	favoritesMap := make(map[string]bool)
	for _, f := range favorites {
		if f.Public != public {
			continue
		}
		favoritesMap[f.Name] = true
	}
	return favoritesMap, nil
}

// GetRootDir implements the Engine interface.
func (k *LibKBFS) GetRootDir(u User, tlfName string, isPublic bool, expectedCanonicalTlfName string) (
	dir Node, err error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx := context.Background()
	h, err := parseTlfHandle(ctx, config.KBPKI(), tlfName, isPublic)
	if err != nil {
		return nil, err
	}

	if string(h.GetCanonicalName()) != expectedCanonicalTlfName {
		return nil, fmt.Errorf("Expected canonical TLF name %s, got %s",
			expectedCanonicalTlfName, h.GetCanonicalName())
	}

	dir, _, err = config.KBFSOps().GetOrCreateRootNode(
		ctx, h, libkbfs.MasterBranch)
	if err != nil {
		return nil, err
	}
	k.refs[config][dir.(libkbfs.Node)] = true
	return dir, nil
}

// CreateDir implements the Engine interface.
func (k *LibKBFS) CreateDir(u User, parentDir Node, name string) (dir Node, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	dir, _, err = kbfsOps.CreateDir(context.Background(), parentDir.(libkbfs.Node), name)
	if err != nil {
		return dir, err
	}
	k.refs[config][dir.(libkbfs.Node)] = true
	return dir, nil
}

// CreateFile implements the Engine interface.
func (k *LibKBFS) CreateFile(u User, parentDir Node, name string) (file Node, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	file, _, err = kbfsOps.CreateFile(context.Background(), parentDir.(libkbfs.Node), name, false)
	if err != nil {
		return file, err
	}
	k.refs[config][file.(libkbfs.Node)] = true
	return file, nil
}

// CreateLink implements the Engine interface.
func (k *LibKBFS) CreateLink(u User, parentDir Node, fromName, toPath string) (err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	_, err = kbfsOps.CreateLink(context.Background(), parentDir.(libkbfs.Node), fromName, toPath)
	return err
}

// RemoveDir implements the Engine interface.
func (k *LibKBFS) RemoveDir(u User, dir Node, name string) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	return kbfsOps.RemoveDir(context.Background(), dir.(libkbfs.Node), name)
}

// RemoveEntry implements the Engine interface.
func (k *LibKBFS) RemoveEntry(u User, dir Node, name string) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	return kbfsOps.RemoveEntry(context.Background(), dir.(libkbfs.Node), name)
}

// Rename implements the Engine interface.
func (k *LibKBFS) Rename(u User, srcDir Node, srcName string,
	dstDir Node, dstName string) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	return kbfsOps.Rename(context.Background(), srcDir.(libkbfs.Node), srcName, dstDir.(libkbfs.Node), dstName)
}

// WriteFile implements the Engine interface.
func (k *LibKBFS) WriteFile(u User, file Node, data string, off int64, sync bool) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	err = kbfsOps.Write(context.Background(), file.(libkbfs.Node), []byte(data), off)
	if err != nil {
		return err
	}
	if sync {
		err = kbfsOps.Sync(context.Background(), file.(libkbfs.Node))
	}
	return err
}

// TruncateFile implements the Engine interface.
func (k *LibKBFS) TruncateFile(u User, file Node, size uint64, sync bool) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	err = kbfsOps.Truncate(context.Background(), file.(libkbfs.Node), size)
	if err != nil {
		return err
	}
	if sync {
		err = kbfsOps.Sync(context.Background(), file.(libkbfs.Node))
	}
	return err
}

// Sync implements the Engine interface.
func (k *LibKBFS) Sync(u User, file Node) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	return kbfsOps.Sync(context.Background(), file.(libkbfs.Node))
}

// ReadFile implements the Engine interface.
func (k *LibKBFS) ReadFile(u User, file Node, off, len int64) (data string, err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	buf := make([]byte, len)
	var numRead int64
	numRead, err = kbfsOps.Read(context.Background(), file.(libkbfs.Node), buf, off)
	if err != nil {
		return "", err
	}
	data = string(buf[:numRead])
	return data, nil
}

type libkbfsSymNode struct {
	parentDir Node
	name      string
}

// Lookup implements the Engine interface.
func (k *LibKBFS) Lookup(u User, parentDir Node, name string) (file Node, symPath string, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	file, ei, err := kbfsOps.Lookup(context.Background(), parentDir.(libkbfs.Node), name)
	if err != nil {
		return file, symPath, err
	}
	if file != nil {
		k.refs[config][file.(libkbfs.Node)] = true
	}
	if ei.Type == libkbfs.Sym {
		symPath = ei.SymPath
	}
	if file == nil {
		// For symlnks, return a special kind of node that can be used
		// to look up stats about the symlink.
		return libkbfsSymNode{parentDir, name}, symPath, nil
	}
	return file, symPath, nil
}

// GetDirChildrenTypes implements the Engine interface.
func (k *LibKBFS) GetDirChildrenTypes(u User, parentDir Node) (childrenTypes map[string]string, err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	var entries map[string]libkbfs.EntryInfo
	entries, err = kbfsOps.GetDirChildren(context.Background(), parentDir.(libkbfs.Node))
	if err != nil {
		return childrenTypes, err
	}
	childrenTypes = make(map[string]string)
	for name, entryInfo := range entries {
		childrenTypes[name] = entryInfo.Type.String()
	}
	return childrenTypes, nil
}

// SetEx implements the Engine interface.
func (k *LibKBFS) SetEx(u User, file Node, ex bool) (err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	return kbfsOps.SetEx(context.Background(), file.(libkbfs.Node), ex)
}

// SetMtime implements the Engine interface.
func (k *LibKBFS) SetMtime(u User, file Node, mtime time.Time) (err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	return kbfsOps.SetMtime(context.Background(), file.(libkbfs.Node), &mtime)
}

// GetMtime implements the Engine interface.
func (k *LibKBFS) GetMtime(u User, file Node) (mtime time.Time, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	var info libkbfs.EntryInfo
	if node, ok := file.(libkbfs.Node); ok {
		info, err = kbfsOps.Stat(context.Background(), node)
	} else if node, ok := file.(libkbfsSymNode); ok {
		// Stat doesn't work for symlinks, so use lookup
		_, info, err = kbfsOps.Lookup(context.Background(),
			node.parentDir.(libkbfs.Node), node.name)
	}
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(0, info.Mtime), nil
}

// getRootNode is like GetRootDir, but doesn't check the canonical TLF
// name.
func getRootNode(config libkbfs.Config, tlfName string, isPublic bool) (libkbfs.Node, error) {
	ctx := context.Background()
	h, err := parseTlfHandle(ctx, config.KBPKI(), tlfName, isPublic)
	if err != nil {
		return nil, err
	}

	kbfsOps := config.KBFSOps()
	dir, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, libkbfs.MasterBranch)
	if err != nil {
		return nil, err
	}
	return dir, nil
}

// DisableUpdatesForTesting implements the Engine interface.
func (k *LibKBFS) DisableUpdatesForTesting(u User, tlfName string, isPublic bool) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	dir, err := getRootNode(config, tlfName, isPublic)
	if err != nil {
		return err
	}

	if _, ok := k.updateChannels[config][dir.GetFolderBranch()]; ok {
		// Updates are already disabled.
		return nil
	}

	var c chan<- struct{}
	c, err = libkbfs.DisableUpdatesForTesting(config, dir.GetFolderBranch())
	if err != nil {
		return err
	}
	k.updateChannels[config][dir.GetFolderBranch()] = c
	// Also stop conflict resolution.
	err = libkbfs.DisableCRForTesting(config, dir.GetFolderBranch())
	if err != nil {
		return err
	}
	return nil
}

// ReenableUpdates implements the Engine interface.
func (k *LibKBFS) ReenableUpdates(u User, tlfName string, isPublic bool) error {
	config := u.(*libkbfs.ConfigLocal)

	dir, err := getRootNode(config, tlfName, isPublic)
	if err != nil {
		return err
	}

	c, ok := k.updateChannels[config][dir.GetFolderBranch()]
	if !ok {
		return fmt.Errorf("Couldn't re-enable updates for %s (public=%t)", tlfName, isPublic)
	}

	err = libkbfs.RestartCRForTesting(context.Background(), config,
		dir.GetFolderBranch())
	if err != nil {
		return err
	}

	c <- struct{}{}
	close(c)
	delete(k.updateChannels[config], dir.GetFolderBranch())
	return nil
}

// SyncFromServerForTesting implements the Engine interface.
func (k *LibKBFS) SyncFromServerForTesting(u User, tlfName string, isPublic bool) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	dir, err := getRootNode(config, tlfName, isPublic)
	if err != nil {
		return err
	}

	return config.KBFSOps().SyncFromServerForTesting(
		context.Background(), dir.GetFolderBranch())
}

// ForceQuotaReclamation implements the Engine interface.
func (k *LibKBFS) ForceQuotaReclamation(u User, tlfName string, isPublic bool) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	dir, err := getRootNode(config, tlfName, isPublic)
	if err != nil {
		return err
	}

	return libkbfs.ForceQuotaReclamationForTesting(
		config, dir.GetFolderBranch())
}

// AddNewAssertion implements the Engine interface.
func (k *LibKBFS) AddNewAssertion(u User, oldAssertion, newAssertion string) error {
	config := u.(*libkbfs.ConfigLocal)
	return libkbfs.AddNewAssertionForTest(config, oldAssertion, newAssertion)
}

// Rekey implements the Engine interface.
func (k *LibKBFS) Rekey(u User, tlfName string, isPublic bool) error {
	config := u.(*libkbfs.ConfigLocal)

	dir, err := getRootNode(config, tlfName, isPublic)
	if err != nil {
		return err
	}

	return config.KBFSOps().Rekey(
		context.Background(), dir.GetFolderBranch().Tlf)
}

// Shutdown implements the Engine interface.
func (k *LibKBFS) Shutdown(u User) error {
	config := u.(*libkbfs.ConfigLocal)
	// drop references
	k.refs[config] = make(map[libkbfs.Node]bool)
	delete(k.refs, config)
	// clear update channels
	k.updateChannels[config] = make(map[libkbfs.FolderBranch]chan<- struct{})
	delete(k.updateChannels, config)
	// shutdown
	if err := config.Shutdown(); err != nil {
		return err
	}
	return nil
}
