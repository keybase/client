// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// LibKBFS implements the Engine interface for direct test harness usage of libkbfs.
type LibKBFS struct {
	// hack: hold references on behalf of the test harness
	refs map[libkbfs.Config]map[libkbfs.Node]bool
	// channels used to re-enable updates if disabled
	updateChannels map[libkbfs.Config]map[data.FolderBranch]chan<- struct{}
	// test object, for logging.
	tb testing.TB
	// timeout for all KBFS calls
	opTimeout time.Duration
	// journal directory
	journalDir string
}

// Check that LibKBFS fully implements the Engine interface.
var _ Engine = (*LibKBFS)(nil)

// Name returns the name of the Engine.
func (k *LibKBFS) Name() string {
	return "libkbfs"
}

// InitTest implements the Engine interface.
func (k *LibKBFS) InitTest(ver kbfsmd.MetadataVer,
	blockSize int64, blockChangeSize int64, batchSize int, bwKBps int,
	opTimeout time.Duration, users []kbname.NormalizedUsername,
	teams, implicitTeams teamMap, clock libkbfs.Clock,
	journal bool) map[kbname.NormalizedUsername]User {
	userMap := make(map[kbname.NormalizedUsername]User)
	// create the first user specially
	config := libkbfs.MakeTestConfigOrBust(k.tb, users...)
	config.SetMetadataVersion(ver)

	setBlockSizes(k.tb, config, blockSize, blockChangeSize)
	if batchSize > 0 {
		config.SetBGFlushDirOpBatchSize(batchSize)
	}
	maybeSetBw(k.tb, config, bwKBps)
	k.opTimeout = opTimeout

	config.SetClock(clock)
	userMap[users[0]] = config
	k.refs[config] = make(map[libkbfs.Node]bool)
	k.updateChannels[config] = make(map[data.FolderBranch]chan<- struct{})

	// create the rest of the users as copies of the original config
	for _, name := range users[1:] {
		c := libkbfs.ConfigAsUser(config, name)
		setBlockSizes(k.tb, c, blockSize, blockChangeSize)
		if batchSize > 0 {
			c.SetBGFlushDirOpBatchSize(batchSize)
		}
		c.SetClock(clock)
		userMap[name] = c
		k.refs[c] = make(map[libkbfs.Node]bool)
		k.updateChannels[c] = make(map[data.FolderBranch]chan<- struct{})
	}

	if journal {
		jdir, err := ioutil.TempDir(os.TempDir(), "kbfs_journal")
		if err != nil {
			k.tb.Fatalf("Couldn't enable journaling: %v", err)
		}
		k.journalDir = jdir
		k.tb.Logf("Journal directory: %s", k.journalDir)
		for name, c := range userMap {
			config := c.(*libkbfs.ConfigLocal)
			journalRoot := filepath.Join(jdir, name.String())
			err = config.EnableDiskLimiter(journalRoot)
			if err != nil {
				panic(fmt.Sprintf("No disk limiter for %s: %+v", name, err))
			}
			err = config.EnableJournaling(context.Background(), journalRoot,
				libkbfs.TLFJournalBackgroundWorkEnabled)
			if err != nil {
				panic(fmt.Sprintf("Couldn't enable journaling: %+v", err))
			}
			jManager, err := libkbfs.GetJournalManager(config)
			if err != nil {
				panic(fmt.Sprintf("No journal server for %s: %+v", name, err))
			}
			err = jManager.DisableAuto(context.Background())
			if err != nil {
				panic(fmt.Sprintf("Couldn't disable journaling: %+v", err))
			}
		}
	}

	for _, u := range userMap {
		c := u.(libkbfs.Config)
		makeTeams(k.tb, c, k, teams, userMap)
		makeImplicitTeams(k.tb, c, k, implicitTeams, userMap)
	}

	return userMap
}

const (
	// CtxOpID is the display name for the unique operation test ID tag.
	CtxOpID = "TID"

	// CtxOpUser is the display name for the user tag.
	CtxOpUser = "User"
)

// CtxTagKey is the type used for unique context tags
type CtxTagKey int

const (
	// CtxIDKey is the type of the tag for unique operation IDs.
	CtxIDKey CtxTagKey = iota

	// CtxUserKey is the type of the user tag.
	CtxUserKey
)

func (k *LibKBFS) newContext(u User) (context.Context, context.CancelFunc) {
	ctx := context.Background()

	config, ok := u.(libkbfs.Config)
	if !ok {
		panic("passed parameter isn't a config object")
	}
	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		panic(err)
	}

	var cancel context.CancelFunc
	if k.opTimeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, k.opTimeout)
	} else {
		ctx, cancel = context.WithCancel(ctx)
	}

	id, errRandomRequestID := libkbfs.MakeRandomRequestID()
	ctx, err = libcontext.NewContextWithCancellationDelayer(libcontext.NewContextReplayable(
		ctx, func(ctx context.Context) context.Context {
			logTags := logger.CtxLogTags{
				CtxIDKey:   CtxOpID,
				CtxUserKey: CtxOpUser,
			}
			ctx = logger.NewContextWithLogTags(ctx, logTags)

			// Add a unique ID to this context, identifying a particular
			// request.
			if errRandomRequestID == nil {
				ctx = context.WithValue(ctx, CtxIDKey, id)
			}

			ctx = context.WithValue(ctx, CtxUserKey, session.Name)

			return ctx
		}))
	if err != nil {
		panic(err)
	}

	return ctx, func() {
		err := libcontext.CleanupCancellationDelayer(ctx)
		if err != nil {
			panic(err)
		}
		cancel()
	}
}

// GetUID implements the Engine interface.
func (k *LibKBFS) GetUID(u User) (uid keybase1.UID) {
	config, ok := u.(libkbfs.Config)
	if !ok {
		panic("passed parameter isn't a config object")
	}
	var err error
	ctx, cancel := k.newContext(u)
	defer cancel()
	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		panic(err.Error())
	}
	return session.UID
}

func parseTlfHandle(
	ctx context.Context, kbpki libkbfs.KBPKI, mdOps libkbfs.MDOps,
	osg idutil.OfflineStatusGetter, tlfName string, t tlf.Type) (
	h *tlfhandle.Handle, err error) {
	// Limit to one non-canonical name for now.
outer:
	for i := 0; i < 2; i++ {
		h, err = tlfhandle.ParseHandle(ctx, kbpki, mdOps, osg, tlfName, t)
		switch err := errors.Cause(err).(type) {
		case nil:
			break outer
		case idutil.TlfNameNotCanonical:
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
func (k *LibKBFS) GetFavorites(u User, t tlf.Type) (map[string]bool, error) {
	config := u.(*libkbfs.ConfigLocal)
	ctx, cancel := k.newContext(u)
	defer cancel()
	favorites, err := config.KBFSOps().GetFavorites(ctx)
	if err != nil {
		return nil, err
	}
	favoritesMap := make(map[string]bool)
	for _, f := range favorites {
		if f.Type != t {
			continue
		}
		favoritesMap[f.Name] = true
	}
	return favoritesMap, nil
}

func (k *LibKBFS) getRootDir(
	u User, tlfName string, t tlf.Type, branch data.BranchName,
	expectedCanonicalTlfName string) (dir Node, err error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	h, err := parseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), config, tlfName, t)
	if err != nil {
		return nil, err
	}

	if string(h.GetCanonicalName()) != expectedCanonicalTlfName {
		return nil, fmt.Errorf("Expected canonical TLF name %s, got %s",
			expectedCanonicalTlfName, h.GetCanonicalName())
	}

	if h.IsLocalConflict() {
		b, ok := data.MakeConflictBranchName(h)
		if ok {
			branch = b
		}
	}

	if branch == data.MasterBranch {
		dir, _, err = config.KBFSOps().GetOrCreateRootNode(ctx, h, branch)
	} else {
		dir, _, err = config.KBFSOps().GetRootNode(ctx, h, branch)
	}
	if err != nil {
		return nil, err
	}

	k.refs[config][dir.(libkbfs.Node)] = true
	return dir, nil
}

// GetRootDir implements the Engine interface.
func (k *LibKBFS) GetRootDir(
	u User, tlfName string, t tlf.Type, expectedCanonicalTlfName string) (
	dir Node, err error) {
	return k.getRootDir(
		u, tlfName, t, data.MasterBranch, expectedCanonicalTlfName)
}

// GetRootDirAtRevision implements the Engine interface.
func (k *LibKBFS) GetRootDirAtRevision(
	u User, tlfName string, t tlf.Type, rev kbfsmd.Revision,
	expectedCanonicalTlfName string) (dir Node, err error) {
	return k.getRootDir(
		u, tlfName, t, data.MakeRevBranchName(rev), expectedCanonicalTlfName)
}

// GetRootDirAtTimeString implements the Engine interface.
func (k *LibKBFS) GetRootDirAtTimeString(
	u User, tlfName string, t tlf.Type, timeString string,
	expectedCanonicalTlfName string) (dir Node, err error) {
	config := u.(*libkbfs.ConfigLocal)
	ctx, cancel := k.newContext(u)
	defer cancel()
	h, err := parseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), config, tlfName, t)
	if err != nil {
		return nil, err
	}

	rev, err := libfs.RevFromTimeString(ctx, config, h, timeString)
	if err != nil {
		return nil, err
	}

	return k.getRootDir(
		u, tlfName, t, data.MakeRevBranchName(rev), expectedCanonicalTlfName)
}

// GetRootDirAtRelTimeString implements the Engine interface.
func (k *LibKBFS) GetRootDirAtRelTimeString(
	u User, tlfName string, t tlf.Type, relTimeString string,
	expectedCanonicalTlfName string) (dir Node, err error) {
	config := u.(*libkbfs.ConfigLocal)
	ctx, cancel := k.newContext(u)
	defer cancel()
	h, err := parseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), config, tlfName, t)
	if err != nil {
		return nil, err
	}

	rev, err := libfs.RevFromRelativeTimeString(ctx, config, h, relTimeString)
	if err != nil {
		return nil, err
	}

	return k.getRootDir(
		u, tlfName, t, data.MakeRevBranchName(rev), expectedCanonicalTlfName)
}

// CreateDir implements the Engine interface.
func (k *LibKBFS) CreateDir(u User, parentDir Node, name string) (dir Node, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := parentDir.(libkbfs.Node)
	dir, _, err = kbfsOps.CreateDir(ctx, n, n.ChildName(name))
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
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := parentDir.(libkbfs.Node)
	file, _, err = kbfsOps.CreateFile(
		ctx, n, n.ChildName(name), false, libkbfs.NoExcl)
	if err != nil {
		return file, err
	}
	k.refs[config][file.(libkbfs.Node)] = true
	return file, nil
}

// CreateFileExcl implements the Engine interface.
func (k *LibKBFS) CreateFileExcl(u User, parentDir Node, name string) (file Node, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := parentDir.(libkbfs.Node)
	file, _, err = kbfsOps.CreateFile(
		ctx, n, n.ChildName(name), false, libkbfs.WithExcl)
	if err != nil {
		return nil, err
	}
	k.refs[config][file.(libkbfs.Node)] = true
	return file, nil
}

// CreateLink implements the Engine interface.
func (k *LibKBFS) CreateLink(
	u User, parentDir Node, fromName, toPath string) (err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := parentDir.(libkbfs.Node)
	_, err = kbfsOps.CreateLink(
		ctx, n, n.ChildName(fromName), n.ChildName(toPath))
	return err
}

// RemoveDir implements the Engine interface.
func (k *LibKBFS) RemoveDir(u User, dir Node, name string) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := dir.(libkbfs.Node)
	return kbfsOps.RemoveDir(ctx, n, n.ChildName(name))
}

// RemoveEntry implements the Engine interface.
func (k *LibKBFS) RemoveEntry(u User, dir Node, name string) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := dir.(libkbfs.Node)
	return kbfsOps.RemoveEntry(ctx, n, n.ChildName(name))
}

// Rename implements the Engine interface.
func (k *LibKBFS) Rename(u User, srcDir Node, srcName string,
	dstDir Node, dstName string) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	srcN := srcDir.(libkbfs.Node)
	dstN := dstDir.(libkbfs.Node)
	return kbfsOps.Rename(
		ctx, srcN, srcN.ChildName(srcName), dstN, dstN.ChildName(dstName))
}

// WriteFile implements the Engine interface.
func (k *LibKBFS) WriteFile(u User, file Node, data []byte, off int64, sync bool) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	err = kbfsOps.Write(ctx, file.(libkbfs.Node), data, off)
	if err != nil {
		return err
	}
	if sync {
		ctx, cancel := k.newContext(u)
		defer cancel()
		err = kbfsOps.SyncAll(ctx, file.(libkbfs.Node).GetFolderBranch())
	}
	return err
}

// TruncateFile implements the Engine interface.
func (k *LibKBFS) TruncateFile(u User, file Node, size uint64, sync bool) (err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	err = kbfsOps.Truncate(ctx, file.(libkbfs.Node), size)
	if err != nil {
		return err
	}
	if sync {
		ctx, cancel := k.newContext(u)
		defer cancel()
		err = kbfsOps.SyncAll(ctx, file.(libkbfs.Node).GetFolderBranch())
	}
	return err
}

// ReadFile implements the Engine interface.
func (k *LibKBFS) ReadFile(u User, file Node, off int64, buf []byte) (length int, err error) {
	kbfsOps := u.(*libkbfs.ConfigLocal).KBFSOps()
	var numRead int64
	ctx, cancel := k.newContext(u)
	defer cancel()
	numRead, err = kbfsOps.Read(ctx, file.(libkbfs.Node), buf, off)
	if err != nil {
		return 0, err
	}
	return int(numRead), nil
}

type libkbfsSymNode struct {
	parentDir Node
	name      string
}

// Lookup implements the Engine interface.
func (k *LibKBFS) Lookup(u User, parentDir Node, name string) (file Node, symPath string, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	n := parentDir.(libkbfs.Node)
	file, ei, err := kbfsOps.Lookup(ctx, n, n.ChildName(name))
	if err != nil {
		return file, symPath, err
	}
	if file != nil {
		k.refs[config][file.(libkbfs.Node)] = true
	}
	if ei.Type == data.Sym {
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
	ctx, cancel := k.newContext(u)
	defer cancel()
	entries, err := kbfsOps.GetDirChildren(ctx, parentDir.(libkbfs.Node))
	if err != nil {
		return childrenTypes, err
	}
	childrenTypes = make(map[string]string)
	for name, entryInfo := range entries {
		childrenTypes[name.Plaintext()] = entryInfo.Type.String()
	}
	return childrenTypes, nil
}

// SetEx implements the Engine interface.
func (k *LibKBFS) SetEx(u User, file Node, ex bool) (err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	return kbfsOps.SetEx(ctx, file.(libkbfs.Node), ex)
}

// SetMtime implements the Engine interface.
func (k *LibKBFS) SetMtime(u User, file Node, mtime time.Time) (err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	ctx, cancel := k.newContext(u)
	defer cancel()
	return kbfsOps.SetMtime(ctx, file.(libkbfs.Node), &mtime)
}

// SyncAll implements the Engine interface.
func (k *LibKBFS) SyncAll(
	u User, tlfName string, t tlf.Type) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	return config.KBFSOps().SyncAll(ctx, dir.GetFolderBranch())
}

// GetMtime implements the Engine interface.
func (k *LibKBFS) GetMtime(u User, file Node) (mtime time.Time, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	var info data.EntryInfo
	ctx, cancel := k.newContext(u)
	defer cancel()
	if node, ok := file.(libkbfs.Node); ok {
		info, err = kbfsOps.Stat(ctx, node)
	} else if node, ok := file.(libkbfsSymNode); ok {
		// Stat doesn't work for symlinks, so use lookup
		n := node.parentDir.(libkbfs.Node)
		_, info, err = kbfsOps.Lookup(ctx, n, n.ChildName(node.name))
	}
	if err != nil {
		return time.Time{}, err
	}
	return time.Unix(0, info.Mtime), nil
}

// GetPrevRevisions implements the Engine interface.
func (k *LibKBFS) GetPrevRevisions(u User, file Node) (
	revs data.PrevRevisions, err error) {
	config := u.(*libkbfs.ConfigLocal)
	kbfsOps := config.KBFSOps()
	var info data.EntryInfo
	ctx, cancel := k.newContext(u)
	defer cancel()
	if node, ok := file.(libkbfs.Node); ok {
		info, err = kbfsOps.Stat(ctx, node)
	} else if node, ok := file.(libkbfsSymNode); ok {
		// Stat doesn't work for symlinks, so use lookup
		n := node.parentDir.(libkbfs.Node)
		_, info, err = kbfsOps.Lookup(ctx, n, n.ChildName(node.name))
	}
	if err != nil {
		return nil, err
	}
	return info.PrevRevisions, nil
}

// getRootNode is like GetRootDir, but doesn't check the canonical TLF
// name.
func getRootNode(ctx context.Context, config libkbfs.Config, tlfName string,
	t tlf.Type) (libkbfs.Node, error) {
	h, err := parseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), config, tlfName, t)
	if err != nil {
		return nil, err
	}

	// TODO: we should cache the root node, to more faithfully
	// simulate real-world callers and avoid unnecessary work.
	kbfsOps := config.KBFSOps()
	if h.IsLocalConflict() {
		b, ok := data.MakeConflictBranchName(h)
		if ok {
			dir, _, err := kbfsOps.GetRootNode(ctx, h, b)
			if err != nil {
				return nil, err
			}
			return dir, nil
		}
	}

	dir, _, err := kbfsOps.GetOrCreateRootNode(ctx, h, data.MasterBranch)
	if err != nil {
		return nil, err
	}
	return dir, nil
}

// DisableUpdatesForTesting implements the Engine interface.
func (k *LibKBFS) DisableUpdatesForTesting(u User, tlfName string, t tlf.Type) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
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

// MakeNaïveStaller implements the Engine interface.
func (*LibKBFS) MakeNaïveStaller(u User) *libkbfs.NaïveStaller {
	return libkbfs.NewNaïveStaller(u.(*libkbfs.ConfigLocal))
}

// ReenableUpdates implements the Engine interface.
func (k *LibKBFS) ReenableUpdates(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	c, ok := k.updateChannels[config][dir.GetFolderBranch()]
	if !ok {
		return fmt.Errorf(
			"Couldn't re-enable updates for %s (type=%s)", tlfName, t)
	}

	// Restart CR using a clean context, since we will cancel ctx when
	// we return.
	err = libkbfs.RestartCRForTesting(
		libcontext.BackgroundContextWithCancellationDelayer(), config,
		dir.GetFolderBranch())
	if err != nil {
		return err
	}

	c <- struct{}{}
	close(c)
	delete(k.updateChannels[config], dir.GetFolderBranch())
	return nil
}

// SyncFromServer implements the Engine interface.
func (k *LibKBFS) SyncFromServer(u User, tlfName string, t tlf.Type) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	return config.KBFSOps().SyncFromServer(ctx,
		dir.GetFolderBranch(), nil)
}

// ForceQuotaReclamation implements the Engine interface.
func (k *LibKBFS) ForceQuotaReclamation(u User, tlfName string, t tlf.Type) (err error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
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

// ChangeTeamName implements the Engine interface.
func (k *LibKBFS) ChangeTeamName(u User, oldName, newName string) error {
	config := u.(*libkbfs.ConfigLocal)
	return libkbfs.ChangeTeamNameForTest(config, oldName, newName)
}

// Rekey implements the Engine interface.
func (k *LibKBFS) Rekey(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	_, err = libkbfs.RequestRekeyAndWaitForOneFinishEvent(ctx,
		config.KBFSOps(), dir.GetFolderBranch().Tlf)
	return err
}

// EnableJournal implements the Engine interface.
func (k *LibKBFS) EnableJournal(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	jManager, err := libkbfs.GetJournalManager(config)
	if err != nil {
		return err
	}

	h, err := parseTlfHandle(
		ctx, config.KBPKI(), config.MDOps(), config, tlfName, t)
	if err != nil {
		return err
	}

	return jManager.Enable(ctx, dir.GetFolderBranch().Tlf, h,
		libkbfs.TLFJournalBackgroundWorkEnabled)
}

// PauseJournal implements the Engine interface.
func (k *LibKBFS) PauseJournal(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	jManager, err := libkbfs.GetJournalManager(config)
	if err != nil {
		return err
	}

	jManager.PauseBackgroundWork(ctx, dir.GetFolderBranch().Tlf)
	return nil
}

// ResumeJournal implements the Engine interface.
func (k *LibKBFS) ResumeJournal(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	jManager, err := libkbfs.GetJournalManager(config)
	if err != nil {
		return err
	}

	jManager.ResumeBackgroundWork(ctx, dir.GetFolderBranch().Tlf)
	return nil
}

// FlushJournal implements the Engine interface.
func (k *LibKBFS) FlushJournal(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	jManager, err := libkbfs.GetJournalManager(config)
	if err != nil {
		return err
	}

	return jManager.Flush(ctx, dir.GetFolderBranch().Tlf)
}

// UnflushedPaths implements the Engine interface.
func (k *LibKBFS) UnflushedPaths(u User, tlfName string, t tlf.Type) (
	[]string, error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return nil, err
	}

	status, _, err := config.KBFSOps().FolderStatus(ctx, dir.GetFolderBranch())
	if err != nil {
		return nil, err
	}

	return status.Journal.UnflushedPaths, nil
}

// UserEditHistory implements the Engine interface.
func (k *LibKBFS) UserEditHistory(u User) (
	[]keybase1.FSFolderEditHistory, error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	session, err := idutil.GetCurrentSessionIfPossible(
		ctx, config.KBPKI(), true)
	if err != nil {
		return nil, err
	}

	history := config.UserHistory().Get(string(session.Name))
	return history, nil
}

// DirtyPaths implements the Engine interface.
func (k *LibKBFS) DirtyPaths(u User, tlfName string, t tlf.Type) (
	[]string, error) {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()
	dir, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return nil, err
	}

	status, _, err := config.KBFSOps().FolderStatus(ctx, dir.GetFolderBranch())
	if err != nil {
		return nil, err
	}

	return status.DirtyPaths, nil
}

// TogglePrefetch implements the Engine interface.
func (k *LibKBFS) TogglePrefetch(u User, enable bool) error {
	config := u.(*libkbfs.ConfigLocal)

	_ = config.BlockOps().TogglePrefetcher(enable)
	return nil
}

// ForceConflict implements the Engine interface.
func (k *LibKBFS) ForceConflict(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()

	root, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	return config.KBFSOps().ForceStuckConflictForTesting(
		ctx, root.GetFolderBranch().Tlf)
}

// ClearConflicts implements the Engine interface.
func (k *LibKBFS) ClearConflicts(u User, tlfName string, t tlf.Type) error {
	config := u.(*libkbfs.ConfigLocal)

	ctx, cancel := k.newContext(u)
	defer cancel()

	root, err := getRootNode(ctx, config, tlfName, t)
	if err != nil {
		return err
	}

	return config.KBFSOps().ClearConflictView(ctx, root.GetFolderBranch().Tlf)
}

// Shutdown implements the Engine interface.
func (k *LibKBFS) Shutdown(u User) error {
	config := u.(*libkbfs.ConfigLocal)
	// drop references
	k.refs[config] = make(map[libkbfs.Node]bool)
	delete(k.refs, config)
	// clear update channels
	k.updateChannels[config] = make(map[data.FolderBranch]chan<- struct{})
	delete(k.updateChannels, config)

	// Get the user name before shutting everything down.
	var userName kbname.NormalizedUsername
	if k.journalDir != "" {
		var err error
		session, err :=
			config.KBPKI().GetCurrentSession(context.Background())
		if err != nil {
			return err
		}
		userName = session.Name
	}

	// shutdown
	ctx := context.Background()
	if err := config.Shutdown(ctx); err != nil {
		return err
	}

	if k.journalDir != "" {
		// Remove the user journal.
		if err := ioutil.RemoveAll(
			filepath.Join(k.journalDir, userName.String())); err != nil {
			return err
		}
		// Remove the overall journal dir if it's empty.
		if err := ioutil.Remove(k.journalDir); err != nil {
			k.tb.Logf("Journal dir %s not empty yet", k.journalDir)
		}
	}
	return nil
}
