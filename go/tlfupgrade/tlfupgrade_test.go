package tlfupgrade

import (
	"context"
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"github.com/stretchr/testify/require"
)

type testAPIServer struct {
	libkb.API
	responseFn func() getUpgradeRes
}

func (t *testAPIServer) GetDecode(arg libkb.APIArg, resp libkb.APIResponseWrapper) error {
	*(resp.(*getUpgradeRes)) = t.responseFn()
	return nil
}

type testChatHelper struct {
	libkb.ChatHelper
}

func (t *testChatHelper) UpgradeKBFSToImpteam(context.Context, string, chat1.TLFID, bool) error {
	return nil
}

func TestBackgroundTLFUpdater(t *testing.T) {
	tc := libkb.SetupTest(t, "TestBackgroundTLFUpdater", 1)
	defer tc.Cleanup()
	_, err := kbtest.CreateAndSignupFakeUser("gregr", tc.G)
	require.NoError(t, err)

	api := &testAPIServer{}
	u := NewBackgroundTLFUpdater(tc.G)
	u.testingAPIServer = api
	u.testingChatHelper = &testChatHelper{}
	upgradeCh := make(chan keybase1.TLFID, 5)
	u.upgradeCh = &upgradeCh

	refTLFID := keybase1.TLFID("hi")
	f := func() getUpgradeRes {
		return getUpgradeRes{
			GetTLFForUpgradeRes: NewGetTLFForUpgradeResWithTlfavailable(GetTLFForUpgradeAvailableRes{
				TlfID: refTLFID,
			})}
	}
	api.responseFn = f
	clock := clockwork.NewFakeClock()
	u.clock = clock
	u.Run()
	attempt := func() {
		clock.BlockUntil(1)
		clock.Advance(time.Hour)
		select {
		case tlfID := <-upgradeCh:
			require.Equal(t, refTLFID, tlfID)
		case <-time.After(20 * time.Second):
			require.Fail(t, "no upgrade")
		}
	}
	attempt()
	tc.G.AppState.Update(keybase1.AppState_BACKGROUND)
	tc.G.AppState.Update(keybase1.AppState_FOREGROUND)
	attempt()
	u.Shutdown()
}
