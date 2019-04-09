// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build !dokan,!fuse

package test

import (
	"testing"

	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/libkbfs"
)

func createEngine(tb testing.TB) Engine {
	return &LibKBFS{
		tb:             tb,
		refs:           make(map[libkbfs.Config]map[libkbfs.Node]bool),
		updateChannels: make(map[libkbfs.Config]map[data.FolderBranch]chan<- struct{}),
	}
}
