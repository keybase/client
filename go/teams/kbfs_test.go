package teams

import (
	"crypto/rand"
	"encoding/hex"
	"testing"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func makeCryptKey(t *testing.T, gen int) keybase1.CryptKey {
	var key [libkb.NaclDHKeysize]byte
	_, err := rand.Read(key[:])
	require.NoError(t, err)
	return keybase1.CryptKey{
		KeyGeneration: gen,
		Key:           key,
	}
}

func makeTLFID(t *testing.T) keybase1.TLFID {
	b, err := libkb.RandBytesWithSuffix(16, 0x16)
	require.NoError(t, err)
	return keybase1.TLFID(hex.EncodeToString(b))
}

func TestKBFSUpgradeTeam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	ctx := context.TODO()
	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	team, _, _, err := LookupOrCreateImplicitTeam(ctx, tc.G, user.Username, false)
	require.NoError(t, err)
	tlfID := makeTLFID(t)
	t.Logf("TLFID: %s", tlfID)
	require.NoError(t, team.AssociateWithTLFID(ctx, tlfID))
	team, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
		ID:          team.ID,
		ForceRepoll: true,
	})
	require.NoError(t, err)

	checkCryptKeys := func(tlfID keybase1.TLFID, cryptKeys []keybase1.CryptKey,
		appType keybase1.TeamApplication) {
		team, err = Load(context.TODO(), tc.G, keybase1.LoadTeamArg{
			ID:          team.ID,
			ForceRepoll: true,
		})
		require.NoError(t, err)
		resKeys := team.KBFSCryptKeys(ctx, appType)
		require.Len(t, resKeys, len(cryptKeys))
		require.Equal(t, cryptKeys, resKeys)
		require.Equal(t, tlfID, team.LatestKBFSTLFID())
	}

	chatCryptKeys := []keybase1.CryptKey{
		makeCryptKey(t, 1),
		makeCryptKey(t, 2),
		makeCryptKey(t, 3),
	}
	require.NoError(t, team.AssociateWithTLFKeyset(ctx, tlfID, chatCryptKeys, keybase1.TeamApplication_CHAT))
	checkCryptKeys(tlfID, chatCryptKeys, keybase1.TeamApplication_CHAT)

	kbfsCryptKeys := append(chatCryptKeys, makeCryptKey(t, 4))
	require.NoError(t, team.AssociateWithTLFKeyset(ctx, tlfID, kbfsCryptKeys, keybase1.TeamApplication_KBFS))
	checkCryptKeys(tlfID, kbfsCryptKeys, keybase1.TeamApplication_KBFS)
}
