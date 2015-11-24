// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build windows

package mounter

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// Unmount tries to unmount normally and then if force if unsuccessful.
func Unmount(g *libkb.GlobalContext, dir string, force bool) error {
	return fmt.Errorf("Unmount unsupported on this platform")
}

func ForceUnmount(g *libkb.GlobalContext, dir string) (err error) {
	return fmt.Errorf("ForceUnmount unsupported on this platform")
}
