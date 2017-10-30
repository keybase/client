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

	peikey, encoded, err := ikey.GeneratePackedEncryptedIKey(context.TODO(), team)
	require.NoError(t, err)
	require.EqualValues(t, peikey.Version, 1)
	require.EqualValues(t, peikey.TeamKeyGeneration, 1)
	require.NotZero(tc.T, peikey.RandomNonce)

	t.Logf("Encrypted ikey with gen: %d\n", peikey.TeamKeyGeneration)
	t.Logf("Armored output: %s\n", encoded)

	peikey2, err := SeitanDecodePEIKey(encoded)
	require.NoError(t, err)
	require.Equal(t, peikey.Version, peikey2.Version)
	require.Equal(t, peikey.TeamKeyGeneration, peikey2.TeamKeyGeneration)
	require.Equal(t, peikey.RandomNonce, peikey2.RandomNonce)
	require.Equal(t, peikey.EIKey, peikey2.EIKey)

	ikey2, err := peikey.DecryptIKey(context.TODO(), team)
	require.NoError(t, err)
	require.Equal(t, ikey, ikey2)

	t.Logf("Decrypted ikey is %q, wowie!\n", ikey2)

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
	// peikey is lAHAxBi8R7edkN/i0W+z1xbgsCqdFAdOFJXOaLvEIKAWDcvayhW+cel6YdZdpuVXj+Iyv434w30z3+PkascC

	expectedIKey := SeitanIKey("raw2ewqp249dyod4")
	var expectedSIKey SeitanSIKey
	copy(expectedSIKey[:], fromB64("Yqbj8NgHkIG03wfZX/dxpBpqFoXPXNXyQr+MnvCMbS4=")[:])
	expectedInviteID := SCTeamInviteID("24189cc0ad5851ac52404ee99c7c9c27")

	var secretKey keybase1.Bytes32
	copy(secretKey[:], fromB64("dKzxu7uoeL4gOpS9a+xPKJ0wM/8SQs8DAsvzqfSu6FU="))

	peiKeyBase64 := "lAHAxBi8R7edkN/i0W+z1xbgsCqdFAdOFJXOaLvEIKAWDcvayhW+cel6YdZdpuVXj+Iyv434w30z3+PkascC"

	peiKey, err := SeitanDecodePEIKey(peiKeyBase64)
	require.NoError(t, err)
	require.EqualValues(t, 1, peiKey.Version)
	require.EqualValues(t, 0, peiKey.TeamKeyGeneration)

	ikey, err := peiKey.decryptIKeyWithSecretKey(secretKey)
	require.NoError(t, err)
	require.Equal(t, expectedIKey, ikey)

	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	require.Equal(t, expectedSIKey, sikey)

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	require.Equal(t, expectedInviteID, inviteID)

	peiKey2, _, err := ikey.generatePackedEncryptedIKeyWithSecretKey(secretKey, keybase1.PerTeamKeyGeneration(0), peiKey.RandomNonce)
	require.NoError(t, err)
	require.Equal(t, peiKey.Version, peiKey2.Version)
	require.Equal(t, peiKey.TeamKeyGeneration, peiKey2.TeamKeyGeneration)
	require.Equal(t, peiKey.RandomNonce, peiKey2.RandomNonce)
	require.Equal(t, peiKey.EIKey, peiKey2.EIKey)
}
