package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"

	"github.com/stretchr/testify/require"
)

func TestSetTarsEnabled(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	_, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name := createTeam(tc)
	t.Logf("Created team %q", name)

	enabled, err := GetTarsEnabled(context.Background(), tc.G, name)
	require.NoError(t, err)
	require.True(t, enabled)

	err = SetTarsEnabled(context.Background(), tc.G, name, false)
	require.NoError(t, err)

	enabled, err = GetTarsEnabled(context.Background(), tc.G, name)
	require.NoError(t, err)
	require.False(t, enabled)
}
