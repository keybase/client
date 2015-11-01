// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package client

import (
	"github.com/keybase/client/go/libkb"
)

// Keep this around to simplify things
var G = libkb.G
var GlobUI *UI

func InitUI() {
	GlobUI = &UI{}
	G.SetUI(GlobUI)
}
