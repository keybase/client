// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !dokan,!fuse

package test

import (
	"errors"
	"fmt"
	"path"
	"regexp"
	"strings"
	"testing"
)

type opt struct {
	readerNames     []username
	writerNames     []username
	users           map[string]User
	t               *testing.T
	initDone        bool
	engine          Engine
	readers         []string
	writers         []string
	blockSize       int64
	blockChangeSize int64
}

func test(t *testing.T, actions ...optionOp) {
	o := &opt{}
	o.engine = &LibKBFS{}
	o.engine.Init()
	o.t = t
	for _, omod := range actions {
		omod(o)
	}
	for _, user := range o.users {
		o.expectSuccess("Shutdown", o.engine.Shutdown(user))
	}
}

func (o *opt) runInitOnce() {
	if o.initDone {
		return
	}
	userSlice := concatUserNamesToStrings2(o.writerNames, o.readerNames)
	o.users = o.engine.InitTest(o.t, o.blockSize, o.blockChangeSize, userSlice...)

	for _, uname := range o.readerNames {
		uid := string(o.engine.GetUID(o.users[string(uname)]))
		o.readers = append(o.readers, uid)
	}
	for _, uname := range o.writerNames {
		uid := string(o.engine.GetUID(o.users[string(uname)]))
		o.writers = append(o.writers, uid)
	}

	o.initDone = true
}

const realFS = false

type ctx struct {
	*opt
	user       User
	rootNode   Node
	noSyncInit bool
}

func as(user username, fops ...fileOp) optionOp {
	return func(o *opt) {
		o.t.Log("as", user)
		o.runInitOnce()
		ctx := &ctx{
			opt:  o,
			user: o.users[string(user)],
		}
		root, err := o.engine.GetRootDir(ctx.user, false, o.writers, o.readers)
		ctx.expectSuccess("GetRootDir", err)
		ctx.rootNode = root

		initDone := false
		for _, fop := range fops {
			if !initDone && fop.flags&IsInit == 0 {
				if !ctx.noSyncInit {
					err = o.engine.SyncFromServer(ctx.user, ctx.rootNode)
					ctx.expectSuccess("SyncFromServer", err)
				}
				initDone = true
			}
			o.t.Log("fop", fop)
			err = fop.operation(ctx)
			ctx.expectSuccess("File operation", err)
		}
	}
}

func mkdir(name string) fileOp {
	return fileOp{func(c *ctx) error {
		_, err := c.getNode(name, true, false)
		return err
	}, Defaults}
}

func write(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		f, err := c.getNode(name, true, true)
		if err != nil {
			return err
		}
		return c.engine.WriteFile(c.user, f, contents, 0, true)
	}, Defaults}
}

func read(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		file, err := c.getNode(name, false, true)
		if err != nil {
			return err
		}
		res, err := c.engine.ReadFile(c.user, file, 0, int64(len(contents)))
		if err != nil {
			return err
		}
		if res != contents {
			return errors.New("Read contents differ from expected")
		}
		return nil
	}, Defaults}
}

func exists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		_, err := c.getNode(filename, false, false)
		return err
	}, Defaults}
}
func notExists(filename string) fileOp {
	return fileOp{func(c *ctx) error {
		_, err := c.getNode(filename, false, false)
		if err == nil {
			return fmt.Errorf("File that should not exist exists: %q", filename)
		}
		return nil
	}, Defaults}
}

func mkfile(name string, contents string) fileOp {
	return fileOp{func(c *ctx) error {
		f, err := c.getNode(name, true, true)
		if err != nil {
			return err
		}
		return c.engine.WriteFile(c.user, f, contents, 0, true)
	}, Defaults}
}

func link(fromName, toPath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(fromName)
		parent, err := c.getNode(dir, false, false)
		if err != nil {
			return err
		}
		return c.engine.CreateLink(c.user, parent, name, toPath)
	}, Defaults}
}

func setex(filepath string, ex bool) fileOp {
	return fileOp{func(c *ctx) error {
		file, err := c.getNode(filepath, false, true)
		if err != nil {
			return err
		}
		return c.engine.SetEx(c.user, file, ex)
	}, Defaults}
}

func rm(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(filepath)
		parent, err := c.getNode(dir, false, false)
		if err != nil {
			return err
		}
		return c.engine.RemoveEntry(c.user, parent, name)
	}, Defaults}
}

func rmdir(filepath string) fileOp {
	return fileOp{func(c *ctx) error {
		dir, name := path.Split(filepath)
		parent, err := c.getNode(dir, false, false)
		if err != nil {
			return err
		}
		return c.engine.RemoveDir(c.user, parent, name)
	}, Defaults}
}

func rename(src, dst string) fileOp {
	return fileOp{func(c *ctx) error {
		sdir, sname := path.Split(src)
		sparent, err := c.getNode(sdir, false, false)
		if err != nil {
			return err
		}
		ddir, dname := path.Split(dst)
		dparent, err := c.getNode(ddir, true, false)
		if err != nil {
			return err
		}
		return c.engine.Rename(c.user, sparent, sname, dparent, dname)
	}, Defaults}
}

func disableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		return c.engine.DisableUpdatesForTesting(c.user, c.rootNode)
	}, Defaults}
}

func reenableUpdates() fileOp {
	return fileOp{func(c *ctx) error {
		c.engine.ReenableUpdates(c.user, c.rootNode)
		return c.engine.SyncFromServer(c.user, c.rootNode)
	}, Defaults}
}

func lsdir(name string, contents m) fileOp {
	return fileOp{func(c *ctx) error {
		folder, err := c.getNode(name, false, false)
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
				if re.MatchString(node) && ty == ty2 {
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

func (c *ctx) getNode(filepath string, create bool, isFile bool) (Node, error) {
	if filepath == "" || filepath == "/" {
		return c.rootNode, nil
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
		}
		if err != nil {
			return nil, err
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
	return node, nil
}
