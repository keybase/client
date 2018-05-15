package teams

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/nacl/box"
)

func encryptWithTeamKey(t *testing.T, team *Team, data []byte, nonce [24]byte,
	gen keybase1.PerTeamKeyGeneration) []byte {
	kp, err := team.encryptionKeyAtGen(gen)
	require.NoError(t, err)
	return box.Seal(nil, data, &nonce, (*[32]byte)(&kp.Public), (*[32]byte)(kp.Private))
}

func TestTeamUnboxOracle(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	teamname := createTeam(tc)
	t.Logf("Created team %s", teamname)

	team, err := Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:        teamname,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	require.NoError(t, RotateKey(context.Background(), tc.G, team.ID))
	require.NoError(t, RotateKey(context.Background(), tc.G, team.ID))

	team, err = Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:        teamname,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	mctx := libkb.NewMetaContextBackground(tc.G)

	kp, err := team.encryptionKeyAtGen(keybase1.PerTeamKeyGeneration(2))
	require.NoError(t, err)

	clearText := []byte{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	buf := encryptWithTeamKey(t, team, clearText, nonce, keybase1.PerTeamKeyGeneration(2))
	arg := keybase1.TryDecryptWithTeamKeyArg{
		TeamID:         team.ID,
		EncryptedData:  buf,
		Nonce:          nonce,
		PeersPublicKey: (keybase1.BoxPublicKey)(kp.Public),
	}
	ret, err := TryDecryptWithTeamKey(mctx, arg)
	require.NoError(t, err)
	require.ElementsMatch(t, ret, clearText)
}
