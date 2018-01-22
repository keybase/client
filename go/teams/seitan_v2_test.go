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

	pepubkey, encoded, err := ikey.GeneratePackedEncryptedKey(context.TODO(), team, expectedLabel)
	require.NoError(t, err)
	require.EqualValues(t, pepubkey.Version, 2)
	require.EqualValues(t, pepubkey.TeamKeyGeneration, 1)
	require.NotZero(tc.T, pepubkey.RandomNonce)

	t.Logf("Encrypted ikey with gen: %d\n", pepubkey.TeamKeyGeneration)
	t.Logf("Armored output: %s\n", encoded)

	expectedPepubkey, err := SeitanDecodePEPubKey(encoded)
	require.NoError(t, err)
	require.Equal(t, expectedPepubkey.Version, pepubkey.Version)
	require.Equal(t, expectedPepubkey.TeamKeyGeneration, pepubkey.TeamKeyGeneration)
	require.Equal(t, expectedPepubkey.RandomNonce, pepubkey.RandomNonce)
	require.Equal(t, expectedPepubkey.EncryptedKeyAndLabel, pepubkey.EncryptedKeyAndLabel)

	keyAndLabel, err := pepubkey.DecryptKeyAndLabel(context.TODO(), team)
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
	ctime := keybase1.ToTime(time.Now())
	msg, err := GenerateSeitanSignatureMessage(uid, user.EldestSeqno, inviteID, ctime)
	require.NoError(t, err)
	sig, _, err := sikey.GenerateSignature(uid, user.EldestSeqno, inviteID, ctime)
	require.NoError(t, err)

	require.True(t, VerifySeitanSignatureMessage(SeitanPubKey(keyPair.Public), msg, sig))
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
	// pepubkey: lAIBxBgxk+0rwtlCacCIzNK8apyoiiN69+tTU1HEgze4fphJmImUv7wFm54ioO9dB876yLUciHsuUItYXH1cSq6cShz2HrjVCSUQCJVxDNQwb3A6x2zv6/mrbUselphhjzxrJFGb6mS7N0cA3cYfdk+WByNEUOVqi6qwzgvAYuwEqM1sAYYb+NgrLEH5+4Tlr5mcWfAtLynLngX3Z4Ef4Mf1
	// label: {"sms":{"f":"Alice","n":"111-555-222"},"t":1}

	var expectedSIKey SeitanSIKeyV2
	copy(expectedSIKey[:], fromB64("Il9ZFgI1yP2b6Hvt53jWIoo8sDre3puyNH8b2es9TTQ=")[:])
	expectedInviteID := SCTeamInviteID("6303ec43bd61d21edb95a433faf06227")

	var secretKey keybase1.Bytes32
	copy(secretKey[:], fromB64("GBsy8q2vgQ6jEHmQZiNJcxvgxVNlG4IsxKf/zcxtJIA="))

	pepubkeyBase64 := "lAIBxBgxk+0rwtlCacCIzNK8apyoiiN69+tTU1HEgze4fphJmImUv7wFm54ioO9dB876yLUciHsuUItYXH1cSq6cShz2HrjVCSUQCJVxDNQwb3A6x2zv6/mrbUselphhjzxrJFGb6mS7N0cA3cYfdk+WByNEUOVqi6qwzgvAYuwEqM1sAYYb+NgrLEH5+4Tlr5mcWfAtLynLngX3Z4Ef4Mf1"

	ikey := SeitanIKeyV2("4uywza+b3cga7rd6yc")
	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	require.Equal(t, sikey, expectedSIKey)

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	require.Equal(t, inviteID, expectedInviteID)

	keyPair, err := sikey.generateKeyPair()
	require.NoError(t, err)

	expectedPepubkey, err := SeitanDecodePEPubKey(pepubkeyBase64)
	require.NoError(t, err)
	require.EqualValues(t, 2, expectedPepubkey.Version)
	require.EqualValues(t, 1, expectedPepubkey.TeamKeyGeneration)

	keyAndLabel, err := expectedPepubkey.decryptKeyAndLabelWithSecretKey(secretKey)
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

	pepubkey, _, err := ikey.generatePackedEncryptedKeyWithSecretKey(secretKey, keybase1.PerTeamKeyGeneration(1), expectedPepubkey.RandomNonce, keyAndLabelV2.L)
	require.NoError(t, err)
	require.Equal(t, expectedPepubkey.Version, pepubkey.Version)
	require.Equal(t, expectedPepubkey.TeamKeyGeneration, pepubkey.TeamKeyGeneration)
	require.Equal(t, expectedPepubkey.RandomNonce, pepubkey.RandomNonce)
	require.Equal(t, expectedPepubkey.EncryptedKeyAndLabel, pepubkey.EncryptedKeyAndLabel)
}

// TestIsSeitanyAndAlphabetCoverage tests two unrelated things at once: (1) that
// the IsSeitany function correctly identifies Seitan tokens; and (2) that all
// letters of the Seitan alphabet are hit by generating a sufficient number of
// tokens. It would be bad, for instance, if we only hit 10% of the characters.
func TestIsSeitanyV2AndAlphabetCoverage(t *testing.T) {

	coverage := make(map[byte]bool)

	for i := 0; i < 100; i++ {
		ikey, err := GenerateIKeyV2()
		require.NoError(t, err)
		s := ikey.String()
		require.True(t, IsSeitanyV2(s))
		require.True(t, IsSeitanyV2(s[2:10]))
		require.True(t, IsSeitanyV2(s[3:13]))
		for _, b := range []byte(s) {
			coverage[b] = true
		}
	}

	// This test can fail with probability 1-(29/30)^(1800), which is approximately (1 - 2^-88)
	for _, b := range []byte(KBase30EncodeStd) {
		require.True(t, coverage[b], "covered all chars")
	}
}

func TestIsSeitanyV2NoMatches(t *testing.T) {
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
		require.False(t, IsSeitanyV2(s), "not seitany")
	}
}
