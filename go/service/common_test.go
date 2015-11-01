// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package service

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func setupServiceTest(tb testing.TB) {
	// This is an empty environment
	libkb.G.Env = libkb.NewEnv(nil, nil)
}
