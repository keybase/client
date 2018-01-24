package systests

import (
	"testing"

	"github.com/keybase/client/go/client"
	"github.com/stretchr/testify/require"
)

func TestResetMultipleDevices(t *testing.T) {
	// not using teams, but this seems to be most convenient
	tt := newTeamTester(t)
	defer tt.cleanup()

	// make a user with two devices
	alice1 := tt.addUser("alice")
	aliceDevice2 := alice1.provisionNewDevice()

	// setup the user client
	/*
		cli, _, err := client.GetRPCClientWithContext(aliceDevice2.tctx.G)
		require.NoError(aliceDevice2.tctx.T, err)

		aliceDevice2.userClient = keybase1.UserClient{Cli: cli}
	*/

	// logout on one device
	alice1.logout()

	// the other device resets
	cmd := client.NewCmdAccountResetRunner(aliceDevice2.tctx.G)
	err := cmd.Run()
	require.NoError(aliceDevice2.tctx.T, err)
}
