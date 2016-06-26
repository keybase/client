// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build fuse

package test

import (
	"testing"

	"bazil.org/fuse"
	"bazil.org/fuse/fs"
	"bazil.org/fuse/fs/fstestutil"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/libfuse"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type fuseEngine struct {
	fsEngine
}

func createEngine() Engine {
	e := &fuseEngine{}
	e.createUser = createUserFuse
	e.name = "fuse"
	return e
}

func createUserFuse(t testing.TB, ith int, config *libkbfs.ConfigLocal) User {
	log := logger.NewTestLogger(t)
	debugLog := log.CloneWithAddedDepth(1)
	fuse.Debug = func(msg interface{}) {
		debugLog.Debug("%s", msg)
	}

	filesys := libfuse.NewFS(config, nil, false)
	fn := func(mnt *fstestutil.Mount) fs.FS {
		filesys.SetFuseConn(mnt.Server, mnt.Conn)
		return filesys
	}
	options := libfuse.GetPlatformSpecificMountOptionsForTest()
	mnt, err := fstestutil.MountedFuncT(t, fn, &fs.Config{
		WithContext: func(ctx context.Context, req fuse.Request) context.Context {
			return filesys.WithContext(ctx)
		},
	}, options...)
	if err != nil {
		t.Fatal(err)
	}
	// the fsUser.cancel will cancel notification processing; the FUSE
	// serve loop is terminated by unmounting the filesystem
	ctx := context.Background()
	ctx = filesys.WithContext(ctx)
	ctx, cancelFn := context.WithCancel(ctx)
	filesys.LaunchNotificationProcessor(ctx)
	return &fsUser{
		mntDir: mnt.Dir,
		config: config,
		cancel: cancelFn,
		close:  mnt.Close,
	}
}
