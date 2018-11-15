package bundle

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

const v1 = stellar1.BundleVersion_V1

type canned struct {
	pukSeedB64 string
	pukGen     int
	encB64     string
	visB64     string
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
	{"mAWdQTSZTnotyTeR0+2wCh1wvbRs8bmbS0SzO+RYEio=", 3, "hKFlxOQBu2gj+ZnJmy4aDGglUmGSemUPfWSmxYnf5FBGtFPezqe3Mb8hJgaFEXp2ZYenM+40enUbQpYdJw379hKosSYSh7OK+oFcuERkYL/VknUlXrLj3tyipB1jZu6mCmeknYJOqRjjvlcVXok9zM2GbCb1dLgAdYRL3RmvtcnDxsyw/YzrDSOM/mRizZ8sHIs/XHQIpUVTEjCSbC1ildsRovSlMJmNKRF7eKYkgBSRSgAX2UqP8hXDxc/ErceDGkoXAESMeaviDbZQOBD6D6s3xn2BEbo/L7nAuxnFFCBO14zo8qbR8fijZ2VuA6FuxBhVBF1NZjT7axUIU4GLLNbsouP++zRM9gqhdgI=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0RHUlVOTlRURUhGU0dHTk5FTklGQ1hMSEk1RkdDUk5CNTU0SEhZR0RQQlY1RDNPQ0taQlNaTzKpaXNQcmltYXJ5w6Rtb2RlAaRwcmV2wKhyZXZpc2lvbgE="},
	// this one was encrypted but is using the wrong key to decrypt (mA vs mB)
	{"63NVeXpRPf0VYIaX1MxfVNoj8rl72abZc2zXS+IgnW4=", 3, "hKFlxOTvB0wso/wzHJyEUoQfMGvNeB40pCCGWsDfNXIqJISWVdnMgPxVHJtnb81BiwcY5vtptPcPmCjG/0go4pnQf8UHcXQQjf2cgWoULsMRYb1lkxIaSBC3U+5kxICoMwI/8wL3JToU3zjfq2dRLzNRPE0kM/a55saY4nwVmQ8jiJ3GMbtEt92yluZK/AG5snhIh/g3tAayfIbDjgzy4qZjJy/HCnEOntr2Nr8OeLdEzRD2wpDrYjcVX/wgXJXQO0TEAIkY/OzOHFORyxAMUJKNaczJR6wlEhNkPX3Lg5wnLRHmx7rVI2qjZ2VuA6FuxBjtPfYaWlZhEztq4R4evtHuhR3kLnCg2HChdgI=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0FaN1VJT0xSQ1dYWFBHQkEzSjRQM1dDNjZHUlNWSVhQWERDRktLVDcyNlRWT1JNUjU3UU9QQUypaXNQcmltYXJ5w6Rtb2RlAaRwcmV2wKhyZXZpc2lvbgE="},
	// this one has two primary accounts.
	{"8+XNNJr3nquEG7OZWWKnTrSz5iGTEDA7zToQNoRu8hA=", 3, "hKFlxQF2pJwTioFbs/xiPQ9GBoU/HQt6x0iJGxVM0CUm0ZtjxmJ9foIUqlbcv2Gg9Yiqk1noeNeJtdyJ85c70kdab2mbBpKOPa4n+MEz9+Iwd+ZbrpSsNVyBOWeb4ft4Kn8XAXs1mCKaGbSP1PK9m4Ka22qgfZKNiywtfKPvhzyKRsIPr5vODx9Jx1mdjnvNtEiAkxrqrGmFBUED5bBFJ/6PyprxhCl9kgnBJMDcevRmx9U/IrCfrnBrw9+NFrRpD7nvVXebIkZQFq5PjvEfiaE1QfzYgYetBg51h6g1j46Yg4oGddrptIt1YMACenlfBR64Rt6ERMxF5EKZbb3SLlTPqmOFO8h9rSjharrCL1L1o5fDE4fFvZotmZon1XseEQVa0t0lIDxHNK8an6udSiUqpvhsLr6Et8FJZHziSDLsjJj6hllETQz/XB+mYsTQyEjUM7Wif8PNLh3aAdm+HV4cOaCi5x4QQM6iu2c8o1ikIBwsSqUgDUIKPcGjZ2VuA6FuxBhbM4dz2ULexmZXwNfWSTe8IJTzV/N47C2hdgI=", "g6hhY2NvdW50c5KDqWFjY291bnRJRNk4R0FXWjdIVlBLUkdDSDJLUDY0NzVYVjZIQTJDQUY0NE1YV1dFNVJLVjRMTU1HQjZGTk5TRVBOUEWpaXNQcmltYXJ5w6Rtb2RlAYOpYWNjb3VudElE2ThHQlBMTEhPS1BSRlNDRTZGUDZEMzdBVVVOWUNKMlRTUE9ITUhBUjU0VEJETFdXUElaQ0Q0UkwzR6lpc1ByaW1hcnnDpG1vZGUBpHByZXbAqHJldmlzaW9uAQ=="},
	// this one has the accounts in different orders on the inside and outside
	{"KRihgI3GNqHrYSk7HuN7iDcIOdZ//hA03moiVtv611I=", 3, "hKFlxQF2K2qt86lRFXoqIJjYCKZx6a0tmv30Nd4cm00EmJz5cXlCeScv+gZpdVEH/BxDhKgdeXuzeYFq/stcqrDp2lzD2kC3E3cce8NumvpEuH0TL+eRpYpjziQzGFz5ReTrae9OcUzSd/4tdD7NcSgaZyUBjJjI8mCeRHHCp5W5kS65g8OBwSC36Oa1cm+Kyaw0KaahqlMZHgpoZcKzqor0mSx0H8xaY+LzgPkFh5jVBPNvbur6Z13wpWLYLwfgGBJ0WQ6OL+mkdrrgl+0z+w/jHoEEV6dS3mhxcY21qtJqWtusi+d7D7y7GrIAIHsgbVdqA1L1ViOlHzL5JYMrhdT7IJlR5RIH0+resEmvF5WYcK5LADicfUMhH55QqTiNRLJmgkXk8uDs134ERvXvDdm8wdP4bFT8toYK+scqQF4YL4xZp1tTxuReCeHRhU/dpaROB5h+7Sj0GU5cKXVX7XnTJpeYW3nSBD2euJyNoXMPi/j/0/GZmo1uLBWjZ2VuA6FuxBi8DkD0rpMWmYunXY/BQ/HBwY13uI+eviuhdgI=", "g6hhY2NvdW50c5KDqWFjY291bnRJRNk4R0JQTExIT0tQUkZTQ0U2RlA2RDM3QVVVTllDSjJUU1BPSE1IQVI1NFRCRExXV1BJWkNENFJMM0epaXNQcmltYXJ5wqRtb2RlAYOpYWNjb3VudElE2ThHQVdaN0hWUEtSR0NIMktQNjQ3NVhWNkhBMkNBRjQ0TVhXV0U1UktWNExNTUdCNkZOTlNFUE5QRalpc1ByaW1hcnnDpG1vZGUBpHByZXbAqHJldmlzaW9uAQ=="},
	// this one uses crypt version 1 which used the wrong context string and is retired
	{"eTL+zDIxcT2VXjQQ++kWV7NpHrz49b0DxK3UcdS8k/A=", 3, "hKFlxOSabxN7oh6jksn0Op99CN6jjt0RGbNkE21rgldt7XWrjUP3LKiLIZXshHF4bXehkbcUqZCpWi14wLc2z31vmEPxm3iSwwWx0ePJnCtX53oYAeJeAGeCmmfacmpvIKhNPqd1Xiv4/Ujj9QhE2QkxhYPC0KPduWN4lsnk+Ae+HHdFcNO5ifQ4DoibsfIiv4Q4GDDxACaawEBv7+BIkO+WNmv/7EPZlxw2F0WVMXY+olewEZuYkuDZSPw0q3i2XyTWzJe5epKe2+mH5nJjIXbC2s1CzvHMj7xabXRLTvuqtiLKsxgqPNKjZ2VuA6FuxBiwsPJSEeeLudeMyVeHF9LgRI77pxlhZi+hdgE=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0RHUlVOTlRURUhGU0dHTk5FTklGQ1hMSEk1RkdDUk5CNTU0SEhZR0RQQlY1RDNPQ0taQlNaTzKpaXNQcmltYXJ5w6Rtb2RlAaRwcmV2wKhyZXZpc2lvbgE="},
}

func TestBundleRoundtrip(t *testing.T) {
	bundle := sampleBundle()
	puk, pukGen := mkPuk(t, 3)
	t.Logf("puk seed (hex): %v", base64.StdEncoding.EncodeToString(puk[:]))
	t.Logf("puk gen: %v", pukGen)

	res, err := Box(bundle, pukGen, puk)
	require.NoError(t, err)
	t.Logf("outer enc b64: %v", res.EncB64)
	t.Logf("outer vis b64: %v", res.VisB64)
	t.Logf("enc.N b64: %v", base64.StdEncoding.EncodeToString(res.Enc.N[:]))
	t.Logf("enc.E b64: %v", base64.StdEncoding.EncodeToString(res.Enc.E))
	require.Equal(t, v1, res.FormatVersion)
	require.True(t, len(res.EncB64) > 100)
	require.Equal(t, 2, res.Enc.V)
	require.True(t, len(res.Enc.E) > 100)
	require.Equal(t, pukGen, res.Enc.Gen)

	dec2, err := Decode(res.EncB64)
	require.NoError(t, err)
	require.Equal(t, res.Enc, dec2.Enc)

	bundle2, v, err := Unbox(nil, dec2, res.VisB64, puk)
	require.NoError(t, err)
	bundle2ForComparison := bundle2.DeepCopy()
	bundle2ForComparison.OwnHash = nil
	require.Equal(t, bundle, bundle2ForComparison)
	require.Equal(t, v1, v)
	require.Nil(t, bundle2.Prev)
}

func TestBundlePrevs(t *testing.T) {
	bundle1src := sampleBundle()
	puk1, pukGen1 := mkPuk(t, 1)
	puk2, pukGen2 := mkPuk(t, 2)

	res1, err := Box(bundle1src, pukGen1, puk1)
	require.NoError(t, err)

	dec1, err := Decode(res1.EncB64)
	require.NoError(t, err)
	require.Equal(t, pukGen1, dec1.Enc.Gen)
	bundle1, _, err := Unbox(nil, dec1, res1.VisB64, puk1)
	require.NoError(t, err)
	require.Nil(t, bundle1.Prev, "first box should have no prev")

	bundle2src := bundle1.DeepCopy()
	bundle2src.Prev = bundle1.OwnHash
	bundle2src.Accounts[0].Name = "squirrel fund"
	res2, err := Box(bundle2src, pukGen2, puk2)
	require.NoError(t, err)

	dec2, err := Decode(res2.EncB64)
	require.NoError(t, err)
	bundle2, _, err := Unbox(nil, dec2, res2.VisB64, puk2)
	require.NoError(t, err)
	require.Equal(t, "squirrel fund", bundle2.Accounts[0].Name, "account should be renamed")
	require.Equal(t, bundle1.OwnHash, bundle2.Prev, "bundle 2 should prev bundle 1")
	require.NotNil(t, bundle2.Prev)

	bundle3src := bundle1.DeepCopy()
	bundle3src.Prev = bundle2.OwnHash
	bundle3src.Accounts[0].IsPrimary = false
	res3, err := Box(bundle3src, pukGen2, puk2)
	require.NoError(t, err)

	enc3, err := Decode(res3.EncB64)
	require.NoError(t, err)
	bundle3, _, err := Unbox(nil, enc3, res3.VisB64, puk2)
	require.NoError(t, err)
	require.False(t, bundle3.Accounts[0].IsPrimary, "account should not be primary")
	require.Equal(t, bundle2.OwnHash, bundle3.Prev, "bundle 3 should prev bundle 2")
}

func TestBundleRoundtripCorruptionEnc(t *testing.T) {
	bundle := sampleBundle()
	puk, pukGen := mkPuk(t, 4)

	res, err := Box(bundle, pukGen, puk)
	require.NoError(t, err)
	replaceWith := "a"
	if res.EncB64[85] == 'a' {
		replaceWith = "b"
	}
	res.EncB64 = res.EncB64[:85] + replaceWith + res.EncB64[86:]

	dec2, err := Decode(res.EncB64)
	require.NoError(t, err)

	_, _, err = Unbox(nil, dec2, res.VisB64, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
}

func TestBundleRoundtripCorruptionVis(t *testing.T) {
	bundle := sampleBundle()
	puk, pukGen := mkPuk(t, 3)

	res, err := Box(bundle, pukGen, puk)
	require.NoError(t, err)
	replaceWith := "a"
	if res.VisB64[85] == 'a' {
		replaceWith = "b"
	}
	res.VisB64 = res.VisB64[:85] + replaceWith + res.VisB64[86:]

	dec2, err := Decode(res.EncB64)
	require.NoError(t, err)

	_, _, err = Unbox(nil, dec2, res.VisB64, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "hash mismatch")
}

func TestCanningFacility(t *testing.T) {
	if os.Getenv("KEYBASE_CANNING_FACILITY") != "1" {
		t.Skip("this is not really a test but a tool for creating cans for tests")
	}
	bundleLocal := stellar1.Bundle{
		Revision: 1,
		Prev:     nil,
		Accounts: []stellar1.BundleEntry{{
			AccountID: "GAWZ7HVPKRGCH2KP6475XV6HA2CAF44MXWWE5RKV4LMMGB6FNNSEPNPE",
			Mode:      stellar1.AccountMode_USER,
			Signers:   []stellar1.SecretKey{"SBV2JNAJA65LMCZ5HYDXAYWRQK25CD2DZB25YZVNX3OLPALN2EVKO2V2"},
			IsPrimary: true,
			Name:      "p1",
		}, {
			AccountID: "GBPLLHOKPRFSCE6FP6D37AUUNYCJ2TSPOHMHAR54TBDLWWPIZCD4RL3G",
			Mode:      stellar1.AccountMode_USER,
			Signers:   []stellar1.SecretKey{"SDZJUFUKEQQU77DCF2VH72XB4S427EGKF6BSOSPUIKLTBCTCMXQQ7JU5"},
			IsPrimary: false,
			Name:      "p2",
		}},
	}
	puk, pukGen := mkPuk(t, 3)
	res, err := Box(bundleLocal, pukGen, puk)
	require.NoError(t, err)
	t.Logf(spew.Sdump(res))
	t.Logf("puk seed: %v", base64.StdEncoding.EncodeToString(puk[:]))
	t.Logf("puk gen: %v", pukGen)
	t.Logf("nonce: %v", base64.StdEncoding.EncodeToString(res.Enc.N[:]))
	t.Logf("enc E: %v", base64.StdEncoding.EncodeToString(res.Enc.E[:]))
	t.Logf("enc: %v", res.EncB64)
	t.Logf("vis: %v", res.VisB64)
	cipherpack, err := base64.StdEncoding.DecodeString(res.EncB64)
	require.NoError(t, err)
	encHash := sha256.Sum256(cipherpack)
	t.Logf("own hash: %v", base64.StdEncoding.EncodeToString(encHash[:]))
}

func TestCanned(t *testing.T) {
	c := cans[0]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	require.Equal(t, 2, dec.Enc.V)
	require.Equal(t, c.gen(), dec.Enc.Gen)
	require.Equal(t, "VQRdTWY0+2sVCFOBiyzW7KLj/vs0TPYK", base64.StdEncoding.EncodeToString(dec.Enc.N[:]))
	b64EncE := "AbtoI/mZyZsuGgxoJVJhknplD31kpsWJ3+RQRrRT3s6ntzG/ISYGhRF6dmWHpzPuNHp1G0KWHScN+/YSqLEmEoezivqBXLhEZGC/1ZJ1JV6y497coqQdY2bupgpnpJ2CTqkY475XFV6JPczNhmwm9XS4AHWES90Zr7XJw8bMsP2M6w0jjP5kYs2fLByLP1x0CKVFUxIwkmwtYpXbEaL0pTCZjSkRe3imJIAUkUoAF9lKj/IVw8XPxK3HgxpKFwBEjHmr4g22UDgQ+g+rN8Z9gRG6Py+5wLsZxRQgTteM6PKm0fH4"
	require.Equal(t, b64EncE, base64.StdEncoding.EncodeToString(dec.Enc.E))
	cipherpack, err := base64.StdEncoding.DecodeString(c.encB64)
	require.NoError(t, err)
	encHash := sha256.Sum256(cipherpack)

	bundle, v, err := Unbox(nil, dec, c.visB64, c.puk(t))
	require.NoError(t, err)
	require.Equal(t, v1, v)
	require.Equal(t, stellar1.BundleRevision(1), bundle.Revision)
	require.Nil(t, bundle.Prev)
	require.Equal(t, "YCtPeRc2WInxlsyXdIWnSGOiY3HPXC4MWKhFeTfSRWo=", base64.StdEncoding.EncodeToString(bundle.OwnHash))
	require.Equal(t, encHash[:], []byte(bundle.OwnHash))
	require.Len(t, bundle.Accounts, 1)
	refAccount := stellar1.BundleEntry{
		AccountID: "GDGRUNNTTEHFSGGNNENIFCXLHI5FGCRNB554HHYGDPBV5D3OCKZBSZO2",
		Mode:      stellar1.AccountMode_USER,
		Signers:   []stellar1.SecretKey{"SAGWDNEMLK2Z65NXQUGP6UMR4MDYZ3UQSUXLIEZU6KENJXEHEGIS23BT"},
		IsPrimary: true,
		Name:      "",
	}
	require.Equal(t, refAccount, bundle.Accounts[0])
}

func TestCannedWrongKey(t *testing.T) {
	c := cans[1]
	puk := c.puk(t)
	puk[3] = byte(8)
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
	_, _, err = Unbox(nil, dec, c.visB64, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
}

func TestCannedUnboxInvariantViolationMultiplePrimary(t *testing.T) {
	c := cans[2]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, c.puk(t))
	require.NoError(t, err)
	_, _, err = Unbox(nil, dec, c.visB64, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "multiple primary accounts")
}

func TestCannedUnboxInvariantViolationOrderMismatch(t *testing.T) {
	c := cans[3]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, c.puk(t))
	require.NoError(t, err)
	_, _, err = Unbox(nil, dec, c.visB64, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "mismatched account ID")
}

func TestCannedCryptV1(t *testing.T) {
	c := cans[4]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "stellar secret bundle encryption version 1 has been retired")
	_, _, err = Unbox(nil, dec, c.visB64, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "stellar secret bundle encryption version 1 has been retired")
}

func TestBoxInvariantViolationDuplicateAccount(t *testing.T) {
	bundle := bundleDuplicateAccountIDs()
	puk, pukGen := mkPuk(t, 3)

	_, err := Box(bundle, pukGen, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate account ID")
}

func sampleBundle() stellar1.Bundle {
	return stellar1.Bundle{
		Revision: 1,
		Prev:     nil,
		Accounts: []stellar1.BundleEntry{{
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      stellar1.AccountMode_USER,
			Signers:   []stellar1.SecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
			IsPrimary: true,
			Name:      "",
		}},
	}
}

func bundleDuplicateAccountIDs() stellar1.Bundle {
	return stellar1.Bundle{
		Revision: 1,
		Prev:     nil,
		Accounts: []stellar1.BundleEntry{{
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      stellar1.AccountMode_USER,
			Signers:   []stellar1.SecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
			IsPrimary: true,
			Name:      "p1",
		}, {
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      stellar1.AccountMode_USER,
			Signers:   []stellar1.SecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
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
