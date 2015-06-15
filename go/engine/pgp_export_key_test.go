package engine

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
)

func TestPGPExportOptions(t *testing.T) {
	tc := SetupEngineTest(t, "pgpsave")
	defer tc.Cleanup()

	u := CreateAndSignupFakeUser(tc, "login")
	secui := libkb.TestSecretUI{Passphrase: u.Passphrase}
	ctx := &Context{LogUI: tc.G.UI.GetLogUI(), SecretUI: secui}

	fp, kid, key := armorKey(t, tc, u.Email)
	eng, err := NewPGPKeyImportEngineFromBytes([]byte(key), true, tc.G)
	if err != nil {
		t.Fatal(err)
	}
	if err = RunEngine(eng, ctx); err != nil {
		t.Fatal(err)
	}

	table := []exportTest{
		{true, fp.String(), false, 1},
		{true, fp.String(), true, 1},
		{false, fp.String(), false, 1},
		{false, fp.String(), true, 1},

		// fingerprint substring must be suffix:
		{true, fp.String()[len(fp.String())-5:], false, 1},
		{true, fp.String()[len(fp.String())-5:], true, 0},
		{false, fp.String()[len(fp.String())-5:], false, 1},
		{false, fp.String()[len(fp.String())-5:], true, 0},
		{true, fp.String()[0:5], false, 0},
		{true, fp.String()[0:5], true, 0},
		{false, fp.String()[0:5], false, 0},
		{false, fp.String()[0:5], true, 0},

		{true, kid.String(), false, 1},
		{true, kid.String(), true, 1},
		{false, kid.String(), false, 1},
		{false, kid.String(), true, 1},

		// kid substring must be prefix:
		{true, kid.String()[len(fp.String())-5:], false, 0},
		{true, kid.String()[len(fp.String())-5:], true, 0},
		{false, kid.String()[len(fp.String())-5:], false, 0},
		{false, kid.String()[len(fp.String())-5:], true, 0},
		{true, kid.String()[0:5], false, 1},
		{true, kid.String()[0:5], true, 0},
		{false, kid.String()[0:5], false, 1},
		{false, kid.String()[0:5], true, 0},
	}

	for i, test := range table {
		n, err := pgpExport(ctx, tc.G, test.secret, test.query, test.exact)
		if err != nil {
			t.Errorf("test %d error: %s", i, err)
		}
		if n != test.count {
			t.Errorf("test %d: num keys exported: %d, expected %d", i, n, test.count)
		}
	}
}

type exportTest struct {
	secret bool
	query  string
	exact  bool
	count  int
}

func pgpExport(ctx *Context, g *libkb.GlobalContext, secret bool, query string, exact bool) (int, error) {
	arg := keybase1.PgpExportArg{
		Options: keybase1.PGPQuery{
			Secret:     secret,
			Query:      query,
			ExactMatch: exact,
		},
	}

	xe := NewPGPKeyExportEngine(arg, g)
	if err := RunEngine(xe, ctx); err != nil {
		return 0, err
	}

	return len(xe.Results()), nil
}
