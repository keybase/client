// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin ios

package engine

import "github.com/keybase/client/go/libkb"

func AfterUpdateApply(g *libkb.GlobalContext, willRestart bool, force bool) error {
	return nil
}
