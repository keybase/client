// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.
//
// +build !windows

package libfuse

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"bazil.org/fuse/fs/fstestutil"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
	"golang.org/x/sys/unix"
)

func makeFS(ctx context.Context, t testing.TB, config *libkbfs.ConfigLocal) (
	*fstestutil.Mount, *FS, func()) {
	log := logger.NewTestLogger(t)
	debugLog := log.CloneWithAddedDepth(1)
	fuse.Debug = MakeFuseDebugFn(debugLog, false /* superVerbose */)

	// TODO duplicates main() in kbfsfuse/main.go too much
	quLog := config.MakeLogger(libkbfs.QuotaUsageLogModule("FSTest"))
	filesys := &FS{
		config:        config,
		log:           log,
		vlog:          config.MakeVLogger(log),
		errLog:        log,
		errVlog:       config.MakeVLogger(log),
		notifications: libfs.NewFSNotifications(log),
		root:          NewRoot(),
		quotaUsage: libkbfs.NewEventuallyConsistentQuotaUsage(
			config, quLog, config.MakeVLogger(quLog)),
	}
	filesys.root.private = &FolderList{
		fs:      filesys,
		tlfType: tlf.Private,
		folders: make(map[string]*TLF),
	}
	filesys.root.public = &FolderList{
		fs:      filesys,
		tlfType: tlf.Public,
		folders: make(map[string]*TLF),
	}
	filesys.root.team = &FolderList{
		fs:      filesys,
		tlfType: tlf.SingleTeam,
		folders: make(map[string]*TLF),
	}
	filesys.execAfterDelay = func(d time.Duration, f func()) {
		time.AfterFunc(d, f)
	}
	fn := func(mnt *fstestutil.Mount) fs.FS {
		filesys.fuse = mnt.Server
		filesys.conn = mnt.Conn
		return filesys
	}
	options := GetPlatformSpecificMountOptionsForTest()
	mnt, err := fstestutil.MountedFuncT(t, fn, &fs.Config{
		WithContext: func(ctx context.Context, req fuse.Request) context.Context {
			return filesys.WithContext(ctx)
		},
	}, options...)
	if err != nil {
		t.Fatal(err)
	}
	// the cancelFn returned will cancel notification processing; the
	// FUSE serve loop is terminated by unmounting the filesystem
	ctx = context.WithValue(ctx, libfs.CtxAppIDKey, filesys)
	ctx, cancelFn := context.WithCancel(ctx)
	filesys.LaunchNotificationProcessor(ctx)
	return mnt, filesys, func() {
		cancelFn()
	}
}

type fileInfoCheck func(fi os.FileInfo) error

func mustBeFileWithSize(fi os.FileInfo, size int64) error {
	if fi.Size() != size {
		return fmt.Errorf("Bad file size: %d", fi.Size())
	}
	return nil
}

func mustBeDir(fi os.FileInfo) error {
	if !fi.IsDir() {
		return fmt.Errorf("not a directory: %v", fi)
	}
	return nil
}

func checkDirNoTestError(
	t testing.TB, dir string, want map[string]fileInfoCheck) error {
	// make a copy of want, to be safe
	{
		tmp := make(map[string]fileInfoCheck, len(want))
		for k, v := range want {
			tmp[k] = v
		}
		want = tmp
	}

	fis, err := ioutil.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, fi := range fis {
		if check, ok := want[fi.Name()]; ok {
			delete(want, fi.Name())
			if check != nil {
				if err := check(fi); err != nil {
					return fmt.Errorf("check failed: %v: %v", fi.Name(), err)
				}
			}
			continue
		}
		return fmt.Errorf("unexpected direntry: %q size=%v mode=%v",
			fi.Name(), fi.Size(), fi.Mode())
	}
	for filename := range want {
		return fmt.Errorf("never saw file: %v", filename)
	}
	return nil
}

func checkDir(t testing.TB, dir string, want map[string]fileInfoCheck) {
	err := checkDirNoTestError(t, dir, want)
	if err != nil {
		t.Error(err)
	}
}

// timeEqualFuzzy returns whether a is b+-skew.
func timeEqualFuzzy(a, b time.Time, skew time.Duration) bool {
	b1 := b.Add(-skew)
	b2 := b.Add(skew)
	return !a.Before(b1) && !a.After(b2)
}

func testCleanupDelayer(ctx context.Context, t *testing.T) {
	err := libcontext.CleanupCancellationDelayer(ctx)
	require.NoError(t, err)
}

func TestStatRoot(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(mnt.Dir)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `dr-x------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatPrivate(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `dr-x------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(path.Join(mnt.Dir, PublicName))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `dr-x------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatMyFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	// Access the tlf once to have the *Dir populated in tlf.go
	if err := ioutil.Mkdir(
		path.Join(mnt.Dir, PrivateName, "jdoe", "d"), os.ModeDir); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwx------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatNonexistentFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if _, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName, "does-not-exist")); !ioutil.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v", err)
	}
}

func TestStatAlias(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe,jdoe")
	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `Lrwxrwxrwx`; g != e {
		t.Errorf("wrong mode for alias : %q != %q", g, e)
	}
	target, err := os.Readlink(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := target, "jdoe"; g != e {
		t.Errorf("wrong alias symlink target: %q != %q", g, e)
	}
}

// Test that we can determine a normalized alias without any identify
// calls (regression test for KBFS-531).
func TestStatAliasCausesNoIdentifies(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PublicName, "HEAD")
	// Even though "head" is not a real user in our config, this stat
	// should succeed because no identify calls should be triggered.
	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `Lrwxrwxrwx`; g != e {
		t.Errorf("wrong mode for alias : %q != %q", g, e)
	}
	target, err := os.Readlink(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := target, "head"; g != e {
		t.Errorf("wrong alias symlink target: %q != %q", g, e)
	}
}

func TestStatInvalidAliasFails(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PublicName, "HEAD.JPG")
	// This should fail as HEAD.JPG has the wrong format.
	_, err := ioutil.Lstat(p)
	if err == nil {
		t.Fatal("Lstat of HEAD.JPG didn't return an error!")
	}
}

func TestRemoveAlias(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe,jdoe")
	err := ioutil.Remove(p)
	if err != nil {
		t.Fatalf("Removing alias failed: %v", err)
	}
}

func TestStatMyPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	// Access the tlf once to have the *Dir populated in tlf.go
	if err := ioutil.Mkdir(
		path.Join(mnt.Dir, PublicName, "jdoe", "d"), os.ModeDir); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(path.Join(mnt.Dir, PublicName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwx------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestReaddirRoot(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, mnt.Dir, map[string]fileInfoCheck{
		PrivateName: mustBeDir,
		PublicName:  mustBeDir,
		TeamName:    mustBeDir,
	})
}

func TestReaddirPrivate(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "janedoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", tlf.Private)
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", tlf.Public)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default home directory
	})
}

func TestReaddirPrivateDeleteAndReaddFavorite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "janedoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, fs, cancelFn := makeFS(ctx, t, config)
	fs.execAfterDelay = func(d time.Duration, f func()) {
		// this causes the entry added to fl.recentlyRemoved (in
		// addToRecentlyRemove) to be removed instantly. this way we can avoid
		// adding delays in tests.
		f()
	}
	defer mnt.Close()
	defer cancelFn()

	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", tlf.Private)
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", tlf.Public)
	}

	err := ioutil.Remove(path.Join(mnt.Dir, PrivateName, "jdoe,janedoe"))
	if err != nil {
		t.Fatalf("Removing favorite failed: %v", err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe": mustBeDir, // default home directory
	})

	// Re-add the favorite by doing a readdir
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe,janedoe"),
		map[string]fileInfoCheck{})

	checkDir(t, path.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default home directory
	})
}

func TestReaddirPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "janedoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", tlf.Private)
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", tlf.Public)
	}

	checkDir(t, path.Join(mnt.Dir, PublicName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default personal public directory
	})
}

type kbserviceBrokenIdentify struct {
	libkbfs.KeybaseService
}

func (k kbserviceBrokenIdentify) Identify(
	ctx context.Context, assertion, reason string,
	_ keybase1.OfflineAvailability) (
	kbname.NormalizedUsername, keybase1.UserOrTeamID, error) {
	return kbname.NormalizedUsername(""), keybase1.UserOrTeamID(""),
		errors.New("Fake identify error")
}

// Regression test for KBFS-772 on OSX.  (There's a bug where ls only
// respects errors from Open, not from ReadDirAll.)
func TestReaddirPublicFailedIdentifyViaOSCall(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "u1", "u2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "u2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, _, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	// Create a shared folder via u2.
	p := path.Join(mnt2.Dir, PrivateName, "u1,u2", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	// Make u1 get failures for every identify call.
	config1.SetKeybaseService(kbserviceBrokenIdentify{
		KeybaseService: config1.KeybaseService(),
	})

	// A private non-existing home folder, with write permissions, fails.
	err := exec.Command("ls", path.Join(mnt1.Dir, PublicName, "u1")).Run()
	if _, ok := err.(*exec.ExitError); !ok {
		t.Fatalf("No error as expected on broken user identify: %v", err)
	}

	// A private existing shared folder, with write permissions, fails.
	err = exec.Command("ls", path.Join(mnt1.Dir, PrivateName, "u1,u2")).Run()
	if _, ok := err.(*exec.ExitError); !ok {
		t.Fatalf("No error as expected on broken user identify: %v", err)
	}

	// A public, non-existing folder, without write permissions, fails.
	err = exec.Command("ls", path.Join(mnt1.Dir, PublicName, "u2")).Run()
	if _, ok := err.(*exec.ExitError); !ok {
		t.Fatalf("No error as expected on broken user identify: %v", err)
	}
}

func TestReaddirMyFolderEmpty(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})
}

func syncAll(t *testing.T, tlf string, ty tlf.Type, fs *FS) {
	// golang doesn't let us sync on a directory handle, so if we need
	// to sync all without a file, go through libkbfs directly.
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	root := libkbfs.GetRootNodeOrBust(ctx, t, fs.config, tlf, ty)
	err := fs.config.KBFSOps().SyncAll(ctx, root.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync all: %v", err)
	}
}

func syncAndClose(t *testing.T, f *os.File) {
	if f == nil {
		return
	}
	err := f.Sync()
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
}

func syncFilename(t *testing.T, name string) {
	f, err := os.OpenFile(name, os.O_WRONLY, 0644)
	if err != nil {
		t.Fatal(err)
	}
	syncAndClose(t, f)
}

func TestReaddirMyFolderWithFiles(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	files := map[string]fileInfoCheck{
		"one": nil,
		"two": nil,
	}
	for filename, check := range files {
		if check != nil {
			// only set up the files
			continue
		}
		p := path.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(
			p, []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), files)
}

func testOneCreateThenRead(t *testing.T, p string) {
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		t.Fatalf("write error: %v", err)
	}
	syncAndClose(t, f)
	f = nil

	buf, err := ioutil.ReadFile(p)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}
}

func TestCreateThenRead(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	testOneCreateThenRead(t, p)
}

// Tests that writing and reading multiple files works, implicitly
// exercising any block pointer reference counting code (since the
// initial created files will have identical empty blocks to start
// with).
func TestMultipleCreateThenRead(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile1")
	testOneCreateThenRead(t, p1)
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile2")
	testOneCreateThenRead(t, p2)
}

func TestReadUnflushed(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f)
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		t.Fatalf("write error: %v", err)
	}
	// explicitly no close here

	buf, err := ioutil.ReadFile(p)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}
}

func TestMountAgain(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	const input = "hello, world\n"
	const filename = "myfile"
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := path.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()
		p := path.Join(mnt.Dir, PrivateName, "jdoe", filename)
		buf, err := ioutil.ReadFile(p)
		if err != nil {
			t.Fatalf("read error: %v", err)
		}
		if g, e := string(buf), input; g != e {
			t.Errorf("bad file contents: %q != %q", g, e)
		}
	}()
}

func TestCreateExecutable(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte("fake binary"), 0755); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)
	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rwx------`; g != e {
		t.Errorf("wrong mode for executable: %q != %q", g, e)
	}
}

func TestMkdir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}
	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwx------`; g != e {
		t.Errorf("wrong mode for subdir: %q != %q", g, e)
	}
}

func TestMkdirAndCreateDeep(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	const input = "hello, world\n"

	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		one := path.Join(mnt.Dir, PrivateName, "jdoe", "one")
		if err := ioutil.Mkdir(one, 0755); err != nil {
			t.Fatal(err)
		}
		two := path.Join(one, "two")
		if err := ioutil.Mkdir(two, 0755); err != nil {
			t.Fatal(err)
		}
		three := path.Join(two, "three")
		if err := ioutil.WriteFile(three, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, three)
	}()

	// unmount to flush cache
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := path.Join(mnt.Dir, PrivateName, "jdoe", "one", "two", "three")
		buf, err := ioutil.ReadFile(p)
		if err != nil {
			t.Fatalf("read error: %v", err)
		}
		if g, e := string(buf), input; g != e {
			t.Errorf("bad file contents: %q != %q", g, e)
		}
	}()
}

func TestSymlink(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := path.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
		if err := os.Symlink("myfile", p); err != nil {
			t.Fatal(err)
		}
	}()

	// unmount to flush cache
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := path.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
		target, err := os.Readlink(p)
		if err != nil {
			t.Fatal(err)
		}
		if g, e := target, "myfile"; g != e {
			t.Errorf("bad symlink target: %q != %q", g, e)
		}
	}()
}

func TestRename(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input)))
		},
	})

	buf, err := ioutil.ReadFile(p2)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRenameOverwrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)
	if err := ioutil.WriteFile(p2, []byte("loser\n"), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p2)

	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": nil,
	})

	buf, err := ioutil.ReadFile(p2)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRenameCrossDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if err := ioutil.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := ioutil.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe", "one"), map[string]fileInfoCheck{})
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe", "two"), map[string]fileInfoCheck{
		"new": nil,
	})

	buf, err := ioutil.ReadFile(p2)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRenameCrossFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "wsmith,jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	err := ioutil.Rename(p1, p2)
	if err == nil {
		t.Fatalf("expected an error from rename: %v", err)
	}
	lerr, ok := errors.Cause(err).(*os.LinkError)
	if !ok {
		t.Fatalf("expected a LinkError from rename: %v", err)
	}
	if g, e := lerr.Op, "rename"; g != e {
		t.Errorf("wrong LinkError.Op: %q != %q", g, e)
	}
	if g, e := lerr.Old, p1; g != e {
		t.Errorf("wrong LinkError.Old: %q != %q", g, e)
	}
	if g, e := lerr.New, p2; g != e {
		t.Errorf("wrong LinkError.New: %q != %q", g, e)
	}
	if g, e := lerr.Err, syscall.EXDEV; g != e {
		t.Errorf("expected EXDEV: %T %v", lerr.Err, lerr.Err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"old": nil,
	})
	checkDir(t, path.Join(mnt.Dir, PrivateName, "wsmith,jdoe"), map[string]fileInfoCheck{})

	buf, err := ioutil.ReadFile(p1)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p2); !ioutil.IsNotExist(err) {
		t.Errorf("new name exists even on error: %v", err)
	}
}

func TestWriteThenRename(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "new")

	f, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	defer syncAndClose(t, f)

	// write to the file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}

	// now rename the file while it's still open
	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	// check that the new path has the right length still
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input)))
		},
	})

	// write again to the same file
	const input2 = "goodbye, world\n"
	if _, err := f.Write([]byte(input2)); err != nil {
		t.Fatalf("cannot write after rename: %v", err)
	}

	buf, err := ioutil.ReadFile(p2)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input+input2; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestWriteThenRenameCrossDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if err := ioutil.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := ioutil.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")

	f, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	defer syncAndClose(t, f)

	// write to the file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}

	// now rename the file while it's still open
	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	// check that the new path has the right length still
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe", "two"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input)))
		},
	})

	// write again to the same file
	const input2 = "goodbye, world\n"
	if _, err := f.Write([]byte(input2)); err != nil {
		t.Fatalf("cannot write after rename: %v", err)
	}

	buf, err := ioutil.ReadFile(p2)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input+input2; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRemoveFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	if err := ioutil.Remove(p); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveTLF(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "pikachu")
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	p := path.Join(mnt.Dir, PrivateName, "jdoe,pikachu")
	f1, err := os.Create(path.Join(p, "f"))
	if err != nil {
		t.Fatal(err)
	}
	syncAndClose(t, f1)

	privatePath := path.Join(mnt.Dir, PrivateName)
	checks := map[string]fileInfoCheck{
		"jdoe": nil,
	}

	var lastErr error
	for i := 0; i < 10; i++ {
		if err := syscall.Rmdir(p); err != nil {
			t.Fatal(err)
		}

		if runtime.GOOS != "darwin" {
			checkDir(t, privatePath, checks)
			return
		}

		// On OSX, the OS might decide to look up "f" at exactly the wrong
		// time, and reinstate the "jdoe,pikachu".  Unfortunately there's
		// no good way to prevent this, so for now we just allow it to
		// happen and retry until we get what we want.  See KBFS-1370.
		lastErr = checkDirNoTestError(t, privatePath, checks)
		if lastErr == nil {
			return
		}

		// Make sure the test should still be running.
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		default:
			t.Logf("Retrying TLF removal after error %+v", lastErr)
		}
	}
	if lastErr != nil {
		t.Error(lastErr)
	}
}

func TestRemoveDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	if err := syscall.Rmdir(p); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.Stat(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveDirNotEmpty(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}
	pFile := path.Join(p, "myfile")
	if err := ioutil.WriteFile(pFile, []byte("i'm important"), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, pFile)

	err := syscall.Rmdir(p)
	if g, e := err, syscall.ENOTEMPTY; g != e {
		t.Fatalf("wrong error from rmdir: %v (%T) != %v (%T)", g, g, e, e)
	}

	if _, err := ioutil.ReadFile(pFile); err != nil {
		t.Errorf("file was lost: %v", err)
	}
}

func TestRemoveFileWhileOpenSetEx(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	if err := ioutil.Remove(p); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}

	// this must not resurrect a deleted file
	if err := f.Chmod(0755); err != nil {
		t.Fatalf("cannot setex: %v", err)
	}

	// Make sure the mode sticks around even though the file was unlinked.
	fi, err := f.Stat()
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rwx------`; g != e {
		t.Errorf("wrong mode: %q != %q", g, e)
	}
	syncAndClose(t, f)
	f = nil

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"),
		map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenWritingInTLFRoot(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	if err := ioutil.Remove(p); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}

	// this must not resurrect a deleted file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}
	syncAndClose(t, f)
	f = nil

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenWritingInSubDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	dirPath := path.Join(mnt.Dir, PrivateName, "jdoe", "dir")
	if err := os.Mkdir(dirPath, 0700); err != nil {
		t.Fatal(err)
	}

	p := path.Join(dirPath, "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	if err := ioutil.Remove(p); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}

	// this must not resurrect a deleted file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}
	syncAndClose(t, f)
	f = nil

	checkDir(t, dirPath, map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRenameOverFileWhileOpenWritingInDifferentDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	dirPath := path.Join(mnt.Dir, PrivateName, "jdoe", "dir")
	if err := os.Mkdir(dirPath, 0700); err != nil {
		t.Fatal(err)
	}

	p1 := path.Join(dirPath, "myfile")
	f1, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	// Call in a closure since `f1` is overridden below.
	defer func() { syncAndClose(t, f1) }()

	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "mynewfile")
	f2, err := os.Create(p2)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	syncAndClose(t, f2)

	if err := os.Rename(p2, p1); err != nil {
		t.Fatalf("cannot move file: %v", err)
	}

	// this must not resurrect content in f2
	const input = "hello, world\n"
	if _, err := f1.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}
	syncAndClose(t, f1)
	f1 = nil

	checkDir(t, dirPath, map[string]fileInfoCheck{"myfile": nil})

	content, err := ioutil.ReadFile(p1)
	if err != nil {
		t.Fatal(err)
	}
	if len(content) > 0 {
		t.Errorf("write to overwritee resulted in content in overwriter")
	}
}

func TestRenameOverFileWhileOpenWritingInSameSubDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	dirPath := path.Join(mnt.Dir, PrivateName, "jdoe", "dir")
	if err := os.Mkdir(dirPath, 0700); err != nil {
		t.Fatal(err)
	}

	p1 := path.Join(dirPath, "myfile")
	f1, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	// Call in a closure since `f1` is overridden below.
	defer func() { syncAndClose(t, f1) }()

	p2 := path.Join(dirPath, "mynewfile")
	f2, err := os.Create(p2)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	syncAndClose(t, f2)

	if err := os.Rename(p2, p1); err != nil {
		t.Fatalf("cannot move file: %v", err)
	}

	// this must not resurrect content in f2
	const input = "hello, world\n"
	if _, err := f1.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}
	syncAndClose(t, f1)
	f1 = nil

	checkDir(t, dirPath, map[string]fileInfoCheck{"myfile": nil})

	content, err := ioutil.ReadFile(p1)
	if err != nil {
		t.Fatal(err)
	}
	if len(content) > 0 {
		t.Errorf("write to overwritee resulted in content in overwriter")
	}
}

func TestRemoveFileWhileOpenReading(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(p)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	if err := ioutil.Remove(p); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}

	buf, err := ioutil.ReadAll(f)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}

	syncAndClose(t, f)
	f = nil

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenReadingAcrossMounts(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	p1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	f, err := os.Open(p1)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	syncFolderToServer(t, "user1,user2", fs2)

	p2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.Remove(p2); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadAll(f)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}

	syncAndClose(t, f)
	f = nil

	checkDir(t, path.Join(mnt1.Dir, PrivateName, "user1,user2"),
		map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRenameOverFileWhileOpenReadingAcrossMounts(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	p1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	p1Other := path.Join(mnt1.Dir, PrivateName, "user1,user2", "other")
	const inputOther = "hello, other\n"
	if err := ioutil.WriteFile(p1Other, []byte(inputOther), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1Other)

	f, err := os.Open(p1)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	syncFolderToServer(t, "user1,user2", fs2)

	p2Other := path.Join(mnt2.Dir, PrivateName, "user1,user2", "other")
	p2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.Rename(p2Other, p2); err != nil {
		t.Fatalf("cannot rename file: %v", err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadAll(f)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}

	syncAndClose(t, f)
	f = nil

	checkDir(t, path.Join(mnt1.Dir, PrivateName, "user1,user2"),
		map[string]fileInfoCheck{
			"myfile": nil,
		})

	if _, err := ioutil.ReadFile(p1Other); !ioutil.IsNotExist(err) {
		t.Errorf("other file still exists: %v", err)
	}

	buf, err = ioutil.ReadFile(p1)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), inputOther; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}
}

func TestTruncateGrow(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	const newSize = 100
	if err := os.Truncate(p, newSize); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Size(), int64(newSize); g != e {
		t.Errorf("wrong size: %v != %v", g, e)
	}

	buf, err := ioutil.ReadFile(p)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input+strings.Repeat("\x00", newSize-len(input)); g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}
}

func TestTruncateShrink(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	const newSize = 4
	if err := os.Truncate(p, newSize); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Size(), int64(newSize); g != e {
		t.Errorf("wrong size: %v != %v", g, e)
	}

	buf, err := ioutil.ReadFile(p)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input[:newSize]; g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}
}

func TestChmodExec(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	if err := os.Chmod(p, 0744); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rwx------`; g != e {
		t.Errorf("wrong mode: %q != %q", g, e)
	}
}

func TestChmodNonExec(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0755); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	if err := os.Chmod(p, 0655); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rw-------`; g != e {
		t.Errorf("wrong mode: %q != %q", g, e)
	}
}

func TestChownFileIgnored(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0755); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	oldOwner := int(fi.Sys().(*syscall.Stat_t).Uid)

	if err := os.Chown(p, oldOwner+1, oldOwner+1); err != nil {
		t.Fatalf("Expecting the file chown to get swallowed silently, "+
			"but got: %v", err)
	}

	newFi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	newOwner := int(newFi.Sys().(*syscall.Stat_t).Uid)
	if oldOwner != newOwner {
		t.Fatalf("Owner changed unexpectedly to %d after a chown", newOwner)
	}
}

func TestChmodDirIgnored(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	if err := os.Chmod(p, 0655); err != nil {
		t.Fatalf("Expecting the dir chmod to get swallowed silently, "+
			"but got: %v", err)
	}
}

func TestChownDirIgnored(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	oldOwner := int(fi.Sys().(*syscall.Stat_t).Uid)

	if err := os.Chown(p, 1, 1); err != nil {
		t.Fatalf("Expecting the dir chown to get swallowed silently, "+
			"but got: %v", err)
	}

	newFi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	newOwner := int(newFi.Sys().(*syscall.Stat_t).Uid)
	if oldOwner != newOwner {
		t.Fatalf("Owner changed unexpectedly to %d after a chown", newOwner)
	}
}

func TestSetattrFileMtime(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.ModTime(), mtime; !libfs.TimeEqual(g, e) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}
}

func TestSetattrFileMtimeAfterWrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	const input2 = "second round of content"
	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config, "jdoe", tlf.Private)

		ops := config.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, jdoe.ChildName("myfile"))
		if err != nil {
			t.Fatal(err)
		}
		if err := ops.Write(ctx, myfile, []byte(input2), 0); err != nil {
			t.Fatal(err)
		}
		// Don't sync
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.ModTime(), mtime; !libfs.TimeEqual(g, e) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}
	syncFilename(t, p)
}

func TestSetattrFileMtimeNow(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	// cause mtime to be set to now
	if err := unix.Utimes(p, nil); err != nil {
		t.Fatalf("touch failed: %v", err)
	}
	now := time.Now()

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, o := fi.ModTime(), mtime; !g.After(o) {
		t.Errorf("mtime did not progress: %v <= %v", g, o)
	}
	if g, e := fi.ModTime(), now; !timeEqualFuzzy(g, e, 1*time.Second) {
		t.Errorf("mtime is wrong: %v !~= %v", g, e)
	}
}

func TestSetattrDirMtime(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.ModTime(), mtime; !libfs.TimeEqual(g, e) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}
}

func TestSetattrDirMtimeNow(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	// cause mtime to be set to now
	if err := unix.Utimes(p, nil); err != nil {
		t.Fatalf("touch failed: %v", err)
	}
	now := time.Now()

	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, o := fi.ModTime(), mtime; !g.After(o) {
		t.Errorf("mtime did not progress: %v <= %v", g, o)
	}
	if g, e := fi.ModTime(), now; !timeEqualFuzzy(g, e, 1*time.Second) {
		t.Errorf("mtime is wrong: %v !~= %v", g, e)
	}
}

func TestFsync(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		t.Fatalf("write error: %v", err)
	}
	if err := f.Sync(); err != nil {
		t.Fatalf("fsync error: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("close error: %v", err)
	}
	f = nil
}

func TestReaddirMyPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	files := map[string]fileInfoCheck{
		"one": nil,
		"two": nil,
	}
	for filename := range files {
		p := path.Join(mnt.Dir, PublicName, "jdoe", filename)
		if err := ioutil.WriteFile(
			p, []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}

	checkDir(t, path.Join(mnt.Dir, PublicName, "jdoe"), files)
}

func TestReaddirOtherFolderAsReader(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := path.Join(mnt.Dir, PrivateName, "jdoe#wsmith", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe#wsmith"), map[string]fileInfoCheck{
		"myfile": nil,
	})
}

func TestReaddirMissingOtherFolderAsReader(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	// Check that folder that doesn't exist yet looks empty
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe#wsmith"),
		map[string]fileInfoCheck{})
}

func TestLookupMissingOtherFolderAsReader(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	p := path.Join(mnt.Dir, PrivateName, "jdoe#wsmith", "foo")
	if _, err := ioutil.Stat(p); !ioutil.IsNotExist(err) {
		t.Errorf("Expected ENOENT, but got: %v", err)
	}
}

func TestStatOtherFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestStatOtherFolderFirstUse(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	// This triggers a different error than with the warmup.
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestStatOtherFolderPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := path.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(path.Join(mnt.Dir, PublicName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	// TODO figure out right modes, note owner is the person running
	// fuse, not the person owning the folder
	if g, e := fi.Mode().String(), `dr-x------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestReadPublicFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	const input = "hello, world\n"
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := path.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	buf, err := ioutil.ReadFile(path.Join(mnt.Dir, PublicName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}
}

func TestReaddirOtherFolderPublicAsAnyone(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := path.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, path.Join(mnt.Dir, PublicName, "jdoe"), map[string]fileInfoCheck{
		"myfile": nil,
	})
}

func TestReaddirMissingFolderPublicAsAnyone(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	// Make sure a public folder, not yet created by its writer, looks empty.
	checkDir(t, path.Join(mnt.Dir, PublicName, "jdoe"),
		map[string]fileInfoCheck{})
}

func TestReaddirOtherFolderAsAnyone(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.ReadDir(path.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func syncFolderToServerHelper(t *testing.T, tlf string, ty tlf.Type, fs *FS) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	root := libkbfs.GetRootNodeOrBust(ctx, t, fs.config, tlf, ty)
	err := fs.config.KBFSOps().SyncFromServer(ctx,
		root.GetFolderBranch(), nil)
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	fs.NotificationGroupWait()
}

func syncFolderToServer(t *testing.T, name string, fs *FS) {
	syncFolderToServerHelper(t, name, tlf.Private, fs)
}

func syncPublicFolderToServer(t *testing.T, name string, fs *FS) {
	syncFolderToServerHelper(t, name, tlf.Public, fs)
}

func TestInvalidateDataOnWrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	config2 := libkbfs.ConfigAsUser(config, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	p := path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	f, err := os.Open(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input1; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}

	const input2 = "second round of content"
	if err := ioutil.WriteFile(p, []byte(input2), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input2; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}
}

func TestInvalidatePublicDataOnWrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	config2 := libkbfs.ConfigAsUser(config, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	p := path.Join(mnt1.Dir, PublicName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncPublicFolderToServer(t, "jdoe", fs2)

	f, err := os.Open(path.Join(mnt2.Dir, PublicName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input1; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}

	const input2 = "second round of content"
	if err := ioutil.WriteFile(p, []byte(input2), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncPublicFolderToServer(t, "jdoe", fs2)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input2; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}
}

func TestInvalidateDataOnTruncate(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	config2 := libkbfs.ConfigAsUser(config, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	p := path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	f, err := os.Open(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input1; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}

	const newSize = 3
	if err := os.Truncate(p, newSize); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input1[:newSize]; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}
}

func TestInvalidateDataOnLocalWrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, fs, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if !mnt.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(path.Join(mnt.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input1; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}

	const input2 = "second round of content"
	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config, "jdoe", tlf.Private)
		ops := config.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, jdoe.ChildName("myfile"))
		if err != nil {
			t.Fatal(err)
		}
		if err := ops.Write(ctx, myfile, []byte(input2), 0); err != nil {
			t.Fatal(err)
		}
	}

	// The Write above is a local change, and thus we can just do a
	// local wait without syncing to the server.
	fs.NotificationGroupWait()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input2; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}
}

func TestInvalidateEntryOnDelete(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	p := path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	buf, err := ioutil.ReadFile(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	if err := ioutil.Remove(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")); err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "jdoe", fs2)

	if buf, err := ioutil.ReadFile(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile")); !ioutil.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}
}

func testForErrorText(t *testing.T, path string, expectedErr error,
	fileType string) {
	buf, err := ioutil.ReadFile(path)
	if err != nil {
		t.Fatalf("Bad error reading %s error file: %v", path, err)
	}

	var errors []libfs.JSONReportedError
	err = json.Unmarshal(buf, &errors)
	if err != nil {
		t.Fatalf("Couldn't unmarshal error file: %v. Full contents: %s",
			err, string(buf))
	}

	found := false
	for _, e := range errors {
		if e.Error == expectedErr.Error() {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("%s error file did not contain the error %s. "+
			"Full contents: %s", fileType, expectedErr, buf)
	}
}

func TestErrorFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	config.SetReporter(libkbfs.NewReporterSimple(config.Clock(), 0))
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	// cause an error by stating a non-existent user
	_, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName, "janedoe"))
	if err == nil {
		t.Fatal("Stat of non-existent user worked!")
	}

	// Make sure the root error file reads as expected
	expectedErr := fuse.ENOENT

	// test both the root error file and one in a directory
	testForErrorText(t, path.Join(mnt.Dir, libkbfs.ErrorFile),
		expectedErr, "root")
	testForErrorText(t, path.Join(mnt.Dir, PublicName, libkbfs.ErrorFile),
		expectedErr, "root")
	testForErrorText(t, path.Join(mnt.Dir, PrivateName, libkbfs.ErrorFile),
		expectedErr, "root")
	testForErrorText(t, path.Join(mnt.Dir, PublicName, "jdoe", libkbfs.ErrorFile),
		expectedErr, "dir")
	testForErrorText(t, path.Join(mnt.Dir, PrivateName, "jdoe", libkbfs.ErrorFile),
		expectedErr, "dir")
}

func TestInvalidateAcrossMounts(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mydira1 := path.Join(mydir1, "a")
	if err := ioutil.WriteFile(mydira1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, mydira1)

	syncFolderToServer(t, "user1,user2", fs2)

	myfile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	buf, err := ioutil.ReadFile(myfile2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	mydir2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir")
	mydira2 := path.Join(mydir2, "a")
	buf, err = ioutil.ReadFile(mydira2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	// now remove the first file, and rename the second
	if err := ioutil.Remove(myfile1); err != nil {
		t.Fatal(err)
	}
	mydirb1 := path.Join(mydir1, "b")
	if err := ioutil.Rename(mydira1, mydirb1); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	syncFolderToServer(t, "user1,user2", fs2)

	// check everything from user 2's perspective
	if buf, err := ioutil.ReadFile(myfile2); !ioutil.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}
	if buf, err := ioutil.ReadFile(mydira2); !ioutil.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}

	checkDir(t, mydir2, map[string]fileInfoCheck{
		"b": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
	})

	mydirb2 := path.Join(mydir2, "b")
	buf, err = ioutil.ReadFile(mydirb2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestInvalidateAppendAcrossMounts(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	syncFolderToServer(t, "user1,user2", fs2)
	myfile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	buf, err := ioutil.ReadFile(myfile2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	// user 1 append using libkbfs, to ensure that it doesn't flush
	// the whole page.
	const input2 = "input round two"
	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config1, "user1,user2", tlf.Private)

		ops := config1.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, jdoe.ChildName("myfile"))
		if err != nil {
			t.Fatal(err)
		}
		if err := ops.Write(
			ctx, myfile, []byte(input2), int64(len(input1))); err != nil {
			t.Fatal(err)
		}
		if err := ops.SyncAll(ctx, myfile.GetFolderBranch()); err != nil {
			t.Fatal(err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs2)

	// check everything from user 2's perspective
	buf, err = ioutil.ReadFile(myfile2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1+input2; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestInvalidateRenameToUncachedDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mydirfile1 := path.Join(mydir1, "myfile")

	syncFolderToServer(t, "user1,user2", fs2)
	myfile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	f, err := os.OpenFile(myfile2, os.O_RDWR, 0644)
	if err != nil {
		t.Fatal(err)
	}
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil && err != io.EOF {
			t.Fatal(err)
		}
		if g, e := string(buf[:n]), input1; g != e {
			t.Errorf("wrong content: %q != %q", g, e)
		}
	}

	// now rename the second into a directory that user 2 hasn't seen
	if err := ioutil.Rename(myfile1, mydirfile1); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	syncFolderToServer(t, "user1,user2", fs2)

	// user 2 should be able to write to its open file, and user 1
	// will see the change
	const input2 = "input round two"
	{
		n, err := f.WriteAt([]byte(input2), 0)
		if err != nil || n != len(input2) {
			t.Fatal(err)
		}
	}
	syncAndClose(t, f)
	f = nil

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadFile(mydirfile1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestStatusFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	libfs.AddRootWrapper(config)

	jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config, "jdoe", tlf.Public)
	mydir := path.Join(mnt.Dir, PublicName, "jdoe", "mydir")
	err := ioutil.Mkdir(mydir, 0755)
	require.NoError(t, err)

	ops := config.KBFSOps()
	status, _, err := ops.FolderStatus(ctx, jdoe.GetFolderBranch())
	require.NoError(t, err)

	checkStatus := func(dir string) {
		// Simply make sure the status in the file matches what we'd
		// expect.  Checking the exact content should be left for tests
		// within libkbfs.
		buf, err := ioutil.ReadFile(path.Join(dir, libfs.StatusFileName))
		require.NoError(t, err)

		var bufStatus libkbfs.FolderBranchStatus
		err = json.Unmarshal(buf, &bufStatus)
		require.NoError(t, err)

		// Use a fuzzy check on the timestamps, since it could include
		// monotonic clock stuff.
		require.True(t, timeEqualFuzzy(
			status.LocalTimestamp, bufStatus.LocalTimestamp, time.Millisecond))
		status.LocalTimestamp = bufStatus.LocalTimestamp

		// It's safe to compare the path slices with DeepEqual since
		// they will all be null for this test (nothing is dirtied).
		require.True(t, reflect.DeepEqual(status, bufStatus))
	}
	checkStatus(path.Join(mnt.Dir, PublicName, "jdoe"))
	checkStatus(mydir)
}

// TODO: remove once we have automatic conflict resolution tests
func TestUnstageFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	// both users read the root dir first
	myroot1 := path.Join(mnt1.Dir, PrivateName, "user1,user2")
	myroot2 := path.Join(mnt2.Dir, PrivateName, "user1,user2")
	checkDir(t, myroot1, map[string]fileInfoCheck{})
	checkDir(t, myroot2, map[string]fileInfoCheck{})

	// turn updates off for user 2
	rootNode2 := libkbfs.GetRootNodeOrBust(ctx, t, config2, "user1,user2", tlf.Private)
	_, err := libkbfs.DisableUpdatesForTesting(config2,
		rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't pause user 2 updates")
	}
	err = libkbfs.DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't disable user 2 CR")
	}

	// user1 writes a file and makes a few directories
	const input1 = "input round one"
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mysubdir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir",
		"mysubdir")
	if err := ioutil.Mkdir(mysubdir1, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	// user2 does similar
	const input2 = "input round two"
	myfile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile2, []byte(input2), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile2)
	mydir2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir2, 0755); err != nil {
		t.Fatal(err)
	}
	myothersubdir2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir",
		"myothersubdir")
	if err := ioutil.Mkdir(myothersubdir2, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

	// verify that they don't see each other's files
	checkDir(t, mydir1, map[string]fileInfoCheck{
		"mysubdir": mustBeDir,
	})
	checkDir(t, mydir2, map[string]fileInfoCheck{
		"myothersubdir": mustBeDir,
	})

	// now unstage user 2 and they should see the same stuff
	unstageFile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.UnstageFileName)
	if err := ioutil.WriteFile(unstageFile2, []byte{1}, 0222); err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "user1,user2", fs2)

	// They should see identical folders now
	checkDir(t, mydir1, map[string]fileInfoCheck{
		"mysubdir": mustBeDir,
	})
	checkDir(t, mydir2, map[string]fileInfoCheck{
		"mysubdir": mustBeDir,
	})

	buf, err := ioutil.ReadFile(myfile1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	buf, err = ioutil.ReadFile(myfile2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestSimpleCRNoConflict(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	root1 := path.Join(mnt1.Dir, PrivateName, "user1,user2")
	root2 := path.Join(mnt2.Dir, PrivateName, "user1,user2")
	// Please create TLF here first
	d1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "D")
	d2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "E")
	if err := ioutil.Mkdir(d1, 0755); err != nil {
		t.Fatal("Mkdir failed")
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)
	syncFolderToServer(t, "user1,user2", fs2)
	if err := ioutil.Mkdir(d2, 0755); err != nil {
		t.Fatal("Mkdir failed")
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)
	syncFolderToServer(t, "user1,user2", fs1)

	// disable updates for user 2
	disableUpdatesFile := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.DisableUpdatesFileName)
	if err := ioutil.WriteFile(disableUpdatesFile,
		[]byte("off"), 0644); err != nil {
		t.Fatal(err)
	}

	// user1 writes a file and makes a few directories
	const input1 = "input round one"
	file1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "file1")
	if err := ioutil.WriteFile(file1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, file1)
	dir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "dir")
	if err := ioutil.Mkdir(dir1, 0755); err != nil {
		t.Fatal(err)
	}
	subdir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "dir", "subdir1")
	if err := ioutil.Mkdir(subdir1, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	// user2 does similar
	const input2 = "input round two two two"
	file2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "file2")
	if err := ioutil.WriteFile(file2, []byte(input2), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, file2)
	dir2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "dir")
	if err := ioutil.Mkdir(dir2, 0755); err != nil {
		t.Fatal(err)
	}
	subdir2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "dir", "subdir2")
	if err := ioutil.Mkdir(subdir2, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

	// verify that they don't see each other's files
	checkDir(t, root1, map[string]fileInfoCheck{
		"file1": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"dir": mustBeDir,
		"D":   mustBeDir,
		"E":   mustBeDir,
	})
	checkDir(t, dir1, map[string]fileInfoCheck{
		"subdir1": mustBeDir,
	})
	checkDir(t, root2, map[string]fileInfoCheck{
		"file2": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
		"dir": mustBeDir,
		"D":   mustBeDir,
		"E":   mustBeDir,
	})
	checkDir(t, dir2, map[string]fileInfoCheck{
		"subdir2": mustBeDir,
	})

	// now re-enable user 2 updates and CR, and the merge should happen
	enableUpdatesFile := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.EnableUpdatesFileName)
	if err := ioutil.WriteFile(enableUpdatesFile,
		[]byte("on"), 0644); err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "user1,user2", fs2)
	syncFolderToServer(t, "user1,user2", fs1)

	// They should see identical folders now (conflict-free merge)
	checkDir(t, root1, map[string]fileInfoCheck{
		"file1": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"file2": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
		"dir": mustBeDir,
		"D":   mustBeDir,
		"E":   mustBeDir,
	})
	checkDir(t, dir1, map[string]fileInfoCheck{
		"subdir1": mustBeDir,
		"subdir2": mustBeDir,
	})
	checkDir(t, root2, map[string]fileInfoCheck{
		"file1": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"file2": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
		"dir": mustBeDir,
		"D":   mustBeDir,
		"E":   mustBeDir,
	})
	checkDir(t, dir2, map[string]fileInfoCheck{
		"subdir1": mustBeDir,
		"subdir2": mustBeDir,
	})

	buf, err := ioutil.ReadFile(file1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	file2u1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "file2")
	buf, err = ioutil.ReadFile(file2u1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	file1u2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "file1")
	buf, err = ioutil.ReadFile(file1u2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	buf, err = ioutil.ReadFile(file2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestSimpleCRConflictOnOpenFiles(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	now := time.Now()
	var clock clocktest.TestClock
	clock.Set(now)
	config2.SetClock(&clock)

	root1 := path.Join(mnt1.Dir, PrivateName, "user1,user2")
	root2 := path.Join(mnt2.Dir, PrivateName, "user1,user2")

	// both users should mutate the dir first
	d1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "D")
	d2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "E")
	if err := ioutil.Mkdir(d1, 0755); err != nil {
		t.Fatal("Mkdir failed")
	}
	syncFolderToServer(t, "user1,user2", fs2)
	if err := ioutil.Mkdir(d2, 0755); err != nil {
		t.Fatal("Mkdir failed")
	}
	syncFolderToServer(t, "user1,user2", fs1)

	// disable updates for user 2
	disableUpdatesFile := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.DisableUpdatesFileName)
	if err := ioutil.WriteFile(disableUpdatesFile,
		[]byte("off"), 0644); err != nil {
		t.Fatal(err)
	}

	// user1 creates and writes a file
	file1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "f")
	f1, err := os.Create(file1)
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f1)

	const input1 = "hello"
	{
		n, err := f1.WriteAt([]byte(input1), 0)
		if err != nil || n != len(input1) {
			t.Fatal(err)
		}
		if err := f1.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	// user2 creates and writes a file
	file2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "f")
	f2, err := os.Create(file2)
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f2)

	const input2 = "ohell"
	{
		n, err := f2.WriteAt([]byte(input2), 0)
		if err != nil || n != len(input2) {
			t.Fatal(err)
		}
		if err := f2.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	// now re-enable user 2 updates and CR, and the merge should happen
	enableUpdatesFile := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.EnableUpdatesFileName)
	if err := ioutil.WriteFile(enableUpdatesFile,
		[]byte("on"), 0644); err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "user1,user2", fs2)
	syncFolderToServer(t, "user1,user2", fs1)

	// They should both be able to read their past writes.
	{
		buf := make([]byte, len(input1))
		n, err := f1.ReadAt(buf, 0)
		if err != nil || n != len(input1) {
			t.Fatal(err)
		}
		if g, e := string(buf), input1; g != e {
			t.Errorf("Unexpected read on f2: %s vs %s", g, e)
		}
	}
	{
		buf := make([]byte, len(input2))
		n, err := f2.ReadAt(buf, 0)
		if err != nil || n != len(input2) {
			t.Fatal(err)
		}
		if g, e := string(buf), input2; g != e {
			t.Errorf("Unexpected read on f2: %s vs %s", g, e)
		}
	}

	// They should see the conflict.
	cre := libkbfs.WriterDeviceDateConflictRenamer{}
	checkDir(t, root1, map[string]fileInfoCheck{
		"f": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		cre.ConflictRenameHelper(now, "user2", "dev1", "f"): func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
		"D": mustBeDir,
		"E": mustBeDir,
	})
	checkDir(t, root2, map[string]fileInfoCheck{
		"f": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		cre.ConflictRenameHelper(now, "user2", "dev1", "f"): func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
		"D": mustBeDir,
		"E": mustBeDir,
	})

	input3 := " world"
	{
		n, err := f1.WriteAt([]byte(input3), int64(len(input1)))
		if err != nil || n != len(input3) {
			t.Fatal(err)
		}
		if err := f1.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs2)

	input4 := " dlrow"
	{
		n, err := f2.WriteAt([]byte(input4), int64(len(input2)))
		if err != nil || n != len(input4) {
			t.Fatal(err)
		}
		if err := f2.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadFile(file1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1+input3; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	buf, err = ioutil.ReadFile(file2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1+input3; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	filec1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", cre.ConflictRenameHelper(now, "user2", "dev1", "f"))
	filec2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", cre.ConflictRenameHelper(now, "user2", "dev1", "f"))
	buf, err = ioutil.ReadFile(filec1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2+input4; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	buf, err = ioutil.ReadFile(filec2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2+input4; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestSimpleCRConflictOnOpenMergedFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	now := time.Now()
	var clock clocktest.TestClock
	clock.Set(now)
	config2.SetClock(&clock)

	root1 := path.Join(mnt1.Dir, PrivateName, "user1,user2")
	root2 := path.Join(mnt2.Dir, PrivateName, "user1,user2")
	// both users should mutate the dir first
	d1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "D")
	d2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "E")
	if err := ioutil.Mkdir(d1, 0755); err != nil {
		t.Fatal("Mkdir failed")
	}
	syncFolderToServer(t, "user1,user2", fs2)
	if err := ioutil.Mkdir(d2, 0755); err != nil {
		t.Fatal("Mkdir failed")
	}
	syncFolderToServer(t, "user1,user2", fs1)

	// disable updates for user 2
	disableUpdatesFile := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.DisableUpdatesFileName)
	if err := ioutil.WriteFile(disableUpdatesFile,
		[]byte("off"), 0644); err != nil {
		t.Fatal(err)
	}

	// user1 creates and writes a file
	file1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "f")
	f1, err := os.Create(file1)
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f1)

	const input1 = "hello"
	{
		n, err := f1.WriteAt([]byte(input1), 0)
		if err != nil || n != len(input1) {
			t.Fatal(err)
		}
		if err := f1.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	// user2 creates a directory and writes a file to it
	dir2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "f")
	if err := ioutil.Mkdir(dir2, 0755); err != nil {
		t.Fatal(err)
	}
	file2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "f", "foo")
	f2, err := os.Create(file2)
	if err != nil {
		t.Fatal(err)
	}
	defer syncAndClose(t, f2)

	const input2 = "ohell"
	{
		n, err := f2.WriteAt([]byte(input2), 0)
		if err != nil || n != len(input2) {
			t.Fatal(err)
		}
		if err := f2.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	// now re-enable user 2 updates and CR, and the merge should happen
	enableUpdatesFile := path.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.EnableUpdatesFileName)
	if err := ioutil.WriteFile(enableUpdatesFile,
		[]byte("on"), 0644); err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "user1,user2", fs2)
	syncFolderToServer(t, "user1,user2", fs1)

	// They should both be able to read their past writes.
	{
		buf := make([]byte, len(input1))
		n, err := f1.ReadAt(buf, 0)
		if err != nil || n != len(input1) {
			t.Fatal(err)
		}
		if g, e := string(buf), input1; g != e {
			t.Errorf("Unexpected read on f2: %s vs %s", g, e)
		}
	}
	{
		buf := make([]byte, len(input2))
		n, err := f2.ReadAt(buf, 0)
		if err != nil || n != len(input2) {
			t.Fatal(err)
		}
		if g, e := string(buf), input2; g != e {
			t.Errorf("Unexpected read on f2: %s vs %s", g, e)
		}
	}

	// They should see the conflict.
	cre := libkbfs.WriterDeviceDateConflictRenamer{}
	fcr := cre.ConflictRenameHelper(now, "user1", "dev1", "f")
	checkDir(t, root1, map[string]fileInfoCheck{
		fcr: func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"f": mustBeDir,
		"D": mustBeDir,
		"E": mustBeDir,
	})
	checkDir(t, root2, map[string]fileInfoCheck{
		fcr: func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"f": mustBeDir,
		"D": mustBeDir,
		"E": mustBeDir,
	})

	input3 := " world"
	{
		n, err := f1.WriteAt([]byte(input3), int64(len(input1)))
		if err != nil || n != len(input3) {
			t.Fatal(err)
		}
		if err := f1.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs2)

	input4 := " dlrow"
	{
		n, err := f2.WriteAt([]byte(input4), int64(len(input2)))
		if err != nil || n != len(input4) {
			t.Fatal(err)
		}
		if err := f2.Sync(); err != nil {
			t.Fatal(err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs1)

	file2u1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "f", "foo")
	buf, err := ioutil.ReadFile(file2u1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2+input4; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	buf, err = ioutil.ReadFile(file2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2+input4; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	filec1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", fcr)
	filec2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", fcr)
	buf, err = ioutil.ReadFile(filec1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1+input3; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
	buf, err = ioutil.ReadFile(filec2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1+input3; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestKbfsFileInfo(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	mnt1, _, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)

	// Turn off the prefetcher to avoid races when reading the file info file.
	ch := config2.BlockOps().TogglePrefetcher(false)
	select {
	case <-ch:
	case <-ctx.Done():
		t.Fatal(ctx.Err())
	}

	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte("foo"), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	syncFolderToServer(t, "user1,user2", fs2)
	fi2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir", libfs.FileInfoPrefix+"myfile")
	bs, err := ioutil.ReadFile(fi2)
	if err != nil {
		t.Fatal(err)
	}
	var dst libkbfs.NodeMetadata
	err = json.Unmarshal(bs, &dst)
	if err != nil {
		t.Fatal(err)
	}
	if dst.LastWriterUnverified != kbname.NormalizedUsername("user1") {
		t.Fatalf("Expected user1, %v raw %X", dst, bs)
	}
}

func TestDirSyncAll(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	mnt1, _, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFS(ctx, t, config2)
	defer mnt2.Close()
	defer cancelFn2()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)

	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir", "myfile")
	data := []byte("foo")
	if err := ioutil.WriteFile(myfile1, data, 0644); err != nil {
		t.Fatal(err)
	}

	d, err := os.Open(mydir1)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	err = d.Sync()
	if err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "user1,user2", fs2)
	myfile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir", "myfile")
	gotData, err := ioutil.ReadFile(myfile2)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data, gotData) {
		t.Fatalf("Expected=%v, got=%v", data, gotData)
	}
}

// Regression test for KBFS-2853.
func TestInodes(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte("fake binary"), 0755); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	getInode := func(p string) uint64 {
		fi, err := ioutil.Lstat(p)
		if err != nil {
			t.Fatal(err)
		}
		stat, ok := fi.Sys().(*syscall.Stat_t)
		if !ok {
			t.Fatalf("Not a syscall.Stat_t")
		}
		return stat.Ino
	}
	inode := getInode(p)

	t.Log("Rename file and make sure inode hasn't changed.")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile2")
	if err := ioutil.Rename(p, p2); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p2)

	inode2 := getInode(p2)
	if inode != inode2 {
		t.Fatalf("Inode changed after rename: %d vs %d", inode, inode2)
	}

	t.Log("A new file with the previous name should get a new inode")

	if err := ioutil.WriteFile(p, []byte("more fake data"), 0755); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	inode3 := getInode(p)
	if inode == inode3 {
		t.Fatal("New and old files have the same inode")
	}
}

func TestHardLinkNotSupported(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	checkLinkErr := func(old, new string, checkPermErr bool) {
		err := os.Link(old, new)
		linkErr, ok := errors.Cause(err).(*os.LinkError)
		require.True(t, ok)
		if checkPermErr && runtime.GOOS == "darwin" {
			// On macOS, in directories without the write bit set like
			// /keybase and /keybase/private, the `Link` call gets an
			// `EPERM` error back from the `Access()` Fuse request,
			// and never even tries calling `Link()`.
			require.Equal(t, syscall.EPERM, linkErr.Err)
		} else {
			require.Equal(t, syscall.ENOTSUP, linkErr.Err)
		}
	}

	t.Log("Test hardlink in root of TLF")
	old := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	err := ioutil.WriteFile(old, []byte("hello"), 0755)
	require.NoError(t, err)
	syncFilename(t, old)
	new := path.Join(mnt.Dir, PrivateName, "jdoe", "hardlink")
	checkLinkErr(old, new, false)

	t.Log("Test hardlink in subdir of TLF")
	mydir := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	err = ioutil.Mkdir(mydir, 0755)
	require.NoError(t, err)
	old2 := path.Join(mydir, "myfile")
	err = ioutil.WriteFile(old2, []byte("hello"), 0755)
	require.NoError(t, err)
	syncFilename(t, old2)
	new2 := path.Join(mydir, "hardlink")
	checkLinkErr(old2, new2, false)

	t.Log("Test hardlink in folder list")
	old3 := path.Join(mnt.Dir, PrivateName, ".kbfs_status")
	new3 := path.Join(mnt.Dir, PrivateName, "hardlink")
	checkLinkErr(old3, new3, true)

	t.Log("Test hardlink in root")
	old4 := path.Join(mnt.Dir, ".kbfs_status")
	new4 := path.Join(mnt.Dir, "hardlink")
	checkLinkErr(old4, new4, true)
}

func TestOpenFileCount(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	p := path.Join(mnt.Dir, libfs.OpenFileCountFileName)
	checkCount := func(expected int64) {
		f, err := os.Open(p)
		require.NoError(t, err)
		defer f.Close()

		b, err := ioutil.ReadAll(f)
		require.NoError(t, err)

		i, err := strconv.ParseInt(string(b), 10, 64)
		require.NoError(t, err)
		require.Equal(t, expected, i)
	}

	checkCount(0)

	_, err := ioutil.Lstat(path.Join(mnt.Dir, PrivateName))
	require.NoError(t, err)
	checkCount(1)

	_, err = ioutil.Lstat(path.Join(mnt.Dir, PublicName))
	require.NoError(t, err)
	checkCount(2)

	_, err = ioutil.Lstat(path.Join(mnt.Dir, PrivateName))
	require.NoError(t, err)
	checkCount(2)

	err = ioutil.Mkdir(
		path.Join(mnt.Dir, PrivateName, "jdoe", "d"), os.ModeDir)
	require.NoError(t, err)
	checkCount(4)
}

func TestUpdateHistoryFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	libfs.AddRootWrapper(config)

	t.Log("Make several revisions")
	p := path.Join(mnt.Dir, PrivateName, "jdoe")
	for i := 0; i < 10; i++ {
		file := path.Join(p, fmt.Sprintf("foo-%d", i))
		f, err := os.Create(file)
		require.NoError(t, err)
		syncAndClose(t, f)
	}

	t.Log("Read a revision range")
	histPrefix := path.Join(p, libfs.UpdateHistoryFileName)
	fRange, err := os.Open(histPrefix + ".3-5")
	require.NoError(t, err)
	defer fRange.Close()
	b, err := ioutil.ReadAll(fRange)
	require.NoError(t, err)
	var histRange libkbfs.TLFUpdateHistory
	err = json.Unmarshal(b, &histRange)
	require.NoError(t, err)
	require.Len(t, histRange.Updates, 3)

	t.Log("Read a single revision")
	fSingle, err := os.Open(histPrefix + ".7")
	require.NoError(t, err)
	defer fSingle.Close()
	b, err = ioutil.ReadAll(fSingle)
	require.NoError(t, err)
	var histSingle libkbfs.TLFUpdateHistory
	err = json.Unmarshal(b, &histSingle)
	require.NoError(t, err)
	require.Len(t, histSingle.Updates, 1)

	t.Log("Read the entire history")
	fAll, err := os.Open(histPrefix)
	require.NoError(t, err)
	defer fAll.Close()
	b, err = ioutil.ReadAll(fAll)
	require.NoError(t, err)
	var histAll libkbfs.TLFUpdateHistory
	err = json.Unmarshal(b, &histAll)
	require.NoError(t, err)
	require.Len(t, histAll.Updates, 11)
}
