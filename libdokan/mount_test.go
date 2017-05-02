// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build windows

package libdokan

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/ioutil"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

type compatMount struct {
	*dokan.MountHandle
}

func (c *compatMount) Close() {
	c.MountHandle.Close()
	getDriveLetterLock(c.Dir[0]).Unlock()
}

var driveLetterLocks ['Z' - 'A']sync.Mutex

func getDriveLetterLock(driveLetter byte) *sync.Mutex {
	if driveLetter >= 'a' && driveLetter <= 'z' {
		driveLetter -= 'a' - 'A'
	}
	if driveLetter >= 'A' && driveLetter <= 'Z' {
		return &driveLetterLocks[driveLetter-'A']
	}
	return nil
}

func makeFS(t testing.TB, ctx context.Context, config *libkbfs.ConfigLocal) (*compatMount, *FS, func()) {
	return makeFSE(t, ctx, config, 'T')
}

func makeFSE(t testing.TB, ctx context.Context, config *libkbfs.ConfigLocal,
	driveLetter byte) (*compatMount, *FS, func()) {
	makeSuccess := false
	lock := getDriveLetterLock(driveLetter)
	lock.Lock()
	defer func() {
		if !makeSuccess {
			lock.Unlock()
		}
	}()

	ctx, cancelFn := context.WithCancel(ctx)
	filesys, err := NewFS(ctx, config, logger.NewTestLogger(t))
	if err != nil {
		t.Fatalf("NewFS failed: %q", err.Error())
	}

	mnt, err := dokan.Mount(&dokan.Config{
		FileSystem: filesys,
		Path:       string([]byte{driveLetter, ':', '\\'}),
		MountFlags: DefaultMountFlags,
	})
	if err != nil {
		t.Fatal(err)
	}
	// Caller will unlock lock via cm.Close().
	cm := &compatMount{MountHandle: mnt}
	makeSuccess = true
	return cm, filesys, func() {
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

func checkDir(t testing.TB, dir string, want map[string]fileInfoCheck) {
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
					t.Errorf("check failed: %v: %v", fi.Name(), err)
				}
			}
			continue
		}
		t.Errorf("unexpected direntry: %q size=%v mode=%v", fi.Name(), fi.Size(), fi.Mode())
	}
	for filename := range want {
		t.Errorf("never saw file: %v", filename)
	}
}

// timeEqualFuzzy returns whether a is b+-skew.
func timeEqualFuzzy(a, b time.Time, skew time.Duration) bool {
	b1 := b.Add(-skew)
	b2 := b.Add(skew)
	return !a.Before(b1) && !a.After(b2)
}

func TestStatRoot(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(mnt.Dir)
	if err != nil {
		t.Fatal(err)
	}
	if !fi.IsDir() {
		t.Errorf("root.IsDir fails")
	}
}

func TestStatPrivate(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName))
	if err != nil {
		t.Fatal(err)
	}
	if !fi.IsDir() {
		t.Errorf("IsDir failed for folder: %v", fi)
	}
}

func TestStatPublic(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PublicName))
	if err != nil {
		t.Fatal(err)
	}
	if !fi.IsDir() {
		t.Errorf("IsDir failed for folder: %v", fi)
	}
}

func TestStatMyFolder(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if !fi.IsDir() {
		t.Errorf("IsDir failed for folder: %v", fi)
	}
}

func TestStatNonexistentFolder(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	if _, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "does-not-exist")); !ioutil.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v", err)
	}
}

func TestStatAlias(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe,jdoe")
	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `dLrwxrwxrwx`; g != e {
		t.Errorf("wrong mode for alias : %q != %q", g, e)
	}
	// TODO Readlink support.
	/*
		target, err := os.Readlink(p)
		if err != nil {
			t.Fatal(err)
		}
		if g, e := target, "jdoe"; g != e {
			t.Errorf("wrong alias symlink target: %q != %q", g, e)
		}
	*/
}

func TestStatMyPublic(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PublicName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if !fi.IsDir() {
		t.Errorf("IsDir failed for folder: %v", fi)
	}
}

func TestReaddirRoot(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, mnt.Dir, map[string]fileInfoCheck{
		PrivateName: mustBeDir,
		PublicName:  mustBeDir,
	})
}

func TestReaddirPrivate(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "janedoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	{
		ctx := libkbfs.BackgroundContextWithCancellationDelayer()
		defer libkbfs.CleanupCancellationDelayer(ctx)
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", false)
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", true)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default home directory
	})
}

func TestReaddirPublic(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "janedoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	{
		ctx := libkbfs.BackgroundContextWithCancellationDelayer()
		defer libkbfs.CleanupCancellationDelayer(ctx)
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", false)
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", true)
	}

	checkDir(t, filepath.Join(mnt.Dir, PublicName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default personal public directory
	})
}

func TestReaddirMyFolderEmpty(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})
}

func syncAll(t *testing.T, tlf string, public bool, fs *FS) {
	// golang doesn't let us sync on a directory handle, so if we need
	// to sync all without a file, go through libkbfs directly.
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	root := libkbfs.GetRootNodeOrBust(ctx, t, fs.config, tlf, public)
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
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
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(
			p, []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), files)
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	testOneCreateThenRead(t, p)
}

// Tests that writing and reading multiple files works, implicitly
// exercising any block pointer reference counting code (since the
// initial created files will have identical empty blocks to start
// with).
func TestMultipleCreateThenRead(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile1")
	testOneCreateThenRead(t, p1)
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile2")
	testOneCreateThenRead(t, p2)
}

func TestReadUnflushed(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	const input = "hello, world\n"
	const filename = "myfile"
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
		buf, err := ioutil.ReadFile(p)
		if err != nil {
			t.Fatalf("read error: %v", err)
		}
		if g, e := string(buf), input; g != e {
			t.Errorf("bad file contents: %q != %q", g, e)
		}
	}()
}

func TestMkdir(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}
	fi, err := ioutil.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwxrwxrwx`; g != e {
		t.Errorf("wrong mode for subdir: %q != %q", g, e)
	}
}

func TestMkdirNewFolder(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	for _, q := range []string{"New Folder", "New folder"} {
		p := filepath.Join(mnt.Dir, PrivateName, q)
		fi, err := ioutil.Lstat(p)
		if err == nil {
			t.Fatal("Non-existent new folder existed!")
		}
		if err = ioutil.Mkdir(p, 0755); err != nil {
			t.Fatal(err)
		}
		fi, err = ioutil.Lstat(p)
		if err != nil {
			t.Fatal(err)
		}
		if g, err := fi.Mode().String(), `drwxrwxrwx`; g != err {
			t.Errorf("wrong mode for subdir: %q != %q", g, err)
		}
	}
}

func TestMkdirAndCreateDeep(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	const input = "hello, world\n"

	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		one := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one")
		if err := ioutil.Mkdir(one, 0755); err != nil {
			t.Fatal(err)
		}
		two := filepath.Join(one, "two")
		if err := ioutil.Mkdir(two, 0755); err != nil {
			t.Fatal(err)
		}
		three := filepath.Join(two, "three")
		if err := ioutil.WriteFile(three, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, three)
	}()

	// unmount to flush cache
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one", "two", "three")
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	t.Skip("Symlink creation not supported on Windows - TODO!")
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
		if err := os.Symlink("myfile", p); err != nil {
			t.Fatal(err)
		}
	}()

	// unmount to flush cache
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)
	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "new")
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

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	if err := ioutil.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe", "one"), map[string]fileInfoCheck{})
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), map[string]fileInfoCheck{
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "wsmith,jdoe", "new")
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

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"old": nil,
	})
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "wsmith,jdoe"), map[string]fileInfoCheck{})

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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "new")

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
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")

	f, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	// Call in a closure since `f` is overridden below.
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
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), map[string]fileInfoCheck{
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	if err := ioutil.Remove(p); err != nil {
		t.Fatal(err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}

}

func TestRemoveDir(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	if err := syscall.Rmdir(p); err != nil {
		t.Fatal(err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.Stat(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}

}

func TestRemoveDirNotEmpty(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}
	pFile := filepath.Join(p, "myfile")
	if err := ioutil.WriteFile(pFile, []byte("i'm important"), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, pFile)

	err := syscall.Rmdir(p)
	if err == nil {
		t.Fatalf("no error from rmdir")
	}

	if _, err := ioutil.ReadFile(pFile); err != nil {
		t.Errorf("file was lost: %v", err)
	}

}

func TestRemoveFileWhileOpenWriting(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}

}

func TestRemoveFileWhileOpenReading(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(p)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	defer f.Close()

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

	if err := f.Close(); err != nil {
		t.Fatalf("error on close: %v", err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}

}

func TestRemoveFileWhileOpenReadingAcrossMounts(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer config1.Shutdown(ctx)
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer config2.Shutdown(ctx)
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	p1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	f, err := os.Open(p1)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	defer f.Close()

	p2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.Remove(p2); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}
	syncAll(t, "user1,user2", false, fs2)

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadAll(f)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}

	if err := f.Close(); err != nil {
		t.Fatalf("error on close: %v", err)
	}

	checkDir(t, filepath.Join(mnt1.Dir, PrivateName, "user1,user2"),
		map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p1); !ioutil.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRenameOverFileWhileOpenReadingAcrossMounts(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer config1.Shutdown(ctx)
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer config2.Shutdown(ctx)
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	p1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1)

	p1Other := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "other")
	const inputOther = "hello, other\n"
	if err := ioutil.WriteFile(p1Other, []byte(inputOther), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p1Other)

	f, err := os.Open(p1)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	defer f.Close()

	p2Other := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "other")
	p2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.Rename(p2Other, p2); err != nil {
		t.Fatalf("cannot rename file: %v", err)
	}
	syncAll(t, "user1,user2", false, fs2)

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadAll(f)
	if err != nil {
		t.Fatalf("cannot read unlinked file: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("read wrong content: %q != %q", g, e)
	}

	if err := f.Close(); err != nil {
		t.Fatalf("error on close: %v", err)
	}

	checkDir(t, filepath.Join(mnt1.Dir, PrivateName, "user1,user2"),
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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

func TestSetattrFileMtime(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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
	// Fuzzy because the conversion between various time formats is lossy.
	if g, e := fi.ModTime(), mtime; !timeEqualFuzzy(g, e, time.Millisecond) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}

}

func TestSetattrFileMtimeNow(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
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
	// Fuzzy because the conversion between various time formats is lossy.
	if g, e := fi.ModTime(), mtime; !timeEqualFuzzy(g, e, time.Millisecond) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}

}

func TestSetattrDirMtimeNow(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
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

	// TODO setmtime to now, no Utimes on Windows.
	/*
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

	*/
}

func TestFsync(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
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

func TestReaddirPrivateDeleteAndReaddFavorite(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "janedoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	{
		ctx := libkbfs.BackgroundContextWithCancellationDelayer()
		defer libkbfs.CleanupCancellationDelayer(ctx)
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", false)
		libkbfs.GetRootNodeOrBust(ctx, t, config, "janedoe,jdoe", true)
	}

	err := ioutil.Remove(filepath.Join(mnt.Dir, PrivateName, "jdoe,janedoe"))
	if err != nil {
		t.Fatalf("Removing favorite failed: %v", err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe": mustBeDir, // default home directory
	})

	// Re-add the favorite by doing a readdir
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe,janedoe"),
		map[string]fileInfoCheck{})

	checkDir(t, filepath.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default home directory
	})
}

func TestReaddirMyPublic(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	files := map[string]fileInfoCheck{
		"one": nil,
		"two": nil,
	}
	for filename := range files {
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", filename)
		if err := ioutil.WriteFile(
			p, []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}

	checkDir(t, filepath.Join(mnt.Dir, PublicName, "jdoe"), files)
}

func TestReaddirOtherFolderAsReader(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe#wsmith", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFS(t, ctx, c2)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe#wsmith"), map[string]fileInfoCheck{
		"myfile": nil,
	})
}

func TestStatOtherFolder(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFSE(t, ctx, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}

}

func TestStatOtherFolderFirstUse(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	// This triggers a different error than with the warmup.
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFSE(t, ctx, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}

}

func TestStatOtherFolderPublic(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFSE(t, ctx, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PublicName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	// TODO figure out right modes, note owner is the person running
	// fuse, not the person owning the folder
	if g, e := fi.Mode().String(), `drwxrwxrwx`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}

}

func TestReadPublicFile(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	const input = "hello, world\n"
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFSE(t, ctx, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	buf, err := ioutil.ReadFile(filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

}

func TestReaddirOtherFolderPublicAsAnyone(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFSE(t, ctx, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, filepath.Join(mnt.Dir, PublicName, "jdoe"), map[string]fileInfoCheck{
		"myfile": nil,
	})

}

func TestReaddirOtherFolderAsAnyone(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	func() {
		mnt, _, cancelFn := makeFS(t, ctx, config)
		defer mnt.Close()
		defer cancelFn()

		// cause the folder to exist
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown(ctx)
	mnt, _, cancelFn := makeFSE(t, ctx, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.ReadDir(filepath.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}

}

func syncFolderToServerHelper(t *testing.T, tlf string, public bool, fs *FS) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	root := libkbfs.GetRootNodeOrBust(ctx, t, fs.config, tlf, public)
	err := fs.config.KBFSOps().SyncFromServerForTesting(ctx, root.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
}

func syncFolderToServer(t *testing.T, tlf string, fs *FS) {
	syncFolderToServerHelper(t, tlf, false, fs)
}

func syncPublicFolderToServer(t *testing.T, tlf string, fs *FS) {
	syncFolderToServerHelper(t, tlf, true, fs)
}

func TestInvalidateDataOnWrite(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(t, ctx, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PublicName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(filepath.Join(mnt2.Dir, PublicName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(t, ctx, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	const input1 = "input round one"
	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	f, err := os.Open(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

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
	defer syncFilename(t, p)
	{
		ctx := libkbfs.BackgroundContextWithCancellationDelayer()
		defer libkbfs.CleanupCancellationDelayer(ctx)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config, "jdoe", false)

		ops := config.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, "myfile")
		if err != nil {
			t.Fatal(err)
		}
		if err := ops.Write(ctx, myfile, []byte(input2), 0); err != nil {
			t.Fatal(err)
		}
	}

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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(t, ctx, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, p)

	buf, err := ioutil.ReadFile(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	if err := ioutil.Remove(filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")); err != nil {
		t.Fatal(err)
	}

	syncFolderToServer(t, "jdoe", fs2)

	if buf, err := ioutil.ReadFile(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile")); !ioutil.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}

}

func testForErrorText(t *testing.T, path string, expectedErr error,
	fileType string) {
	buf, err := ioutil.ReadFile(path)
	if err != nil {
		t.Fatalf("Bad error reading %s error file: %v", err, fileType)
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	t.Skip("Non-existent users are allowed on windows.")
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	config.SetReporter(libkbfs.NewReporterSimple(config.Clock(), 0))
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	// cause an error by stating a non-existent user
	_, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "janedoe"))
	if err == nil {
		t.Fatal("Stat of non-existent user worked!")
	}

	// Make sure the root error file reads as expected
	expectedErr := libkbfs.NoSuchUserError{Input: "janedoe"}

	// test both the root error file and one in a directory
	testForErrorText(t, filepath.Join(mnt.Dir, libkbfs.ErrorFile),
		expectedErr, "root")
	testForErrorText(t, filepath.Join(mnt.Dir, PublicName, libkbfs.ErrorFile),
		expectedErr, "root")
	testForErrorText(t, filepath.Join(mnt.Dir, PrivateName, libkbfs.ErrorFile),
		expectedErr, "root")
	testForErrorText(t, filepath.Join(mnt.Dir, PublicName, "jdoe", libkbfs.ErrorFile),
		expectedErr, "dir")
	testForErrorText(t, filepath.Join(mnt.Dir, PrivateName, "jdoe", libkbfs.ErrorFile),
		expectedErr, "dir")

}

type testMountObserver struct {
	c chan<- struct{}
}

func (t *testMountObserver) LocalChange(ctx context.Context, node libkbfs.Node,
	write libkbfs.WriteRange) {
	// ignore
}

func (t *testMountObserver) BatchChanges(ctx context.Context,
	changes []libkbfs.NodeChange) {
	t.c <- struct{}{}
}

func (t *testMountObserver) TlfHandleChange(ctx context.Context,
	newHandle *libkbfs.TlfHandle) {
	return
}

func TestInvalidateAcrossMounts(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, _, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mydira1 := filepath.Join(mydir1, "a")
	if err := ioutil.WriteFile(mydira1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, mydira1)

	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	buf, err := ioutil.ReadFile(myfile2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	mydir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir")
	mydira2 := filepath.Join(mydir2, "a")
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
	mydirb1 := filepath.Join(mydir1, "b")
	if err := ioutil.Rename(mydira1, mydirb1); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", false, fs1)

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

	mydirb2 := filepath.Join(mydir2, "b")
	buf, err = ioutil.ReadFile(mydirb2)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestInvalidateAppendAcrossMounts(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, _, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
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
		ctx := libkbfs.BackgroundContextWithCancellationDelayer()
		defer libkbfs.CleanupCancellationDelayer(ctx)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config1, "user1,user2", false)

		ops := config1.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, "myfile")
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mydirfile1 := filepath.Join(mydir1, "myfile")

	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
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
	syncAll(t, "user1,user2", false, fs1)

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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(t, ctx, config)
	defer mnt.Close()
	defer cancelFn()

	jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config, "jdoe", true)

	ops := config.KBFSOps()
	status, _, err := ops.FolderStatus(ctx, jdoe.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't get KBFS status: %v", err)
	}

	// Simply make sure the status in the file matches what we'd
	// expect.  Checking the exact content should be left for tests
	// within libkbfs.
	buf, err := ioutil.ReadFile(filepath.Join(mnt.Dir, PublicName, "jdoe",
		libfs.StatusFileName))
	if err != nil {
		t.Fatalf("Couldn't read KBFS status file: %v", err)
	}

	var bufStatus libkbfs.FolderBranchStatus
	json.Unmarshal(buf, &bufStatus)

	// It's safe to compare the path slices with DeepEqual since they
	// will all be null for this test (nothing is dirtied).
	if !reflect.DeepEqual(status, bufStatus) {
		t.Fatalf("Status file contents (%s) didn't match expected status %v",
			buf, status)
	}

}

// TODO: remove once we have automatic conflict resolution tests
func TestUnstageFile(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, _, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// both users read the root dir first
	myroot1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2")
	myroot2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2")
	checkDir(t, myroot1, map[string]fileInfoCheck{})
	checkDir(t, myroot2, map[string]fileInfoCheck{})

	// turn updates off for user 2
	rootNode2 := libkbfs.GetRootNodeOrBust(ctx, t, config2, "user1,user2", false)
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
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mysubdir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir",
		"mysubdir")
	if err := ioutil.Mkdir(mysubdir1, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", false, fs1)

	// user2 does similar
	const input2 = "input round two"
	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile2, []byte(input2), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile2)
	mydir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir2, 0755); err != nil {
		t.Fatal(err)
	}
	myothersubdir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir",
		"myothersubdir")
	if err := ioutil.Mkdir(myothersubdir2, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", false, fs2)

	// verify that they don't see each other's files
	checkDir(t, mydir1, map[string]fileInfoCheck{
		"mysubdir": mustBeDir,
	})
	checkDir(t, mydir2, map[string]fileInfoCheck{
		"myothersubdir": mustBeDir,
	})

	// now unstage user 2 and they should see the same stuff
	unstageFile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// both users read the root dir first
	root1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2")
	root2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2")
	checkDir(t, root1, map[string]fileInfoCheck{})
	checkDir(t, root2, map[string]fileInfoCheck{})

	// disable updates for user 2
	disableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.DisableUpdatesFileName)
	if err := ioutil.WriteFile(disableUpdatesFile,
		[]byte("off"), 0644); err != nil {
		t.Fatal(err)
	}

	// user1 writes a file and makes a few directories
	const input1 = "input round one"
	file1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "file1")
	if err := ioutil.WriteFile(file1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, file1)
	dir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "dir")
	if err := ioutil.Mkdir(dir1, 0755); err != nil {
		t.Fatal(err)
	}
	subdir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "dir", "subdir1")
	if err := ioutil.Mkdir(subdir1, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", false, fs1)

	// user2 does similar
	const input2 = "input round two two two"
	file2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "file2")
	if err := ioutil.WriteFile(file2, []byte(input2), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, file2)
	dir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "dir")
	if err := ioutil.Mkdir(dir2, 0755); err != nil {
		t.Fatal(err)
	}
	subdir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "dir", "subdir2")
	if err := ioutil.Mkdir(subdir2, 0755); err != nil {
		t.Fatal(err)
	}
	syncAll(t, "user1,user2", false, fs2)

	// verify that they don't see each other's files
	checkDir(t, root1, map[string]fileInfoCheck{
		"file1": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"dir": mustBeDir,
	})
	checkDir(t, dir1, map[string]fileInfoCheck{
		"subdir1": mustBeDir,
	})

	checkDir(t, root2, map[string]fileInfoCheck{
		"file2": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
		"dir": mustBeDir,
	})
	checkDir(t, dir2, map[string]fileInfoCheck{
		"subdir2": mustBeDir,
	})

	// now re-enable user 2 updates and CR, and the merge should happen
	enableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
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
	file2u1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "file2")
	buf, err = ioutil.ReadFile(file2u1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	file1u2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "file1")
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
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	now := time.Now()
	var clock libkbfs.TestClock
	clock.Set(now)
	config2.SetClock(&clock)

	// both users read the root dir first
	root1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2")
	root2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2")
	checkDir(t, root1, map[string]fileInfoCheck{})
	checkDir(t, root2, map[string]fileInfoCheck{})

	// disable updates for user 2
	disableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.DisableUpdatesFileName)
	if err := ioutil.WriteFile(disableUpdatesFile,
		[]byte("off"), 0644); err != nil {
		t.Fatal(err)
	}

	// user1 creates and writes a file
	file1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "f")
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
	file2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "f")
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
	enableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
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
	})
	checkDir(t, root2, map[string]fileInfoCheck{
		"f": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		cre.ConflictRenameHelper(now, "user2", "dev1", "f"): func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input2)))
		},
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

	// TODO: timestamps without ':', see KBFS-516
	/*
		filec1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2",
			"f.conflict.user2."+nowString)
		filec2 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2",
			"f.conflict.user2."+nowString)

		buf, err = ioutil.ReadFile(filec1)
		if err != nil {
			t.Fatal(err)
		}
		t.Fatal("END END END")
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
	*/
}

func TestSimpleCRConflictOnOpenMergedFile(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	now := time.Now()
	var clock libkbfs.TestClock
	clock.Set(now)
	config2.SetClock(&clock)

	// both users read the root dir first
	root1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2")
	root2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2")
	checkDir(t, root1, map[string]fileInfoCheck{})
	checkDir(t, root2, map[string]fileInfoCheck{})

	// disable updates for user 2
	disableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.DisableUpdatesFileName)
	if err := ioutil.WriteFile(disableUpdatesFile,
		[]byte("off"), 0644); err != nil {
		t.Fatal(err)
	}

	// user1 creates and writes a file
	file1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "f")
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
	dir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "f")
	if err := ioutil.Mkdir(dir2, 0755); err != nil {
		t.Fatal(err)
	}
	file2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "f", "foo")
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
	enableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
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
		cre.ConflictRenameHelper(now, "user1", "dev1", "f"): func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"f": mustBeDir,
	})
	checkDir(t, root2, map[string]fileInfoCheck{
		cre.ConflictRenameHelper(now, "user1", "dev1", "f"): func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
		"f": mustBeDir,
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

	file2u1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "f", "foo")
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

	// TODO: timestamps without ':', see KBFS-516
	/*
		filec1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2",
			"f.conflict.user1."+nowString)
		filec2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
			"f.conflict.user1."+nowString)
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
	*/
}

func TestKbfsFileInfo(t *testing.T) {
	ctx := libkbfs.BackgroundContextWithCancellationDelayer()
	defer libkbfs.CleanupCancellationDelayer(ctx)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(t, ctx, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, _, cancelFn2 := makeFSE(t, ctx, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte("foo"), 0644); err != nil {
		t.Fatal(err)
	}
	syncFilename(t, myfile1)
	syncFolderToServer(t, "user1,user2", fs1)
	fi2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir", libfs.FileInfoPrefix+"myfile")
	bs, err := ioutil.ReadFile(fi2)
	if err != nil {
		t.Fatal(err)
	}
	var dst libkbfs.NodeMetadata
	err = json.Unmarshal(bs, &dst)
	if err != nil {
		t.Fatal(err)
	}
	if dst.LastWriterUnverified != libkb.NormalizedUsername("user1") {
		t.Fatalf("Expected user1, %v raw %X", dst, bs)
	}
}
