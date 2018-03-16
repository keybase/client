package bundle

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

const v1 = keybase1.StellarBundleVersion_V1

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
	{"eTL+zDIxcT2VXjQQ++kWV7NpHrz49b0DxK3UcdS8k/A=", 3, "hKFlxOSabxN7oh6jksn0Op99CN6jjt0RGbNkE21rgldt7XWrjUP3LKiLIZXshHF4bXehkbcUqZCpWi14wLc2z31vmEPxm3iSwwWx0ePJnCtX53oYAeJeAGeCmmfacmpvIKhNPqd1Xiv4/Ujj9QhE2QkxhYPC0KPduWN4lsnk+Ae+HHdFcNO5ifQ4DoibsfIiv4Q4GDDxACaawEBv7+BIkO+WNmv/7EPZlxw2F0WVMXY+olewEZuYkuDZSPw0q3i2XyTWzJe5epKe2+mH5nJjIXbC2s1CzvHMj7xabXRLTvuqtiLKsxgqPNKjZ2VuA6FuxBiwsPJSEeeLudeMyVeHF9LgRI77pxlhZi+hdgE=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0RHUlVOTlRURUhGU0dHTk5FTklGQ1hMSEk1RkdDUk5CNTU0SEhZR0RQQlY1RDNPQ0taQlNaTzKpaXNQcmltYXJ5w6Rtb2RlAaRwcmV2wKhyZXZpc2lvbgE="},
	{"atVK8A2oMUqH2bjNlNjQB8TQGVFy6OMZwlLegmgD2J0=", 3, "hKFlxOQ1dbS1A0jTBnUQbvKbfWJ+vRSev9O20K0x5HRRtWGBWey0ABbajtI3uDalJ3nzI2bJ8jacL6USpTB6Uxs1x9dufPARAi9H2karv2LgQdfdQJ4u30DEUa9ayXkNTY4Gzo0T8f/G0YdWL6uVjGZrB+qlXNsYn16VMbeeJ318c2TNX69mVdJEaAkWT7qu3MF6w3/GojEG4VK/PrvzcJG4+0J6swvNeNYaWGzMEn7jy8QDps4UJQshbZJw+djwa/mr40WJLrUg6jYUYGRfjTZOJTCoHHbIS2Kzlbxjhlo0CFqz5Uxij7KjZ2VuA6FuxBjMRz8H5RN+xPmEkulUakQpiVYhd+dm8fKhdgE=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0FaN1VJT0xSQ1dYWFBHQkEzSjRQM1dDNjZHUlNWSVhQWERDRktLVDcyNlRWT1JNUjU3UU9QQUypaXNQcmltYXJ5w6Rtb2RlAaRwcmV2wKhyZXZpc2lvbgE="},
	// this one has two primary accounts.
	{"9Qd+6cJL8PpnpNAzpWnQYW/Dqf8p2pX37p+Fpa4u7YI=", 3, "hKFlxQF2PpQpxlJ8zd3HZrErc3zjTr9FbiSXhlr4c4e6JALlqRD7+1K1RiyZEfK3xWriy5+WAH7Uo/3gvWkaKEHLYPxpSfNNGzOJsOntMhAodU1l29h/IeldiwsCUFeIhswwIZXNZ6vfmN7M/1Ux3oVk7NKbwPCaCoIufYWx4y/BL8N1/HwdERe27IEDPyd1LpBV5rEded4sLbBhPE9V9jOx8+SbKGtILE3tzI6g3gFqSm8CjstzwRhm1D6A04frj96G5RPKAVQzp+65qVJwpG8JkHjWBg16zZMhX95nruHTCLXBEdFjDslJTZdwS6H2yunnf6tfgqHa2FLuhykspaMmgM8hXPcFnsUjL2RyYGlFpdmBgPdj4mUNfvYV2+PDfYAs9OG4nd4BV9wQKFRA7hooBp3NnC01keGORvQNkkpvZYGroyJC5odSngIVeRQD8NvWaPjqOV7MPSu3YdF9nUDd10c+OzYOvtDqonaV9DsD8ZkmqzdZeSjRnOyjZ2VuA6FuxBg/mM19V2d1K2+n3mjnziNx3okGJ3iaodqhdgE=", "g6hhY2NvdW50c5KDqWFjY291bnRJRNk4R0FNTUVZSTJESTc1NzZSWUZSSEEzRktENlJKQ0Y1RUNKVTdCV0hGNzdVUUtKN05TM01WUjZOMkupaXNQcmltYXJ5w6Rtb2RlAYOpYWNjb3VudElE2ThHQUIyQlBCQ05IRkxMQkNMRTI2UVBHSUtVWDJIQzJOTVVNTDdQRUozVVBWUjNPNFFNVTRUNlZLMqlpc1ByaW1hcnnDpG1vZGUBpHByZXbAqHJldmlzaW9uAQ=="},
	// this one has the accounts in different orders on the inside and outside
	{"MWoF2nQhFUC1R+7HEfD8RMHEzE95d5KURpw8fMWPU5A=", 3, "hKFlxQF2BwY9jwhef9+q54QJcfq7hfKtzEH1apJ7FC3mjTTvpcsnKHeXNX6MvEISlTwE7iuTMmnpr8ZbNv8dBT8OeAc/t5IrRUUFymXl1s0Keyvilf4q9jhG6qe8mGILG+S9D3se6CnMPiY0yVpRQBugXLm0h3xI8kJn/TVieT5Gd5IiW19f1H/jFu8C5gVa3+e8tO8TTvwOJKYYmMaczxhY2O1YWN5XZbBgxX1quDkqe+c7K2OMt4GgMxMS6KWn+kKJ6l1D1bhHvQ6cAmc5KwCECS0oAalH7vjQdJylXOxOtBEkuTxBHSqfASpT5zLNI7QnJ8Xu7T1xYUPWHCsJOTIvalA/eRXgTCurZ+tWM6BFT58npn7LVOApwHdR6EE3U2PkBysEPAY35Wr1lKJjxv07Yv9f07Hrxbp0/LaHAmSjHSJkojnPPqbWRKbTRIvLxP9Ug92f8d1KELJmpYFzantjsYRrbC9mKB4oIcNPyCCRuwtt8PELbMBDCKOjZ2VuA6FuxBgjv0ihU6zxq0XZTYfeslHWEphYuUoF+M2hdgE=", "g6hhY2NvdW50c5KDqWFjY291bnRJRNk4R0NQQkJCRk5NRjVMRUNXSU9STlpKNEU1NVdDRzdBR1dGWFhMWUVHMlc0NDRDSUZTWFhTV0IzSkepaXNQcmltYXJ5w6Rtb2RlAYOpYWNjb3VudElE2ThHQk5BRkpKUTJOQ0ozVVdCSENaR0RWVzQ2R1k0TVVJSEZYQ1ZVRlA1QVpZS0RNNDNLWDRZRlRBUalpc1ByaW1hcnnCpG1vZGUBpHByZXbAqHJldmlzaW9uAQ=="},
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
	require.Equal(t, 1, res.Enc.V)
	require.True(t, len(res.Enc.E) > 100)
	require.Equal(t, pukGen, res.Enc.Gen)

	dec2, err := Decode(res.EncB64)
	require.NoError(t, err)
	require.Equal(t, res.Enc, dec2.Enc)

	bundle2, v, err := Unbox(dec2, res.VisB64, puk)
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
	bundle1, _, err := Unbox(dec1, res1.VisB64, puk1)
	require.NoError(t, err)
	require.Nil(t, bundle1.Prev, "first box should have no prev")

	bundle2src := bundle1.DeepCopy()
	bundle2src.Prev = bundle1.OwnHash
	bundle2src.Accounts[0].Name = "squirrel fund"
	res2, err := Box(bundle2src, pukGen2, puk2)
	require.NoError(t, err)

	dec2, err := Decode(res2.EncB64)
	require.NoError(t, err)
	bundle2, _, err := Unbox(dec2, res2.VisB64, puk2)
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
	bundle3, _, err := Unbox(enc3, res3.VisB64, puk2)
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

	_, _, err = Unbox(dec2, res.VisB64, puk)
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

	_, _, err = Unbox(dec2, res.VisB64, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "hash mismatch")
}

func TestCanned(t *testing.T) {
	c := cans[0]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	require.Equal(t, 1, dec.Enc.V)
	require.Equal(t, c.gen(), dec.Enc.Gen)
	require.Equal(t, "sLDyUhHni7nXjMlXhxfS4ESO+6cZYWYv", base64.StdEncoding.EncodeToString(dec.Enc.N[:]))
	b64EncE := "mm8Te6Ieo5LJ9DqffQjeo47dERmzZBNta4JXbe11q41D9yyoiyGV7IRxeG13oZG3FKmQqVoteMC3Ns99b5hD8Zt4ksMFsdHjyZwrV+d6GAHiXgBngppn2nJqbyCoTT6ndV4r+P1I4/UIRNkJMYWDwtCj3bljeJbJ5PgHvhx3RXDTuYn0OA6Im7HyIr+EOBgw8QAmmsBAb+/gSJDvljZr/+xD2ZccNhdFlTF2PqJXsBGbmJLg2Uj8NKt4tl8k1syXuXqSntvph+ZyYyF2wtrNQs7xzI+8Wm10S077qrYiyrMYKjzS"
	require.Equal(t, b64EncE, base64.StdEncoding.EncodeToString(dec.Enc.E))
	cipherpack, err := base64.StdEncoding.DecodeString(c.encB64)
	require.NoError(t, err)
	encHash := sha256.Sum256(cipherpack)

	bundle, v, err := Unbox(dec, c.visB64, c.puk(t))
	require.NoError(t, err)
	require.Equal(t, v1, v)
	require.Equal(t, keybase1.StellarRevision(1), bundle.Revision)
	require.Nil(t, bundle.Prev)
	require.Equal(t, "CPbPvX1CVoMD60+dQhyLcW5pBY3758YAGUWN4Swxuy0=", base64.StdEncoding.EncodeToString(bundle.OwnHash))
	require.Equal(t, encHash[:], []byte(bundle.OwnHash))
	require.Len(t, bundle.Accounts, 1)
	refAccount := keybase1.StellarEntry{
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
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
	_, _, err = Unbox(dec, c.visB64, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret box open failed")
}

func TestCannedUnboxInvariantViolationMultiplePrimary(t *testing.T) {
	c := cans[2]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, c.puk(t))
	require.NoError(t, err)
	_, _, err = Unbox(dec, c.visB64, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "multiple primary accounts")
}

func TestCannedUnboxInvariantViolationOrderMismatch(t *testing.T) {
	c := cans[3]
	dec, err := Decode(c.encB64)
	require.NoError(t, err)
	_, err = Decrypt(dec.Enc, c.puk(t))
	require.NoError(t, err)
	_, _, err = Unbox(dec, c.visB64, c.puk(t))
	require.Error(t, err)
	require.Contains(t, err.Error(), "mismatched account ID")
}

func TestBoxInvariantViolationDuplicateAccount(t *testing.T) {
	bundle := bundleDuplicateAccountIDs()
	puk, pukGen := mkPuk(t, 3)

	_, err := Box(bundle, pukGen, puk)
	require.Error(t, err)
	require.Contains(t, err.Error(), "duplicate account ID")
}

func sampleBundle() keybase1.StellarBundle {
	return keybase1.StellarBundle{
		Revision: 1,
		Prev:     nil,
		Accounts: []keybase1.StellarEntry{{
			AccountID: "GDRDPWSPKOEUNYZMWKNEC3WZTEDPT6XYGDWNO4VIASTFFZYS5WII2762",
			Mode:      keybase1.StellarAccountMode_USER,
			Signers:   []keybase1.StellarSecretKey{"SDGCPMBQHYAIWM3PQOEKWICDMLVT7REJ24J26QEYJYGB6FJRPTKDULQX"},
			IsPrimary: true,
			Name:      "",
		}},
	}
}

func bundleDuplicateAccountIDs() keybase1.StellarBundle {
	return keybase1.StellarBundle{
		Revision: 1,
		Prev:     nil,
		Accounts: []keybase1.StellarEntry{{
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
