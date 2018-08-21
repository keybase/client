package ephemeral

import (
	"context"
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
	teamID := createTeam(tc)

	ekLib := g.GetEKLib()
	teamEK1, err := ekLib.GetOrCreateLatestTeamEK(context.Background(), teamID)
	require.NoError(t, err)

	// Now self provision the user and make sure she can still access the teamEK
	secUI := user.NewSecretUI()
	provLoginUI := &libkb.TestLoginUI{Username: user.Username}
	uis := libkb.UIs{
		ProvisionUI: &kbtest.TestProvisionUI{},
		LogUI:       g.Log,
		SecretUI:    secUI,
		LoginUI:     provLoginUI,
	}

	m := libkb.NewMetaContextForTest(tc).WithUIs(uis)
	libkb.CreateClonedDevice(tc, m)
	newName := "uncloneme"
	eng := engine.NewSelfProvisionEngine(g, newName)
	err = engine.RunEngine2(m, eng)
	require.NoError(t, err)

	teamEK2, err := g.GetTeamEKBoxStorage().Get(context.Background(), teamID, teamEK1.Metadata.Generation)
	require.NoError(t, err)
	require.Equal(t, teamEK1, teamEK2)
}
