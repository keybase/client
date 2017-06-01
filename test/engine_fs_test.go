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
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type createUserFn func(tb testing.TB, ith int, config *libkbfs.ConfigLocal,
	opTimeout time.Duration) *fsUser

type fsEngine struct {
	name       string
	tb         testing.TB
	createUser createUserFn
	// journal directory
	journalDir string
}
type fsNode struct {
	path string
}

type fsUser struct {
	mntDir   string
	username libkb.NormalizedUsername
	config   *libkbfs.ConfigLocal
	cancel   func()
	close    func()
}

// It's important that this be called, even on error paths, as it may
// do unmounts and release locks.
func (u *fsUser) shutdown() {
	u.cancel()
	u.close()
}

// Name returns the name of the Engine.
func (e *fsEngine) Name() string {
	return e.name
}

// GetUID is called by the test harness to retrieve a user instance's UID.
func (e *fsEngine) GetUID(user User) keybase1.UID {
	u := user.(*fsUser)
	ctx := context.Background()
	session, err := u.config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		e.tb.Fatalf("GetUID: GetCurrentSession failed with %v", err)
	}
	return session.UID
}

func buildRootPath(u *fsUser, t tlf.Type) string {
	var path string
	switch t {
	case tlf.Public:
		// TODO: Consolidate all "public" and "private"
		// constants in libkbfs.
		path = filepath.Join(u.mntDir, "public")
	case tlf.Private:
		path = filepath.Join(u.mntDir, "private")
	case tlf.SingleTeam:
		path = filepath.Join(u.mntDir, "team")
	default:
		panic(fmt.Sprintf("Unknown TLF type: %s", t))
	}
	return path
}

func buildTlfPath(u *fsUser, tlfName string, t tlf.Type) string {
	return filepath.Join(buildRootPath(u, t), tlfName)
}

func (e *fsEngine) GetFavorites(user User, t tlf.Type) (map[string]bool, error) {
	u := user.(*fsUser)
	path := buildRootPath(u, t)
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	fis, err := f.Readdir(-1)
	if err != nil {
		return nil, fmt.Errorf("Readdir on %v failed: %q", f, err.Error())
	}
	favorites := make(map[string]bool)
	for _, fi := range fis {
		favorites[fi.Name()] = true
	}
	return favorites, nil
}

// GetRootDir implements the Engine interface.
func (e *fsEngine) GetRootDir(user User, tlfName string, t tlf.Type, expectedCanonicalTlfName string) (dir Node, err error) {
	u := user.(*fsUser)
	preferredName, err := libkbfs.FavoriteNameToPreferredTLFNameFormatAs(u.username,
		libkbfs.CanonicalTlfName(tlfName))
	if err != nil {
		return nil, err
	}
	expectedPreferredName, err := libkbfs.FavoriteNameToPreferredTLFNameFormatAs(u.username,
		libkbfs.CanonicalTlfName(expectedCanonicalTlfName))
	if err != nil {
		return nil, err
	}
	path := buildTlfPath(u, tlfName, t)
	var realPath string
	// TODO currently we pretend that Dokan has no symbolic links
	// here and end up deferencing them. This works but is not
	// ideal. (See Lookup.)
	if preferredName == expectedPreferredName || e.name == "dokan" {
		realPath = path
	} else {
		realPath, err = filepath.EvalSymlinks(path)
		if err != nil {
			return nil, err
		}
		realName := filepath.Base(realPath)
		if realName != string(expectedPreferredName) {
			return nil, fmt.Errorf(
				"Expected preferred TLF name %s, got %s",
				expectedPreferredName, realName)
		}
	}
	return fsNode{realPath}, nil
}

// CreateDir is called by the test harness to create a directory relative to the passed
// parent directory for the given user.
func (*fsEngine) CreateDir(u User, parentDir Node, name string) (dir Node, err error) {
	p := parentDir.(fsNode)
	path := filepath.Join(p.path, name)
	err = ioutil.Mkdir(path, 0755)
	if err != nil {
		return nil, err
	}
	return fsNode{path}, nil
}

// CreateFile is called by the test harness to create a file in the given directory as
// the given user.
func (*fsEngine) CreateFile(u User, parentDir Node, name string) (file Node, err error) {
	p := parentDir.(fsNode)
	path := filepath.Join(p.path, name)
	f, err := os.Create(path)
	if err != nil {
		return nil, err
	}
	f.Close()
	return fsNode{path}, nil
}

// CreateFileExcl is called by the test harness to exclusively create a file in
// the given directory as the given user. The file is created with
// O_RDWR|O_CREATE|O_EXCL.
func (*fsEngine) CreateFileExcl(u User, parentDir Node, name string) (file Node, err error) {
	p := parentDir.(fsNode).path
	f, err := os.OpenFile(filepath.Join(p, name), os.O_RDWR|os.O_CREATE|os.O_EXCL, 0666)
	if err != nil {
		return nil, err
	}
	f.Close()
	return fsNode{p}, nil
}

// WriteFile is called by the test harness to write to the given file as the given user.
func (*fsEngine) WriteFile(u User, file Node, data []byte, off int64, sync bool) (err error) {
	n := file.(fsNode)
	f, err := os.OpenFile(n.path, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = f.Seek(off, 0)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err != nil {
		return err
	}
	if !sync {
		return nil
	}
	return f.Sync()
}

// TruncateFile is called by the test harness to truncate the given file as the given user to the given size.
func (*fsEngine) TruncateFile(u User, file Node, size uint64, sync bool) (err error) {
	n := file.(fsNode)
	f, err := os.OpenFile(n.path, os.O_RDWR|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	defer f.Close()
	err = f.Truncate(int64(size))
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
	n := dir.(fsNode)
	return ioutil.Remove(filepath.Join(n.path, name))
}

// RemoveEntry is called by the test harness as the given user to remove a directory entry.
func (*fsEngine) RemoveEntry(u User, dir Node, name string) (err error) {
	n := dir.(fsNode)
	return ioutil.Remove(filepath.Join(n.path, name))
}

// Rename is called by the test harness as the given user to rename a node.
func (*fsEngine) Rename(u User, srcDir Node, srcName string, dstDir Node, dstName string) (err error) {
	snode := srcDir.(fsNode)
	dnode := dstDir.(fsNode)
	return ioutil.Rename(
		filepath.Join(snode.path, srcName),
		filepath.Join(dnode.path, dstName))
}

// ReadFile is called by the test harness to read from the given file as the given user.
func (e *fsEngine) ReadFile(u User, file Node, off int64, bs []byte) (int, error) {
	n := file.(fsNode)
	f, err := os.Open(n.path)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	return io.ReadFull(io.NewSectionReader(f, off, int64(len(bs))), bs)
}

// GetDirChildrenTypes is called by the test harness as the given user to return a map of child nodes
// and their type names.
func (*fsEngine) GetDirChildrenTypes(u User, parentDir Node) (children map[string]string, err error) {
	n := parentDir.(fsNode)
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

func (*fsEngine) DisableUpdatesForTesting(user User, tlfName string, t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.DisableUpdatesFileName),
		[]byte("off"), 0644)
}

// MakeNaïveStaller implements the Engine interface.
func (*fsEngine) MakeNaïveStaller(u User) *libkbfs.NaïveStaller {
	return libkbfs.NewNaïveStaller(u.(*fsUser).config)
}

// ReenableUpdatesForTesting is called by the test harness as the given user to resume updates
// if previously disabled for testing.
func (*fsEngine) ReenableUpdates(user User, tlfName string, t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.EnableUpdatesFileName),
		[]byte("on"), 0644)
}

// SyncFromServerForTesting is called by the test harness as the given
// user to actively retrieve new metadata for a folder.
func (e *fsEngine) SyncFromServerForTesting(user User, tlfName string, t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.SyncFromServerFileName),
		[]byte("x"), 0644)
}

// ForceQuotaReclamation implements the Engine interface.
func (*fsEngine) ForceQuotaReclamation(user User, tlfName string, t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.ReclaimQuotaFileName),
		[]byte("x"), 0644)
}

// AddNewAssertion implements the Engine interface.
func (e *fsEngine) AddNewAssertion(user User, oldAssertion, newAssertion string) error {
	u := user.(*fsUser)
	return libkbfs.AddNewAssertionForTest(u.config, oldAssertion, newAssertion)
}

// Rekey implements the Engine interface.
func (*fsEngine) Rekey(user User, tlfName string, t tlf.Type) error {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.RekeyFileName),
		[]byte("x"), 0644)
}

// EnableJournal is called by the test harness as the given user to
// enable journaling.
func (*fsEngine) EnableJournal(user User, tlfName string,
	t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.EnableJournalFileName),
		[]byte("on"), 0644)
}

// PauseJournal is called by the test harness as the given user to
// pause journaling.
func (*fsEngine) PauseJournal(user User, tlfName string,
	t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.PauseJournalBackgroundWorkFileName),
		[]byte("on"), 0644)
}

// ResumeJournal is called by the test harness as the given user to
// resume journaling.
func (*fsEngine) ResumeJournal(user User, tlfName string,
	t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.ResumeJournalBackgroundWorkFileName),
		[]byte("on"), 0644)
}

// FlushJournal is called by the test harness as the given user to
// wait for the journal to flush, if enabled.
func (*fsEngine) FlushJournal(user User, tlfName string,
	t tlf.Type) (err error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	return ioutil.WriteFile(
		filepath.Join(path, libfs.FlushJournalFileName),
		[]byte("on"), 0644)
}

// UnflushedPaths implements the Engine interface.
func (*fsEngine) UnflushedPaths(user User, tlfName string, t tlf.Type) (
	[]string, error) {
	u := user.(*fsUser)
	path := buildTlfPath(u, tlfName, t)
	buf, err := ioutil.ReadFile(filepath.Join(path, libfs.StatusFileName))
	if err != nil {
		return nil, err
	}

	var bufStatus libkbfs.FolderBranchStatus
	err = json.Unmarshal(buf, &bufStatus)
	if err != nil {
		return nil, err
	}

	return bufStatus.Journal.UnflushedPaths, nil
}

// TogglePrefetch implements the Engine interface.
func (*fsEngine) TogglePrefetch(user User, enable bool) error {
	u := user.(*fsUser)
	filename := libfs.DisableBlockPrefetchingFileName
	if enable {
		filename = libfs.EnableBlockPrefetchingFileName
	}
	return ioutil.WriteFile(
		filepath.Join(u.mntDir, filename),
		[]byte("1"), 0644)
}

// Shutdown is called by the test harness when it is done with the
// given user.
func (e *fsEngine) Shutdown(user User) error {
	u := user.(*fsUser)
	u.shutdown()

	// Get the user name before shutting everything down.
	var userName libkb.NormalizedUsername
	if e.journalDir != "" {
		session, err :=
			u.config.KBPKI().GetCurrentSession(context.Background())
		if err != nil {
			return err
		}
		userName = session.Name
	}

	ctx := context.Background()
	if err := u.config.Shutdown(ctx); err != nil {
		return err
	}

	if e.journalDir != "" {
		// Remove the user journal.
		if err := ioutil.RemoveAll(
			filepath.Join(e.journalDir, userName.String())); err != nil {
			return err
		}
		// Remove the overall journal dir if it's empty.
		if err := ioutil.Remove(e.journalDir); err != nil {
			e.tb.Logf("Journal dir %s not empty yet", e.journalDir)
		}
	}
	return nil
}

// CreateLink is called by the test harness to create a symlink in the given directory as
// the given user.
func (*fsEngine) CreateLink(u User, parentDir Node, fromName string, toPath string) (err error) {
	n := parentDir.(fsNode)
	return os.Symlink(toPath, filepath.Join(n.path, fromName))
}

// Lookup is called by the test harness to return a node in the given directory by
// its name for the given user. In the case of a symlink the symPath will be set and
// the node will be nil.
func (e *fsEngine) Lookup(u User, parentDir Node, name string) (file Node, symPath string, err error) {
	n := parentDir.(fsNode)
	path := filepath.Join(n.path, name)
	fi, err := ioutil.Lstat(path)
	if err != nil {
		return nil, "", err
	}
	// Return if not a symlink
	// TODO currently we pretend that Dokan has no symbolic links
	// here and end up deferencing them. This works but is not
	// ideal. (See GetRootDir.)
	if fi.Mode()&os.ModeSymlink == 0 || e.name == "dokan" {
		return fsNode{path}, "", nil
	}
	symPath, err = os.Readlink(path)
	if err != nil {
		return nil, "", err
	}
	return fsNode{path}, symPath, err
}

// SetEx is called by the test harness as the given user to set/unset the executable bit on the
// given file.
func (*fsEngine) SetEx(u User, file Node, ex bool) (err error) {
	n := file.(fsNode)
	var mode os.FileMode = 0644
	if ex {
		mode = 0755
	}
	return os.Chmod(n.path, mode)
}

// SetMtime is called by the test harness as the given user to set the
// mtime on the given file.
func (*fsEngine) SetMtime(u User, file Node, mtime time.Time) (err error) {
	n := file.(fsNode)
	// KBFS doesn't respect the atime, but we have to give it something
	atime := mtime
	return os.Chtimes(n.path, atime, mtime)
}

// GetMtime implements the Engine interface.
func (*fsEngine) GetMtime(u User, file Node) (mtime time.Time, err error) {
	n := file.(fsNode)
	fi, err := ioutil.Lstat(n.path)
	if err != nil {
		return time.Time{}, err
	}
	return fi.ModTime(), err
}

// SyncAll implements the Engine interface.
func (e *fsEngine) SyncAll(
	user User, tlfName string, t tlf.Type) (err error) {
	u := user.(*fsUser)
	ctx := context.Background()
	ctx, err = libkbfs.NewContextWithCancellationDelayer(
		libkbfs.NewContextReplayable(
			ctx, func(ctx context.Context) context.Context { return ctx }))
	if err != nil {
		return err
	}
	dir, err := getRootNode(ctx, u.config, tlfName, t)
	if err != nil {
		return err
	}
	// Sadly golang doesn't support syncing on a directory handle, so
	// we have to hack it by syncing directly with the KBFSOps
	// instance.  TODO: implement a `.kbfs_sync_all` file to be used
	// here, or maybe use a direct OS syscall?
	return u.config.KBFSOps().SyncAll(ctx, dir.GetFolderBranch())
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

func (e *fsEngine) InitTest(ver libkbfs.MetadataVer,
	blockSize int64, blockChangeSize int64, batchSize int, bwKBps int,
	opTimeout time.Duration, users []libkb.NormalizedUsername, teams teamMap,
	clock libkbfs.Clock, journal bool) map[libkb.NormalizedUsername]User {
	res := map[libkb.NormalizedUsername]User{}
	initSuccess := false
	defer func() {
		if !initSuccess {
			for _, user := range res {
				user.(*fsUser).shutdown()
			}
		}
	}()

	if int(opTimeout) > 0 {
		// TODO: wrap fs calls in our own timeout-able layer?
		e.tb.Log("Ignoring op timeout for FS test")
	}

	// create the first user specially
	config0 := libkbfs.MakeTestConfigOrBust(e.tb, users...)
	config0.SetMetadataVersion(ver)
	config0.SetClock(clock)

	setBlockSizes(e.tb, config0, blockSize, blockChangeSize)
	if batchSize > 0 {
		config0.SetBGFlushDirOpBatchSize(batchSize)
	}
	maybeSetBw(e.tb, config0, bwKBps)
	uids := make([]keybase1.UID, len(users))
	cfgs := make([]*libkbfs.ConfigLocal, len(users))
	cfgs[0] = config0
	uids[0] = nameToUID(e.tb, config0)
	for i, name := range users[1:] {
		c := libkbfs.ConfigAsUser(config0, name)
		setBlockSizes(e.tb, c, blockSize, blockChangeSize)
		if batchSize > 0 {
			c.SetBGFlushDirOpBatchSize(batchSize)
		}
		c.SetClock(clock)
		cfgs[i+1] = c
		uids[i+1] = nameToUID(e.tb, c)
	}

	for i, name := range users {
		res[name] = e.createUser(e.tb, i, cfgs[i], opTimeout)
	}

	if journal {
		jdir, err := ioutil.TempDir(os.TempDir(), "kbfs_journal")
		if err != nil {
			e.tb.Fatalf("Couldn't enable journaling: %v", err)
		}
		e.journalDir = jdir
		e.tb.Logf("Journal directory: %s", e.journalDir)
		for i, c := range cfgs {
			journalRoot := filepath.Join(jdir, users[i].String())
			_, err = c.EnableDiskLimiter(journalRoot)
			if err != nil {
				panic(fmt.Sprintf("No disk limiter for %d: %+v", i, err))
			}
			c.EnableJournaling(context.Background(),
				journalRoot, libkbfs.TLFJournalBackgroundWorkEnabled)
			jServer, err := libkbfs.GetJournalServer(c)
			if err != nil {
				panic(fmt.Sprintf("No journal server for %d: %+v", i, err))
			}
			err = jServer.DisableAuto(context.Background())
			if err != nil {
				panic(fmt.Sprintf("Couldn't disable journaling: %+v", err))
			}
		}
	}

	for _, c := range cfgs {
		makeTeams(e.tb, c, e, teams, res)
	}

	initSuccess = true
	return res
}

func nameToUID(t testing.TB, config libkbfs.Config) keybase1.UID {
	session, err := config.KBPKI().GetCurrentSession(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return session.UID
}
