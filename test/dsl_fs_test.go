// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Without any build tags the tests are run on libkbfs directly.
// With the tag dokan all tests are run through a dokan filesystem.
// With the tag fuse all tests are run thrhough a fuse filesystem.
// Note that fuse cannot be compiled on Windows and Dokan can only
// be compiled on Windows.

// +build dokan fuse

package test

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"regexp"
	"runtime"
	"sort"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type opt struct {
	readerNames     []username
	writerNames     []username
	userNames       []string
	users           map[string]*userData
	t               *testing.T
	initDone        bool
	blockSize       int64
	blockChangeSize int64
}

func test(t *testing.T, actions ...optionOp) {
	o := &opt{}
	o.t = t
	o.users = map[string]*userData{}
	defer o.Close()

	for _, omod := range actions {
		omod(o)
	}

}

func (o *opt) Close() {
	o.t.Log("Starting cleanup")
	for _, user := range o.users {
		user.cancel()
		user.mnt.Close()
	}
	if len(o.users) > 0 {
		libkbfs.CheckConfigAndShutdown(o.t, o.users[o.userNames[0]].config)
	}
}

const realFS = true

func as(user username, fops ...fileOp) optionOp {
	return func(o *opt) {
		o.t.Log("as", user)
		o.runInitOnce()
		ud, ok := o.users[string(user)]
		if !ok {
			o.t.Fatalf("User not found: %q", user)
		}
		ctx := &ctx{
			opt:      o,
			userData: ud,
			base:     ud.mnt.Dir + "/private/" + ud.tlf + "/",
		}
		o.t.Log("mounted at", ctx.base)

		initDone := false
		for _, fop := range fops {
			if !initDone && fop.flags&IsInit == 0 {
				if !ctx.noSyncInit {
					o.t.Log("Performing initial sync")
					syncWithServer(o.t, ud.tlf, ud)
				} else {
					o.t.Log("Omitting initial sync")
				}
				initDone = true
			}
			o.t.Log("fop", fop)
			err := fop.operation(ctx)
			ctx.expectSuccess("File operation", err)
		}
		ud.fs.NotificationGroupWait()
	}
}

// runInitOnce is run once per opt. Each test case has their own opt.
func (o *opt) runInitOnce() {
	if o.initDone {
		return
	}
	o.initDone = true

	o.userNames = concatUserNamesToStrings2(o.writerNames, o.readerNames)
	configs, uids := o.createConfigsForUsers(o.userNames, o.blockSize, o.blockChangeSize)

	for i, name := range o.userNames {
		tlf := o.usersTlf(uids, len(o.writerNames), configs[i])
		o.users[name] = o.createUserData(configs[i], i, tlf)
	}

}

type ctx struct {
	*opt
	userData   *userData
	base       string
	noSyncInit bool
}

func mkdir(name string) fileOp {
	return fileOp{func(c *ctx) error {
		return os.MkdirAll(c.base+name, 0755)
	}, Defaults}
}

func openRW(name string) (*os.File, error) {
	return os.OpenFile(name, os.O_RDWR|os.O_CREATE, 0644)
}

func write(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		c.ensureBaseExists(name)
		f, err := openRW(c.base + name)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = f.Write([]byte(contents))
		if err != nil {
			return err
		}
		return f.Sync()
	}, Defaults}
}

func read(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		bs, err := ioutil.ReadFile(c.base + name)
		if err != nil {
			return err
		}
		if len(bs) < len(contents) {
			c.t.Logf("Expected: %q", contents)
			c.t.Logf("Got:      %q", bs)
			return errors.New("Read: file contents shorter than expected")
		}
		for i, c := range bs {
			if c != contents[i] {
				return fmt.Errorf("%q: read contents differ from expected, got %q, expected %q", name, string(bs[:len(contents)]), contents)
			}
		}
		return nil
	}, Defaults}
}

func exists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		f, err := os.Open(c.base + filename)
		if err != nil {
			return err
		}
		f.Close()
		return nil
	}, Defaults}
}
func notExists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		f, err := os.Open(c.base + filename)
		if err != nil {
			return nil
		}
		f.Close()
		return fmt.Errorf("File that should not exist exists: %q", filename)
	}, Defaults}
}

func mkfile(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		err := ioutil.WriteFile(c.base+name, []byte(contents), 0644)
		if err == nil {
			return nil
		}
		dir, _ := path.Split(name)
		os.MkdirAll(c.base+dir, 0755)
		return ioutil.WriteFile(c.base+name, []byte(contents), 0644)
	}, Defaults}
}

func link(linkName, path string) fileOp {
	return fileOp{func(c *ctx) error {
		if runtime.GOOS == "windows" {
			c.t.Skip("TODO Skipping symbolic link creation on Windows.")
		}
		return os.Symlink(path, c.base+linkName)
	}, Defaults}
}

func setex(filepath string, ex bool) fileOp {
	return fileOp{func(c *ctx) error {
		if runtime.GOOS == "windows" {
			c.t.Skip("TODO Skipping SetEx on Windows.")
		}
		var mode os.FileMode = 0644
		if ex {
			mode = 0755
		}
		return os.Chmod(c.base+filepath, mode)
	}, Defaults}
}

func rm(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		return os.Remove(c.base + filepath)
	}, Defaults}
}

func rmdir(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		// Go does not distinguish between unlink and rmdir in API.
		return os.Remove(c.base + filepath)
	}, Defaults}
}

func rename(src, dst string) fileOp {
	return fileOp{func(c *ctx) error {
		c.ensureBaseExists(dst)
		return os.Rename(c.base+src, c.base+dst)
	}, Defaults}
}

func disableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		return ioutil.WriteFile(c.base+".kbfs_disable_updates", []byte("off"), 0644)
	}, Defaults}
}

func reenableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		err := ioutil.WriteFile(c.base+".kbfs_enable_updates", []byte("on"), 0644)
		if err != nil {
			return err
		}
		syncWithServer(c.t, c.userData.tlf, c.userData)

		return nil
	}, Defaults}
}

func lsdir(name string, contents m) fileOp {
	return fileOp{func(c *ctx) error {
		c.t.Log("lsdir", name)
		f, err := os.Open(c.base + name)
		if err != nil {
			return err
		}
		defer f.Close()
		fis, err := f.Readdir(-1)
		if err != nil {
			return fmt.Errorf("Readdir on %q failed: %q", f, err.Error())
		}
	outer:
		for restr, ty := range contents {
			re := regexp.MustCompile(restr)
			for i, fi := range fis {
				if fi != nil && re.MatchString(fi.Name()) && ty == fiTypeString(fi) {
					fis[i] = nil
					continue outer
				}
			}
			for _, fi := range fis {
				if fi != nil {
					c.t.Logf("Unmatched: %q %s", fi.Name(), fiTypeString(fi))
				}
			}
			return fmt.Errorf("Not found: %q (unmatched elements %v)", restr, len(fis))
		}
		// and make sure everything is matched
		for _, fi := range fis {
			if fi != nil {
				return fmt.Errorf("Unexpected node %q of type %q found", fi.Name(), fiTypeString(fi))
			}
		}
		return nil
	}, Defaults}
}

func (c *ctx) ensureBaseExists(name string) {
	dir, _ := path.Split(name)
	f, err := os.Open(c.base + dir)
	if err != nil {
		err = os.MkdirAll(c.base+dir, 0755)
		if err != nil {
			c.t.Fatal("ensureBaseExists:", dir, err)
		}
	}
	f.Close()

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

func (o *opt) fail(reason string) {
	o.t.Fatal(reason)
}

func (o *opt) failf(format string, objs ...interface{}) {
	o.t.Fatalf(format, objs...)
}

func (o *opt) expectSuccess(reason string, err error) {
	if err != nil {
		o.t.Fatalf("Error: %s: %v", reason, err)
	}
}

func syncWithServer(t *testing.T, tlf string, ud *userData) {
	config := ud.config
	ctx := context.Background()
	root, _, err := config.KBFSOps().GetOrCreateRootNode(
		ctx, tlf, false, libkbfs.MasterBranch)
	if err != nil {
		t.Fatalf("cannot get root for %s: %v", tlf, err)
	}

	err = config.KBFSOps().SyncFromServer(ctx, root.GetFolderBranch())
	if err != nil {
		t.Fatalf("Couldn't sync from server: %v", err)
	}
	ud.fs.NotificationGroupWait()
}

func (o *opt) usersTlf(uids []keybase1.UID, nwriters int, config libkbfs.Config) string {
	h := libkbfs.NewTlfHandle()

	for i, uid := range uids {
		if i < nwriters {
			h.Writers = append(h.Writers, uid)
		} else {
			h.Readers = append(h.Readers, uid)
		}
	}

	sort.Stable(libkbfs.UIDList(h.Writers))
	sort.Stable(libkbfs.UIDList(h.Readers))

	ctx := context.Background()

	name := h.ToString(ctx, config)
	return name
}

func (o *opt) createConfigsForUsers(users []string, blockSize, blockChangeSize int64) ([]*libkbfs.ConfigLocal, []keybase1.UID) {
	normalized := make([]libkb.NormalizedUsername, len(users))
	for i, name := range users {
		normalized[i] = libkb.NormalizedUsername(name)
	}
	o.t.Log("Normalized:", normalized)

	// create the first user specially
	config := libkbfs.MakeTestConfigOrBust(o.t, normalized...)

	setBlockSizes(o.t, config, blockSize, blockChangeSize)

	// TODO: pass this in from each test
	clock := libkbfs.TestClock{T: time.Time{}}
	config.SetClock(clock)

	configs := make([]*libkbfs.ConfigLocal, len(users))
	configs[0] = config

	uids := make([]keybase1.UID, len(users))
	uids[0] = nameToUid(o.t, config)

	// create the rest of the users as copies of the original config
	for i, name := range normalized[1:] {
		c := libkbfs.ConfigAsUser(config, name)
		c.SetClock(clock)
		configs[i+1] = c
		uids[i+1] = nameToUid(o.t, c)
	}
	return configs, uids
}

func nameToUid(t *testing.T, config libkbfs.Config) keybase1.UID {
	uid, err := config.KBPKI().GetCurrentUID(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return uid
}
