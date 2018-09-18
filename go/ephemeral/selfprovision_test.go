package ephemeral

import (
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/stretchr/testify/require"
)

func TestEphemeralSelfProvision(t *testing.T) {
	tc, user := ephemeralKeyTestSetup(t)
	defer tc.Cleanup()

	g := tc.G
	m := libkb.NewMetaContextForTest(tc)
	ctx := m.Ctx()
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, err := ekLib.GetOrCreateLatestTeamEK(ctx, teamID)
	require.NoError(t, err)

	// Publish a few deviceEKs on the cloned account and make sure the self
	// provision goes through successfully and we can continue to generate
	// deviceEKs after.
	merkleRootPtr, err := g.GetMerkleClient().FetchRootFromServer(m, libkb.EphemeralKeyMerkleFreshness)
	require.NoError(t, err)
	merkleRoot := *merkleRootPtr
	_, err = publishNewDeviceEK(ctx, g, merkleRoot)
	require.NoError(t, err)
	_, err = publishNewDeviceEK(ctx, g, merkleRoot)
	require.NoError(t, err)
	deviceEKStorage := g.GetDeviceEKStorage()
	maxGen, err := deviceEKStorage.MaxGeneration(ctx)
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

	m = m.WithUIs(uis)
	libkb.CreateClonedDevice(tc, m)
	newName := "uncloneme"
	eng := engine.NewSelfProvisionEngine(g, newName)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)
	require.Equal(t, m.ActiveDevice().Name(), newName)

	teamEK2, err := g.GetTeamEKBoxStorage().Get(ctx, teamID, teamEK1.Metadata.Generation)
	require.NoError(t, err)
	require.Equal(t, teamEK1, teamEK2)

	// After self provisioning we should only have a single deviceEK, and have
	// no issues producing new ones.
	maxGen, err = deviceEKStorage.MaxGeneration(ctx)
	require.NoError(t, err)
	require.EqualValues(t, 1, maxGen)

	_, err = publishNewDeviceEK(ctx, g, merkleRoot)
	require.NoError(t, err)
	maxGen, err = deviceEKStorage.MaxGeneration(ctx)
	require.NoError(t, err)
	require.EqualValues(t, 2, maxGen)
}
