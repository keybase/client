package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestEphemeralSelfProvision(t *testing.T) {
	tc, mctx, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	g := tc.G
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, created, err := ekLib.GetOrCreateLatestTeamEK(mctx, teamID)
	require.NoError(t, err)
	require.True(t, created)

	// Publish a few deviceEKs on the cloned account and make sure the self
	// provision goes through successfully and we can continue to generate
	// deviceEKs after.
	merkleRootPtr, err := g.GetMerkleClient().FetchRootFromServer(mctx, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr
	_, err = publishNewDeviceEK(mctx, merkleRoot)
	require.NoError(t, err)
	_, err = publishNewDeviceEK(mctx, merkleRoot)
	require.NoError(t, err)
	deviceEKStorage := g.GetDeviceEKStorage()
	maxGen, err := deviceEKStorage.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.EqualValues(t, 3, maxGen)

	// Now self provision the user and make sure she can still access the teamEK
	secUI := user.NewSecretUI()
	provLoginUI := &libkb.TestLoginUI{Username: user.Username}
	uis := libkb.UIs{
		ProvisionUI: &kbtest.TestProvisionUI{},
		LogUI:       g.Log,
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
	}

	mctx = mctx.WithUIs(uis)
	libkb.CreateClonedDevice(tc, mctx)
	newName := "uncloneme"
	eng := engine.NewSelfProvisionEngine(g, newName)
	err = engine.RunEngine2(mctx, eng)
	require.NoError(t, err)
	require.Equal(t, mctx.ActiveDevice().Name(), newName)

	teamEK2, err := g.GetTeamEKBoxStorage().Get(mctx, teamID, teamEK1.Generation(), nil)
	require.NoError(t, err)
	require.Equal(t, teamEK1, teamEK2)

	// After self provisioning we should only have a single deviceEK, and have
	// no issues producing new ones.
	maxGen, err = deviceEKStorage.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGen)

	_, err = publishNewDeviceEK(mctx, merkleRoot)
	require.NoError(t, err)
	maxGen, err = deviceEKStorage.MaxGeneration(mctx, false)
	require.NoError(t, err)
	require.EqualValues(t, 2, maxGen)
}
