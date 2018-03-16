package bundle

import (
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
	{"BGYPk8x7VXMRvHzfaceTUks9W9Vx91BHJC5ukiI0xE8=", 3, "hKFlxORQo+AglN4EmjCZ7/0c/Lg/OMh0QOjkr86fMnYGFAL5yQVlQKb4KEzKwDQOkVY1nWnMCLqKY4z36KtdJ2Es09ae4QAluWLHbHYruAdzZjyCCR4yc/sF9XLahdHeqqivuKGjxfLLV+Al8ZXlcbZ+j+++E8E/szPyK4FzUrH4VK+RFWhNFDd5fl1r5jt7BDzzkfkZRTFxeaUlHgl8tB3Ks3uyrs6wsRA9H4QV3jYNPO4xDZ3YtrRbpTFuglui38B8z87sIkubNhy1XKH/kIGd7j62fGO5TGG7QHC0SwJz3OWAY2DlIhajZ2VuA6FuxBgkiHiy6QrIxBfjIiIV/CVXZPn/3uvEM8uhdgE=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0RHUlVOTlRURUhGU0dHTk5FTklGQ1hMSEk1RkdDUk5CNTU0SEhZR0RQQlY1RDNPQ0taQlNaTzKpaXNQcmltYXJ5w6Rtb2RlAKRwcmV2wKhyZXZpc2lvbgE="},
	{"B4r8s6QrEfgO/gJT5k2+x3fykfLQMZWJJVUakZmwsm4=", 3, "hKFlxOSL8f9p79FDdEs47rxZnwKfg+94pzF6GHFZpM+6z0n8PzNGg3cBeM+hpPlzhJoWBhTg1TKIHZ3WWK+91tTYvpA2xkrWXUZpzvQdqqsBGpTPAnb0O7Ob4jKrt2brjewdoJn7BxH6BmrlTau9tmtQj05Yb1VEEYMx35PrcSK3+bw4tQUhhRezr7wMixR0bdXwqpxdx7Yz9Ovupf90h7INw2CT+drWAFB1zTqLul1PVvwQsddj85qC2tuSdUCakbZ/gY03CHNpVh1a1W65tJxkoaXg2DuiIUcrIe+SeHXIlsNU5fIF2YyjZ2VuA6FuxBiUZpnIvcrLcWe34kDGfpQYVWEvZrEClvKhdgE=", "g6hhY2NvdW50c5GDqWFjY291bnRJRNk4R0FaN1VJT0xSQ1dYWFBHQkEzSjRQM1dDNjZHUlNWSVhQWERDRktLVDcyNlRWT1JNUjU3UU9QQUypaXNQcmltYXJ5w6Rtb2RlAKRwcmV2wKhyZXZpc2lvbgE="},
	// this one has two primary accounts.
	{"KHUq4YZME7s30g/R+cQkwONToYIoZxgDriV0C3Vn+Po=", 3, "hKFlxQF2oTmeYwShzWTA0m54gdPPdM77ZYpaWm7Y7I9NzDKSapG6AutL0Vc2620McAFo1KuK0IjEtX0xh3bfY0yBPcUjQSuX7B9nNlvm25NcNEUYY+s7vlcOvNcsolCsPzT3jgXcs9qkmnlJWqGFHvqmuxAfVjirSa1Tx7SpLdD1lS8T5kCN9yX8lxNwS1sQHj4XZ1s798v8Wklh5bIVlvqEuCWF3o84+KXAosrx4fu/pPO7TsvcPusKxe3MeVmZ/2cftZCufK3RkiBMKliF/6tLxnLtwdqi0KBpuhh9tj1jlWNFDIcrP2gC/faz9JZ6oh4Ve+lfwuyVcfOcWU7X3u6T+KAplLj0HwEWlANMoXXKYIa/IwFlAlxCWa4zkQHj7H6ymEwu5gI/jV4r4m9Z2b6/WEmg+DmIDiB0zSS3cvGZs0je6hURAwaoUIhSOXVEwtQ17k4U++iJIMxSOf+Ft/k3yP8X/ceJeW+zv9b2GSoCzi7aktnG/BVrcpmjZ2VuA6FuxBiGG3oFPJdO64/uvd1xb087GH0RIR2ZPGChdgE=", "g6hhY2NvdW50c5KDqWFjY291bnRJRNk4R0NRTDZHSE9NNllaQUlGUUE3T0VCS1JLWlFPU0NYUzVNV05NU1JXRFpZTFBMQ1pXR0hSQ1dLVjSpaXNQcmltYXJ5w6Rtb2RlAIOpYWNjb3VudElE2ThHQ1VIRUVCQ0JMSE9ZTVBaUEpWNFBMUkVSUlJRTFg0Q1dERkxUT0k0U0xERUlJVEZQRkRRV0xOWalpc1ByaW1hcnnDpG1vZGUApHByZXbAqHJldmlzaW9uAQ=="},
	// this one has the accounts in different orders on the inside and outside
	{"jLb/t4BwNkBOTnAyLUeHWkAxUQRG1Umnn50xNMlZVeI=", 3, "hKFlxQF2A+vdA4GJqi6u8Pvu/uhESSlauGGWFymRPEuCR3fKXl6Ms0X3kyw9mVAGzWXNOlht/h5qtf5WcyZYrV7PXK0yPcgyay3EnbzcSdPdKJwV9Srplv5IjlFQATYVVi9QDhNR+caPdh/KpG3sWQ6TK8dIKHEosgze6C4vk5MMqSYD4RHAaPzx3tk/QdrwMyebGCuOGa7u8WLl7bwWH2BwXc+AcqtlBN76FMv3BOEn0xzumeSeAwW9QuNAWvi30Rd+KTAnYCeUpOnjH0mEGBtcvxicNVknT/GOkgTU7Bcws0rLG8wCL6ky288SnKtcxOw7jQgyciL/AZyIEcPE/Z+RXjcKfgcHo+PWmaHmPXLGQiFbmCzdP2N+1m0lW0A8Ye3CYaW4FkVbFe7HggRty4k3xrbbR8GjE1A9AvHbyoa1vAjTHLm/QnqVslXNp3raYpAuYuANuwUUCELfUrug5647VokzTepKiEhQs0FGo5L6SpfAiPkmM3DOp1OjZ2VuA6FuxBjxuftzcissPIfzECF4AZ3kMnkLnBgQv9ahdgE=", "g6hhY2NvdW50c5KDqWFjY291bnRJRNk4R0NRTDZHSE9NNllaQUlGUUE3T0VCS1JLWlFPU0NYUzVNV05NU1JXRFpZTFBMQ1pXR0hSQ1dLVjSpaXNQcmltYXJ5wqRtb2RlAIOpYWNjb3VudElE2ThHQ1VIRUVCQ0JMSE9ZTVBaUEpWNFBMUkVSUlJRTFg0Q1dERkxUT0k0U0xERUlJVEZQRkRRV0xOWalpc1ByaW1hcnnCpG1vZGUApHByZXbAqHJldmlzaW9uAQ=="},
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
	require.Equal(t, "JIh4sukKyMQX4yIiFfwlV2T5/97rxDPL", base64.StdEncoding.EncodeToString(dec.Enc.N[:]))
	b64EncE := "UKPgIJTeBJowme/9HPy4PzjIdEDo5K/OnzJ2BhQC+ckFZUCm+ChMysA0DpFWNZ1pzAi6imOM9+irXSdhLNPWnuEAJblix2x2K7gHc2Y8ggkeMnP7BfVy2oXR3qqor7iho8Xyy1fgJfGV5XG2fo/vvhPBP7Mz8iuBc1Kx+FSvkRVoTRQ3eX5da+Y7ewQ885H5GUUxcXmlJR4JfLQdyrN7sq7OsLEQPR+EFd42DTzuMQ2d2La0W6UxboJbot/AfM/O7CJLmzYctVyh/5CBne4+tnxjuUxhu0BwtEsCc9zlgGNg5SIW"
	require.Equal(t, b64EncE, base64.StdEncoding.EncodeToString(dec.Enc.E))

	bundle, v, err := Unbox(dec, c.visB64, c.puk(t))
	require.NoError(t, err)
	require.Equal(t, v1, v)
	require.Equal(t, keybase1.StellarRevision(1), bundle.Revision)
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
