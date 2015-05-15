package main

import (
	"io"
	"io/ioutil"
	"os"
	"path"
	"syscall"
	"testing"

	"bazil.org/fuse/fs/fstestutil"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func makeFS(t testing.TB, config *libkbfs.ConfigLocal) *fstestutil.Mount {
	filesys := &FS{
		config: config,
	}
	mnt, err := fstestutil.MountedT(t, filesys)
	if err != nil {
		t.Fatal(err)
	}
	return mnt
}

func TestStatRoot(t *testing.T) {
	config := makeTestConfig("jdoe")
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

func TestStatMyFolder(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwx------`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestStatAlias(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe,jdoe")
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
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	fi, err := os.Lstat(path.Join(mnt.Dir, "jdoe", "public"))
	if err != nil {
		t.Fatal(err)
	}
	if g, e := fi.Mode().String(), `drwxr-xr-x`; g != e {
		t.Errorf("wrong mode for folder: %q != %q", g, e)
	}
}

func TestReaddirRoot(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	{
		// Force FakeMDServer to have some DirIds it can present to us
		// as favorites. Don't go through VFS to avoid caching causing
		// false positives.
		dh, err := libkbfs.ParseDirHandle(context.Background(), config, "jdoe")
		if err != nil {
			t.Fatalf("cannot parse jdoe as folder: %v", err)
		}
		if _, err := config.KBFSOps().GetRootMDForHandle(dh); err != nil {
			t.Fatalf("cannot set up a favorite: %v", err)
		}
	}

	fis, err := ioutil.ReadDir(mnt.Dir)
	if err != nil {
		t.Fatal(err)
	}
	seenMyFolder := false
	for _, fi := range fis {
		if fi.Name() == "jdoe" {
			seenMyFolder = true
			continue
		}
		t.Errorf("unexpected direntry: %v", fi)
	}
	if !seenMyFolder {
		t.Error("did not see my folder")
	}
}

func TestReaddirMyFolderEmpty(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	for _, fi := range fis {
		t.Errorf("unexpected direntry: %v", fi)
	}
}

func TestReaddirMyFolderWithFiles(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	files := map[string]struct{}{
		"one": struct{}{},
		"two": struct{}{},
	}
	for filename := range files {
		if err := ioutil.WriteFile(path.Join(mnt.Dir, "jdoe", filename), []byte("data for "+filename), 0644); err != nil {
			t.Fatal(err)
		}
	}
	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatal(err)
	}
	for _, fi := range fis {
		if _, ok := files[fi.Name()]; ok {
			delete(files, fi.Name())
			continue
		}
		t.Errorf("unexpected direntry: %v", fi)
	}
	for filename := range files {
		t.Errorf("never saw file: %v", filename)
	}
}

func TestCreateThenRead(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
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

func TestReadUnflushed(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
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
	config := makeTestConfig("jdoe")

	const input = "hello, world\n"
	const filename = "myfile"
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		p := path.Join(mnt.Dir, "jdoe", filename)
		if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
			t.Fatal(err)
		}
	}()

	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()
		p := path.Join(mnt.Dir, "jdoe", filename)
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
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
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
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "mydir")
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
	config := makeTestConfig("jdoe")
	const input = "hello, world\n"

	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		one := path.Join(mnt.Dir, "jdoe", "one")
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

		p := path.Join(mnt.Dir, "jdoe", "one", "two", "three")
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
	config := makeTestConfig("jdoe")

	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		p := path.Join(mnt.Dir, "jdoe", "mylink")
		if err := os.Symlink("myfile", p); err != nil {
			t.Fatal(err)
		}
	}()

	// unmount to flush cache
	func() {
		mnt := makeFS(t, config)
		defer mnt.Close()

		p := path.Join(mnt.Dir, "jdoe", "mylink")
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
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, "jdoe", "old")
	p2 := path.Join(mnt.Dir, "jdoe", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 1 {
		t.Errorf("unexpected files: %v", fis)
	}
	if g, e := fis[0].Name(), "new"; g != e {
		t.Errorf("unexpected file: %q != %q", g, e)
	}

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
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, "jdoe", "old")
	p2 := path.Join(mnt.Dir, "jdoe", "new")
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

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 1 {
		t.Errorf("unexpected files: %v", fis)
	}
	if g, e := fis[0].Name(), "new"; g != e {
		t.Errorf("unexpected file: %q != %q", g, e)
	}

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
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	if err := os.Mkdir(path.Join(mnt.Dir, "jdoe", "one"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path.Join(mnt.Dir, "jdoe", "two"), 0755); err != nil {
		t.Fatal(err)
	}
	p1 := path.Join(mnt.Dir, "jdoe", "one", "old")
	p2 := path.Join(mnt.Dir, "jdoe", "two", "new")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p1, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Rename(p1, p2); err != nil {
		t.Fatal(err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe", "one"))
	if err != nil {
		t.Fatalf("cannot list directory: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

	fis, err = ioutil.ReadDir(path.Join(mnt.Dir, "jdoe", "two"))
	if err != nil {
		t.Fatalf("cannot list directory: %v", err)
	}
	if len(fis) != 1 {
		t.Errorf("unexpected files: %v", fis)
	}
	if g, e := fis[0].Name(), "new"; g != e {
		t.Errorf("unexpected file: %q != %q", g, e)
	}

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
	config := makeTestConfig("jdoe", "wsmith")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p1 := path.Join(mnt.Dir, "jdoe", "old")
	p2 := path.Join(mnt.Dir, "wsmith,jdoe", "new")
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

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot list directory: %v", err)
	}
	if len(fis) != 1 {
		t.Errorf("unexpected files: %v", fis)
	}
	if g, e := fis[0].Name(), "old"; g != e {
		t.Errorf("unexpected file: %q != %q", g, e)
	}

	fis, err = ioutil.ReadDir(path.Join(mnt.Dir, "wsmith,jdoe"))
	if err != nil {
		t.Fatalf("cannot list directory: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

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

func TestRemoveFile(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
	const input = "hello, world\n"
	if err := ioutil.WriteFile(p, []byte(input), 0644); err != nil {
		t.Fatal(err)
	}

	if err := os.Remove(p); err != nil {
		t.Fatal(err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveDir(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "mydir")
	if err := os.Mkdir(p, 0755); err != nil {
		t.Fatal(err)
	}

	if err := syscall.Rmdir(p); err != nil {
		t.Fatal(err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

	if _, err := os.Stat(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenWriting_Desired(t *testing.T) {
	// when this works, rename function and remove
	// TestRemoveFileWhileOpenWriting_Current
	t.Skip("Not implemented yet. https://github.com/keybase/kbfs/issues/81")
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
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
		t.Fatal("error on close: %v", err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenWriting_Current(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
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
	_, err = f.Write([]byte(input))
	if err == nil {
		t.Fatalf("expected an error from write")
	}
	perr, ok := err.(*os.PathError)
	if !ok {
		t.Fatalf("expected a PathError from write: %v", err)
	}
	if g, e := perr.Op, "write"; g != e {
		t.Errorf("wrong PathError.Op: %q != %q", g, e)
	}
	if g, e := perr.Path, p; g != e {
		t.Errorf("wrong PathError.Path: %q != %q", g, e)
	}
	// TODO want ESTALE or ENOENT, maybe?
	if g, e := perr.Err, syscall.EIO; g != e {
		t.Errorf("expected EIO: %T %v", perr.Err, perr.Err)
	}

	if err := f.Close(); err != nil {
		t.Fatal("error on close: %v", err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}

func TestRemoveFileWhileOpenReading(t *testing.T) {
	config := makeTestConfig("jdoe")
	mnt := makeFS(t, config)
	defer mnt.Close()

	p := path.Join(mnt.Dir, "jdoe", "myfile")
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
		t.Fatal("error on close: %v", err)
	}

	fis, err := ioutil.ReadDir(path.Join(mnt.Dir, "jdoe"))
	if err != nil {
		t.Fatalf("cannot read dir: %v", err)
	}
	if len(fis) != 0 {
		t.Errorf("unexpected files: %v", fis)
	}

	if _, err := ioutil.ReadFile(p); !os.IsNotExist(err) {
		t.Errorf("file still exists: %v", err)
	}
}
