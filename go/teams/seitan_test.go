package teams

import (
	"fmt"
	"testing"
	"time"

	"golang.org/x/net/context"

	//"github.com/keybase/client/go/externals"
	//"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

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
	fmt.Printf("ikey is: %q (%d)\n", ikey, len(ikey))

	sikey, err := ikey.GenerateSIKey()
	require.NoError(t, err)
	fmt.Printf("sikey is: %v (%d)\n", sikey, len(sikey))

	inviteID, err := sikey.GenerateTeamInviteID()
	require.NoError(t, err)
	fmt.Printf("Invite id is: %s\n", inviteID)
	require.Equal(t, len(string(inviteID)), 32)

	peikey, encoded, err := ikey.GeneratePackedEncryptedIKey(context.TODO(), team)
	require.NoError(t, err)
	require.EqualValues(t, peikey.Version, 1)
	require.EqualValues(t, peikey.TeamKeyGeneration, 1)
	require.NotZero(tc.T, peikey.RandomNonce)

	fmt.Printf("Encrypted ikey with gen: %d\n", peikey.TeamKeyGeneration)
	fmt.Printf("Armored output: %s\n", encoded)

	peikey2, err := SeitanDecodePEIKey(encoded)
	require.NoError(t, err)
	require.Equal(t, peikey.Version, peikey2.Version)
	require.Equal(t, peikey.TeamKeyGeneration, peikey2.TeamKeyGeneration)
	require.Equal(t, peikey.RandomNonce, peikey2.RandomNonce)
	require.Equal(t, peikey.EIKey, peikey2.EIKey)

	ikey2, err := peikey.DecryptIKey(context.TODO(), team)
	require.NoError(t, err)
	require.Equal(t, ikey, ikey2)

	fmt.Printf("Decrypted ikey is %q, wowie!\n", ikey2)

	_, _, err = sikey.GenerateAcceptanceKey(user.User.GetUID(), user.EldestSeqno, time.Now().Unix())
	require.NoError(t, err)
}

func TestSeitanEndToEnd(t *testing.T) {

}
