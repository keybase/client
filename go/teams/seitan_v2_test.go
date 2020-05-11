package teams

import (
	"errors"
	"testing"
	"time"

	"encoding/base64"

	"golang.org/x/net/context"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// TestSeitanV2Encryption does an offline test run of seitan crypto
// functions.
func TestSeitanV2Encryption(t *testing.T) {
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

	ikey, err := GenerateIKeyV2()
	require.NoError(t, err)
	t.Logf("ikey is: %q (%d)\n", ikey, len(ikey))

	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	t.Logf("sikey is: %v (%d)\n", sikey, len(sikey))

	keyPair, err := sikey.generateKeyPair()
	require.NoError(t, err)
	pubKey := keybase1.SeitanPubKey(keyPair.Public.GetKID()[:])

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	t.Logf("Invite id is: %s\n", inviteID)
	require.Equal(t, len(string(inviteID)), 32)

	var expectedLabelSms keybase1.SeitanKeyLabelSms
	expectedLabelSms.F = "edwin powell hubble"
	expectedLabelSms.N = "+48123zz3045"

	expectedLabel := keybase1.NewSeitanKeyLabelWithSms(expectedLabelSms)

	pkey, encoded, err := sikey.GeneratePackedEncryptedKey(context.TODO(), team, expectedLabel)
	require.NoError(t, err)
	require.EqualValues(t, pkey.Version, 2)
	require.EqualValues(t, pkey.TeamKeyGeneration, 1)
	require.NotZero(tc.T, pkey.RandomNonce)

	t.Logf("Encrypted ikey with gen: %d\n", pkey.TeamKeyGeneration)
	t.Logf("Armored output: %s\n", encoded)

	expectedPKey, err := SeitanDecodePKey(encoded)
	require.NoError(t, err)
	require.Equal(t, expectedPKey.Version, pkey.Version)
	require.Equal(t, expectedPKey.TeamKeyGeneration, pkey.TeamKeyGeneration)
	require.Equal(t, expectedPKey.RandomNonce, pkey.RandomNonce)
	require.Equal(t, expectedPKey.EncryptedKeyAndLabel, pkey.EncryptedKeyAndLabel)

	keyAndLabel, err := pkey.DecryptKeyAndLabel(context.TODO(), team)
	require.NoError(t, err)
	keyAndLabelType, err := keyAndLabel.V()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyAndLabelVersion_V2, keyAndLabelType)
	keyAndLabelV2 := keyAndLabel.V2()
	require.EqualValues(t, pubKey, keyAndLabelV2.K)

	label := keyAndLabelV2.L
	labelType, err := label.T()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyLabelType_SMS, labelType)

	labelSms := label.Sms()
	require.Equal(t, expectedLabelSms.F, labelSms.F)
	require.Equal(t, expectedLabelSms.N, labelSms.N)

	t.Logf("Decrypted pubKey is %q\n", keyAndLabelV2.K)

	uid := user.User.GetUID()
	eldestSeqno := user.EldestSeqno
	ctime := keybase1.ToTime(time.Now())
	msg, err := GenerateSeitanSignatureMessage(uid, eldestSeqno, inviteID, ctime)
	require.NoError(t, err)
	sig, _, err := sikey.GenerateSignature(uid, eldestSeqno, inviteID, ctime)
	require.NoError(t, err)

	require.NoError(t, VerifySeitanSignatureMessage(SeitanPubKey(keyPair.Public), msg, sig))
}

func TestSeitanBadSignatures(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	ikey1, err := GenerateIKeyV2()
	require.NoError(t, err)

	sikey1, err := ikey1.GenerateSIKey()
	require.NoError(t, err)

	inviteID1, err := sikey1.GenerateTeamInviteID()
	require.NoError(t, err)

	keyPair1, err := sikey1.generateKeyPair()
	require.NoError(t, err)

	uid := user.User.GetUID()
	eldestSeqno := user.EldestSeqno
	ctime := keybase1.ToTime(time.Now())
	sig, _, err := sikey1.GenerateSignature(uid, eldestSeqno, inviteID1, ctime)
	require.NoError(t, err)

	// Check signature verification failure for using the wrong sikey
	ikey2, err := GenerateIKeyV2()
	require.NoError(t, err)

	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)

	keyPair2, err := sikey2.generateKeyPair()
	require.NoError(t, err)

	msg, err := GenerateSeitanSignatureMessage(uid, eldestSeqno, inviteID1, ctime)
	require.NoError(t, err)
	require.Error(t, VerifySeitanSignatureMessage(SeitanPubKey(keyPair2.Public), msg, sig))

	type Badmsg struct {
		msg []byte
		err error
	}
	badMsgs := make([]Badmsg, 4)

	// Check signature verification failure for a bad uid
	msgBadUID, errBadUID := GenerateSeitanSignatureMessage(uid+"a", eldestSeqno, inviteID1, ctime)
	badMsgs = append(badMsgs, Badmsg{msgBadUID, errBadUID})

	// Check signature verification failure for a bad EldestSeqno
	msgBadEldest, errBadEldest := GenerateSeitanSignatureMessage(uid, eldestSeqno+1, inviteID1, ctime)
	badMsgs = append(badMsgs, Badmsg{msgBadEldest, errBadEldest})

	// Check signature verification failure for a bad InviteID
	msgBadInviteID, errBadInviteID := GenerateSeitanSignatureMessage(uid, eldestSeqno, inviteID1+"a", ctime)
	badMsgs = append(badMsgs, Badmsg{msgBadInviteID, errBadInviteID})

	// Check signature verification failure for a bad ctime
	msgBadCTime, errBadCTime := GenerateSeitanSignatureMessage(uid, eldestSeqno, inviteID1, ctime+1)
	badMsgs = append(badMsgs, Badmsg{msgBadCTime, errBadCTime})

	for _, bad := range badMsgs {
		require.NoError(t, bad.err)
		require.Error(t, VerifySeitanSignatureMessage(SeitanPubKey(keyPair1.Public), bad.msg, sig))
	}

}

// TestSeitanV2KnownSamples runs offline seitan crypto chain using known
// inputs and compares results with known samples generated using
// server test library.
func TestSeitanV2KnownSamples(t *testing.T) {
	fromB64 := func(b string) (ret []byte) {
		ret, err := base64.StdEncoding.DecodeString(b)
		require.NoError(t, err)
		return ret
	}

	// secret_key: GBsy8q2vgQ6jEHmQZiNJcxvgxVNlG4IsxKf/zcxtJIA=
	// ikey: 4uywza+b3cga7rd6yc
	// sikey: Il9ZFgI1yP2b6Hvt53jWIoo8sDre3puyNH8b2es9TTQ=
	// inviteID: 6303ec43bd61d21edb95a433faf06227
	// pkey: lAIBxBgxk+0rwtlCacCIzNK8apyoiiN69+tTU1HEgze4fphJmImUv7wFm54ioO9dB876yLUciHsuUItYXH1cSq6cShz2HrjVCSUQCJVxDNQwb3A6x2zv6/mrbUselphhjzxrJFGb6mS7N0cA3cYfdk+WByNEUOVqi6qwzgvAYuwEqM1sAYYb+NgrLEH5+4Tlr5mcWfAtLynLngX3Z4Ef4Mf1
	// label: {"sms":{"f":"Alice","n":"111-555-222"},"t":1}

	var expectedSIKey SeitanSIKeyV2
	copy(expectedSIKey[:], fromB64("Il9ZFgI1yP2b6Hvt53jWIoo8sDre3puyNH8b2es9TTQ="))
	expectedInviteID := SCTeamInviteID("6303ec43bd61d21edb95a433faf06227")

	var secretKey keybase1.Bytes32
	copy(secretKey[:], fromB64("GBsy8q2vgQ6jEHmQZiNJcxvgxVNlG4IsxKf/zcxtJIA="))

	pkeyBase64 := "lAIBxBgxk+0rwtlCacCIzNK8apyoiiN69+tTU1HEgze4fphJmImUv7wFm54ioO9dB876yLUciHsuUItYXH1cSq6cShz2HrjVCSUQCJVxDNQwb3A6x2zv6/mrbUselphhjzxrJFGb6mS7N0cA3cYfdk+WByNEUOVqi6qwzgvAYuwEqM1sAYYb+NgrLEH5+4Tlr5mcWfAtLynLngX3Z4Ef4Mf1"

	ikey := SeitanIKeyV2("4uywza+b3cga7rd6yc")
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	require.Equal(t, sikey, expectedSIKey)

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	require.Equal(t, inviteID, expectedInviteID)

	keyPair, err := sikey.generateKeyPair()
	require.NoError(t, err)

	expectedPKey, err := SeitanDecodePKey(pkeyBase64)
	require.NoError(t, err)
	require.EqualValues(t, 2, expectedPKey.Version)
	require.EqualValues(t, 1, expectedPKey.TeamKeyGeneration)

	keyAndLabel, err := expectedPKey.decryptKeyAndLabelWithSecretKey(secretKey)
	require.NoError(t, err) // only encoded map or array can be decoded into a struct

	keyAndLabelVersion, err := keyAndLabel.V()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyAndLabelVersion_V2, keyAndLabelVersion)
	keyAndLabelV2 := keyAndLabel.V2()
	pubKey := keyAndLabelV2.K

	require.Equal(t, keybase1.SeitanPubKey(keyPair.GetKID().String()), pubKey)

	label := keyAndLabelV2.L
	labelType, err := label.T()
	require.NoError(t, err)
	require.Equal(t, keybase1.SeitanKeyLabelType_SMS, labelType)

	labelSms := label.Sms()
	require.Equal(t, "Alice", labelSms.F)
	require.Equal(t, "111-555-222", labelSms.N)

	pkey, _, err := sikey.generatePackedEncryptedKeyWithSecretKey(secretKey, keybase1.PerTeamKeyGeneration(1), expectedPKey.RandomNonce, keyAndLabelV2.L)
	require.NoError(t, err)
	require.Equal(t, expectedPKey.Version, pkey.Version)
	require.Equal(t, expectedPKey.TeamKeyGeneration, pkey.TeamKeyGeneration)
	require.Equal(t, expectedPKey.RandomNonce, pkey.RandomNonce)
	require.Equal(t, expectedPKey.EncryptedKeyAndLabel, pkey.EncryptedKeyAndLabel)
}

// TestIsSeitanyAndAlphabetCoverage tests two unrelated things at once: (1) that
// the IsSeitany function correctly identifies Seitan tokens; and (2) that all
// letters of the Seitan alphabet are hit by generating a sufficient number of
// tokens. It would be bad, for instance, if we only hit 10% of the characters.
func TestIsSeitanyAndAlphabetCoverage(t *testing.T) {

	ikeyV1Gen := func() (s string, err error) {
		ikey, err := GenerateIKey()
		return ikey.String(), err
	}

	ikeyV2Gen := func() (s string, err error) {
		ikey, err := GenerateIKeyV2()
		return ikey.String(), err
	}

	verifyCoverage := func(ikeyGen func() (s string, err error)) {
		coverage := make(map[byte]bool)
		for i := 0; i < 100; i++ {
			s, err := ikeyGen()
			require.NoError(t, err)
			require.True(t, IsSeitany(s))
			require.True(t, IsSeitany(s[2:10]))
			require.True(t, IsSeitany(s[3:13]))
			for _, b := range []byte(s) {
				coverage[b] = true
			}
		}

		// This test can fail with probability 1-(29/30)^(1800), which is
		// approximately (1 - 2^-88)
		for _, b := range []byte(KBase30EncodeStd) {
			require.True(t, coverage[b], "covered all chars")
		}
	}
	verifyCoverage(ikeyV1Gen)
	verifyCoverage(ikeyV2Gen)
}

func TestTeamHandleMultipleSeitans(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	users := make([]*kbtest.FakeUser, 4)
	for i := range users {
		u, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)
		kbtest.Logout(tc)
		users[i] = u
	}

	ann, bee, dan, mel := users[0], users[1], users[2], users[3]
	err := ann.Login(tc.G)
	require.NoError(t, err)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %s", teamName.String())

	_, err = AddMember(context.TODO(), tc.G, teamName.String(), dan.Username, keybase1.TeamRole_WRITER, nil /* botSettings */)
	require.NoError(t, err)

	addSeitanV2 := func(F, N string, role keybase1.TeamRole) keybase1.SeitanIKeyV2 {
		label := keybase1.NewSeitanKeyLabelWithSms(keybase1.SeitanKeyLabelSms{
			F: F,
			N: N,
		})
		ikeyV2, err := CreateSeitanTokenV2(context.TODO(), tc.G, teamName.String(), role, label)
		require.NoError(t, err)
		return ikeyV2
	}

	tokenForBee := addSeitanV2("bee", "123", keybase1.TeamRole_WRITER)
	// tokenForDan := addSeitanV2("dan", "555", keybase1.TeamRole_READER)
	anotherToken := addSeitanV2("someone", "666", keybase1.TeamRole_READER)

	teamObj, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamName.String(),
		NeedAdmin: true,
	})
	require.NoError(t, err)

	invites := teamObj.GetActiveAndObsoleteInvites()
	require.Len(t, invites, 2)
	for _, invite := range invites {
		invtype, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, invtype)
	}

	acceptSeitan := func(u *kbtest.FakeUser, ikey keybase1.SeitanIKeyV2, corrupt bool) keybase1.TeamSeitanRequest {
		kbtest.LogoutAndLoginAs(tc, u)

		uv := u.GetUserVersion()
		now := keybase1.ToTime(time.Now())
		accepted, err := generateAcceptanceSeitanV2(SeitanIKeyV2(ikey), uv, now)
		require.NoError(t, err)

		if corrupt {
			// Ruin the acceptance sig so request is no longer valid
			accepted.sig[0] ^= 0xF0
			accepted.sig[1] ^= 0x0F
			accepted.encoded = base64.StdEncoding.EncodeToString(accepted.sig[:])
		}

		// We need to send this request so HandleTeamSeitan links can
		// do completed_invites, otherwise server will reject these.
		err = postSeitanV2(tc.MetaContext(), accepted)
		require.NoError(t, err)

		return keybase1.TeamSeitanRequest{
			InviteID:    keybase1.TeamInviteID(accepted.inviteID),
			Uid:         uv.Uid,
			EldestSeqno: uv.EldestSeqno,
			Akey:        keybase1.SeitanAKey(accepted.encoded),
			UnixCTime:   int64(now),
		}
	}

	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{
			acceptSeitan(bee, tokenForBee, false /* corrupt */),
			// TODO: Accepting seitan while you are already in team is disabled because
			// of Y2K-1898. Re-enable this after.
			// acceptSeitan(dan, tokenForDan, false /* corrupt */),
			acceptSeitan(mel, anotherToken, true /* corrupt */),
		},
	}

	kbtest.LogoutAndLoginAs(tc, ann)

	API := libkb.NewAPIArgRecorder(tc.G.API)
	tc.G.API = API
	err = HandleTeamSeitan(context.TODO(), tc.G, msg)
	require.NoError(t, err)
	records := API.GetFilteredRecordsAndReset(func(rec *libkb.APIRecord) bool {
		return rec.Arg.Endpoint == "team/reject_invite_acceptance"
	})
	require.Len(t, records, 0, "no invite link acceptances were rejected")

	teamObj, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:      teamName.String(),
		NeedAdmin: true,
	})
	require.NoError(t, err)

	// Ann is still an owner
	role, err := teamObj.MemberRole(context.Background(), ann.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_OWNER, role)

	// Bee got added as a writer
	role, err = teamObj.MemberRole(context.Background(), bee.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)

	// Dan stayed writer
	role, err = teamObj.MemberRole(context.Background(), dan.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_WRITER, role)

	// Mel didn't get in
	role, err = teamObj.MemberRole(context.Background(), mel.GetUserVersion())
	require.NoError(t, err)
	require.Equal(t, keybase1.TeamRole_NONE, role)

	// And invite that Mel tried (and failed) to use is still there.
	require.Equal(t, 1, teamObj.NumActiveInvites(), "NumActiveInvites")
	allInvites := teamObj.GetActiveAndObsoleteInvites()
	require.Len(t, allInvites, 1)
	for _, invite := range allInvites {
		// Ignore errors, we went through this path before in seitan
		// processing and acceptance.
		sikey, _ := SeitanIKeyV2(anotherToken).GenerateSIKey()
		inviteID, _ := sikey.GenerateTeamInviteID()
		require.EqualValues(t, inviteID, invite.Id)
		invtype, err := invite.Type.C()
		require.NoError(t, err)
		require.Equal(t, keybase1.TeamInviteCategory_SEITAN, invtype)
	}
}

func TestTeamInviteSeitanV2Failures(t *testing.T) {
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

	token, err := CreateSeitanTokenV2(context.Background(), tc.G,
		teamName.String(), keybase1.TeamRole_WRITER, keybase1.SeitanKeyLabel{})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	kbtest.LogoutAndLoginAs(tc, user2)

	// Generate invitation id, but make Signature with different IKey.
	// Simulate "replay attack" or similar.
	ikey, err := ParseIKeyV2FromString(string(token))
	require.NoError(t, err)
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)

	ikey2, err := GenerateIKeyV2() // ikey2 is not the ikey from token.
	require.NoError(t, err)
	sikey2, err := ikey2.GenerateSIKey()
	require.NoError(t, err)
	now := keybase1.ToTime(time.Now())
	badSig, badEncoded, err := sikey2.GenerateSignature(user2.GetUID(), user2.EldestSeqno, inviteID, now)
	require.NoError(t, err)

	err = postSeitanV2(tc.MetaContext(), acceptedSeitanV2{
		sig:      badSig,
		encoded:  badEncoded,
		now:      now,
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
			UnixCTime:   int64(now),
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

func TestSeitanPukless(t *testing.T) {
	// Test what happens if client receives handle Seitan notification with an
	// acceptance that's of a PUKless user. If a user can't be added as a
	// crypto-member (using 'team.change_membership' link), they should not be
	// added at all during Seitan resolution, because adding a type='keybase'
	// invitation using 'team.invite' link cannot complete Seitan invite
	// properly.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)
	t.Logf("Admin username: %s", admin.Username)

	teamName, teamID := createTeam2(tc)
	t.Logf("Created team %q", teamName.String())

	token, err := CreateSeitanTokenV2(context.Background(), tc.G,
		teamName.String(), keybase1.TeamRole_WRITER, keybase1.SeitanKeyLabel{})
	require.NoError(t, err)

	t.Logf("Created token %q", token)

	kbtest.Logout(tc)

	// Create a PUKless user
	tc.Tp.DisableUpgradePerUserKey = true
	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	t.Logf("User: %s", user.Username)

	timeNow := keybase1.ToTime(tc.G.Clock().Now())
	seitanRet, err := generateAcceptanceSeitanV2(SeitanIKeyV2(token), user.GetUserVersion(), timeNow)
	require.NoError(t, err)

	// Can't post this acceptance when we don't have a PUK.
	err = postSeitanV2(tc.MetaContext(), seitanRet)
	require.Error(t, err)
	require.IsType(t, libkb.AppStatusError{}, err)
	require.EqualValues(t, keybase1.StatusCode_SCTeamSeitanInviteNeedPUK, err.(libkb.AppStatusError).Code)

	// But server could still send it to us, e.g. due to a bug.
	kbtest.LogoutAndLoginAs(tc, admin)

	inviteID, err := seitanRet.inviteID.TeamInviteID()
	require.NoError(t, err)

	msg := keybase1.TeamSeitanMsg{
		TeamID: teamID,
		Seitans: []keybase1.TeamSeitanRequest{{
			InviteID:    inviteID,
			Uid:         user.GetUID(),
			EldestSeqno: user.EldestSeqno,
			Akey:        keybase1.SeitanAKey(seitanRet.encoded),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   int64(timeNow),
		}},
	}
	err = HandleTeamSeitan(context.Background(), tc.G, msg)
	require.NoError(t, err)

	// HandleTeamSeitan should not have added an invite for user. If it has, it
	// also hasn't completed invite properly (`team.invite` link can't complete
	// invite), which means the invite has been used but left active.
	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        teamName.String(),
		NeedAdmin:   true,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	invite, _, found := team.FindActiveKeybaseInvite(user.GetUID())
	require.False(t, found, "Expected not to find invite for user: %s", spew.Sdump(invite))
}

func TestSeitanMultipleRequestForOneInvite(t *testing.T) {
	// Test server sending a Seitan notifications with multiple request for one
	// Seitan invite. Seitan V1/V2 can never be multiple use, so at most one
	// request should be handled.

	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	tc.Tp.SkipSendingSystemChatMessages = true

	admin, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamName, teamID := createTeam2(tc)

	token, err := CreateSeitanTokenV2(context.Background(), tc.G,
		teamName.String(), keybase1.TeamRole_WRITER, keybase1.SeitanKeyLabel{})
	require.NoError(t, err)

	// Create two users
	var users [2]*kbtest.FakeUser
	for i := range users {
		kbtest.Logout(tc)

		user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
		require.NoError(t, err)
		users[i] = user
	}

	timeNow := keybase1.ToTime(tc.G.Clock().Now())

	var acceptances [2]acceptedSeitanV2
	for i, user := range users {
		kbtest.LogoutAndLoginAs(tc, user)
		seitanRet, err := generateAcceptanceSeitanV2(SeitanIKeyV2(token), user.GetUserVersion(), timeNow)
		require.NoError(t, err)
		acceptances[i] = seitanRet

		if i == 0 {
			// First user has to PostSeitan so invite is changed to ACCEPTED on
			// the server.
			err = postSeitanV2(tc.MetaContext(), seitanRet)
			require.NoError(t, err)
		}
	}

	kbtest.LogoutAndLoginAs(tc, admin)

	inviteID, err := acceptances[0].inviteID.TeamInviteID()
	require.NoError(t, err)

	var seitans [2]keybase1.TeamSeitanRequest
	for i, user := range users {
		seitans[i] = keybase1.TeamSeitanRequest{
			InviteID:    inviteID,
			Uid:         user.GetUID(),
			EldestSeqno: user.EldestSeqno,
			Akey:        keybase1.SeitanAKey(acceptances[i].encoded),
			Role:        keybase1.TeamRole_WRITER,
			UnixCTime:   int64(timeNow),
		}
	}
	msg := keybase1.TeamSeitanMsg{
		TeamID:  teamID,
		Seitans: seitans[:],
	}
	err = HandleTeamSeitan(context.Background(), tc.G, msg)
	if err != nil {
		if err, ok := errors.Unwrap(err).(libkb.AppStatusError); ok {
			// We are expecting no error, but if there's a specific bug that we can
			// recognize, inform about it.
			if err.Code == int(keybase1.StatusCode_SCTeamInviteCompletionMissing) {
				require.FailNowf(t,
					"Got error which suggests that bad change_membership was sent to the server.",
					"%s", err.Error())
			}
		}
	}
	require.NoError(t, err)

	// First request should have been fulfilled, so users[0] should have been
	// added. Second request should have been ignored.
	team, err := Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		Name:        teamName.String(),
		NeedAdmin:   true,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	require.True(t, team.IsMember(context.TODO(), users[0].GetUserVersion()))
	require.False(t, team.IsMember(context.TODO(), users[1].GetUserVersion()))
}
