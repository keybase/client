// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build darwin dragonfly freebsd linux nacl netbsd openbsd solaris

package client

import (
	"context"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func doSimpleFSPlatformGlob(g *libkb.GlobalContext, ctx context.Context, cli keybase1.SimpleFSInterface, paths []keybase1.Path) ([]keybase1.Path, error) {
	return paths, nil
}
