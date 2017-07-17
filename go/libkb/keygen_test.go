// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type cidTest struct {
	name      string
	pgpUIDArg []string
	errOut    error
	idsOut    []Identity
}

var cidTests = []cidTest{
	{"empty", []string{}, nil, []Identity{}},
	{"no custom", []string{}, nil, []Identity{}},
	{"one ID", []string{"pc@pc.com"}, nil, []Identity{
		{Email: "pc@pc.com"},
	}},
	{"one ID with comment", []string{"non_email_name (test comment)"}, nil, []Identity{
		{Username: "non_email_name", Comment: "test comment"},
	}},
	{"one email with comment", []string{"(test comment) <pc@pc.com>"}, nil, []Identity{
		{Email: "pc@pc.com", Comment: "test comment"},
	}},
	{"custom", []string{"pc@pc.com"}, nil, []Identity{
		{Email: "pc@pc.com"},
	}},
	{"many custom", []string{"pc@pc.com", "ab@ab.com", "cd@cd.com"}, nil, []Identity{
		{Email: "pc@pc.com"},
		{Email: "ab@ab.com"},
		{Email: "cd@cd.com"},
	}},
	{"pgp uid", []string{"Patrick Crosby <pc@pc.com>"}, nil, []Identity{
		{Username: "Patrick Crosby", Email: "pc@pc.com"},
	}},
	{"pgp uid no email", []string{"Patrick Crosby"}, nil, []Identity{
		{Username: "Patrick Crosby"},
	}},
	{"brackets", []string{"<xyz@xyz.com>"}, nil, []Identity{
		{Email: "xyz@xyz.com"},
	}},
	{"brackets with comment", []string{"(test comment) <xyz@xyz.com>"}, nil, []Identity{
		{Email: "xyz@xyz.com", Comment: "test comment"},
	}},
	{"mixture", []string{"Patrick Crosby", "pc@pc.com", "<ab@ab.com>", "CD <cd@cd.com>"}, nil, []Identity{
		{Username: "Patrick Crosby"},
		{Email: "pc@pc.com"},
		{Email: "ab@ab.com"},
		{Username: "CD", Email: "cd@cd.com"},
	}},
	// Note that we can parse an email by itself without brackets, but can't support a comment in that case
	{"mixture2", []string{"Patrick Crosby (test comment1)", "(test comment3) <ab@ab.com>", "CD (test comment4) <cd@cd.com>"}, nil, []Identity{
		{Username: "Patrick Crosby", Comment: "test comment1"},
		{Email: "ab@ab.com", Comment: "test comment3"},
		{Username: "CD", Comment: "test comment4", Email: "cd@cd.com"},
	}},
}

func TestCreateIds(t *testing.T) {
	tc := SetupTest(t, "createIds", 1)
	defer tc.Cleanup()

	// We need to fake the call to G.Env.GetUsername().  The best way to do this is to
	// fake an entire UserConfig. Most of these fields won't be used in this test, so it's
	// ok to give empty UIDs/Salts.
	uid, _ := keybase1.UIDFromString("00000000000000000000000000000019")
	var nilDeviceID keybase1.DeviceID
	tc.G.Env.GetConfigWriter().SetUserConfig(NewUserConfig(uid, "foo", []byte{}, nilDeviceID), true)

	for _, test := range cidTests {
		arg := &PGPGenArg{PrimaryBits: 1024, SubkeyBits: 1024, PGPUids: test.pgpUIDArg}
		if err := arg.Init(); err != nil {
			t.Errorf("%s: arg init err: %s", test.name, err)
			continue
		}
		err := arg.CreatePGPIDs()
		if err != test.errOut {
			t.Errorf("%s: error %v, expected %v", test.name, err, test.errOut)
			continue
		}
		if test.errOut != nil {
			// this is an error test, no need to do anything else
			continue
		}
		if len(arg.Ids) != len(test.idsOut) {
			t.Errorf("%s: %d IDs, expected %d.", test.name, len(arg.Ids), len(test.idsOut))
			continue
		}
		for i, id := range arg.Ids {
			if id != test.idsOut[i] {
				t.Errorf("%s: id %d = %+v, expected %+v", test.name, i, id, test.idsOut[i])
			}
		}

		if len(arg.Ids) == 0 {
			continue
		}

		// test the PGPKeyBundle
		bundle, err := GeneratePGPKeyBundle(tc.G, *arg, tc.G.UI.GetLogUI())
		if err != nil {
			t.Errorf("%s: bundle error: %s", test.name, err)
		}
		if len(bundle.Identities) != len(test.idsOut) {
			t.Errorf("%s: %d bundle ids, expected %d", test.name, len(bundle.Identities), len(test.idsOut))
			continue
		}
		pids, err := arg.PGPUserIDs()
		if err != nil {
			t.Errorf("%s: pgp user id conversion error: %q", test.name, err)
			continue
		}
		for _, id := range pids {
			bundleID, ok := bundle.Identities[id.Id]
			if !ok {
				t.Errorf("%s: no bundle identity found for %q", test.name, id.Id)
				continue
			}
			if *(bundleID.UserId) != *id {
				t.Errorf("%s: bundle UserId = %+v, expected %+v", test.name, bundleID.UserId, id)
				continue
			}
		}
	}
}
