// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build fuse

package test

import (
	"testing"
	"time"

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

func createEngine(tb testing.TB) Engine {
	log := logger.NewTestLogger(tb)
	debugLog := log.CloneWithAddedDepth(1)
	fuse.Debug = libfuse.MakeFuseDebugFn(debugLog, false /* superVerbose */)
	return &fuseEngine{
		fsEngine: fsEngine{
			name:       "fuse",
			tb:         tb,
			createUser: createUserFuse,
		},
	}
}

func createUserFuse(tb testing.TB, ith int, config *libkbfs.ConfigLocal,
	opTimeout time.Duration) *fsUser {
	filesys := libfuse.NewFS(config, nil, false, libfuse.PlatformParams{})
	fn := func(mnt *fstestutil.Mount) fs.FS {
		filesys.SetFuseConn(mnt.Server, mnt.Conn)
		return filesys
	}
	options := libfuse.GetPlatformSpecificMountOptionsForTest()
	mnt, err := fstestutil.MountedFuncT(tb, fn, &fs.Config{
		WithContext: func(ctx context.Context, req fuse.Request) context.Context {
			if int(opTimeout) > 0 {
				// Safe to ignore cancel since fuse should clean up the parent
				ctx, _ = context.WithTimeout(ctx, opTimeout)
			}
			ctx = filesys.WithContext(ctx)
			return ctx
		},
	}, options...)
	if err != nil {
		tb.Fatal(err)
	}
	tb.Logf("FUSE HasInvalidate=%v", mnt.Conn.Protocol().HasInvalidate())

	ctx, cancelFn := context.WithCancel(context.Background())
	ctx, err = libkbfs.NewContextWithCancellationDelayer(
		libkbfs.NewContextReplayable(
			ctx, func(c context.Context) context.Context {
				return ctx
			}))
	if err != nil {
		tb.Fatal(err)
	}

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		tb.Fatal(err)
	}

	logTags := logger.CtxLogTags{
		CtxUserKey: CtxOpUser,
	}
	ctx = logger.NewContextWithLogTags(ctx, logTags)
	ctx = context.WithValue(ctx, CtxUserKey, session.Name)

	// the fsUser.cancel will cancel notification processing; the FUSE
	// serve loop is terminated by unmounting the filesystem
	filesys.LaunchNotificationProcessor(ctx)
	return &fsUser{
		mntDir:   mnt.Dir,
		username: session.Name,
		config:   config,
		cancel:   cancelFn,
		close:    mnt.Close,
	}
}
