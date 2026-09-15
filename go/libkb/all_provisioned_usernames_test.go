package libkb

import (
	"testing"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type fatalAPI struct {
	NullMockAPI
	t *testing.T
}

func (f *fatalAPI) Get(MetaContext, APIArg) (*APIRes, error) {
	f.t.Fatal("unexpected API Get")
	return nil, nil
}

func (f *fatalAPI) PostDecode(MetaContext, APIArg, APIResponseWrapper) error {
	f.t.Fatal("unexpected API PostDecode")
	return nil
}

func TestGetAllProvisionedUsernamesDoesNotWaitOnServer(t *testing.T) {
	tc := SetupTest(t, "gapu", 1)
	defer tc.Cleanup()

	tc.G.API = &fatalAPI{t: t}

	testuser := NewNormalizedUsername("testuser")
	testuserMac := NewNormalizedUsername("testuser-mac")
	device1, err := NewDeviceID()
	require.NoError(t, err)
	device2, err := NewDeviceID()
	require.NoError(t, err)
	require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
		NewUserConfig(keybase1.MakeTestUID(1), testuser, []byte("salt"), device1), true))
	require.NoError(t, tc.G.Env.GetConfigWriter().SetUserConfig(
		NewUserConfig(keybase1.MakeTestUID(2), testuserMac, []byte("salt"), device2), true))
	require.NoError(t, tc.G.Env.GetConfigWriter().SwitchUser(testuser))

	current, all, err := GetAllProvisionedUsernames(NewMetaContextForTest(tc))
	require.NoError(t, err)
	require.Equal(t, testuser, current)
	require.ElementsMatch(t, []NormalizedUsername{testuser, testuserMac}, all)
}
