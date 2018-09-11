package teams

import (
	"testing"
	"time"

	"encoding/base64"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// TestSeitanEncryption does an offline test run of seitan crypto
// functions.
func TestSeitanEncryption(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name := createTeam(tc)

	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        name,
		NeedAdmin:   true,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	ikey, err := GenerateIKey()
	require.NoError(t, err)
	t.Logf("ikey is: %q (%d)\n", ikey, len(ikey))

	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	t.Logf("sikey is: %v (%d)\n", sikey, len(sikey))

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	t.Logf("Invite id is: %s\n", inviteID)
	require.Equal(t, len(string(inviteID)), 32)

	var labelSms keybase1.SeitanKeyLabelSms
	labelSms.F = "Edwin Powell Hubble"
	labelSms.N = "+48123ZZ3045"

	label := keybase1.NewSeitanKeyLabelWithSms(labelSms)

	pkey, encoded, err := ikey.GeneratePackedEncryptedKey(context.TODO(), team, label)
	require.NoError(t, err)
	require.EqualValues(t, pkey.Version, 1)
	require.EqualValues(t, pkey.TeamKeyGeneration, 1)
	require.NotZero(tc.T, pkey.RandomNonce)

	t.Logf("Encrypted ikey with gen: %d\n", pkey.TeamKeyGeneration)
	t.Logf("Armored output: %s\n", encoded)

	pkey2, err := SeitanDecodePKey(encoded)
	require.NoError(t, err)
	require.Equal(t, pkey.Version, pkey2.Version)
	require.Equal(t, pkey.TeamKeyGeneration, pkey2.TeamKeyGeneration)
	require.Equal(t, pkey.RandomNonce, pkey2.RandomNonce)
	require.Equal(t, pkey.EncryptedKeyAndLabel, pkey2.EncryptedKeyAndLabel)

	keyAndLabel, err := pkey.DecryptKeyAndLabel(context.TODO(), team)
	require.NoError(t, err)
	keyAndLabelType, err := keyAndLabel.V()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyAndLabelVersion_V1, keyAndLabelType)
	keyAndLabelV1 := keyAndLabel.V1()
	require.EqualValues(t, ikey, keyAndLabelV1.I)

	label2 := keyAndLabelV1.L
	label2Type, err := label2.T()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyLabelType_SMS, label2Type)

	labelSms2 := label2.Sms()
	require.Equal(t, labelSms.F, labelSms2.F)
	require.Equal(t, labelSms.N, labelSms2.N)

	t.Logf("Decrypted ikey is %q\n", keyAndLabelV1.I)

	_, _, err = sikey.GenerateAcceptanceKey(user.User.GetUID(), user.EldestSeqno, time.Now().Unix())
	require.NoError(t, err)
}

// TestSeitanKnownSamples runs offline seitan crypto chain using known
// inputs and compares results with known samples generated using
// server test library.
func TestSeitanKnownSamples(t *testing.T) {
	fromB64 := func(b string) (ret []byte) {
		ret, err := base64.StdEncoding.DecodeString(b)
		require.NoError(t, err)
		return ret
	}

	// Secret key is dKzxu7uoeL4gOpS9a+xPKJ0wM/8SQs8DAsvzqfSu6FU=
	// IKey is raw2ewqp249dyod4
	// SIKey is Yqbj8NgHkIG03wfZX/dxpBpqFoXPXNXyQr+MnvCMbS4=
	// invite_id is 24189cc0ad5851ac52404ee99c7c9c27
	// pkey is lAHAxBi8R7edkN/i0W+z1xbgsCqdFAdOFJXOaLvEIKAWDcvayhW+cel6YdZdpuVXj+Iyv434w30z3+PkascC
	// Label is sms (type 1): { full_name : "Edwin Powell Hubble", number : "+48123ZZ3045" }

	expectedIKey := SeitanIKey("raw2ewqp249dyod4")
	var expectedSIKey SeitanSIKey
	copy(expectedSIKey[:], fromB64("Yqbj8NgHkIG03wfZX/dxpBpqFoXPXNXyQr+MnvCMbS4=")[:])
	expectedInviteID := SCTeamInviteID("24189cc0ad5851ac52404ee99c7c9c27")

	var secretKey keybase1.Bytes32
	copy(secretKey[:], fromB64("dKzxu7uoeL4gOpS9a+xPKJ0wM/8SQs8DAsvzqfSu6FU="))

	pkeyBase64 := "lAEBxBgfSKQYaD+wEBhdRga+OUuEyTlT1lg6sGbEW6uPYbSC94eoWQopzkyVVoaZYYx6sAH3EXewxYkrCoIyncd4hayOFeGZI5XraS/vS5YvqThWj19EZAzxRVBV/W6JrZuiCFuw5Rkx0TJqGg1n+Y65cXSCP5zbPP8="

	pkey, err := SeitanDecodePKey(pkeyBase64)
	require.NoError(t, err)
	require.EqualValues(t, 1, pkey.Version)
	require.EqualValues(t, 1, pkey.TeamKeyGeneration)

	keyAndLabel, err := pkey.decryptKeyAndLabelWithSecretKey(secretKey)
	require.NoError(t, err) // only encoded map or array can be decoded into a struct

	keyAndLabelType, err := keyAndLabel.V()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyAndLabelVersion_V1, keyAndLabelType)
	keyAndLabelV1 := keyAndLabel.V1()
	ikey := SeitanIKey(keyAndLabelV1.I)

	require.Equal(t, expectedIKey, ikey)

	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	require.Equal(t, expectedSIKey, sikey)

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	require.Equal(t, expectedInviteID, inviteID)

	label := keyAndLabelV1.L
	labelType, err := label.T()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyLabelType_SMS, labelType)

	labelSms := label.Sms()
	require.Equal(t, "Edwin Powell Hubble", labelSms.F)
	require.Equal(t, "+48123ZZ3045", labelSms.N)

	pkey2, _, err := ikey.generatePackedEncryptedKeyWithSecretKey(secretKey, keybase1.PerTeamKeyGeneration(1), pkey.RandomNonce, keyAndLabelV1.L)
	require.NoError(t, err)
	require.Equal(t, pkey.Version, pkey2.Version)
	require.Equal(t, pkey.TeamKeyGeneration, pkey2.TeamKeyGeneration)
	require.Equal(t, pkey.RandomNonce, pkey2.RandomNonce)
	require.Equal(t, pkey.EncryptedKeyAndLabel, pkey2.EncryptedKeyAndLabel)
}

// TestSeitanParams tests the note at the top of seitan.go.
func TestSeitanParams(t *testing.T) {
	require.True(t, (len(KBase30EncodeStd) <= int(base30BitMask)), "the right bitmask at log2(len(alphabet))")
}

func TestIsSeitanyNoMatches(t *testing.T) {
	var noMatches = []string{
		"team.aaa.bb.cc",
		"aanbbjejjeff",
		"a+b",
		"aaa+b",
		"+",
		"+++",
		"chia_public",
	}
	for _, s := range noMatches {
		require.False(t, IsSeitany(s), "not seitany")
	}
}

func TestParseSeitanTokenFromPaste(t *testing.T) {
	units := []struct {
		token     string
		expectedS string
		expectedB bool
	}{
		{
			`aazaaa0a+aaaaaaaaa`,
			`aazaaa0a+aaaaaaaaa`,
			true,
		}, {

			`aazaaa0aaaaaaaaaa`,
			`aazaaa0aaaaaaaaaa`,
			false,
		}, {

			`team1`,
			`team1`,
			false,
		}, {
			`team1.subteam2`,
			`team1.subteam2`,
			false,
		}, {
			`team1.subteam222`,
			`team1.subteam222`,
			false,
		}, {
			`team1.subteam2222`,
			`team1.subteam2222`,
			false,
		}, {
			`team1.subteam22222`,
			`team1.subteam22222`,
			false,
		}, {
			`HELLO AND WELCOME TO THIS TEAM. token: aazaaa0a+aaaaaaaaa`,
			`aazaaa0a+aaaaaaaaa`,
			true,
		}, {
			`HELLO AND WELCOME TO THIS TEAM. token: aazaaa0aaaaaaaaa`,
			`aazaaa0aaaaaaaaa`,
			true,
		}, {
			`HELLO AND WELCOME TO THIS TEAM. token: aazaaa0aaaaaaaaaa`,
			`aazaaa0aaaaaaaaaa`,
			true,
		}, {
			`aazaaa0aaaaaaaaaa`,
			`aazaaa0aaaaaaaaaa`,
			false,
		}, {
			`aazaaa0aaaaaaaaaa aazaaa0aaaaaaaaaa`,
			`aazaaa0aaaaaaaaaa aazaaa0aaaaaaaaaa`,
			false,
		}, {
			`invited to team 0123456789012345 with token: 87zaaa0aaa1zyaaz`,
			`87zaaa0aaa1zyaaz`,
			true,
		}, {
			`Please join the agot team on Keybase. Install and paste this in the "Teams" tab:  token: m947873cdbwdvtku  quick install: keybase.io/_/go`,
			`m947873cdbwdvtku`,
			true,
		},
	}

	for i, unit := range units {
		t.Logf("[%v] %v", i, unit.token)
		maybeSeitan, keepSecret := ParseSeitanTokenFromPaste(unit.token)
		require.Equal(t, unit.expectedS, maybeSeitan)
		require.Equal(t, unit.expectedB, keepSecret)
	}
}
