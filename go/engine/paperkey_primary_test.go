// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
)

func TestPaperKeyPrimary(t *testing.T) {
	tc := SetupEngineTest(t, "paper")
	defer tc.Cleanup()

	f := func(arg *SignupEngineRunArg) {
		arg.SkipPaper = true
	}

	fu, signingKey := CreateAndSignupFakeUserCustomArg(tc, "paper", f)

	me, err := libkb.LoadMe(libkb.NewLoadUserArg(tc.G))
	if err != nil {
		t.Fatal(err)
	}

	ctx := &Context{
		LoginUI: libkb.TestLoginUI{},
	}
	args := &PaperKeyPrimaryArgs{
		Me:         me,
		SigningKey: signingKey,
	}
	eng := NewPaperKeyPrimary(tc.G, args)
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	hasOnePaperDev(tc, fu)
}
