// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfs

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/logger"
	billy "gopkg.in/src-d/go-billy.v4"
)

type statusFileNode struct {
	libkbfs.Node

	fb     data.FolderBranch
	config libkbfs.Config
	log    logger.Logger
}

var _ libkbfs.Node = (*statusFileNode)(nil)

func (sfn *statusFileNode) GetFile(ctx context.Context) billy.File {
	return &wrappedReadFile{
		name: StatusFileName,
		reader: func(ctx context.Context) ([]byte, time.Time, error) {
			return GetEncodedFolderStatus(ctx, sfn.config, sfn.fb)
		},
		log: sfn.log,
	}
}

func (sfn *statusFileNode) FillCacheDuration(d *time.Duration) {
	// Suggest kindly that no one should cache this node, since it
	// could change each time it's read.
	*d = 0
}

var updateHistoryRevsRE = regexp.MustCompile("^\\.([0-9]+)(-([0-9]+))?$") //nolint (`\.` doesn't seem to work in single quotes)

type updateHistoryFileNode struct {
	libkbfs.Node

	fb     data.FolderBranch
	config libkbfs.Config
	log    logger.Logger
	start  kbfsmd.Revision
	end    kbfsmd.Revision
}

var _ libkbfs.Node = (*updateHistoryFileNode)(nil)

func (uhfn updateHistoryFileNode) GetFile(ctx context.Context) billy.File {
	return &wrappedReadFile{
		name: StatusFileName,
		reader: func(ctx context.Context) ([]byte, time.Time, error) {
			return GetEncodedUpdateHistory(
				ctx, uhfn.config, uhfn.fb, uhfn.start, uhfn.end)
		},
		log: uhfn.log,
	}
}

func (uhfn *updateHistoryFileNode) FillCacheDuration(d *time.Duration) {
	// Suggest kindly that no one should cache this node, since it
	// could change each time it's read.
	*d = 0
}

// specialFileNode is a Node wrapper around a TLF node, that causes
// special files to be fake-created when they are accessed.
type specialFileNode struct {
	libkbfs.Node

	config libkbfs.Config
	log    logger.Logger
}

var _ libkbfs.Node = (*specialFileNode)(nil)

var perTlfWrappedNodeNames = map[string]bool{
	StatusFileName:        true,
	UpdateHistoryFileName: true,
}

var perTlfWrappedNodePrefixes = []string{
	UpdateHistoryFileName,
}

func shouldBeTlfWrappedNode(name string) bool {
	for _, p := range perTlfWrappedNodePrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return perTlfWrappedNodeNames[name]
}

func (sfn *specialFileNode) newUpdateHistoryFileNode(
	node libkbfs.Node, name string) *updateHistoryFileNode {
	revs := strings.TrimPrefix(name, UpdateHistoryFileName)
	if revs == "" {
		return &updateHistoryFileNode{
			Node:   node,
			fb:     sfn.GetFolderBranch(),
			config: sfn.config,
			log:    sfn.log,
			start:  kbfsmd.RevisionInitial,
			end:    kbfsmd.RevisionUninitialized,
		}
	}

	matches := updateHistoryRevsRE.FindStringSubmatch(revs)
	if len(matches) != 4 {
		return nil
	}

	start, err := strconv.ParseUint(matches[1], 10, 64)
	if err != nil {
		return nil
	}
	end := start
	if matches[3] != "" {
		end, err = strconv.ParseUint(matches[3], 10, 64)
		if err != nil {
			return nil
		}
	}

	return &updateHistoryFileNode{
		Node:   node,
		fb:     sfn.GetFolderBranch(),
		config: sfn.config,
		log:    sfn.log,
		start:  kbfsmd.Revision(start),
		end:    kbfsmd.Revision(end),
	}
}

// ShouldCreateMissedLookup implements the Node interface for
// specialFileNode.
func (sfn *specialFileNode) ShouldCreateMissedLookup(
	ctx context.Context, name data.PathPartString) (
	bool, context.Context, data.EntryType, os.FileInfo, data.PathPartString) {
	plain := name.Plaintext()
	if !shouldBeTlfWrappedNode(plain) {
		return sfn.Node.ShouldCreateMissedLookup(ctx, name)
	}

	switch {
	case plain == StatusFileName:
		sfn := &statusFileNode{
			Node:   nil,
			fb:     sfn.GetFolderBranch(),
			config: sfn.config,
			log:    sfn.log,
		}
		f := sfn.GetFile(ctx)
		return true, ctx, data.FakeFile, f.(*wrappedReadFile).GetInfo(),
			data.PathPartString{}
	case strings.HasPrefix(plain, UpdateHistoryFileName):
		uhfn := sfn.newUpdateHistoryFileNode(nil, plain)
		if uhfn == nil {
			return sfn.Node.ShouldCreateMissedLookup(ctx, name)
		}
		f := uhfn.GetFile(ctx)
		return true, ctx, data.FakeFile, f.(*wrappedReadFile).GetInfo(),
			data.PathPartString{}
	default:
		panic(fmt.Sprintf("Name %s was in map, but not in switch", name))
	}

}

// WrapChild implements the Node interface for specialFileNode.
func (sfn *specialFileNode) WrapChild(child libkbfs.Node) libkbfs.Node {
	child = sfn.Node.WrapChild(child)
	name := child.GetBasename().Plaintext()
	if !shouldBeTlfWrappedNode(name) {
		if child.EntryType() == data.Dir {
			// Wrap this child too, so we can look up special files in
			// subdirectories of this node as well.
			return &specialFileNode{
				Node:   child,
				config: sfn.config,
				log:    sfn.log,
			}
		}
		return child
	}

	switch {
	case name == StatusFileName:
		return &statusFileNode{
			Node:   &libkbfs.ReadonlyNode{Node: child},
			fb:     sfn.GetFolderBranch(),
			config: sfn.config,
			log:    sfn.log,
		}
	case strings.HasPrefix(name, UpdateHistoryFileName):
		uhfn := sfn.newUpdateHistoryFileNode(child, name)
		if uhfn == nil {
			return child
		}
		return uhfn
	default:
		panic(fmt.Sprintf("Name %s was in map, but not in switch", name))
	}
}

// rootWrapper is a struct that manages wrapping root nodes with
// special per-TLF content.
type rootWrapper struct {
	config libkbfs.Config
	log    logger.Logger
}

func (rw rootWrapper) wrap(node libkbfs.Node) libkbfs.Node {
	return &specialFileNode{
		Node:   node,
		config: rw.config,
		log:    rw.log,
	}
}

// AddRootWrapper should be called on startup by any KBFS interface
// that wants to handle special files.
func AddRootWrapper(config libkbfs.Config) {
	rw := rootWrapper{config, config.MakeLogger("")}
	config.AddRootNodeWrapper(rw.wrap)
}
