package bundle

import (
	"encoding/base64"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

const v1 = keybase1.StellarSecretBundleVersion_V1

type canned struct {
	pukSeedB64 string
	pukGen     int
	outerB64   string
}

func (c *canned) puk(t *testing.T) (puk libkb.PerUserKeySeed) {
	bs, err := base64.StdEncoding.DecodeString(c.pukSeedB64)
	require.NoError(t, err)
	require.Equal(t, len(puk), len(bs))
	copy(puk[:], bs)
	return puk
}

func (c *canned) gen() keybase1.PerUserKeyGeneration {
	return keybase1.PerUserKeyGeneration(c.pukGen)
}

var cans = []canned{
	{"sTwIOJ9nGIW1H+ruwX1yXwomu72JmmhMbORjhzEA1Is=", 3, "hKFlxNFm/UeXfI1g5p97qljKSb/slFsmAPgImHN74OlxgTseWKJ36sbREgWlqISAM2yvzR1d/2MqpfO9+6hvi3r1gaO1exEgBCMUddrpI+oFwuPLHqATa6Q5y0c/scfRcLJdUf+NHD+7QubB0Sb3fg9Ln6k4BLz3aUxxUZaoEnOF5JKfEd30M0Xcb/qC0GHwKzC2vYaajyBq7NTO46UJDji3eO+y61cHLQ56Ui4qc64P6HO/H78NFKHMijnxPtFZnBO/SitxVNRu7aWsTc0SEs6SM/zCsqNnZW4DoW7EGP+i1y3+JhzofplQXDzXGzs0aDC6zFkuU6F2AQ=="},
	{"dO/t7WzeXmuQF+8vitbxrTZZcLasJDLiWre0j9E0WYY=", 3, "hKFlxNEGzWSdEAoPP0VUOFiGi+F4knwYPYiFBeQmZzdUaPOJ5j0F1hMxtPx0MV/6WOLWEBNs8MNIH7owuMyQMf6oVH2P8S8+r5dUXBrfoC37BYd/zoA/AheN2LGFwLNCOU4HZFtaUwSxqQNdkM/MRt9PvxPTWz+ivZwoV1zMj+f2Nx8+t/2FYBDLCGLui4g16cExl3PH5P+w9VQa/QjWUFHTBSr1fInudKTjxfcm2gN6Nsb6msook1VZwrfOAgAgsc889WK6com1WMsFFCvG12gLdzvuJqNnZW4DoW7EGBEEUn+mRL1bPTqf47dZiHspRiusRLv3Z6F2AQ=="},
	// this one has two primary accounts.
	{"q/kPfnlbgK312LrI9xLtHPxXw66a4apEz6mgdM3J4WY=", 3, "hKFlxQF0Gopd0H+DTbHDr49361EXfyDWTVRfc1AzSwlP0DPUtOjbX0hedU9OyFAYSmr82FpTl8O8m+bKgk9GngT7Dm51pudCpuxANQ7LoOI5hlHJXWeDimS2Q/UzHt7nZxztsE9++RR5vE4tnsdSH0IbC8Br88OgNp+wIE7WzTehVCHyvU7QHmH7nbZTT8S78FMKO9MVRcpXUKA00fx35yLKcJ5XaXhS2sv+bVh4K4LL/iY1wdPyUQMhqQhstM+NZMBP8JzkSpYILg5bKF2u5Tmo01HA6LqbE/Jezw/iQ5I/rJ/sXX5ctxjKoH1IHeT7ObtuTtAopEk3XJsN8gL0sWAxc/IFAmHKMYPsMPq3hh3cAhwTwYxkdqRJGFk1l9X7ErhbOkQmLvjkLZwhzNPOGjf5TUbJLd4Wk0hQx+BOKegL299LHvIzBYFpMxVdL21IN+zDze56D7pwyXzBB1iHur+qGMthtepI9oHqEF66ToRQCvqMI/7bVl1Vo2dlbgOhbsQYrBSyc5ycfisWyYWdqMFKwahbYuwH7rbXoXYB"},
}

func TestBundleRoundtrip(t *testing.T) {
	bundle := sampleBundle()
	puk, pukGen := mkPuk(t, 3)
	t.Logf("puk seed (hex): %v", base64.StdEncoding.EncodeToString(puk[:]))
	t.Logf("puk gen: %v", pukGen)

	enc, resB64, err := Box(bundle, pukGen, puk)
	require.NoError(t, err)
	t.Logf("outer b64: %v", resB64)
	require.True(t, len(resB64) > 100)
	require.Equal(t, 1, enc.V)
	require.True(t, len(enc.E) > 100)
	require.Equal(t, pukGen, enc.Gen)

	enc2, err := Decode(resB64)
	require.NoError(t, err)
	require.Equal(t, enc, enc2)

	bundle2, v, err := Unbox(enc2, puk)
	require.NoError(t, err)
	require.Equal(t, bundle, bundle2)
	require.Equal(t, v1, v)
}

func TestBundleRoundtripCorruption(t *testing.T) {
	bundle := sampleBundle()
	puk, pukGen := mkPuk(t, 3)

	_, resB64, err := Box(bundle, pukGen, puk)
	require.NoError(t, err)
	replaceWith := "a"
	if resB64[85] == 'a' {
		replaceWith = "b"
	}
	resB64 = resB64[:85] + replaceWith + resB64[86:]

	enc2, err := Decode(resB64)
	require.NoError(t, err)

	_, _, err = Unbox(enc2, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
}

func TestCanned(t *testing.T) {
	c := cans[0]
	enc, err := Decode(c.outerB64)
	require.NoError(t, err)
	require.Equal(t, 1, enc.V)
	require.Equal(t, c.gen(), enc.Gen)
	require.Equal(t, "/6LXLf4mHOh+mVBcPNcbOzRoMLrMWS5T", base64.StdEncoding.EncodeToString(enc.N[:]))
	b64EncE := "Zv1Hl3yNYOafe6pYykm/7JRbJgD4CJhze+DpcYE7Hliid+rG0RIFpaiEgDNsr80dXf9jKqXzvfuob4t69YGjtXsRIAQjFHXa6SPqBcLjyx6gE2ukOctHP7HH0XCyXVH/jRw/u0LmwdEm934PS5+pOAS892lMcVGWqBJzheSSnxHd9DNF3G/6gtBh8Cswtr2Gmo8gauzUzuOlCQ44t3jvsutXBy0OelIuKnOuD+hzvx+/DRShzIo58T7RWZwTv0orcVTUbu2lrE3NEhLOkjP8wrI="
	require.Equal(t, b64EncE, base64.StdEncoding.EncodeToString(enc.E))

	bundle, v, err := Unbox(enc, c.puk(t))
	require.NoError(t, err)
	require.Equal(t, v1, v)
	require.Equal(t, keybase1.StellarRevision(1), bundle.Revision)
	require.Len(t, bundle.Accounts, 1)
	refAccount := keybase1.StellarSecretEntry{
		AccountID: "GDGRUNNTTEHFSGGNNENIFCXLHI5FGCRNB554HHYGDPBV5D3OCKZBSZO2",
		Mode:      keybase1.StellarAccountMode_USER,
		Signers:   []keybase1.StellarSecretKey{"SAGWDNEMLK2Z65NXQUGP6UMR4MDYZ3UQSUXLIEZU6KENJXEHEGIS23BT"},
		IsPrimary: true,
		Name:      "",
	}
	require.Equal(t, refAccount, bundle.Accounts[0])
}

func TestCannedWrongKey(t *testing.T) {
	c := cans[1]
	puk := c.puk(t)
	puk[3] = byte(8)
	enc, err := Decode(c.outerB64)
	require.NoError(t, err)
	_, _, err = Unbox(enc, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
}

func TestCannedUnboxInvariantViolation(t *testing.T) {
	c := cans[2]
	enc, err := Decode(c.outerB64)
	require.NoError(t, err)
	_, _, err = Unbox(enc, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "multiple primary accounts")
}

func TestBoxInvariantViolation(t *testing.T) {
	bundle := bundleDuplicateAccountIDs()
	puk, pukGen := mkPuk(t, 3)

	_, _, err := Box(bundle, pukGen, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate account ID")
}

func sampleBundle() keybase1.StellarSecretBundle {
	return keybase1.StellarSecretBundle{
		Revision: 1,
		Accounts: []keybase1.StellarSecretEntry{{
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      keybase1.StellarAccountMode_USER,
			Signers:   []keybase1.StellarSecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
			IsPrimary: true,
			Name:      "",
		}},
	}
}

func bundleDuplicateAccountIDs() keybase1.StellarSecretBundle {
	return keybase1.StellarSecretBundle{
		Revision: 1,
		Accounts: []keybase1.StellarSecretEntry{{
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      keybase1.StellarAccountMode_USER,
			Signers:   []keybase1.StellarSecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
			IsPrimary: true,
			Name:      "p1",
		}, {
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      keybase1.StellarAccountMode_USER,
			Signers:   []keybase1.StellarSecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
			IsPrimary: false,
			Name:      "p2",
		}},
	}
}

func mkPuk(t *testing.T, gen int) (libkb.PerUserKeySeed, keybase1.PerUserKeyGeneration) {
	puk, err := libkb.GeneratePerUserKeySeed()
	require.NoError(t, err)
	return puk, keybase1.PerUserKeyGeneration(gen)
}
