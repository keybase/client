// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package test

import (
	"bytes"
	"fmt"
	"path"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libfs"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/test/clocktest"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
)

type m map[string]string

const (
	alice   = username("alice")
	bob     = username("bob")
	charlie = username("charlie")
	eve     = username("eve")
)

type opt struct {
	ver                      kbfsmd.MetadataVer
	usernames                []kbname.NormalizedUsername
	teams                    teamMap
	implicitTeams            teamMap
	tlfName                  string
	expectedCanonicalTlfName string
	tlfType                  tlf.Type
	tlfRevision              kbfsmd.Revision
	tlfTime                  string
	tlfRelTime               string
	users                    map[kbname.NormalizedUsername]User
	stallers                 map[kbname.NormalizedUsername]*libkbfs.NaïveStaller
	tb                       testing.TB
	initOnce                 sync.Once
	engine                   Engine
	blockSize                int64
	blockChangeSize          int64
	batchSize                int
	bwKBps                   int
	timeout                  time.Duration
	clock                    *clocktest.TestClock
	isParallel               bool
	journal                  bool
}

// run{Test,Benchmark}OverMetadataVers are copied from
// libkbfs/bare_root_metadata_test.go, so as to avoid having libkbfs
// depend on testing.

// Also copy testMetadataVers, so that we can set it independently
// from libkbfs tests.
var testMetadataVers = []kbfsmd.MetadataVer{
	kbfsmd.InitialExtraMetadataVer, kbfsmd.ImplicitTeamsVer,
}

// runTestOverMetadataVers runs the given test function over all
// metadata versions to test.
func runTestOverMetadataVers(
	t *testing.T, f func(t *testing.T, ver kbfsmd.MetadataVer)) {
	for _, ver := range testMetadataVers {
		ver := ver // capture range variable.
		t.Run(ver.String(), func(t *testing.T) {
			// Don't do t.Parallel() for now, as FUSE DSL
			// tests might not like it.
			f(t, ver)
		})
	}
}

// runBenchmarkOverMetadataVers runs the given benchmark function over
// all metadata versions to test.
func runBenchmarkOverMetadataVers(
	b *testing.B, f func(b *testing.B, ver kbfsmd.MetadataVer)) {
	for _, ver := range testMetadataVers {
		ver := ver // capture range variable.
		b.Run(ver.String(), func(b *testing.B) {
			f(b, ver)
		})
	}
}

func runOneTestOrBenchmark(
	tb testing.TB, ver kbfsmd.MetadataVer, actions ...optionOp) {
	o := &opt{
		ver:    ver,
		tb:     tb,
		engine: createEngine(tb),
	}
	defer o.close()
	for _, omod := range actions {
		omod(o)
	}
}

func test(t *testing.T, actions ...optionOp) {
	runTestOverMetadataVers(t, func(t *testing.T, ver kbfsmd.MetadataVer) {
		runOneTestOrBenchmark(t, ver, actions...)
	})
}

func benchmark(b *testing.B, actions ...optionOp) {
	runBenchmarkOverMetadataVers(
		b, func(b *testing.B, ver kbfsmd.MetadataVer) {
			runOneTestOrBenchmark(silentBenchmark{b}, ver, actions...)
		})
}

func parallel(actions ...optionOp) optionOp {
	return func(o *opt) {
		o.isParallel = true
		wg := &sync.WaitGroup{}
		for _, omod := range actions {
			wg.Add(1)
			go func(omod optionOp) {
				omod(o)
				wg.Done()
			}(omod)
		}
		wg.Wait()
	}
}

func sequential(actions ...optionOp) optionOp {
	return func(o *opt) {
		for _, omod := range actions {
			omod(o)
		}
	}
}

type errorList struct {
	el []error
}

func (el errorList) Error() string {
	return fmt.Sprintf("%v", el.el)
}

func (o *opt) close() {
	var el []error
	// Make sure Shutdown is called properly for every user, even
	// if any of the calls fail.
	for _, user := range o.users {
		err := o.engine.Shutdown(user)
		if err != nil {
			el = append(el, err)
		}
	}

	var err error
	if len(el) > 0 {
		err = errorList{el}
	}

	o.expectSuccess("Shutdown", err)
}

func (o *opt) runInitOnce() {
	o.initOnce.Do(func() {
		o.clock = &clocktest.TestClock{}
		o.clock.Set(time.Unix(1, 0))
		o.users = o.engine.InitTest(o.ver, o.blockSize,
			o.blockChangeSize, o.batchSize, o.bwKBps, o.timeout, o.usernames,
			o.teams, o.implicitTeams, o.clock, o.journal)
		o.stallers = o.makeStallers()
	})
}

func (o *opt) makeStallers() (
	stallers map[kbname.NormalizedUsername]*libkbfs.NaïveStaller) {
	stallers = make(map[kbname.NormalizedUsername]*libkbfs.NaïveStaller)
	for username, user := range o.users {
		stallers[username] = o.engine.MakeNaïveStaller(user)
	}
	return stallers
}

func ntimesString(n int, s string) string {
	var bs bytes.Buffer
	for i := 0; i < n; i++ {
		bs.WriteString(s)
	}
	return bs.String()
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

func batchSize(n int) optionOp {
	return func(o *opt) {
		o.batchSize = n
	}
}

func bandwidth(n int) optionOp {
	return func(o *opt) {
		o.bwKBps = n
	}
}

func opTimeout(n time.Duration) optionOp {
	return func(o *opt) {
		o.timeout = n
	}
}

func journal() optionOp {
	return func(o *opt) {
		o.journal = true
	}
}

func skip(implementation, reason string) optionOp {
	return func(o *opt) {
		if o.engine.Name() == implementation {
			o.tb.Skip(reason)
		}
	}
}

func users(ns ...username) optionOp {
	return func(o *opt) {
		var a []string
		for _, u := range ns {
			username := kbname.NewNormalizedUsername(string(u))
			o.usernames = append(o.usernames, username)
			a = append(a, string(username))
		}
		// Default to the private TLF shared by all the users.
		sort.Strings(a)
		tlfName := strings.Join(a, ",")
		inPrivateTlf(tlfName)(o)
	}
}

func team(teamName kbname.NormalizedUsername, writers string,
	readers string) optionOp {
	return func(o *opt) {
		if o.ver < kbfsmd.SegregatedKeyBundlesVer {
			o.tb.Skip("mdv2 doesn't support teams")
		}
		if o.teams == nil {
			o.teams = make(teamMap)
		}
		var writerNames, readerNames []kbname.NormalizedUsername
		for _, w := range strings.Split(writers, ",") {
			writerNames = append(writerNames, kbname.NormalizedUsername(w))
		}
		if readers != "" {
			for _, r := range strings.Split(readers, ",") {
				readerNames = append(readerNames, kbname.NormalizedUsername(r))
			}
		}
		o.teams[teamName] = teamMembers{writerNames, readerNames}
	}
}

func implicitTeam(writers string, readers string) optionOp {
	return func(o *opt) {
		if o.ver < kbfsmd.ImplicitTeamsVer {
			o.tb.Skip("mdv2 doesn't support teams")
		}
		if o.implicitTeams == nil {
			o.implicitTeams = make(teamMap)
		}

		var writerNames, readerNames []kbname.NormalizedUsername
		for _, w := range strings.Split(writers, ",") {
			writerNames = append(writerNames, kbname.NormalizedUsername(w))
		}
		isPublic := false
		if readers != "" {
			for _, r := range strings.Split(readers, ",") {
				readerNames = append(readerNames, kbname.NormalizedUsername(r))
			}
			isPublic = len(readerNames) == 1 && readers == "public"
		}
		var teamName tlf.CanonicalName
		if isPublic {
			teamName = tlf.MakeCanonicalName(
				writerNames, nil, nil, nil, nil)
		} else {
			teamName = tlf.MakeCanonicalName(
				writerNames, nil, readerNames, nil, nil)
		}
		o.implicitTeams[kbname.NormalizedUsername(teamName)] =
			teamMembers{writerNames, readerNames}
	}
}

func inPrivateTlf(name string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfType = tlf.Private
	}
}

func inPrivateTlfAtRevision(name string, rev kbfsmd.Revision) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfType = tlf.Private
		o.tlfRevision = rev
	}
}

func inPrivateTlfAtTime(name string, timeString string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfType = tlf.Private
		o.tlfTime = timeString
	}
}

func inPrivateTlfAtRelativeTime(name string, relTimeString string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfType = tlf.Private
		o.tlfRelTime = relTimeString
	}
}

func inPrivateTlfNonCanonical(name, expectedCanonicalName string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = expectedCanonicalName
		o.tlfType = tlf.Private
	}
}

func inPublicTlf(name string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfType = tlf.Public
	}
}

func inPublicTlfNonCanonical(name, expectedCanonicalName string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = expectedCanonicalName
		o.tlfType = tlf.Public
	}
}

func inSingleTeamTlf(name string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = name
		o.tlfType = tlf.SingleTeam
	}
}

func inSingleTeamNonCanonical(name, expectedCanonicalName string) optionOp {
	return func(o *opt) {
		o.tlfName = name
		o.expectedCanonicalTlfName = expectedCanonicalName
		o.tlfType = tlf.SingleTeam
	}
}

func addNewAssertion(oldAssertion, newAssertion string) optionOp {
	return func(o *opt) {
		o.tb.Logf("addNewAssertion: %q -> %q", oldAssertion, newAssertion)
		for _, u := range o.users {
			err := o.engine.AddNewAssertion(u, oldAssertion, newAssertion)
			o.expectSuccess("addNewAssertion", err)
			// Sync the TLF to wait for the TLF handle change
			// notifications to be processed. Ignore the error since
			// the user might not even have access to that TLF.
			_ = o.engine.SyncFromServer(u, o.tlfName, o.tlfType)
		}
	}
}

func changeTeamName(oldName, newName string) optionOp {
	return func(o *opt) {
		o.teams[kbname.NormalizedUsername(newName)] =
			o.teams[kbname.NormalizedUsername(oldName)]
		delete(o.teams, kbname.NormalizedUsername(oldName))
		o.tb.Logf("changeTeamName: %q -> %q", oldName, newName)
		for _, u := range o.users {
			err := o.engine.ChangeTeamName(u, oldName, newName)
			o.expectSuccess("changeTeamName", err)
		}
	}
}

type fileOp struct {
	operation   func(*ctx) error
	flags       fileOpFlags
	description string
}
type fileOpFlags uint32

const (
	Defaults = fileOpFlags(0)
	IsInit   = fileOpFlags(1)
)

type ctx struct {
	*opt
	user       User
	username   kbname.NormalizedUsername
	rootNode   Node
	noSyncInit bool
	staller    *libkbfs.NaïveStaller
	noSyncEnd  bool
}

func runFileOpHelper(c *ctx, fop fileOp) (string, error) {
	desc := fmt.Sprintf("(%s) %s", c.username, fop.description)
	c.tb.Log(desc)
	err := fop.operation(c)
	if err != nil {
		c.tb.Logf("%s failed with %s", desc, err)
	}
	return desc, err
}

func runFileOp(c *ctx, fop fileOp) (string, error) {
	if c.rootNode == nil && fop.flags&IsInit == 0 {
		initOp := initRoot()
		desc, err := runFileOpHelper(c, initOp)
		if err != nil {
			desc = fmt.Sprintf("%s for %s", desc, fop.description)
			return desc, err
		}
	}
	return runFileOpHelper(c, fop)
}

func expectError(op fileOp, reasonPrefix string) fileOp {
	return fileOp{func(c *ctx) error {
		_, err := runFileOp(c, op)
		if err == nil {
			return fmt.Errorf("Didn't get expected error (success while expecting failure): %q", reasonPrefix)
		}
		// Real filesystems don't give us the exact errors we wish for.
		if c.engine.Name() == "libkbfs" &&
			!strings.HasPrefix(err.Error(), reasonPrefix) {
			return fmt.Errorf("Got the wrong error: expected prefix %q, got %q", reasonPrefix, err.Error())
		}
		return nil
	}, IsInit, /* So that we can use expectError with e.g. initRoot(). */
		fmt.Sprintf("expectError(%s, %s)",
			op.description, reasonPrefix)}
}

func noSync() fileOp {
	return fileOp{func(c *ctx) error {
		c.noSyncInit = true
		return nil
	}, IsInit, "noSync()"}
}

func resetTimer() fileOp {
	return fileOp{func(c *ctx) error {
		switch b := c.tb.(type) {
		case *testing.B:
			b.ResetTimer()
		case silentBenchmark:
			b.ResetTimer()
		}
		return nil
	}, Defaults, "resetTimer()"}
}

func startTimer() fileOp {
	return fileOp{func(c *ctx) error {
		switch b := c.tb.(type) {
		case *testing.B:
			b.StartTimer()
		case silentBenchmark:
			b.StartTimer()
		}
		return nil
	}, Defaults, "startTimer()"}
}

func stopTimer() fileOp {
	return fileOp{func(c *ctx) error {
		switch b := c.tb.(type) {
		case *testing.B:
			b.StopTimer()
		case silentBenchmark:
			b.StopTimer()
		}
		return nil
	}, Defaults, "stopTimer()"}
}

func getBenchN(n *int) fileOp {
	return fileOp{func(c *ctx) error {
		switch b := c.tb.(type) {
		case *testing.B:
			*n = b.N
		case silentBenchmark:
			*n = b.N
		}
		return nil
	}, Defaults, "getBenchN()"}
}

// noSyncEnd turns off the SyncFromServer call at the end of each `as`
// block.  It's also turned off by a `disableUpdates()` call or a
// `noSync()` call.
func noSyncEnd() fileOp {
	return fileOp{func(c *ctx) error {
		c.noSyncEnd = true
		return nil
	}, IsInit, "noSyncEnd()"}
}

func (o *opt) expectSuccess(reason string, err error) {
	if err != nil {
		if o.isParallel {
			// FailNow/Fatalf can only be called from the goroutine running the Test
			// function. In parallel tests, this is not always true. So we use Errorf
			// to mark the test as failed without an implicit FailNow.
			o.tb.Errorf("Error %s: %v", reason, err)
		} else {
			o.tb.Fatalf("Error %s: %v", reason, err)
		}
	}
}

func addTime(d time.Duration) fileOp {
	return fileOp{func(c *ctx) error {
		c.clock.Add(d)
		return nil
	}, Defaults, fmt.Sprintf("addTime(%s)", d)}
}

func as(user username, fops ...fileOp) optionOp {
	return func(o *opt) {
		o.tb.Log("as:", user)
		o.runInitOnce()
		u := kbname.NewNormalizedUsername(string(user))
		ctx := &ctx{
			opt:      o,
			user:     o.users[u],
			username: u,
			staller:  o.stallers[u],
		}

		for _, fop := range fops {
			desc, err := runFileOp(ctx, fop)
			ctx.expectSuccess(desc, err)
		}

		// Sync everything to disk after this round of operations.
		if !ctx.noSyncInit {
			err := ctx.engine.SyncAll(ctx.user, ctx.tlfName, ctx.tlfType)
			ctx.expectSuccess("SyncAll", err)
			if !ctx.noSyncEnd {
				err := ctx.engine.SyncFromServer(
					ctx.user, ctx.tlfName, ctx.tlfType)
				ctx.expectSuccess("SyncFromServer", err)
			}
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
			err := c.engine.SyncFromServer(c.user, c.tlfName, c.tlfType)
			if err != nil {
				return err
			}
		}
		var root Node
		var err error
		switch {
		case c.tlfRevision != kbfsmd.RevisionUninitialized:
			root, err = c.engine.GetRootDirAtRevision(
				c.user, c.tlfName, c.tlfType, c.tlfRevision,
				c.expectedCanonicalTlfName)
		case c.tlfTime != "":
			root, err = c.engine.GetRootDirAtTimeString(
				c.user, c.tlfName, c.tlfType, c.tlfTime,
				c.expectedCanonicalTlfName)
		case c.tlfRelTime != "":
			root, err = c.engine.GetRootDirAtRelTimeString(
				c.user, c.tlfName, c.tlfType, c.tlfRelTime,
				c.expectedCanonicalTlfName)
		default:
			root, err = c.engine.GetRootDir(
				c.user, c.tlfName, c.tlfType, c.expectedCanonicalTlfName)
		}
		if err != nil {
			return err
		}
		c.rootNode = root
		return nil
	}, IsInit, "initRoot()"}
}

func custom(f func(func(fileOp) error) error) fileOp {
	return fileOp{func(c *ctx) error {
		return f(func(fop fileOp) error { return fop.operation(c) })
	}, Defaults, "custom()"}
}

func mkdir(name string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(name, createDir, resolveAllSyms)
		return err
	}, Defaults, fmt.Sprintf("mkdir(%s)", name)}
}

func write(name string, contents string) fileOp {
	return writeBS(name, []byte(contents))
}

func writeBS(name string, contents []byte) fileOp {
	return pwriteBS(name, contents, 0)
}

func pwriteBS(name string, contents []byte, off int64) fileOp {
	return pwriteBSSync(name, contents, off, true)
}

func pwriteBSSync(name string, contents []byte, off int64, sync bool) fileOp {
	return fileOp{func(c *ctx) error {
		f, _, err := c.getNode(name, createFile, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.WriteFile(c.user, f, contents, off, sync)
	}, Defaults, fmt.Sprintf("pwriteBSSync(%s, %d bytes, off=%d, sync=%t)",
		name, len(contents), off, sync)}
}

func truncate(name string, size uint64) fileOp {
	return fileOp{func(c *ctx) error {
		f, _, err := c.getNode(name, createFile, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.TruncateFile(c.user, f, size, true)
	}, Defaults, fmt.Sprintf("truncate(%s, %d)", name, size)}
}

func read(name string, contents string) fileOp {
	return preadBS(name, []byte(contents), 0)
}
func preadBS(name string, contents []byte, at int64) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(name, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		bs := make([]byte, len(contents))
		l, err := c.engine.ReadFile(c.user, file, at, bs)
		if err != nil {
			return err
		}
		bs = bs[:l]
		if !bytes.Equal(bs, contents) {
			return fmt.Errorf("Read (name=%s) got=%d, expected=%d bytes: contents=%s differ from expected=%s", name, len(bs), len(contents), bs, contents)
		}
		return nil
	}, Defaults, fmt.Sprintf("preadBS(%s, %d bytes, at=%d)",
		name, len(contents), at)}
}

func exists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(filename, noCreate, resolveAllSyms)
		return err
	}, Defaults, fmt.Sprintf("exists(%s)", filename)}
}
func notExists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(filename, noCreate, resolveAllSyms)
		if err == nil {
			return fmt.Errorf("File that should not exist exists: %q", filename)
		}
		return nil
	}, Defaults, fmt.Sprintf("notExists(%s)", filename)}
}

func mkfileexcl(name string) fileOp {
	return fileOp{func(c *ctx) error {
		_, _, err := c.getNode(name, createFileExcl, resolveAllSyms)
		return err
	}, Defaults, fmt.Sprintf("mkfileexcl(%s)", name)}
}

func mkfile(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		f, wasCreated, err := c.getNode(name, createFile, resolveAllSyms)
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
		return c.engine.WriteFile(c.user, f, []byte(contents), 0, true)
	}, Defaults, fmt.Sprintf("mkfile(%s, %d bytes)", name, len(contents))}
}

func link(fromName, toPath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(fromName)
		parent, _, err := c.getNode(dir, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.CreateLink(c.user, parent, name, toPath)
	}, Defaults, fmt.Sprintf("link(%s => %s)", fromName, toPath)}
}

func setex(filepath string, ex bool) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(filepath, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.SetEx(c.user, file, ex)
	}, Defaults, fmt.Sprintf("setex(%s, %t)", filepath, ex)}
}

func setmtime(filepath string, mtime time.Time) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(filepath, noCreate, dontResolveFinalSym)
		if err != nil {
			return err
		}
		return c.engine.SetMtime(c.user, file, mtime)
	}, Defaults, fmt.Sprintf("setmtime(%s, %s)", filepath, mtime)}
}

func mtime(filepath string, expectedMtime time.Time) fileOp {
	return fileOp{func(c *ctx) error {
		// If the expected time is zero, use the clock's current time.
		if expectedMtime.IsZero() {
			expectedMtime = c.clock.Now()
		}

		file, _, err := c.getNode(filepath, noCreate, dontResolveFinalSym)
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
	}, Defaults, fmt.Sprintf("mtime(%s, %s)", filepath, expectedMtime)}
}

func rm(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(filepath)
		parent, _, err := c.getNode(dir, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.RemoveEntry(c.user, parent, name)
	}, Defaults, fmt.Sprintf("rm(%s)", filepath)}
}

func rmdir(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(filepath)
		parent, _, err := c.getNode(dir, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.RemoveDir(c.user, parent, name)
	}, Defaults, fmt.Sprintf("rmdir(%s)", filepath)}
}

func rename(src, dst string) fileOp {
	return fileOp{func(c *ctx) error {
		sdir, sname := path.Split(src)
		sparent, _, err := c.getNode(sdir, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		ddir, dname := path.Split(dst)
		dparent, _, err := c.getNode(ddir, createDir, resolveAllSyms)
		if err != nil {
			return err
		}
		return c.engine.Rename(c.user, sparent, sname, dparent, dname)
	}, Defaults, fmt.Sprintf("rename(%s => %s)", src, dst)}
}

func disableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		c.noSyncEnd = true
		err := c.engine.SyncFromServer(c.user, c.tlfName, c.tlfType)
		if err != nil {
			return err
		}
		return c.engine.DisableUpdatesForTesting(c.user, c.tlfName, c.tlfType)
	}, IsInit, "disableUpdates()"}
}

func stallOnMDPut() fileOp {
	return fileOp{func(c *ctx) error {
		// TODO: Allow test to pass in a more precise maxStalls limit.
		c.staller.StallMDOp(libkbfs.StallableMDPut, 100, false)
		return nil
	}, Defaults, "stallOnMDPut()"}
}

func waitForStalledMDPut() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.WaitForStallMDOp(libkbfs.StallableMDPut)
		return nil
	}, IsInit, "waitForStalledMDPut()"}
}

func undoStallOnMDPut() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UndoStallMDOp(libkbfs.StallableMDPut)
		return nil
	}, IsInit, "undoStallOnMDPut()"}
}

func stallOnMDGetForTLF() fileOp {
	return fileOp{func(c *ctx) error {
		// TODO: Allow test to pass in a more precise maxStalls limit.
		c.staller.StallMDOp(libkbfs.StallableMDGetForTLF, 100, false)
		return nil
	}, Defaults, "stallOnMDGetForTLF()"}
}

func waitForStalledMDGetForTLF() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.WaitForStallMDOp(libkbfs.StallableMDGetForTLF)
		return nil
	}, IsInit, "waitForStalledMDGetForTLF()"}
}

func unstallOneMDGetForTLF() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UnstallOneMDOp(libkbfs.StallableMDGetForTLF)
		return nil
	}, IsInit, "unstallOneMDGetForTLF()"}
}

func undoStallOnMDGetForTLF() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UndoStallMDOp(libkbfs.StallableMDGetForTLF)
		return nil
	}, IsInit, "undoStallOnMDGetForTLF()"}
}

func stallOnMDGetRange() fileOp {
	return fileOp{func(c *ctx) error {
		// TODO: Allow test to pass in a more precise maxStalls limit.
		c.staller.StallMDOp(libkbfs.StallableMDGetRange, 100, false)
		return nil
	}, Defaults, "stallOnMDGetRange()"}
}

func waitForStalledMDGetRange() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.WaitForStallMDOp(libkbfs.StallableMDGetRange)
		return nil
	}, IsInit, "waitForStalledMDGetRange()"}
}

func unstallOneMDGetRange() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UnstallOneMDOp(libkbfs.StallableMDGetRange)
		return nil
	}, IsInit, "unstallOneMDGetRange()"}
}

func undoStallOnMDGetRange() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UndoStallMDOp(libkbfs.StallableMDGetRange)
		return nil
	}, IsInit, "undoStallOnMDGetRange()"}
}

func stallOnMDResolveBranch() fileOp {
	return fileOp{func(c *ctx) error {
		// TODO: Allow test to pass in a more precise maxStalls limit.
		c.staller.StallMDOp(libkbfs.StallableMDResolveBranch, 100, false)
		return nil
	}, Defaults, "stallOnMDResolveBranch()"}
}

func waitForStalledMDResolveBranch() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.WaitForStallMDOp(libkbfs.StallableMDResolveBranch)
		return nil
	}, IsInit, "waitForStalledMDResolveBranch()"}
}

func unstallOneMDResolveBranch() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UnstallOneMDOp(libkbfs.StallableMDResolveBranch)
		return nil
	}, IsInit, "unstallOneMDResolveBranch()"}
}

func undoStallOnMDResolveBranch() fileOp {
	return fileOp{func(c *ctx) error {
		c.staller.UndoStallMDOp(libkbfs.StallableMDResolveBranch)
		return nil
	}, IsInit, "undoStallOnMDResolveBranch()"}
}

func reenableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		c.noSyncEnd = false
		err := c.engine.ReenableUpdates(c.user, c.tlfName, c.tlfType)
		if err != nil {
			return err
		}
		return c.engine.SyncFromServer(c.user, c.tlfName, c.tlfType)
	}, IsInit, "reenableUpdates()"}
}

func reenableUpdatesNoSync() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.ReenableUpdates(c.user, c.tlfName, c.tlfType)
	}, IsInit, "reenableUpdatesNoSync()"}
}

func forceQuotaReclamation() fileOp {
	return fileOp{func(c *ctx) error {
		err := c.engine.ForceQuotaReclamation(c.user, c.tlfName, c.tlfType)
		if err != nil {
			return err
		}
		// Wait for QR to finish.
		return c.engine.SyncFromServer(c.user, c.tlfName, c.tlfType)
	}, IsInit, "forceQuotaReclamation()"}
}

func rekey() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.Rekey(c.user, c.tlfName, c.tlfType)
	}, IsInit, "rekey()"}
}

func enableJournal() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.EnableJournal(c.user, c.tlfName, c.tlfType)
	}, IsInit, "enableJournal()"}
}

func pauseJournal() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.PauseJournal(c.user, c.tlfName, c.tlfType)
	}, IsInit, "pauseJournal()"}
}

func resumeJournal() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.ResumeJournal(c.user, c.tlfName, c.tlfType)
	}, IsInit, "resumeJournal()"}
}

func flushJournal() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.FlushJournal(c.user, c.tlfName, c.tlfType)
	}, IsInit, "flushJournal()"}
}

func checkUnflushedPaths(expectedPaths []string) fileOp {
	return fileOp{func(c *ctx) error {
		paths, err := c.engine.UnflushedPaths(c.user, c.tlfName, c.tlfType)
		if err != nil {
			return err
		}

		sort.Strings(expectedPaths)
		sort.Strings(paths)
		if !reflect.DeepEqual(expectedPaths, paths) {
			return fmt.Errorf("Expected unflushed paths %v, got %v",
				expectedPaths, paths)
		}
		return nil
	}, IsInit, fmt.Sprintf("checkUnflushedPaths(%s)", expectedPaths)}
}

func checkPrevRevisions(filepath string, counts []uint8) fileOp {
	return fileOp{func(c *ctx) error {
		file, _, err := c.getNode(filepath, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		pr, err := c.engine.GetPrevRevisions(c.user, file)
		if err != nil {
			return err
		}
		if len(pr) != len(counts) {
			return fmt.Errorf("Wrong number of prev revisions: %v", pr)
		}
		for i, c := range counts {
			if c != pr[i].Count {
				return fmt.Errorf("Unexpected prev revision counts: %v", pr)
			}
		}
		return nil
	}, Defaults, fmt.Sprintf("prevRevisions(%s, %v)", filepath, counts)}
}

type expectedEdit struct {
	tlfName      string
	tlfType      keybase1.FolderType
	writer       string
	files        []string
	deletedFiles []string
}

func checkUserEditHistoryWithSort(
	expectedEdits []expectedEdit, doSort bool) fileOp {
	return fileOp{func(c *ctx) error {
		history, err := c.engine.UserEditHistory(c.user)
		if err != nil {
			return err
		}

		// Convert the history to expected edits.
		hEdits := make([]expectedEdit, len(history))
		for i, h := range history {
			if len(h.History) != 1 {
				return fmt.Errorf(
					"Unexpected history of size %d: %#v", len(h.History), h)
			}
			hEdits[i].tlfName = h.Folder.Name
			hEdits[i].tlfType = h.Folder.FolderType
			hEdits[i].writer = h.History[0].WriterName
			for _, we := range h.History[0].Edits {
				hEdits[i].files = append(hEdits[i].files, we.Filename)
			}
			if doSort {
				sort.Strings(hEdits[i].files)
				sort.Strings(expectedEdits[i].files)
			}
			for _, we := range h.History[0].Deletes {
				hEdits[i].deletedFiles = append(
					hEdits[i].deletedFiles, we.Filename)
			}
			if doSort {
				sort.Strings(hEdits[i].deletedFiles)
				sort.Strings(expectedEdits[i].deletedFiles)
			}
		}

		if !reflect.DeepEqual(expectedEdits, hEdits) {
			return fmt.Errorf("Expected edit history %v, got %v",
				expectedEdits, hEdits)
		}
		return nil
	}, Defaults, "checkUserEditHistory()"}
}

func checkUserEditHistory(expectedEdits []expectedEdit) fileOp {
	return checkUserEditHistoryWithSort(expectedEdits, false)
}

func checkDirtyPaths(expectedPaths []string) fileOp {
	return fileOp{func(c *ctx) error {
		paths, err := c.engine.DirtyPaths(c.user, c.tlfName, c.tlfType)
		if err != nil {
			return err
		}

		sort.Strings(expectedPaths)
		sort.Strings(paths)
		if !reflect.DeepEqual(expectedPaths, paths) {
			return fmt.Errorf("Expected dirty paths %v, got %v",
				expectedPaths, paths)
		}
		return nil
	}, IsInit, fmt.Sprintf("checkDirtyPaths(%s)", expectedPaths)}
}

func forceConflict() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.ForceConflict(c.user, c.tlfName, c.tlfType)
	}, IsInit, "forceConflict()"}
}

func clearConflicts() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.ClearConflicts(c.user, c.tlfName, c.tlfType)
	}, IsInit, "clearConflicts()"}
}

func lsfavoritesOp(c *ctx, expected []string, t tlf.Type) error {
	favorites, err := c.engine.GetFavorites(c.user, t)
	if err != nil {
		return err
	}
	c.tb.Log("lsfavorites", t, "=>", favorites)
	for _, f := range expected {
		if favorites[f] {
			delete(favorites, f)
			continue
		}

		p, err := tlf.CanonicalToPreferredName(c.username, tlf.CanonicalName(f))
		if err != nil {
			return err
		}
		if favorites[string(p)] {
			delete(favorites, string(p))
		} else {
			return fmt.Errorf("Missing favorite %s", f)
		}
	}

	for f := range favorites {
		return fmt.Errorf("Unexpected favorite %s", f)
	}
	return nil
}

func lspublicfavorites(contents []string) fileOp {
	return fileOp{func(c *ctx) error {
		return lsfavoritesOp(c, contents, tlf.Public)
	}, Defaults, fmt.Sprintf("lspublicfavorites(%s)", contents)}
}

func lsprivatefavorites(contents []string) fileOp {
	return fileOp{func(c *ctx) error {
		return lsfavoritesOp(c, contents, tlf.Private)
	}, Defaults, fmt.Sprintf("lsprivatefavorites(%s)", contents)}
}

func lsteamfavorites(contents []string) fileOp {
	return fileOp{func(c *ctx) error {
		return lsfavoritesOp(c, contents, tlf.SingleTeam)
	}, Defaults, fmt.Sprintf("lsteamfavorites(%s)", contents)}
}

func lsdir(name string, contents m) fileOp {
	return fileOp{func(c *ctx) error {
		folder, _, err := c.getNode(name, noCreate, resolveAllSyms)
		if err != nil {
			return err
		}
		entries, err := c.engine.GetDirChildrenTypes(c.user, folder)
		if err != nil {
			return err
		}
		c.tb.Log("lsdir =>", entries)
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
	}, Defaults, fmt.Sprintf("lsdir(%s, %d bytes)", name, len(contents))}
}

// createType specifies whether getNode should create any nodes that
// don't exist.
type createType int

const (
	noCreate createType = iota
	createDir
	createFile
	createFileExcl
)

func (c createType) String() string {
	switch c {
	case noCreate:
		return "noCreate"
	case createDir:
		return "createDir"
	case createFile:
		return "createFile"
	case createFileExcl:
		return "createFileExcl"
	default:
		return fmt.Sprintf("unknownCreateType:%d", c)
	}
}

// symBehavior specifies what getNode should do with symlinks.
type symBehavior int

const (
	resolveAllSyms symBehavior = iota
	dontResolveFinalSym
)

func (c *ctx) getNode(filepath string, create createType, sym symBehavior) (
	Node, bool, error) {
	if filepath == "" || filepath == "/" {
		return c.rootNode, false, nil
	}
	if filepath[len(filepath)-1] == '/' {
		filepath = filepath[:len(filepath)-1]
	}
	components := strings.Split(filepath, "/")
	c.tb.Log("getNode:", filepath, create, components, len(components))
	var symPath string
	var err error
	var node, parent Node
	parent = c.rootNode
	wasCreated := false
	for i, name := range components {
		node, symPath, err = c.engine.Lookup(c.user, parent, name)
		c.tb.Log("getNode:", i, name, node, symPath, err)

		if i+1 == len(components) { // last element in path
			switch {
			case err == nil:
				if create == createFileExcl {
					return nil, false, data.NameExistsError{}
				}
			case create == createFileExcl:
				c.tb.Log("getNode: CreateFileExcl")
				node, err = c.engine.CreateFileExcl(c.user, parent, name)
				wasCreated = true
			case create == createFile:
				c.tb.Log("getNode: CreateFile")
				node, err = c.engine.CreateFile(c.user, parent, name)
				wasCreated = true
			case create == createDir:
				c.tb.Log("getNode: CreateDir")
				node, err = c.engine.CreateDir(c.user, parent, name)
				wasCreated = true
			case create == noCreate:
				// let it error!
			default:
				panic("unreachable")
			}
		} else if err != nil && create != noCreate {
			// intermediate element in path
			c.tb.Log("getNode: CreateDir")
			node, err = c.engine.CreateDir(c.user, parent, name)
			wasCreated = true
		} // otherwise let it error!

		if err != nil {
			return nil, false, err
		}

		parent = node
		// If this is a symlink, and either we're supposed to resolve
		// all symlinks or this isn't the final one in the path, then
		// go ahead and recurse on the resolved path.
		if len(symPath) > 0 &&
			(sym == resolveAllSyms || i != len(components)-1) {
			var tmp []string
			if symPath[0] == '/' {
				tmp = []string{symPath}
			} else {
				tmp = components[:i]
				tmp = append(tmp, symPath)
			}
			tmp = append(tmp, components[i+1:]...)
			newpath := path.Clean(path.Join(tmp...))
			c.tb.Log("getNode: symlink ", symPath, " redirecting to ", newpath)
			return c.getNode(newpath, create, sym)
		}
	}
	return node, wasCreated, nil
}

// crnameAtTime returns the name of a conflict file, at a given
// duration past the default time.
func crnameAtTime(path string, user username, d time.Duration) string {
	cre := libkbfs.WriterDeviceDateConflictRenamer{}
	return cre.ConflictRenameHelper(time.Unix(1, 0).Add(d), string(user),
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

type silentBenchmark struct{ *testing.B }

func (silentBenchmark) Log(args ...interface{})                 {}
func (silentBenchmark) Logf(format string, args ...interface{}) {}
