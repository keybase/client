package teams

import (
	"testing"
	"time"

	"encoding/base64"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
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
	copy(expectedSIKey[:], fromB64("Yqbj8NgHkIG03wfZX/dxpBpqFoXPXNXyQr+MnvCMbS4="))
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

func TestTeamInviteSeitanFailures(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	user2, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	kbtest.Logout(tc)

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %q", teamName.String())

	token, err := CreateSeitanToken(context.Background(), tc.G,
		teamName.String(), keybase1.TeamRole_WRITER, keybase1.SeitanKeyLabel{})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	kbtest.LogoutAndLoginAs(tc, user2)

	// Generate invitation id, but make AKey with different IKey.
	// Simulate "replay attack" or similar.
	ikey, err := ParseIKeyFromString(string(token))
	require.NoError(t, err)
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)

	ikey2, err := GenerateIKey() // ikey2 is not the ikey from token.
	require.NoError(t, err)
	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)
	unixNow := time.Now().Unix()
	badAkey, badEncoded, err := sikey2.GenerateAcceptanceKey(user2.GetUID(), user2.EldestSeqno, unixNow)
	require.NoError(t, err)

	err = postSeitanV1(tc.MetaContext(), acceptedSeitanV1{
		akey:     badAkey,
		encoded:  badEncoded,
		unixNow:  unixNow,
		inviteID: inviteID,
	})
	require.NoError(t, err)

	teamInviteID, err := inviteID.TeamInviteID()
	require.NoError(t, err)

	t.Logf("handle synthesized rekeyd command")
	kbtest.LogoutAndLoginAs(tc, admin)

	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{{
			InviteID:    teamInviteID,
			Uid:         user2.GetUID(),
			EldestSeqno: user2.EldestSeqno,
			Akey:        keybase1.SeitanAKey(badEncoded),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   unixNow,
		}},
	}

	API := libkb.NewAPIArgRecorder(tc.G.API)
	tc.G.API = API
	err = HandleTeamSeitan(context.TODO(), tc.G, msg)
	// Seitan handler does not fail, but ignores the request.
	require.NoError(t, err)
	records := API.GetFilteredRecordsAndReset(func(rec *libkb.APIRecord) bool {
		return rec.Arg.Endpoint == "team/reject_invite_acceptance"
	})
	// not an InviteLink, nothing to reject
	require.Len(t, records, 0, "no invite link acceptances were rejected")

	t.Logf("invite should still be there")
	t0, err := GetTeamByNameForTest(context.Background(), tc.G, teamName.String(), false /* public */, true /* needAdmin */)
	require.NoError(t, err)
	require.Equal(t, 1, t0.NumActiveInvites(), "invite should still be active")
	require.EqualValues(t, t0.CurrentSeqno(), 2)

	t.Logf("user should not be in team")
	role, err := t0.MemberRole(context.Background(), user2.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_NONE, role, "user role")
}
