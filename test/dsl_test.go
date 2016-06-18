// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"bytes"
	"fmt"
	"path"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/kbfs/libfs"
	"github.com/keybase/kbfs/libkbfs"
)

type m map[string]string

const (
	alice   = username("alice")
	bob     = username("bob")
	charlie = username("charlie")
	eve     = username("eve")
)

type opt struct {
	usernames                []libkb.NormalizedUsername
	tlfName                  string
	expectedCanonicalTlfName string
	tlfIsPublic              bool
	users                    map[libkb.NormalizedUsername]User
	t                        *testing.T
	initDone                 bool
	engine                   Engine
	blockSize                int64
	blockChangeSize          int64
	clock                    *libkbfs.TestClock
}

func test(t *testing.T, actions ...optionOp) {
	o := &opt{}
	o.engine = createEngine()
	o.engine.Init()
	o.t = t
	defer o.close()
	for _, omod := range actions {
		omod(o)
	}
}

func (o *opt) close() {
	for _, user := range o.users {
		o.expectSuccess("Shutdown", o.engine.Shutdown(user))
	}
}

func (o *opt) runInitOnce() {
	if o.initDone {
		return
	}
	o.clock = &libkbfs.TestClock{}
	o.clock.Set(time.Unix(0, 0))
	o.users = o.engine.InitTest(o.t, o.blockSize, o.blockChangeSize,
		o.usernames, o.clock)
	o.initDone = true
}

func ntimesString(n int, s string) string {
	var bs bytes.Buffer
	for i := 0; i < n; i++ {
		bs.WriteString(s)
	}
	return bs.String()
}

func setBlockSizes(t *testing.T, config libkbfs.Config, blockSize, blockChangeSize int64) {
	// Set the block sizes, if any
	if blockSize > 0 || blockChangeSize > 0 {
		if blockSize == 0 {
			blockSize = 512 * 1024
		}
		if blockChangeSize < 0 {
			t.Fatal("Can't handle negative blockChangeSize")
		}
		if blockChangeSize == 0 {
			blockChangeSize = 8 * 1024
		}
		bsplit, err := libkbfs.NewBlockSplitterSimple(blockSize,
			uint64(blockChangeSize), config.Codec())
		if err != nil {
			t.Fatalf("Couldn't make block splitter for block size %d,"+
				" blockChangeSize %d: %v", blockSize, blockChangeSize, err)
		}
		config.SetBlockSplitter(bsplit)
	}
}

type optionOp func(*opt)

func blockSize(n int64) optionOp {
	return func(o *opt) {
		o.blockSize = n
	}
}

func blockChangeSize(n int64) optionOp {
	return func(o *opt) {
		o.blockChangeSize = n
	}
}

func skip(implementation, reason string) optionOp {
	return func(c *opt) {
		if c.engine.Name() == implementation {
			c.t.Skip(reason)
		}
	}
}

func users(ns ...username) optionOp {
	return func(o *opt) {
		var a []string
		for _, u := range ns {
			username := libkb.NewNormalizedUsername(string(u))
			o.usernames = append(o.usernames, username)
			a = append(a, string(username))
		}
		// Default to the private TLF shared by all the users.
		sort.Strings(a)
		tlfName := strings.Join(a, ",")
		inPrivateTlf(tlfName)(o)
	}
}

func inPrivateTlf(name string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfIsPublic = false
	}
}

func inPrivateTlfNonCanonical(name, expectedCanonicalName string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = expectedCanonicalName
		o.tlfIsPublic = false
	}
}

func inPublicTlf(name string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfIsPublic = true
	}
}

func inPublicTlfNonCanonical(name, expectedCanonicalName string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = expectedCanonicalName
		o.tlfIsPublic = true
	}
}

func addNewAssertion(oldAssertion, newAssertion string) optionOp {
	return func(o *opt) {
		for _, u := range o.users {
			err := o.engine.AddNewAssertion(u, oldAssertion, newAssertion)
			o.expectSuccess("addNewAssertion", err)
		}
	}
}

type fileOp struct {
	operation func(*ctx) error
	flags     fileOpFlags
}
type fileOpFlags uint32

const (
	Defaults = fileOpFlags(0)
	IsInit   = fileOpFlags(1)
)

type ctx struct {
	*opt
	user       User
	rootNode   Node
	noSyncInit bool
}

func runFileOp(c *ctx, fop fileOp) (string, error) {
	if c.rootNode == nil && fop.flags&IsInit == 0 {
		initOp := initRoot()
		err := initOp.operation(c)
		if err != nil {
			return "initRoot", err
		}
	}
	c.t.Log("fop", fop)
	return "File operation", fop.operation(c)
}

func expectError(op fileOp, reason string) fileOp {
	return fileOp{func(c *ctx) error {
		_, err := runFileOp(c, op)
		if err == nil {
			return fmt.Errorf("Didn't get expected error (success while expecting failure): %q", reason)
		}
		// Real filesystems don't give us the exact errors we wish for.
		if c.engine.Name() == "libkbfs" && err.Error() != reason {
			return fmt.Errorf("Got the wrong error: expected %q, got %q", reason, err.Error())
		}
		return nil
	}, IsInit /* So that we can use expectError with e.g. initRoot(). */}
}

func noSync() fileOp {
	return fileOp{func(c *ctx) error {
		c.noSyncInit = true
		return nil
	}, IsInit}
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

func addTime(d time.Duration) fileOp {
	return fileOp{func(c *ctx) error {
		c.clock.Add(d)
		return nil
	}, Defaults}
}

func as(user username, fops ...fileOp) optionOp {
	return func(o *opt) {
		o.t.Log("as", user)
		o.runInitOnce()
		ctx := &ctx{
			opt:  o,
			user: o.users[libkb.NewNormalizedUsername(string(user))],
		}

		for _, fop := range fops {
			desc, err := runFileOp(ctx, fop)
			ctx.expectSuccess(desc, err)
		}
	}
}

// initRoot initializes the root for an invocation of as(). Usually
// not called directly.
func initRoot() fileOp {
	return fileOp{func(c *ctx) error {
		if !c.noSyncInit {
			// Do this before GetRootDir so that we pick
			// up any TLF name changes.
			err := c.engine.SyncFromServerForTesting(c.user, c.tlfName, c.tlfIsPublic)
			if err != nil {
				return err
			}
		}
		root, err := c.engine.GetRootDir(c.user, c.tlfName, c.tlfIsPublic, c.expectedCanonicalTlfName)
		if err != nil {
			return err
		}
		c.rootNode = root
		return nil
	}, IsInit}
}

func mkdir(name string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(name, true, false)
		return err
	}, Defaults}
}

func write(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		f, _, err := c.getNode(name, true, true)
		if err != nil {
			return err
		}
		return c.engine.WriteFile(c.user, f, contents, 0, true)
	}, Defaults}
}

func truncate(name string, size uint64) fileOp {
	return fileOp{func(c *ctx) error {
		f, _, err := c.getNode(name, true, true)
		if err != nil {
			return err
		}
		return c.engine.TruncateFile(c.user, f, size, true)
	}, Defaults}
}

func read(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(name, false, true)
		if err != nil {
			return err
		}
		res, err := c.engine.ReadFile(c.user, file, 0, int64(len(contents)))
		if err != nil {
			return err
		}
		if res != contents {
			return fmt.Errorf("Read (name=%s) got=%d, expected=%d bytes: contents=%s differ from expected=%s", name, len(res), len(contents), res, contents)
		}
		return nil
	}, Defaults}
}

func exists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(filename, false, false)
		return err
	}, Defaults}
}
func notExists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(filename, false, false)
		if err == nil {
			return fmt.Errorf("File that should not exist exists: %q", filename)
		}
		return nil
	}, Defaults}
}

func mkfile(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		f, wasCreated, err := c.getNode(name, true, true)
		if err != nil {
			return err
		}
		if !wasCreated {
			return fmt.Errorf("File %s already existed when mkfile was called",
				name)
		}
		// Skip the write if the requested contents is empty.
		if len(contents) == 0 {
			return nil
		}
		return c.engine.WriteFile(c.user, f, contents, 0, true)
	}, Defaults}
}

func link(fromName, toPath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(fromName)
		parent, _, err := c.getNode(dir, false, false)
		if err != nil {
			return err
		}
		return c.engine.CreateLink(c.user, parent, name, toPath)
	}, Defaults}
}

func setex(filepath string, ex bool) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(filepath, false, true)
		if err != nil {
			return err
		}
		return c.engine.SetEx(c.user, file, ex)
	}, Defaults}
}

func setmtime(filepath string, mtime time.Time) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(filepath, false, true)
		if err != nil {
			return err
		}
		return c.engine.SetMtime(c.user, file, mtime)
	}, Defaults}
}

func mtime(filepath string, expectedMtime time.Time) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(filepath, false, true)
		if err != nil {
			return err
		}
		mtime, err := c.engine.GetMtime(c.user, file)
		if err != nil {
			return err
		}
		if !libfs.TimeEqual(mtime, expectedMtime) {
			return fmt.Errorf("Mtime (name=%s) got=%s, expected=%s", filepath,
				mtime, expectedMtime)
		}
		return nil
	}, Defaults}
}

func rm(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(filepath)
		parent, _, err := c.getNode(dir, false, false)
		if err != nil {
			return err
		}
		return c.engine.RemoveEntry(c.user, parent, name)
	}, Defaults}
}

func rmdir(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(filepath)
		parent, _, err := c.getNode(dir, false, false)
		if err != nil {
			return err
		}
		return c.engine.RemoveDir(c.user, parent, name)
	}, Defaults}
}

func rename(src, dst string) fileOp {
	return fileOp{func(c *ctx) error {
		sdir, sname := path.Split(src)
		sparent, _, err := c.getNode(sdir, false, false)
		if err != nil {
			return err
		}
		ddir, dname := path.Split(dst)
		dparent, _, err := c.getNode(ddir, true, false)
		if err != nil {
			return err
		}
		return c.engine.Rename(c.user, sparent, sname, dparent, dname)
	}, Defaults}
}

func disableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		err := c.engine.SyncFromServerForTesting(c.user, c.tlfName, c.tlfIsPublic)
		if err != nil {
			return err
		}
		return c.engine.DisableUpdatesForTesting(c.user, c.tlfName, c.tlfIsPublic)
	}, IsInit}
}

func reenableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		err := c.engine.ReenableUpdates(c.user, c.tlfName, c.tlfIsPublic)
		if err != nil {
			return err
		}
		return c.engine.SyncFromServerForTesting(c.user, c.tlfName, c.tlfIsPublic)
	}, IsInit}
}

func forceQuotaReclamation() fileOp {
	return fileOp{func(c *ctx) error {
		err := c.engine.ForceQuotaReclamation(c.user, c.tlfName, c.tlfIsPublic)
		if err != nil {
			return err
		}
		return c.engine.SyncFromServerForTesting(c.user, c.tlfName, c.tlfIsPublic)
	}, IsInit}
}

func rekey() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.Rekey(c.user, c.tlfName, c.tlfIsPublic)
	}, IsInit}
}

func lsdir(name string, contents m) fileOp {
	return fileOp{func(c *ctx) error {
		folder, _, err := c.getNode(name, false, false)
		if err != nil {
			return err
		}
		entries, err := c.engine.GetDirChildrenTypes(c.user, folder)
		if err != nil {
			return err
		}
		c.t.Log("lsdir =>", entries)
	outer:
		for restr, ty := range contents {
			re := regexp.MustCompile(restr)
			for node, ty2 := range entries {
				// Windows does not mark "executable" bits in any way.
				if re.MatchString(node) && (ty == ty2 ||
					(c.engine.Name() == "dokan" && ty == "EXEC" && ty2 == "FILE")) {
					delete(entries, node)
					continue outer
				}
			}
			return fmt.Errorf("%s of type %s not found", restr, ty)
		}
		// and make sure everything is matched
		for node, ty := range entries {
			return fmt.Errorf("unexpected %s of type %s found in %s", node, ty, name)
		}
		return nil
	}, Defaults}
}

func (c *ctx) getNode(filepath string, create bool, isFile bool) (
	Node, bool, error) {
	if filepath == "" || filepath == "/" {
		return c.rootNode, false, nil
	}
	if filepath[len(filepath)-1] == '/' {
		filepath = filepath[:len(filepath)-1]
	}
	components := strings.Split(filepath, "/")
	c.t.Log("getNode:", filepath, create, isFile, components, len(components))
	var sym string
	var err error
	var node, parent Node
	parent = c.rootNode
	wasCreated := false
	for i, name := range components {
		node, sym, err = c.engine.Lookup(c.user, parent, name)
		c.t.Log("getNode:", i, name, node, sym, err)
		if err != nil && create {
			if isFile && i+1 == len(components) {
				c.t.Log("getNode: CreateFile")
				node, err = c.engine.CreateFile(c.user, parent, name)
			} else {
				c.t.Log("getNode: CreateDir")
				node, err = c.engine.CreateDir(c.user, parent, name)
			}
			wasCreated = true
		}
		if err != nil {
			return nil, false, err
		}
		parent = node
		if len(sym) > 0 {
			var tmp []string
			if sym[0] == '/' {
				tmp = []string{sym}
			} else {
				tmp = components[:i]
				tmp = append(tmp, sym)
			}
			tmp = append(tmp, components[i+1:]...)
			newpath := path.Clean(path.Join(tmp...))
			c.t.Log("getNode: symlink ", sym, " redirecting to ", newpath)
			return c.getNode(newpath, create, isFile)
		}
	}
	return node, wasCreated, nil
}

// crnameAtTime returns the name of a conflict file, at a given
// duration past the default time.
func crnameAtTime(path string, user username, d time.Duration) string {
	cre := libkbfs.WriterDeviceDateConflictRenamer{}
	return cre.ConflictRenameHelper(time.Unix(0, 0).Add(d), string(user),
		"dev1", path)
}

// crnameAtTimeEsc returns the name of a conflict file with regular
// expression escapes, at a given duration past the default time.
func crnameAtTimeEsc(path string, user username, d time.Duration) string {
	return regexp.QuoteMeta(crnameAtTime(path, user, d))
}

// crname returns the name of a conflict file.
func crname(path string, user username) string {
	return crnameAtTime(path, user, 0)
}

// crnameEsc returns the name of a conflict file with regular expression escapes.
func crnameEsc(path string, user username) string {
	return crnameAtTimeEsc(path, user, 0)
}
