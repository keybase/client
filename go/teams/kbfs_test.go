package teams

import (
	"crypto/rand"
	"encoding/hex"
	"testing"
	"time"

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

type testTimer struct {
	waits int
}

func (t *testTimer) StartupWait(m libkb.MetaContext) (err error) {
	time.Sleep(10 * time.Millisecond)
	return nil
}

func (t *testTimer) LoopWait(m libkb.MetaContext, _ error) (err error) {
	time.Sleep(10 * time.Millisecond)
	t.waits++
	return nil
}

type unpinnedTLFAPIFaker struct {
	res *unpinnedTLF
}

func (u *unpinnedTLFAPIFaker) getUnpinnedTLF(_ libkb.MetaContext) (res *unpinnedTLF, err error) {
	ret := u.res
	u.res = nil
	return ret, nil
}

func TestTLFPinLoop(t *testing.T) {

	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	t.Logf("U0 creates A")
	rootName, rootID := createTeam2(*tcs[0])
	tlfID := randomTlfID(t)

	faker := &unpinnedTLFAPIFaker{
		res: &unpinnedTLF{
			Name:   rootName.String(),
			TeamID: rootID,
			TlfID:  tlfID,
		},
	}
	exitCh := make(chan error)
	timer := &testTimer{}

	pinner := &backgroundTLFPinner{
		timer:          timer,
		getUnpinnedTLF: func(m libkb.MetaContext) (*unpinnedTLF, error) { return faker.getUnpinnedTLF(m) },
		exitCh:         exitCh,
	}

	m := libkb.NewMetaContextForTest(*tcs[0])

	go pinner.run(m)
	err := <-exitCh
	require.NoError(t, err)
	require.Equal(t, timer.waits, 1)

	team, err := Load(m.Ctx(), tcs[0].G, keybase1.LoadTeamArg{
		ID:          rootID,
		ForceRepoll: true,
	})
	require.NoError(t, err)
	require.Equal(t, team.KBFSTLFIDs(), []keybase1.TLFID{tlfID})
}

type logoutTimer struct{}

func (t *logoutTimer) StartupWait(m libkb.MetaContext) (err error) {
	m.G().Logout(context.TODO())
	return nil
}

func (t *logoutTimer) LoopWait(m libkb.MetaContext, _ error) (err error) {
	return nil
}

func TestTLFPinLoopLogout(t *testing.T) {

	_, tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	faker := &unpinnedTLFAPIFaker{}
	exitCh := make(chan error)
	timer := &logoutTimer{}

	pinner := &backgroundTLFPinner{
		timer:          timer,
		getUnpinnedTLF: func(m libkb.MetaContext) (*unpinnedTLF, error) { return faker.getUnpinnedTLF(m) },
		exitCh:         exitCh,
	}

	m := libkb.NewMetaContextForTest(*tcs[0])

	go pinner.run(m)
	err := <-exitCh
	require.Error(t, err)
	require.IsType(t, libkb.LoginRequiredError{}, err)
}
