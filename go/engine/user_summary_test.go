// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func TestUserSummary(t *testing.T) {
	tc := SetupEngineTest(t, "usersummary")
	defer tc.Cleanup()

	uids := []keybase1.UID{
		libkb.UsernameToUID("t_alice"),
		libkb.UsernameToUID("t_bob"),
		libkb.UsernameToUID("t_charlie"),
	}

	eng := NewUserSummary(uids, tc.G)
	ctx := &Context{}
	if err := RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}
	sums := eng.Summaries()
	if len(sums) != 3 {
		t.Errorf("# summaries: %d, expected 3", len(sums))
	}

	for _, uid := range uids {
		if _, ok := sums[uid]; !ok {
			t.Errorf("no summary for %s in result", uid)
		}
	}
}
