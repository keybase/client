package main

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"reflect"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"

	"bazil.org/fuse/fs"
	"bazil.org/fuse/fs/fstestutil"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
	"golang.org/x/sys/unix"
)

func makeFS(t testing.TB, config *libkbfs.ConfigLocal) *fstestutil.Mount {
	// TODO duplicates main() in kbfsfuse/main.go too much
	filesys := &FS{
		config: config,
	}
	ctx := context.Background()
	ctx = context.WithValue(ctx, ctxAppIDKey, filesys)
	fn := func(mnt *fstestutil.Mount) fs.FS {
		filesys.fuse = mnt.Server
		filesys.conn = mnt.Conn
		return filesys
	}
	mnt, err := fstestutil.MountedFuncT(t, fn, &fs.Config{
		GetContext: func() context.Context {
			return ctx
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return mnt
}

type fileInfoCheck func(fi os.FileInfo) error

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

// fsTimeEqual compares two filesystem-related timestamps.
//
// On platforms that don't use nanosecond-accurate timestamps in their
// filesystem APIs, it truncates the timestamps to make them
// comparable.
func fsTimeEqual(a, b time.Time) bool {
	if runtime.GOOS == "darwin" {
		a = a.Truncate(1 * time.Second)
		b = b.Truncate(1 * time.Second)
	}
	return a == b
}

// timeEqualFuzzy returns whether a is b+-skew.
func timeEqualFuzzy(a, b time.Time, skew time.Duration) bool {
	b1 := b.Add(-skew)
	b2 := b.Add(skew)
	return !a.Before(b1) && !a.After(b2)
}

func TestStatRoot(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(mnt.Dir)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwxr-xr-x`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatPrivate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, PrivateName))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwxr-xr-x`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, PublicName))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwxr-xr-x`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatMyFolder(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, PrivateName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwx------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatNonexistentFolder(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	if _, err := os.Lstat(path.Join(mnt.Dir, PrivateName, "does-not-exist")); !os.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v", err)
	}
}

func TestStatAlias(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe,jdoe")
	fi, err := os.Lstat(p)
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

func TestStatMyPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, PublicName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwxr-xr-x`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestReaddirRoot(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	checkDir(t, mnt.Dir, map[string]fileInfoCheck{
		PrivateName: mustBeDir,
		PublicName:  mustBeDir,
	})
}

func TestReaddirPrivate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	{
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		dh, err := libkbfs.ParseTlfHandle(context.Background(), config, "jdoe")
		if err != nil {
			t.Fatalf("cannot parse jdoe as folder: %v", err)
		}
		if _, _, err := config.KBFSOps().GetOrCreateRootNodeForHandle(
			context.Background(), dh, libkbfs.MasterBranch); err != nil {
			t.Fatalf("cannot set up a favorite: %v", err)
		}
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName), map[string]fileInfoCheck{
		"jdoe": mustBeDir,
	})
}

func TestReaddirPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	{
		// Force FakeMDServer to have some TlfIDs it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		dh, err := libkbfs.ParseTlfHandle(context.Background(), config, "jdoe")
		dh.Readers = append(dh.Readers, keybase1.PublicUID)
		if err != nil {
			t.Fatalf("cannot parse jdoe as folder: %v", err)
		}
		if _, _, err := config.KBFSOps().GetOrCreateRootNodeForHandle(
			context.Background(), dh, libkbfs.MasterBranch); err != nil {
			t.Fatalf("cannot set up a favorite: %v", err)
		}
	}

	checkDir(t, path.Join(mnt.Dir, PublicName), map[string]fileInfoCheck{
		"jdoe": mustBeDir,
	})
}

func TestReaddirMyFolderEmpty(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})
}

func TestReaddirMyFolderWithFiles(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	files := map[string]fileInfoCheck{
		"one": nil,
		"two": nil,
	}
	for filename, check := range files {
		if check != nil {
			// only set up the files
			continue
		}
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PrivateName, "jdoe", filename), []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
	}
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), files)
}

func testOneCreateThenRead(t *testing.T, p string) {
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	const input = "hello, world\n"
	if _, err := io.WriteString(f, input); err != nil {
		t.Fatalf("write error: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("error on close: %v", err)
	}

	buf, err := ioutil.ReadFile(p)
	if err != nil {
		t.Fatalf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}
}

func TestCreateThenRead(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	testOneCreateThenRead(t, p)
}

// Tests that writing and reading multiple files works, implicitly
// exercising any block pointer reference counting code (since the
// initial created files will have identical empty blocks to start
// with).
func TestMultipleCreateThenRead(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile1")
	testOneCreateThenRead(t, p1)
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile2")
	testOneCreateThenRead(t, p2)
}

func TestReadUnflushed(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()

	const input = "hello, world\n"
	const filename = "myfile"
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		p := path.Join(mnt.Dir, PrivateName, "jdoe", filename)
		if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := ioutil.WriteFile(p, []byte("fake binary"), 0755); err != nil {
		t.Fatal(err)
	}
	fi, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rwxr-xr-x`; g != e {
		t.Errorf("wrong mode for executable: %q != %q", g, e)
	}
}

func TestMkdir(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := os.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}
	fi, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwx------`; g != e {
		t.Errorf("wrong mode for subdir: %q != %q", g, e)
	}
}

func TestMkdirAndCreateDeep(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	const input = "hello, world\n"

	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		one := path.Join(mnt.Dir, PrivateName, "jdoe", "one")
		if err := os.Mkdir(one, 0755); err != nil {
			t.Fatal(err)
		}
		two := path.Join(one, "two")
		if err := os.Mkdir(two, 0755); err != nil {
			t.Fatal(err)
		}
		three := path.Join(two, "three")
		if err := ioutil.WriteFile(three, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	// unmount to flush cache
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()

	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		p := path.Join(mnt.Dir, PrivateName, "jdoe", "mylink")
		if err := os.Symlink("myfile", p); err != nil {
			t.Fatal(err)
		}
	}()

	// unmount to flush cache
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			if fi.Size() != int64(len(input)) {
				return fmt.Errorf("Bad file size: %d", fi.Size())
			}
			return nil
		},
	})

	buf, err := ioutil.ReadFile(p2)
	if err != nil {
		t.Errorf("read error: %v", err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}

	if _, err := ioutil.ReadFile(p1); !os.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRenameOverwrite(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}
	if err := ioutil.WriteFile(p2, []byte("loser\n"), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Rename(p1, p2); err != nil {
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

	if _, err := ioutil.ReadFile(p1); !os.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRenameCrossDir(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	if err := os.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Rename(p1, p2); err != nil {
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

	if _, err := ioutil.ReadFile(p1); !os.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRenameCrossFolder(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "wsmith,jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	err := os.Rename(p1, p2)
	if err == nil {
		t.Fatalf("expected an error from rename: %v", err)
	}
	lerr, ok := err.(*os.LinkError)
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

	if _, err := ioutil.ReadFile(p2); !os.IsNotExist(err) {
		t.Errorf("new name exists even on error: %v", err)
	}
}

func TestWriteThenRename(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "new")

	f, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	defer f.Close()

	// write to the file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}

	// now rename the file while it's still open
	if err := os.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	// check that the new path has the right length still
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			if fi.Size() != int64(len(input)) {
				return fmt.Errorf("Bad file size: %d", fi.Size())
			}
			return nil
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

	if _, err := ioutil.ReadFile(p1); !os.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestWriteThenRenameCrossDir(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	if err := os.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path.Join(mnt.Dir, PrivateName, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := path.Join(mnt.Dir, PrivateName, "jdoe", "one", "old")
	p2 := path.Join(mnt.Dir, PrivateName, "jdoe", "two", "new")

	f, err := os.Create(p1)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	defer f.Close()

	// write to the file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}

	// now rename the file while it's still open
	if err := os.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	// check that the new path has the right length still
	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe", "two"), map[string]fileInfoCheck{
		"new": func(fi os.FileInfo) error {
			if fi.Size() != int64(len(input)) {
				return fmt.Errorf("Bad file size: %d", fi.Size())
			}
			return nil
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

	if _, err := ioutil.ReadFile(p1); !os.IsNotExist(err) {
		t.Errorf("old name still exists: %v", err)
	}
}

func TestRemoveFile(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveDir(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := os.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	if err := syscall.Rmdir(p); err != nil {
		t.Fatal(err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := os.Stat(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveDirNotEmpty(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := os.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}
	pFile := path.Join(p, "myfile")
	if err := ioutil.WriteFile(pFile, []byte("i'm important"), 0644); err != nil {
		t.Fatal(err)
	}

	err := syscall.Rmdir(p)
	if g, e := err, syscall.ENOTEMPTY; g != e {
		t.Fatalf("wrong error from rmdir: %v (%T) != %v (%T)", g, g, e, e)
	}

	if _, err := ioutil.ReadFile(pFile); err != nil {
		t.Errorf("file was lost: %v", err)
	}
}

func TestRemoveFileWhileOpenWriting(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatalf("cannot create file: %v", err)
	}
	defer f.Close()

	if err := os.Remove(p); err != nil {
		t.Fatalf("cannot delete file: %v", err)
	}

	// this must not resurrect a deleted file
	const input = "hello, world\n"
	if _, err := f.Write([]byte(input)); err != nil {
		t.Fatalf("cannot write: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("error on close: %v", err)
	}

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenReading(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(p)
	if err != nil {
		t.Fatalf("cannot open file: %v", err)
	}
	defer f.Close()

	if err := os.Remove(p); err != nil {
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

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe"), map[string]fileInfoCheck{})

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestTruncateGrow(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	const newSize = 100
	if err := os.Truncate(p, newSize); err != nil {
		t.Fatal(err)
	}

	fi, err := os.Lstat(p)
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	const newSize = 4
	if err := os.Truncate(p, newSize); err != nil {
		t.Fatal(err)
	}

	fi, err := os.Lstat(p)
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Chmod(p, 0744); err != nil {
		t.Fatal(err)
	}

	fi, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rwxr-xr-x`; g != e {
		t.Errorf("wrong mode: %q != %q", g, e)
	}
}

func TestChmodNonExec(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0755); err != nil {
		t.Fatal(err)
	}

	if err := os.Chmod(p, 0655); err != nil {
		t.Fatal(err)
	}

	fi, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `-rw-r--r--`; g != e {
		t.Errorf("wrong mode: %q != %q", g, e)
	}
}

func TestChmodDir(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	if err := os.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	switch err := os.Chmod(p, 0655); err := err.(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EPERM; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestSetattrFileMtime(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	fi, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.ModTime(), mtime; !fsTimeEqual(g, e) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}
}

func TestSetattrFileMtimeNow(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
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

	fi, err := os.Lstat(p)
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := os.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	mtime := time.Date(2015, 1, 2, 3, 4, 5, 6, time.Local)
	// KBFS does not respect atime (which is ok), but we need to give
	// something to the syscall.
	atime := time.Date(2015, 7, 8, 9, 10, 11, 12, time.Local)
	if err := os.Chtimes(p, atime, mtime); err != nil {
		t.Fatal(err)
	}

	fi, err := os.Lstat(p)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.ModTime(), mtime; !fsTimeEqual(g, e) {
		t.Errorf("wrong mtime: %v !~= %v", g, e)
	}
}

func TestSetattrDirMtimeNow(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "mydir")
	if err := os.Mkdir(p, 0755); err != nil {
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

	fi, err := os.Lstat(p)
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, PrivateName, "jdoe", "myfile")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
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
}

func TestReaddirMyPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	files := map[string]fileInfoCheck{
		"one": nil,
		"two": nil,
	}
	for filename := range files {
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PublicName, "jdoe", filename), []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
	}

	checkDir(t, path.Join(mnt.Dir, PublicName, "jdoe"), files)
}

func TestReaddirOtherFolderAsReader(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		// cause the folder to exist
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PrivateName, "jdoe#wsmith", "myfile"), []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	checkDir(t, path.Join(mnt.Dir, PrivateName, "jdoe#wsmith"), map[string]fileInfoCheck{
		"myfile": nil,
	})
}

func TestStatOtherFolder(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		// cause the folder to exist
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PrivateName, "jdoe", "myfile"), []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	switch _, err := os.Lstat(path.Join(mnt.Dir, PrivateName, "jdoe")); err := err.(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestStatOtherFolderFirstUse(t *testing.T) {
	// This triggers a different error than with the warmup.
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	switch _, err := os.Lstat(path.Join(mnt.Dir, PrivateName, "jdoe")); err := err.(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestStatOtherFolderPublic(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		// cause the folder to exist
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PublicName, "jdoe", "myfile"), []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, PublicName, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	// TODO figure out right modes, note owner is the person running
	// fuse, not the person owning the folder
	if g, e := fi.Mode().String(), `drwxr-xr-x`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatOtherFolderPublicFirstUse(t *testing.T) {
	// This triggers a different error than with the warmup.
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	switch _, err := os.Lstat(path.Join(mnt.Dir, PublicName, "jdoe")); err := err.(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestReadPublicFile(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	const input = "hello, world\n"
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		// cause the folder to exist
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PublicName, "jdoe", "myfile"), []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	buf, err := ioutil.ReadFile(path.Join(mnt.Dir, PublicName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input; g != e {
		t.Errorf("bad file contents: %q != %q", g, e)
	}
}

func TestReaddirOtherFolderPublicAsAnyone(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		// cause the folder to exist
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PublicName, "jdoe", "myfile"), []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	checkDir(t, path.Join(mnt.Dir, PublicName, "jdoe"), map[string]fileInfoCheck{
		"myfile": nil,
	})
}

func TestReaddirOtherFolderAsAnyone(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		// cause the folder to exist
		if err := ioutil.WriteFile(path.Join(mnt.Dir, PrivateName, "jdoe", "myfile"), []byte("data for myfile"), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	c2 := libkbfs.ConfigAsUser(config, "wsmith")
	defer c2.Shutdown()
	mnt := makeFS(t, c2)
	defer mnt.Close()

	switch _, err := ioutil.ReadDir(path.Join(mnt.Dir, PrivateName, "jdoe")); err := err.(type) {
	case *os.PathError:
		if g, e := err.Err, syscall.EACCES; g != e {
			t.Fatalf("wrong error: %v != %v", g, e)
		}
	default:
		t.Fatalf("expected a PathError, got %T: %v", err, err)
	}
}

func TestInvalidateDataOnWrite(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	mnt1 := makeFS(t, config)
	defer mnt1.Close()
	mnt2 := makeFS(t, config)
	defer mnt2.Close()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	if err := ioutil.WriteFile(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile"), []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
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
	if err := ioutil.WriteFile(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile"), []byte(input2), 0644); err != nil {
		t.Fatal(err)
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

func TestInvalidatePublicDataOnWrite(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	mnt1 := makeFS(t, config)
	defer mnt1.Close()
	mnt2 := makeFS(t, config)
	defer mnt2.Close()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	if err := ioutil.WriteFile(path.Join(mnt1.Dir, PublicName, "jdoe", "myfile"), []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(path.Join(mnt2.Dir, PublicName, "jdoe", "myfile"))
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
	if err := ioutil.WriteFile(path.Join(mnt1.Dir, PublicName, "jdoe", "myfile"), []byte(input2), 0644); err != nil {
		t.Fatal(err)
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

func TestInvalidateDataOnTruncate(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	mnt1 := makeFS(t, config)
	defer mnt1.Close()
	mnt2 := makeFS(t, config)
	defer mnt2.Close()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	if err := ioutil.WriteFile(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile"), []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
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
	if err := os.Truncate(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile"), newSize); err != nil {
		t.Fatal(err)
	}

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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	if !mnt.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	if err := ioutil.WriteFile(path.Join(mnt.Dir, PrivateName, "jdoe", "myfile"), []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}

	f, err := os.Open(path.Join(mnt.Dir, PrivateName, "jdoe", "myfile"))
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
	{
		ctx := context.Background()
		dh, err := libkbfs.ParseTlfHandle(ctx, config, "jdoe")
		if err != nil {
			t.Fatalf("cannot parse folder for jdoe: %v", err)
		}
		ops := config.KBFSOps()
		jdoe, _, err := ops.GetOrCreateRootNodeForHandle(ctx, dh, libkbfs.MasterBranch)
		if err != nil {
			t.Fatal(err)
		}
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
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe", "wsmith")
	defer config.Shutdown()
	mnt1 := makeFS(t, config)
	defer mnt1.Close()
	mnt2 := makeFS(t, config)
	defer mnt2.Close()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	const input1 = "input round one"
	if err := ioutil.WriteFile(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile"), []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}

	buf, err := ioutil.ReadFile(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input1; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}

	if err := os.Remove(path.Join(mnt1.Dir, PrivateName, "jdoe", "myfile")); err != nil {
		t.Fatal(err)
	}

	if buf, err := ioutil.ReadFile(path.Join(mnt2.Dir, PrivateName, "jdoe", "myfile")); !os.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}
}

func testForErrorText(t *testing.T, path string, expectedErr error,
	fileType string) {
	buf, err := ioutil.ReadFile(path)
	s := strings.TrimSpace(string(buf))
	if err != nil {
		t.Fatalf("Bad error reading %s error file: %v", err, fileType)
	}
	if s != expectedErr.Error() {
		t.Errorf("%s error file had bad contents; got %s, expected %s",
			fileType, s, expectedErr)
	}
}

func TestErrorFile(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	// Give the kernel a chance to lookup a few non-existent files
	// first, otherwise on slow machines the last-reported error could
	// be something else.
	time.Sleep(100 * time.Millisecond)

	// cause an error by stating a non-existent user
	_, err := os.Lstat(path.Join(mnt.Dir, PrivateName, "janedoe"))
	if err == nil {
		t.Fatal("Stat of non-existent user worked!")
	}

	// Make sure the root error file reads as expected
	expectedErr := libkbfs.NoSuchUserError{Input: "janedoe"}

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
	config1 := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "user1",
		"user2")
	mnt1 := makeFS(t, config1)
	defer mnt1.Close()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2 := makeFS(t, config2)
	defer mnt2.Close()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := os.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mydira1 := path.Join(mydir1, "a")
	if err := ioutil.WriteFile(mydira1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}

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
	if err := os.Remove(myfile1); err != nil {
		t.Fatal(err)
	}
	mydirb1 := path.Join(mydir1, "b")
	if err := os.Rename(mydira1, mydirb1); err != nil {
		t.Fatal(err)
	}

	// check everything from user 2's perspective
	if buf, err := ioutil.ReadFile(myfile2); !os.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}
	if buf, err := ioutil.ReadFile(mydira2); !os.IsNotExist(err) {
		t.Fatalf("expected ENOENT: %v: %q", err, buf)
	}

	checkDir(t, mydir2, map[string]fileInfoCheck{
		"b": func(fi os.FileInfo) error {
			if fi.Size() != int64(len(input1)) {
				return fmt.Errorf("Bad file size: %d", fi.Size())
			}
			return nil
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

func TestInvalidateRenameToUncachedDir(t *testing.T) {
	config1 := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "user1",
		"user2")
	mnt1 := makeFS(t, config1)
	defer mnt1.Close()

	config2 := libkbfs.ConfigAsUser(config1, "user2")
	mnt2 := makeFS(t, config2)
	defer mnt2.Close()

	if !mnt2.Conn.Protocol().HasInvalidate() {
		t.Skip("Old FUSE protocol")
	}

	// user 1 writes one file to root and one to a sub directory
	const input1 = "input round one"
	myfile1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "myfile")
	if err := ioutil.WriteFile(myfile1, []byte(input1), 0644); err != nil {
		t.Fatal(err)
	}
	mydir1 := path.Join(mnt1.Dir, PrivateName, "user1,user2", "mydir")
	if err := os.Mkdir(mydir1, 0755); err != nil {
		t.Fatal(err)
	}
	mydirfile1 := path.Join(mydir1, "myfile")

	myfile2 := path.Join(mnt2.Dir, PrivateName, "user1,user2", "myfile")
	f, err := os.OpenFile(myfile2, os.O_RDWR, 0644)
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

	// now rename the second into a directory that user 2 hasn't seen
	if err := os.Rename(myfile1, mydirfile1); err != nil {
		t.Fatal(err)
	}

	// user 2 should be able to write to its open file, and user 1
	// will see the change
	const input2 = "input round two"
	{
		n, err := f.WriteAt([]byte(input2), 0)
		if err != nil || n != len(input2) {
			t.Fatal(err)
		}
	}
	f.Close()

	buf, err := ioutil.ReadFile(mydirfile1)
	if err != nil {
		t.Fatal(err)
	}
	if g, e := string(buf), input2; g != e {
		t.Errorf("wrong content: %q != %q", g, e)
	}
}

func TestStatusFile(t *testing.T) {
	config := libkbfs.MakeTestConfigOrBust(t, BServerRemoteAddr, "jdoe")
	defer config.Shutdown()
	mnt := makeFS(t, config)
	defer mnt.Close()

	ctx := context.Background()
	dh, err := libkbfs.ParseTlfHandle(ctx, config, "jdoe")
	ops := config.KBFSOps()
	jdoe, _, err := ops.GetOrCreateRootNodeForHandle(ctx, dh,
		libkbfs.MasterBranch)
	status, _, err := ops.Status(ctx, jdoe.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't get KBFS status: %v", err)
	}

	// Simply make sure the status in the file matches what we'd
	// expect.  Checking the exact content should be left for tests
	// within libkbfs.
	buf, err := ioutil.ReadFile(path.Join(mnt.Dir, PublicName, "jdoe",
		StatusFileName))
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
