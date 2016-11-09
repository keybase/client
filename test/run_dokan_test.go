// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build dokan

package test

import (
	"sync"
	"testing"
	"time"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libdokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type dokanEngine struct {
	fsEngine
}

func createEngine() Engine {
	e := &dokanEngine{}
	e.createUser = createUserDokan
	e.name = "dokan"
	return e
}

func createUserDokan(t testing.TB, ith int, config *libkbfs.ConfigLocal,
	opTimeout time.Duration) *fsUser {
	driveLetter := 'T' + byte(ith)
	if driveLetter > 'Z' {
		t.Error("Too many users - out of drive letters")
	}
	getDriveLetterLock(driveLetter).Lock()
	ctx := context.Background()
	ctx, cancelFn := context.WithCancel(ctx)
	fs, err := libdokan.NewFS(ctx, config, logger.NewTestLogger(t))
	if err != nil {
		t.Fatal(err)
	}

	if opTimeout > 0 {
		t.Logf("Ignoring op timeout for Dokan test")
	}

	mnt, err := dokan.Mount(&dokan.Config{
		FileSystem: fs,
		Path:       string([]byte{driveLetter, ':'}),
		MountFlags: libdokan.DefaultMountFlags,
	})
	if err != nil {
		t.Fatal(err)
	}

	return &fsUser{
		mntDir: mnt.Dir,
		config: config,
		cancel: cancelFn,
		close: func() {
			dokan.Unmount(mnt.Dir)
			getDriveLetterLock(driveLetter).Unlock()
		},
	}
}

var driveLetterLocks ['Z' - 'A']sync.Mutex

func getDriveLetterLock(driveLetter byte) *sync.Mutex {
	return &driveLetterLocks[driveLetter-'A']
}
