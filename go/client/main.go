// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"github.com/keybase/client/go/libkb"
)

func InitUI(g *libkb.GlobalContext) {
	ui := &UI{Contextified: libkb.NewContextified(g)}
	g.SetUI(ui)
}
