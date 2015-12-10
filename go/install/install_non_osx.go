// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin

package install

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

func AutoInstall(g *libkb.GlobalContext, binPath string, force bool) (newProc bool, err error) {
	return false, fmt.Errorf("Auto install only supported for OS X")
}
