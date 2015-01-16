package libkb

import (
	"os"
	"testing"
)

type cidTest struct {
	name      string
	noDefArg  bool
	pgpUidArg []string
	errOut    error
	idsOut    []Identity
}

var cidTests = []cidTest{
	{"empty", false, []string{}, nil, []Identity{
		{Username: "keybase.io/foo", Email: "foo@keybase.io"},
	}},
	{"no default, no custom", true, []string{}, ErrKeyGenArgNoDefNoCustom, []Identity{}},
	{"no default", true, []string{"pc@pc.com"}, nil, []Identity{
		{Email: "pc@pc.com"},
	}},
	{"default + custom", false, []string{"pc@pc.com"}, nil, []Identity{
		{Email: "pc@pc.com"},
		{Username: "keybase.io/foo", Email: "foo@keybase.io"},
	}},
	{"default + many custom", false, []string{"pc@pc.com", "ab@ab.com", "cd@cd.com"}, nil, []Identity{
		{Email: "pc@pc.com"},
		{Email: "ab@ab.com"},
		{Email: "cd@cd.com"},
		{Username: "keybase.io/foo", Email: "foo@keybase.io"},
	}},
	{"pgp uid", true, []string{"Patrick Crosby <pc@pc.com>"}, nil, []Identity{
		{Username: "Patrick Crosby", Email: "pc@pc.com"},
	}},
	{"pgp uid no email", true, []string{"Patrick Crosby"}, nil, []Identity{
		{Username: "Patrick Crosby"},
	}},
	{"brackets", true, []string{"<xyz@xyz.com>"}, nil, []Identity{
		{Email: "xyz@xyz.com"},
	}},
	{"mixture", false, []string{"Patrick Crosby", "pc@pc.com", "<ab@ab.com>", "CD <cd@cd.com>"}, nil, []Identity{
		{Username: "Patrick Crosby"},
		{Email: "pc@pc.com"},
		{Email: "ab@ab.com"},
		{Username: "CD", Email: "cd@cd.com"},
		{Username: "keybase.io/foo", Email: "foo@keybase.io"},
	}},
}

func TestCreateIds(t *testing.T) {
	os.Setenv("KEYBASE_USERNAME", "foo")
	G.Init()
	for _, test := range cidTests {
		arg := &KeyGenArg{PrimaryBits: 1024, SubkeyBits: 1024, PGPUids: test.pgpUidArg, NoDefPGPUid: test.noDefArg}
		if err := arg.Init(); err != nil {
			t.Errorf("%s: arg init err: %s", test.name, err)
			continue
		}
		err := arg.CreateIDs()
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

		// test the PgpKeyBundle
		bundle, err := NewPgpKeyBundle(*arg)
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
