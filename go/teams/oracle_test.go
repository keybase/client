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
	gen keybase1.PerTeamKeyGeneration) (ciphertext []byte, pubkey libkb.NaclDHKeyPublic) {
	kp, err := team.encryptionKeyAtGen(context.Background(), gen)
	require.NoError(t, err)
	ciphertext = box.Seal(nil, data, &nonce, (*[32]byte)(&kp.Public), (*[32]byte)(kp.Private))
	pubkey = kp.Public
	return ciphertext, pubkey
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

	require.NoError(t, RotateKeyVisible(context.Background(), tc.G, team.ID))
	require.NoError(t, RotateKeyVisible(context.Background(), tc.G, team.ID))

	team, err = Load(context.Background(), tc.G, keybase1.LoadTeamArg{
		Name:        teamname,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	mctx := libkb.NewMetaContextBackground(tc.G)

	clearText := []byte{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	buf, pub := encryptWithTeamKey(t, team, clearText, nonce, keybase1.PerTeamKeyGeneration(2))
	arg := keybase1.TryDecryptWithTeamKeyArg{
		TeamID:         team.ID,
		EncryptedData:  buf,
		Nonce:          nonce,
		PeersPublicKey: (keybase1.BoxPublicKey)(pub),
	}
	ret, err := TryDecryptWithTeamKey(mctx, arg)
	require.NoError(t, err)
	require.ElementsMatch(t, ret, clearText)

	// Try again with MinGeneration argument.
	arg.MinGeneration = keybase1.PerTeamKeyGeneration(2)
	ret, err = TryDecryptWithTeamKey(mctx, arg)
	require.NoError(t, err)
	require.ElementsMatch(t, ret, clearText)

	// Do same encryption scheme but with generation 1.
	buf, pub = encryptWithTeamKey(t, team, clearText, nonce, keybase1.PerTeamKeyGeneration(1))
	arg.EncryptedData = buf
	arg.MinGeneration = keybase1.PerTeamKeyGeneration(0) // default
	arg.PeersPublicKey = (keybase1.BoxPublicKey)(pub)
	ret, err = TryDecryptWithTeamKey(mctx, arg)
	require.NoError(t, err)
	require.ElementsMatch(t, ret, clearText)
}

func TestTeamOracleRepolling(t *testing.T) {
	fus, tcs, cleanup := setupNTests(t, 2)
	defer cleanup()

	teamName, teamID := createTeam2(*tcs[0])
	t.Logf("Created team %s", teamName)

	_, err := AddMember(context.Background(), tcs[0].G, teamName.String(), fus[1].Username, keybase1.TeamRole_ADMIN, nil)
	require.NoError(t, err)

	// Issue a team load as user 1 to get this version of the team to cache.
	_, err = Load(context.Background(), tcs[1].G, keybase1.LoadTeamArg{
		Name:        teamName.String(),
		ForceRepoll: true,
	})
	require.NoError(t, err)

	// Rotate team as user 0 and encrypt with key 2.
	require.NoError(t, RotateKeyVisible(context.Background(), tcs[0].G, teamID))
	team, err := Load(context.Background(), tcs[0].G, keybase1.LoadTeamArg{
		Name:        teamName.String(),
		ForceRepoll: true,
	})
	require.NoError(t, err)

	clearText := []byte{0, 1, 2, 3, 4, 5}
	nonce := [24]byte{6, 7, 8, 9, 10}
	buf, pub := encryptWithTeamKey(t, team, clearText, nonce, keybase1.PerTeamKeyGeneration(2))

	// Try to decrypt as user 1. User 1 does not have team with gen=2
	// in cache, so `TryDecryptWithTeamKey` will have to take slower
	// repoll path.
	arg := keybase1.TryDecryptWithTeamKeyArg{
		TeamID:         teamID,
		EncryptedData:  buf,
		Nonce:          nonce,
		PeersPublicKey: (keybase1.BoxPublicKey)(pub),
	}
	ret, err := TryDecryptWithTeamKey(libkb.NewMetaContextBackground(tcs[1].G), arg)
	require.NoError(t, err)
	require.ElementsMatch(t, ret, clearText)
}
