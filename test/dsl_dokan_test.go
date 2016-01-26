// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build dokan

package test

import (
	"sync"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/keybase/kbfs/dokan"
	"github.com/keybase/kbfs/libdokan"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

type compatMount struct {
	*dokan.MountHandle
}

func (c *compatMount) Close() {
	dokan.Unmount(c.Dir)
	getDriveLetterLock(c.Dir[0]).Unlock()
}

var driveLetterLocks ['Z' - 'A']sync.Mutex

func getDriveLetterLock(driveLetter byte) *sync.Mutex {
	return &driveLetterLocks[driveLetter-'A']
}

func makeFSE(t testing.TB, config *libkbfs.ConfigLocal, driveLetter byte) (*compatMount, *libdokan.FS, func()) {
	getDriveLetterLock(driveLetter).Lock()
	ctx := context.Background()
	ctx, cancelFn := context.WithCancel(ctx)
	fs, err := libdokan.NewFS(ctx, config, logger.NewTestLogger(t))
	if err != nil {
		t.Fatal(err)
	}

	mnt, err := dokan.Mount(fs, string([]byte{driveLetter, ':'}))
	if err != nil {
		t.Fatal(err)
	}
	cm := &compatMount{MountHandle: mnt}
	return cm, fs, cancelFn
}

type userData struct {
	config libkbfs.Config
	fs     *libdokan.FS
	mnt    *compatMount
	tlf    string
	cancel func()
}

func (o *opt) createUserData(cfg *libkbfs.ConfigLocal, i int, tlf string) *userData {
	driveLetter := byte('T') + byte(i)
	if driveLetter >= 'Z' {
		o.t.Fatal("Out of drive letters")
	}
	mnt, fs, cancel := makeFSE(o.t, cfg, driveLetter)
	return &userData{cfg, fs, mnt, tlf, cancel}
}
