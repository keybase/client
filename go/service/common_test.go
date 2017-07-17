// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func setupServiceTest(tb testing.TB) {
	// This is an empty environment
	libkb.G.Env = libkb.NewEnv(nil, nil)
}
