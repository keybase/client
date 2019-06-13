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
	copy(expectedSIKey[:], fromB64("Il9ZFgI1yP2b6Hvt53jWIoo8sDre3puyNH8b2es9TTQ=")[:])
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
