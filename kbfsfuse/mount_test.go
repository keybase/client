package main

import (
	"io"
	"io/ioutil"
	"os"
	"path"
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
