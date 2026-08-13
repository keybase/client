// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

//go:build windows

package libdokan

import (
	"context"
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

	"github.com/keybase/client/go/kbfs/dokan"
	"github.com/keybase/client/go/kbfs/ioutil"
	"github.com/keybase/client/go/kbfs/libcontext"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/logger"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
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

func makeFS(ctx context.Context, t testing.TB, config *libkbfs.ConfigLocal) (
	*compatMount, *FS, func(),
) {
	return makeFSE(ctx, t, config, 'T')
}

func makeFSE(ctx context.Context, t testing.TB, config *libkbfs.ConfigLocal,
	driveLetter byte,
) (*compatMount, *FS, func()) {
	makeSuccess := false
	lock := getDriveLetterLock(driveLetter)
	lock.Lock()
	defer func() {
		if !makeSuccess {
			lock.Unlock()
		} else {
			time.Sleep(5 * time.Second)
		}
	}()

	ctx, cancelFn := context.WithCancel(ctx)
	filesys, err := NewFS(ctx, config, logger.NewTestLogger(t))
	require.NoError(t, err,
		"NewFS failed: %q", err.Error())

	mnt, err := dokan.Mount(&dokan.Config{
		FileSystem: filesys,
		Path:       string([]byte{driveLetter, ':', '\\'}),
		MountFlags: DefaultMountFlags,
	})
	require.NoError(t, err)
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
	require.NoError(t, err)
	for _, fi := range fis {
		if check, ok := want[fi.Name()]; ok {
			delete(want, fi.Name())
			if check != nil {
				err := check(fi)
	require.NoError(t, err, "check failed: %v: %v", fi.Name(), err)
			}
			continue
		}
		require.Fail(t, "unexpected direntry: %q size=%v mode=%v", fi.Name(), fi.Size(), fi.Mode())
	}
	for filename := range want {
		require.Fail(t, "never saw file: %v", filename)
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
	require.NoError(t, err)
	require.True(t, fi.IsDir(), "root.IsDir fails")
}

func TestStatPrivate(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName))
	require.NoError(t, err)
	require.True(t, fi.IsDir(), "IsDir failed for folder: %v", fi)
}

func TestStatPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PublicName))
	require.NoError(t, err)
	require.True(t, fi.IsDir(), "IsDir failed for folder: %v", fi)
}

func TestStatMyFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "jdoe"))
	require.NoError(t, err)
	require.True(t, fi.IsDir(), "IsDir failed for folder: %v", fi)
}

func TestStatNonexistentFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if _, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "does-not-exist")); !ioutil.IsNotExist(err) {
		require.True(t, ioutil.IsNotExist(err),
			"expected ENOENT: %v", err)
	}
}

func TestStatAlias(t *testing.T) {
	t.Skip()
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe,jdoe")
	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	// FIXME go 1.12 changed symlink detection in ways that don't work with Dokan.
	g := fi.Mode().String()
	require.True(t, g == `Lrw-rw-rw-` || g == `drwxrwxrwx`, "wrong mode for alias : %q", g)
	// TODO Readlink support.
	/*
		target, err := os.Readlink(p)
		if err != nil {
			require.FailNow(t, err)
		}
		e, g := target, "jdoe"
	require.Equal(t, e, g, "wrong alias symlink target: %q != %q", g, e)
	*/
}

func TestStatMyPublic(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PublicName, "jdoe"))
	require.NoError(t, err)
	require.True(t, fi.IsDir(), "IsDir failed for folder: %v", fi)
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

	checkDir(t, filepath.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
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

	checkDir(t, filepath.Join(mnt.Dir, PublicName), map[string]fileInfoCheck{
		"jdoe,janedoe": mustBeDir,
		"jdoe":         mustBeDir, // default personal public directory
	})
}

func TestReaddirMyFolderEmpty(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})
}

func syncAll(t *testing.T, tlf string, ty tlf.Type, fs *FS) {
	// golang doesn't let us sync on a directory handle, so if we need
	// to sync all without a file, go through libkbfs directly.
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	root := libkbfs.GetRootNodeOrBust(ctx, t, fs.config, tlf, ty)
	err := fs.config.KBFSOps().SyncAll(ctx, root.GetFolderBranch())
	require.NoError(t, err,
		"Couldn't sync all: %v", err)
}

func syncAndClose(t *testing.T, f *os.File) {
	if f == nil {
		return
	}
	err := f.Sync()
	require.NoError(t, err)
	f.Close()
}

func syncFilename(t *testing.T, name string) {
	f, err := os.OpenFile(name, os.O_WRONLY, 0o644)
	require.NoError(t, err)
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
		"one":       nil,
		"two":       nil,
		"foo‰5cbar": nil,
	}
	for filename, check := range files {
		if check != nil {
			// only set up the files
			continue
		}
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(
			p, []byte("data for "+filename), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), files)
}

func TestReaddirMyFolderWithSpecialCharactersInFileName(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	windowsFilename := "foo‰5cbar"
	kbfsFilename := `foo\bar`

	// Create through dokan and check through dokan.
	{
		files := map[string]fileInfoCheck{
			windowsFilename: nil,
		}
		for filename, check := range files {
			if check != nil {
				// only set up the files
				continue
			}
			p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
			if err := ioutil.WriteFile(
				p, []byte("data for "+filename), 0o644); err != nil {
				require.NoError(t, err)
			}
			syncFilename(t, p)
		}
		checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), files)
	}

	// Check through KBFSOps
	{
		jdoe := libkbfs.GetRootNodeOrBust(ctx,
			t, config, "jdoe", tlf.Private)
		ops := config.KBFSOps()
		_, _, err := ops.Lookup(ctx, jdoe, jdoe.ChildName(kbfsFilename))
		require.NoError(t, err)
	}
}

func testOneCreateThenRead(t *testing.T, p string) {
	f, err := os.Create(p)
	require.NoError(t, err)
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		require.NoError(t, err,
			"write error: %v", err)
	}
	syncAndClose(t, f)
	f = nil

	buf, err := ioutil.ReadFile(p)
	require.NoError(t, err,
		"read error: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)
}

func TestCreateThenRead(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
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
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile1")
	testOneCreateThenRead(t, p1)
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile2")
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

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	require.NoError(t, err)
	defer syncAndClose(t, f)
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		require.NoError(t, err,
			"write error: %v", err)
	}
	// explicitly no close here

	buf, err := ioutil.ReadFile(p)
	require.NoError(t, err,
		"read error: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)
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

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", filename)
		buf, err := ioutil.ReadFile(p)
		require.NoError(t, err,
			"read error: %v", err)
		e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)
	}()
}

func TestMkdir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0o755); err != nil {
		require.NoError(t, err)
	}
	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	e, g := fi.Mode().String(), `drwxrwxrwx`
	require.Equal(t, e, g, "wrong mode for subdir: %q != %q", g, e)
}

func TestMkdirNewFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	for _, q := range []string{"New Folder", "New folder"} {
		p := filepath.Join(mnt.Dir, PrivateName, q)
		_, err := ioutil.Lstat(p)
		require.Error(t, err,
			"Non-existent new folder existed!")
		if err = ioutil.Mkdir(p, 0o755); err != nil {
			require.NoError(t, err)
		}
		fi, err := ioutil.Lstat(p)
		require.NoError(t, err)
		g := fi.Mode().String()
		require.Equal(t, `drwxrwxrwx`, g, "wrong mode for subdir: %q != %q", g, `drwxrwxrwx`)
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

		one := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one")
		if err := ioutil.Mkdir(one, 0o755); err != nil {
			require.NoError(t, err)
		}
		two := filepath.Join(one, "two")
		if err := ioutil.Mkdir(two, 0o755); err != nil {
			require.NoError(t, err)
		}
		three := filepath.Join(two, "three")
		if err := ioutil.WriteFile(three, []byte(input), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, three)
	}()

	// unmount to flush cache
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one", "two", "three")
		buf, err := ioutil.ReadFile(p)
		require.NoError(t, err,
			"read error: %v", err)
		e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)
	}()
}

func TestSymlink(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	t.Skip("Symlink creation not supported on Windows - TODO!")
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)

	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
		if err := os.Symlink("myfile", p); err != nil {
			require.NoError(t, err)
		}
	}()

	// unmount to flush cache
	func() {
		mnt, _, cancelFn := makeFS(ctx, t, config)
		defer mnt.Close()
		defer cancelFn()

		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
		target, err := os.Readlink(p)
		require.NoError(t, err)
		e, g := target, "myfile"
	require.Equal(t, e, g, "bad symlink target: %q != %q", g, e)
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

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1)
	if err := ioutil.Rename(p1, p2); err != nil {
		require.NoError(t, err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input)))
		},
	})

	buf, err := ioutil.ReadFile(p2)
	require.NoError(t, err, "read error: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)

	_, err = ioutil.ReadFile(p1)
	require.True(t, ioutil.IsNotExist(err), "old name still exists: %v", err)
}

func TestRenameOverwrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1)
	if err := ioutil.WriteFile(p2, []byte("loser\n"), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p2)

	if err := ioutil.Rename(p1, p2); err != nil {
		require.NoError(t, err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": nil,
	})

	buf, err := ioutil.ReadFile(p2)
	require.NoError(t, err, "read error: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)

	_, err = ioutil.ReadFile(p1)
	require.True(t, ioutil.IsNotExist(err), "old name still exists: %v", err)
}

func TestRenameCrossDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0o755); err != nil {
		require.NoError(t, err)
	}
	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0o755); err != nil {
		require.NoError(t, err)
	}
	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1)

	if err := ioutil.Rename(p1, p2); err != nil {
		require.NoError(t, err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe", "one"), map[string]fileInfoCheck{})
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), map[string]fileInfoCheck{
		"new": nil,
	})

	buf, err := ioutil.ReadFile(p2)
	require.NoError(t, err, "read error: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)

	_, err = ioutil.ReadFile(p1)
	require.True(t, ioutil.IsNotExist(err), "old name still exists: %v", err)
}

func TestRenameCrossFolder(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "wsmith,jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1)

	err := ioutil.Rename(p1, p2)
	require.Error(t, err,
		"expected an error from rename: %v", err)
	lerr, ok := errors.Cause(err).(*os.LinkError)
	require.True(t, ok,
		"expected a LinkError from rename: %v", err)
	e, g := lerr.Op, "rename"
	require.Equal(t, e, g, "wrong LinkError.Op: %q != %q", g, e)
	e, g = lerr.Old, p1
	require.Equal(t, e, g, "wrong LinkError.Old: %q != %q", g, e)
	e, g = lerr.New, p2
	require.Equal(t, e, g, "wrong LinkError.New: %q != %q", g, e)

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"old": nil,
	})
	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "wsmith,jdoe"), map[string]fileInfoCheck{})

	buf, err := ioutil.ReadFile(p1)
	require.NoError(t, err, "read error: %v", err)
	e, g = string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)

	_, err = ioutil.ReadFile(p2)
	require.True(t, ioutil.IsNotExist(err), "new name exists even on error: %v", err)
}

func TestWriteThenRename(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "new")

	f, err := Create(p1)
	require.NoError(t, err,
		"cannot create file: %v", err)
	defer syncAndClose(t, f)

	// write to the file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		require.NoError(t, err,
			"cannot write: %v", err)
	}

	// now rename the file while it's still open
	if err := ioutil.Rename(p1, p2); err != nil {
		require.NoError(t, err)
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
		require.NoError(t, err,
			"cannot write after rename: %v", err)
	}

	buf, err := ioutil.ReadFile(p2)
	require.NoError(t, err, "read error: %v", err)
	e, g := string(buf), input+input2
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)

	_, err = ioutil.ReadFile(p1)
	require.True(t, ioutil.IsNotExist(err), "old name still exists: %v", err)
}

func TestWriteThenRenameCrossDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0o755); err != nil {
		require.NoError(t, err)
	}
	if err := ioutil.Mkdir(filepath.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0o755); err != nil {
		require.NoError(t, err)
	}
	p1 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := filepath.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")

	f, err := Create(p1)
	require.NoError(t, err,
		"cannot create file: %v", err)
	// Call in a closure since `f` is overridden below.
	defer syncAndClose(t, f)

	// write to the file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		require.NoError(t, err,
			"cannot write: %v", err)
	}

	// now rename the file while it's still open
	if err := ioutil.Rename(p1, p2); err != nil {
		require.NoError(t, err)
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
		require.NoError(t, err,
			"cannot write after rename: %v", err)
	}

	buf, err := ioutil.ReadFile(p2)
	require.NoError(t, err, "read error: %v", err)
	e, g := string(buf), input+input2
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)

	_, err := ioutil.ReadFile(p1)
	require.True(t, ioutil.IsNotExist(err), "old name still exists: %v", err)
}

func TestRemoveFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	if err := ioutil.Remove(p); err != nil {
		require.NoError(t, err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	_, err := ioutil.ReadFile(p)
	require.True(t, ioutil.IsNotExist(err), "file still exists: %v", err)
}

func TestRemoveDir(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0o755); err != nil {
		require.NoError(t, err)
	}

	if err := syscall.Rmdir(p); err != nil {
		require.NoError(t, err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	_, err := ioutil.Stat(p)
	require.True(t, ioutil.IsNotExist(err), "file still exists: %v", err)
}

func TestRemoveDirNotEmpty(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0o755); err != nil {
		require.NoError(t, err)
	}
	pFile := filepath.Join(p, "myfile")
	if err := ioutil.WriteFile(pFile, []byte("i'm important"), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, pFile)

	err := syscall.Rmdir(p)
	require.Error(t, err,
		"no error from rmdir")

	err := ioutil.ReadFile(pFile)
	require.NoError(t, err, "file was lost: %v", err)
}

func TestRemoveFileWhileOpenWriting(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := Create(p)
	require.NoError(t, err,
		"cannot create file: %v", err)
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	if err := ioutil.Remove(p); err != nil {
		require.NoError(t, err,
			"cannot delete file: %v", err)
	}

	// this must not resurrect a deleted file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		require.NoError(t, err,
			"cannot write: %v", err)
	}
	syncAndClose(t, f)
	f = nil

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	_, err := ioutil.ReadFile(p)
	require.True(t, ioutil.IsNotExist(err), "file still exists: %v", err)
}

func TestRemoveFileWhileOpenReading(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	f, err := Open(p)
	require.NoError(t, err,
		"cannot open file: %v", err)
	defer f.Close()

	if err := ioutil.Remove(p); err != nil {
		require.NoError(t, err,
			"cannot delete file: %v", err)
	}

	buf, err := ioutil.ReadAll(f)
	require.NoError(t, err,
		"cannot read unlinked file: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "read wrong content: %q != %q", g, e)

	if err := f.Close(); err != nil {
		require.NoError(t, err,
			"error on close: %v", err)
	}

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	_, err := ioutil.ReadFile(p)
	require.True(t, ioutil.IsNotExist(err), "file still exists: %v", err)
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
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	p1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1)

	f, err := os.Open(p1)
	require.NoError(t, err,
		"cannot open file: %v", err)
	defer f.Close()

	syncFolderToServer(t, "user1,user2", fs2)

	p2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.Remove(p2); err != nil {
		require.NoError(t, err,
			"cannot delete file: %v", err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadAll(f)
	require.NoError(t, err,
		"cannot read unlinked file: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "read wrong content: %q != %q", g, e)

	if err := f.Close(); err != nil {
		require.NoError(t, err,
			"error on close: %v", err)
	}

	checkDir(t, filepath.Join(mnt1.Dir, PrivateName, "user1,user2"),
		map[string]fileInfoCheck{})

	_, err := ioutil.ReadFile(p1)
	require.True(t, ioutil.IsNotExist(err), "file still exists: %v", err)
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
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	p1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1)

	p1Other := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "other")
	const inputOther = "hello, other\n"
	if err := ioutil.WriteFile(p1Other, []byte(inputOther), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p1Other)

	f, err := os.Open(p1)
	require.NoError(t, err,
		"cannot open file: %v", err)
	defer f.Close()

	syncFolderToServer(t, "user1,user2", fs2)

	p2Other := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "other")
	p2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.Rename(p2Other, p2); err != nil {
		require.NoError(t, err,
			"cannot rename file: %v", err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadAll(f)
	require.NoError(t, err,
		"cannot read unlinked file: %v", err)
	e, g := string(buf), input
	require.Equal(t, e, g, "read wrong content: %q != %q", g, e)

	if err := f.Close(); err != nil {
		require.NoError(t, err,
			"error on close: %v", err)
	}

	checkDir(t, filepath.Join(mnt1.Dir, PrivateName, "user1,user2"),
		map[string]fileInfoCheck{
			"myfile": nil,
		})

	_, err := ioutil.ReadFile(p1Other)
	require.True(t, ioutil.IsNotExist(err), "other file still exists: %v", err)

	buf, err = ioutil.ReadFile(p1)
	require.NoError(t, err, "read error: %v", err)
	e, g := string(buf), inputOther
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)
}

func TestTruncateGrow(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	const newSize = 100
	if err := os.Truncate(p, newSize); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	e, g := fi.Size(), int64(newSize)
	require.Equal(t, e, g, "wrong size: %v != %v", g, e)

	buf, err := ioutil.ReadFile(p)
	require.NoError(t, err,
		"cannot read unlinked file: %v", err)
	e, g := string(buf), input+strings.Repeat("\x00", newSize-len(input))
	require.Equal(t, e, g, "read wrong content: %q != %q", g, e)
}

func TestTruncateShrink(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	const newSize = 4
	if err := os.Truncate(p, newSize); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	e, g := fi.Size(), int64(newSize)
	require.Equal(t, e, g, "wrong size: %v != %v", g, e)

	buf, err := ioutil.ReadFile(p)
	require.NoError(t, err,
		"cannot read unlinked file: %v", err)
	e, g := string(buf), input[:newSize]
	require.Equal(t, e, g, "read wrong content: %q != %q", g, e)
}

func TestSetattrFileMtime(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		require.NoError(t, err)
	}

	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	// Fuzzy because the conversion between various time formats is lossy.
	g, e := fi.ModTime(), mtime
	require.True(t, timeEqualFuzzy(g, e, time.Millisecond), "wrong mtime: %v !~= %v", g, e)
}

func TestSetattrFileMtimeNow(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		require.NoError(t, err)
	}

	// cause mtime to be set to now
	if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)
	now := time.Now()

	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	g, o := fi.ModTime(), mtime
	require.True(t, g.After(o), "mtime did not progress: %v <= %v", g, o)
	g, e := fi.ModTime(), now
	require.True(t, timeEqualFuzzy(g, e, 1*time.Second), "mtime is wrong: %v !~= %v", g, e)
}

func TestSetattrDirMtime(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0o755); err != nil {
		require.NoError(t, err)
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		require.NoError(t, err)
	}

	fi, err := ioutil.Lstat(p)
	require.NoError(t, err)
	// Fuzzy because the conversion between various time formats is lossy.
	g, e := fi.ModTime(), mtime
	require.True(t, timeEqualFuzzy(g, e, time.Millisecond), "wrong mtime: %v !~= %v", g, e)
}

func TestSetattrDirMtimeNow(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := ioutil.Mkdir(p, 0o755); err != nil {
		require.NoError(t, err)
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		require.NoError(t, err)
	}

	// TODO setmtime to now, no Utimes on Windows.
	/*
		if err := unix.Utimes(p, nil); err != nil {
			require.FailNow(t, fmt.Sprintf("touch failed: %v", err))
		}
		now := time.Now()

		fi, err := ioutil.Lstat(p)
		if err != nil {
			require.FailNow(t, err)
		}
		g, o := fi.ModTime(), mtime
	require.True(t, g.After(o), "mtime did not progress: %v <= %v", g, o)
		g, e := fi.ModTime(), now
	require.True(t, timeEqualFuzzy(g, e, 1*time.Second), "mtime is wrong: %v !~= %v", g, e)

	*/
}

func TestFsync(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	require.NoError(t, err)
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		require.NoError(t, err,
			"write error: %v", err)
	}
	if err := f.Sync(); err != nil {
		require.NoError(t, err,
			"fsync error: %v", err)
	}
	if err := f.Close(); err != nil {
		require.NoError(t, err,
			"close error: %v", err)
	}
	f = nil
}

func TestReaddirPrivateDeleteAndReaddFavorite(t *testing.T) {
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

	err := ioutil.Remove(filepath.Join(mnt.Dir, PrivateName, "jdoe,janedoe"))
	require.NoError(t, err,
		"Removing favorite failed: %v", err)

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
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", filename)
		if err := ioutil.WriteFile(
			p, []byte("data for "+filename), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}

	checkDir(t, filepath.Join(mnt.Dir, PublicName, "jdoe"), files)
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
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe#wsmith", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFS(ctx, t, c2)
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, filepath.Join(mnt.Dir, PrivateName, "jdoe#wsmith"), map[string]fileInfoCheck{
		"myfile": nil,
	})
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
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFSE(ctx, t, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
	default:
		require.FailNow(t, fmt.Sprintf("expected a PathError, got %T: %v", err, err))
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
	mnt, _, cancelFn := makeFSE(ctx, t, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
	default:
		require.FailNow(t, fmt.Sprintf("expected a PathError, got %T: %v", err, err))
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
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFSE(ctx, t, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	fi, err := ioutil.Lstat(filepath.Join(mnt.Dir, PublicName, "jdoe"))
	require.NoError(t, err)
	// TODO figure out right modes, note owner is the person running
	// fuse, not the person owning the folder
	e, g := fi.Mode().String(), `drwxrwxrwx`
	require.Equal(t, e, g, "wrong mode for folder: %q != %q", g, e)
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
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(p, []byte(input), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFSE(ctx, t, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	buf, err := ioutil.ReadFile(filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile"))
	require.NoError(t, err)
	e, g := string(buf), input
	require.Equal(t, e, g, "bad file contents: %q != %q", g, e)
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
		p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFSE(ctx, t, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	checkDir(t, filepath.Join(mnt.Dir, PublicName, "jdoe"), map[string]fileInfoCheck{
		"myfile": nil,
	})
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
		p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
		if err := ioutil.WriteFile(
			p, []byte("data for myfile"), 0o644); err != nil {
			require.NoError(t, err)
		}
		syncFilename(t, p)
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, c2)
	mnt, _, cancelFn := makeFSE(ctx, t, c2, 'U')
	defer mnt.Close()
	defer cancelFn()

	switch _, err := ioutil.ReadDir(filepath.Join(mnt.Dir, PrivateName, "jdoe")); err := errors.Cause(err).(type) {
	case *os.PathError:
	default:
		require.FailNow(t, fmt.Sprintf("expected a PathError, got %T: %v", err, err))
	}
}

func syncFolderToServerHelper(t *testing.T, tlf string, ty tlf.Type, fs *FS) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	root := libkbfs.GetRootNodeOrBust(ctx, t, fs.config, tlf, ty)
	err := fs.config.KBFSOps().SyncFromServer(
		ctx, root.GetFolderBranch(), nil)
	require.NoError(t, err,
		"Couldn't sync from server: %v", err)
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
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)
	f, err := os.Open(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	require.NoError(t, err)
	defer f.Close()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}

	const input2 = "second round of content"
	if err := ioutil.WriteFile(p, []byte(input2), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}
}

func TestInvalidatePublicDataOnWrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PublicName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncPublicFolderToServer(t, "jdoe", fs2)
	f, err := os.Open(filepath.Join(mnt2.Dir, PublicName, "jdoe", "myfile"))
	require.NoError(t, err)
	defer f.Close()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}

	const input2 = "second round of content"
	if err := ioutil.WriteFile(p, []byte(input2), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncPublicFolderToServer(t, "jdoe", fs2)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}
}

func TestInvalidateDataOnTruncate(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config)
	defer mnt1.Close()
	defer cancelFn1()
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)
	f, err := os.Open(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	require.NoError(t, err)
	defer f.Close()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}

	const newSize = 3
	if err := os.Truncate(p, newSize); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input1[:newSize]
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}
}

func TestInvalidateDataOnLocalWrite(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe", "wsmith")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	const input1 = "input round one"
	p := filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	f, err := os.Open(p)
	require.NoError(t, err)
	defer f.Close()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}

	const input2 = "second round of content"
	defer syncFilename(t, p)
	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config, "jdoe", tlf.Private)

		ops := config.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, jdoe.ChildName("myfile"))
		require.NoError(t, err)
		if err := ops.Write(ctx, myfile, []byte(input2), 0); err != nil {
			require.NoError(t, err)
		}
	}

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
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
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	const input1 = "input round one"
	p := filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	syncFolderToServer(t, "jdoe", fs2)
	buf, err := ioutil.ReadFile(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	if err := ioutil.Remove(filepath.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")); err != nil {
		require.NoError(t, err)
	}

	syncFolderToServer(t, "jdoe", fs2)

	if buf, err := ioutil.ReadFile(filepath.Join(mnt2.Dir, PrivateName, "jdoe", "myfile")); !ioutil.IsNotExist(err) {
		require.True(t, ioutil.IsNotExist(err),
			"expected ENOENT: %v: %q", err, buf)
	}
}

func testForErrorText(t *testing.T, path string, expectedErr error,
	fileType string,
) {
	buf, err := ioutil.ReadFile(path)
	require.NoError(t, err,
		"Bad error reading %s error file: %v", err, fileType)

	var errors []libfs.JSONReportedError
	err = json.Unmarshal(buf, &errors)
	require.NoError(t, err,
		"Couldn't unmarshal error file: %v. Full contents: %s",
		err, string(buf))

	found := false
	for _, e := range errors {
		if e.Error == expectedErr.Error() {
			found = true
			break
		}
	}

	if !found {
		require.Fail(t, "%s error file did not contain the error %s. "+
			"Full contents: %s", fileType, expectedErr, buf)
	}
}

func TestErrorFile(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	t.Skip("Non-existent users are allowed on windows.")
	config := libkbfs.MakeTestConfigOrBust(t, "jdoe")
	config.SetReporter(libkbfs.NewReporterSimple(config.Clock(), 0))
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config)
	mnt, _, cancelFn := makeFS(ctx, t, config)
	defer mnt.Close()
	defer cancelFn()

	libfs.AddRootWrapper(config)

	// cause an error by stating a non-existent user
	_, err := ioutil.Lstat(filepath.Join(mnt.Dir, PrivateName, "janedoe"))
	require.Error(t, err,
		"Stat of non-existent user worked!")

	// Make sure the root error file reads as expected
	expectedErr := dokan.ErrObjectNameNotFound

	// test both the root error file and one in a directory
	testForErrorText(t, filepath.Join(mnt.Dir, libfs.ErrorFileName),
		expectedErr, "root")
	testForErrorText(t, filepath.Join(mnt.Dir, PublicName, libfs.ErrorFileName),
		expectedErr, "root")
	testForErrorText(
		t, filepath.Join(mnt.Dir, PrivateName, libfs.ErrorFileName),
		expectedErr, "root")

	// Create public and private jdoe TLFs.
	const b = "hello world"
	p := filepath.Join(mnt.Dir, PublicName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(b), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)
	p = filepath.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte(b), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, p)

	testForErrorText(
		t, filepath.Join(mnt.Dir, PublicName, "jdoe", libfs.ErrorFileName),
		expectedErr, "dir")
	testForErrorText(
		t, filepath.Join(mnt.Dir, PrivateName, "jdoe", libfs.ErrorFileName),
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
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, myfile1)
	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	mydira1 := filepath.Join(mydir1, "a")
	if err := ioutil.WriteFile(mydira1, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, mydira1)
	syncFolderToServer(t, "user1,user2", fs2)
	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	buf, err := ioutil.ReadFile(myfile2)
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	mydir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir")
	mydira2 := filepath.Join(mydir2, "a")
	buf, err = ioutil.ReadFile(mydira2)
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	// now remove the first file, and rename the second
	if err := ioutil.Remove(myfile1); err != nil {
		require.NoError(t, err)
	}
	mydirb1 := filepath.Join(mydir1, "b")
	if err := ioutil.Rename(mydira1, mydirb1); err != nil {
		require.NoError(t, err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	syncFolderToServer(t, "user1,user2", fs2)

	// check everything from user 2's perspective
	if buf, err := ioutil.ReadFile(myfile2); !ioutil.IsNotExist(err) {
		require.True(t, ioutil.IsNotExist(err),
			"expected ENOENT: %v: %q", err, buf)
	}
	if buf, err := ioutil.ReadFile(mydira2); !ioutil.IsNotExist(err) {
		require.True(t, ioutil.IsNotExist(err),
			"expected ENOENT: %v: %q", err, buf)
	}

	checkDir(t, mydir2, map[string]fileInfoCheck{
		"b": func(fi os.FileInfo) error {
			return mustBeFileWithSize(fi, int64(len(input1)))
		},
	})

	mydirb2 := filepath.Join(mydir2, "b")
	buf, err = ioutil.ReadFile(mydirb2)
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
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
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, myfile1)
	syncFolderToServer(t, "user1,user2", fs2)
	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	buf, err := ioutil.ReadFile(myfile2)
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	// user 1 append using libkbfs, to ensure that it doesn't flush
	// the whole page.
	const input2 = "input round two"
	{
		ctx := libcontext.BackgroundContextWithCancellationDelayer()
		defer testCleanupDelayer(ctx, t)

		jdoe := libkbfs.GetRootNodeOrBust(ctx, t, config1, "user1,user2", tlf.Private)

		ops := config1.KBFSOps()
		myfile, _, err := ops.Lookup(ctx, jdoe, jdoe.ChildName("myfile"))
		require.NoError(t, err)
		if err := ops.Write(
			ctx, myfile, []byte(input2), int64(len(input1))); err != nil {
			require.NoError(t, err)
		}
		if err := ops.SyncAll(ctx, myfile.GetFolderBranch()); err != nil {
			require.NoError(t, err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs2)

	// check everything from user 2's perspective
	buf, err = ioutil.ReadFile(myfile2)
	require.NoError(t, err)
	e, g := string(buf), input1+input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
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
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, myfile1)
	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	mydirfile1 := filepath.Join(mydir1, "myfile")
	syncFolderToServer(t, "user1,user2", fs2)
	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	f, err := os.OpenFile(myfile2, os.O_RDWR, 0o644)
	require.NoError(t, err)
	// Call in a closure since `f` is overridden below.
	defer func() { syncAndClose(t, f) }()

	{
		buf := make([]byte, 4096)
		n, err := f.ReadAt(buf, 0)
		if err != nil {
		require.ErrorIs(t, err, io.EOF,
			err)
	}
		e, g := string(buf[:n]), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	}

	// now rename the second into a directory that user 2 hasn't seen
	if err := ioutil.Rename(myfile1, mydirfile1); err != nil {
		require.NoError(t, err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	syncFolderToServer(t, "user1,user2", fs2)

	// user 2 should be able to write to its open file, and user 1
	// will see the change
	const input2 = "input round two"
	{
		n, err := f.WriteAt([]byte(input2), 0)
		require.False(t, err != nil || n != len(input2),
			err)
	}
	syncAndClose(t, f)
	f = nil

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadFile(mydirfile1)
	require.NoError(t, err)
	e, g := string(buf), input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
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

	ops := config.KBFSOps()
	status, _, err := ops.FolderStatus(ctx, jdoe.GetFolderBranch())
	require.NoError(t, err,
		"Couldn't get KBFS status: %v", err)

	// Simply make sure the status in the file matches what we'd
	// expect.  Checking the exact content should be left for tests
	// within libkbfs.
	buf, err := ioutil.ReadFile(filepath.Join(mnt.Dir, PublicName, "jdoe",
		libfs.StatusFileName))
	require.NoError(t, err,
		"Couldn't read KBFS status file: %v", err)

	var bufStatus libkbfs.FolderBranchStatus
	err = json.Unmarshal(buf, &bufStatus)
	require.NoError(t, err)

	// Use a fuzzy check on the timestamps, since it could include
	// monotonic clock stuff.
	require.True(t, timeEqualFuzzy(
		status.LocalTimestamp, bufStatus.LocalTimestamp, time.Millisecond),
		"Local timestamp (%s) didn't match expected timestamp %v",
		bufStatus.LocalTimestamp, status.LocalTimestamp)
	status.LocalTimestamp = bufStatus.LocalTimestamp

	// It's safe to compare the path slices with DeepEqual since they
	// will all be null for this test (nothing is dirtied).
	require.True(t, reflect.DeepEqual(status, bufStatus),
		"Status file contents (%s) didn't match expected status %v",
		buf, status)
}

// TODO: remove once we have automatic conflict resolution tests
func TestUnstageFile(t *testing.T) {
	t.Skip("Multi-mount test fails on Windows CI with access denied errors")
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// both users read the root dir first
	myroot1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2")
	myroot2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2")
	checkDir(t, myroot1, map[string]fileInfoCheck{})
	checkDir(t, myroot2, map[string]fileInfoCheck{})

	// turn updates off for user 2
	rootNode2 := libkbfs.GetRootNodeOrBust(ctx, t, config2, "user1,user2", tlf.Private)
	_, err := libkbfs.DisableUpdatesForTesting(config2,
		rootNode2.GetFolderBranch())
	require.NoError(t, err,
		"Couldn't pause user 2 updates")
	err = libkbfs.DisableCRForTesting(config2, rootNode2.GetFolderBranch())
	require.NoError(t, err,
		"Couldn't disable user 2 CR")

	// user1 writes a file and makes a few directories
	const input1 = "input round one"
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, myfile1)
	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	mysubdir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir",
		"mysubdir")
	if err := ioutil.Mkdir(mysubdir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	// user2 does similar
	const input2 = "input round two"
	myfile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile2, []byte(input2), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, myfile2)
	mydir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir2, 0o755); err != nil {
		require.NoError(t, err)
	}
	myothersubdir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir",
		"myothersubdir")
	if err := ioutil.Mkdir(myothersubdir2, 0o755); err != nil {
		require.NoError(t, err)
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
	unstageFile2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.UnstageFileName)
	if err := ioutil.WriteFile(unstageFile2, []byte{1}, 0o222); err != nil {
		require.NoError(t, err)
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
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	buf, err = ioutil.ReadFile(myfile2)
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
}

func TestSimpleCRNoConflict(t *testing.T) {
	t.Skip("Multi-mount test fails on Windows CI with access denied errors")
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
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
		[]byte("off"), 0o644); err != nil {
		require.NoError(t, err)
	}

	// user1 writes a file and makes a few directories
	const input1 = "input round one"
	file1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "file1")
	if err := ioutil.WriteFile(file1, []byte(input1), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, file1)
	dir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "dir")
	if err := ioutil.Mkdir(dir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	subdir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "dir", "subdir1")
	if err := ioutil.Mkdir(subdir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs1)

	// user2 does similar
	const input2 = "input round two two two"
	file2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "file2")
	if err := ioutil.WriteFile(file2, []byte(input2), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, file2)
	dir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "dir")
	if err := ioutil.Mkdir(dir2, 0o755); err != nil {
		require.NoError(t, err)
	}
	subdir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "dir", "subdir2")
	if err := ioutil.Mkdir(subdir2, 0o755); err != nil {
		require.NoError(t, err)
	}
	syncAll(t, "user1,user2", tlf.Private, fs2)

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
		[]byte("on"), 0o644); err != nil {
		require.NoError(t, err)
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
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	file2u1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "file2")
	buf, err = ioutil.ReadFile(file2u1)
	require.NoError(t, err)
	e, g := string(buf), input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	file1u2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "file1")
	buf, err = ioutil.ReadFile(file1u2)
	require.NoError(t, err)
	e, g := string(buf), input1
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	buf, err = ioutil.ReadFile(file2)
	require.NoError(t, err)
	e, g := string(buf), input2
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
}

func TestSimpleCRConflictOnOpenFiles(t *testing.T) {
	t.Skip("Multi-mount test fails on Windows CI with access denied errors")
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	now := time.Now()
	var clock clocktest.TestClock
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
		[]byte("off"), 0o644); err != nil {
		require.NoError(t, err)
	}

	// user1 creates and writes a file
	file1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "f")
	f1, err := os.Create(file1)
	require.NoError(t, err)
	defer syncAndClose(t, f1)

	const input1 = "hello"
	{
		n, err := f1.WriteAt([]byte(input1), 0)
		require.False(t, err != nil || n != len(input1),
			err)
		if err := f1.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	// user2 creates and writes a file
	file2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "f")
	f2, err := os.Create(file2)
	require.NoError(t, err)
	defer syncAndClose(t, f2)

	const input2 = "ohell"
	{
		n, err := f2.WriteAt([]byte(input2), 0)
		require.False(t, err != nil || n != len(input2),
			err)
		if err := f2.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	// now re-enable user 2 updates and CR, and the merge should happen
	enableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.EnableUpdatesFileName)
	if err := ioutil.WriteFile(enableUpdatesFile,
		[]byte("on"), 0o644); err != nil {
		require.NoError(t, err)
	}

	syncFolderToServer(t, "user1,user2", fs2)
	syncFolderToServer(t, "user1,user2", fs1)

	// They should both be able to read their past writes.
	{
		buf := make([]byte, len(input1))
		n, err := f1.ReadAt(buf, 0)
		require.False(t, err != nil || n != len(input1),
			err)
		e, g := string(buf), input1
	require.Equal(t, e, g, "Unexpected read on f2: %s vs %s", g, e)
	}
	{
		buf := make([]byte, len(input2))
		n, err := f2.ReadAt(buf, 0)
		require.False(t, err != nil || n != len(input2),
			err)
		e, g := string(buf), input2
	require.Equal(t, e, g, "Unexpected read on f2: %s vs %s", g, e)
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
		require.False(t, err != nil || n != len(input3),
			err)
		if err := f1.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs2)

	input4 := " dlrow"
	{
		n, err := f2.WriteAt([]byte(input4), int64(len(input2)))
		require.False(t, err != nil || n != len(input4),
			err)
		if err := f2.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs1)

	buf, err := ioutil.ReadFile(file1)
	require.NoError(t, err)
	e, g := string(buf), input1+input3
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	buf, err = ioutil.ReadFile(file2)
	require.NoError(t, err)
	e, g := string(buf), input1+input3
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	// TODO: timestamps without ':', see KBFS-516
	/*
		filec1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2",
			"f.conflict.user2."+nowString)
		filec2 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2",
			"f.conflict.user2."+nowString)

		buf, err = ioutil.ReadFile(filec1)
		if err != nil {
			require.FailNow(t, err)
		}
		require.FailNow(t, "END END END")
		e, g := string(buf), input2+input4
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
		buf, err = ioutil.ReadFile(filec2)
		if err != nil {
			require.FailNow(t, err)
		}
		e, g := string(buf), input2+input4
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	*/
}

func TestSimpleCRConflictOnOpenMergedFile(t *testing.T) {
	t.Skip("Multi-mount test fails on Windows CI with access denied errors")
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1",
		"user2")
	mnt1, fs1, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	now := time.Now()
	var clock clocktest.TestClock
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
		[]byte("off"), 0o644); err != nil {
		require.NoError(t, err)
	}

	// user1 creates and writes a file
	file1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "f")
	f1, err := os.Create(file1)
	require.NoError(t, err)
	defer syncAndClose(t, f1)

	const input1 = "hello"
	{
		n, err := f1.WriteAt([]byte(input1), 0)
		require.False(t, err != nil || n != len(input1),
			err)
		if err := f1.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	// user2 creates a directory and writes a file to it
	dir2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "f")
	if err := ioutil.Mkdir(dir2, 0o755); err != nil {
		require.NoError(t, err)
	}
	file2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "f", "foo")
	f2, err := os.Create(file2)
	require.NoError(t, err)
	defer syncAndClose(t, f2)

	const input2 = "ohell"
	{
		n, err := f2.WriteAt([]byte(input2), 0)
		require.False(t, err != nil || n != len(input2),
			err)
		if err := f2.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	// now re-enable user 2 updates and CR, and the merge should happen
	enableUpdatesFile := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
		libfs.EnableUpdatesFileName)
	if err := ioutil.WriteFile(enableUpdatesFile,
		[]byte("on"), 0o644); err != nil {
		require.NoError(t, err)
	}

	syncFolderToServer(t, "user1,user2", fs2)
	syncFolderToServer(t, "user1,user2", fs1)

	// They should both be able to read their past writes.
	{
		buf := make([]byte, len(input1))
		n, err := f1.ReadAt(buf, 0)
		require.False(t, err != nil || n != len(input1),
			err)
		e, g := string(buf), input1
	require.Equal(t, e, g, "Unexpected read on f2: %s vs %s", g, e)
	}
	{
		buf := make([]byte, len(input2))
		n, err := f2.ReadAt(buf, 0)
		require.False(t, err != nil || n != len(input2),
			err)
		e, g := string(buf), input2
	require.Equal(t, e, g, "Unexpected read on f2: %s vs %s", g, e)
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
		require.False(t, err != nil || n != len(input3),
			err)
		if err := f1.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs2)

	input4 := " dlrow"
	{
		n, err := f2.WriteAt([]byte(input4), int64(len(input2)))
		require.False(t, err != nil || n != len(input4),
			err)
		if err := f2.Sync(); err != nil {
			require.NoError(t, err)
		}
	}

	syncFolderToServer(t, "user1,user2", fs1)

	file2u1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "f", "foo")
	buf, err := ioutil.ReadFile(file2u1)
	require.NoError(t, err)
	e, g := string(buf), input2+input4
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	buf, err = ioutil.ReadFile(file2)
	require.NoError(t, err)
	e, g := string(buf), input2+input4
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)

	// TODO: timestamps without ':', see KBFS-516
	/*
		filec1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2",
			"f.conflict.user1."+nowString)
		filec2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2",
			"f.conflict.user1."+nowString)
		buf, err = ioutil.ReadFile(filec1)
		if err != nil {
			require.FailNow(t, err)
		}
		e, g := string(buf), input1+input3
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
		buf, err = ioutil.ReadFile(filec2)
		if err != nil {
			require.FailNow(t, err)
		}
		e, g := string(buf), input1+input3
	require.Equal(t, e, g, "wrong content: %q != %q", g, e)
	*/
}

func TestKbfsFileInfo(t *testing.T) {
	ctx := libcontext.BackgroundContextWithCancellationDelayer()
	defer testCleanupDelayer(ctx, t)
	config1 := libkbfs.MakeTestConfigOrBust(t, "user1", "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config1)
	mnt1, _, cancelFn1 := makeFS(ctx, t, config1)
	defer mnt1.Close()
	defer cancelFn1()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	defer libkbfs.CheckConfigAndShutdown(ctx, t, config2)
	mnt2, fs2, cancelFn2 := makeFSE(ctx, t, config2, 'U')
	defer mnt2.Close()
	defer cancelFn2()

	// Turn off the prefetcher to avoid races when reading the file info file.
	ch := config2.BlockOps().TogglePrefetcher(false)
	select {
	case <-ch:
	case <-ctx.Done():
		require.FailNow(t, fmt.Sprint(ctx.Err()))
	}

	mydir1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := ioutil.Mkdir(mydir1, 0o755); err != nil {
		require.NoError(t, err)
	}
	myfile1 := filepath.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte("foo"), 0o644); err != nil {
		require.NoError(t, err)
	}
	syncFilename(t, myfile1)
	syncFolderToServer(t, "user1,user2", fs2)
	fi2 := filepath.Join(mnt2.Dir, PrivateName, "user1,user2", "mydir", libfs.FileInfoPrefix+"myfile")
	bs, err := ioutil.ReadFile(fi2)
	require.NoError(t, err)
	var dst libkbfs.NodeMetadata
	err = json.Unmarshal(bs, &dst)
	require.NoError(t, err)
	require.Equal(t, kbname.NormalizedUsername("user1"), dst.LastWriterUnverified,
		"Expected user1, %v raw %X", dst, bs)
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
	p := filepath.Join(mnt.Dir, PrivateName, "jdoe")
	for i := 0; i < 10; i++ {
		file := filepath.Join(p, fmt.Sprintf("foo-%d", i))
		f, err := os.Create(file)
		require.NoError(t, err)
		syncAndClose(t, f)
	}

	t.Log("Read a revision range")
	histPrefix := filepath.Join(p, libfs.UpdateHistoryFileName)
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
