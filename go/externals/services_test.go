package externals

import (
	"fmt"
	"testing"

	libkb "github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestLoadParamServices(t *testing.T) {
	tc := setupTest(t, "TestLoadParamServices", 1)
	defer tc.Cleanup()

	m := libkb.NewMetaContextForTest(tc)

	proofServices := newProofServices(tc.G)
	entry, err := tc.G.GetParamProofStore().GetLatestEntry(m)
	require.NoError(t, err)

	proofConfigs, displayConfigs, err := proofServices.parseServiceConfigs(entry)
	require.NoError(t, err)
	require.NotNil(t, proofConfigs)
	require.NotNil(t, displayConfigs)
	require.NotZero(t, len(proofConfigs))
	require.NotZero(t, len(displayConfigs))

	// assert that we parse the dev gubble configuration correctly
	var gubbleConf *GenericSocialProofConfig
	for _, config := range proofConfigs {
		if config.Domain == "gubble.social" {
			gubbleConf = config
			break
		}
	}
	t.Logf("Found config %+v", gubbleConf)
	require.NotNil(t, gubbleConf)
	require.True(t, gubbleConf.Version >= 1)
	require.Equal(t, "gubble.social", gubbleConf.Domain)
	require.Equal(t, keybase1.ParamProofUsernameConfig{
		Re:  "^([a-zA-Z0-9_])+$",
		Min: 2,
		Max: 20,
	}, gubbleConf.UsernameConfig)
	require.NotZero(t, len(gubbleConf.BrandColor))
	require.NotNil(t, gubbleConf.Logo)
	require.NotZero(t, len(gubbleConf.Logo.Url))
	require.NotZero(t, len(gubbleConf.Logo.FaIcon))
	require.NotZero(t, len(gubbleConf.DisplayName))
	require.NotZero(t, len(gubbleConf.Description))

	serverURI := tc.G.Env.GetServerURI()
	gubbleRoot := fmt.Sprintf("%s/_/gubble_universe/gubble_social", serverURI)
	gubbleAPIRoot := fmt.Sprintf("%s/_/api/1.0/gubble_universe/gubble_social", serverURI)
	require.Equal(t, fmt.Sprintf("%s%s", gubbleRoot, "/%{username}"), gubbleConf.ProfileUrl)
	require.Equal(t, fmt.Sprintf("%s%s", gubbleRoot, "?kb_username=%{kb_username}&sig_hash=%{sig_hash}"), gubbleConf.PrefillUrl)
	require.Equal(t, fmt.Sprintf("%s%s", gubbleAPIRoot, "/%{username}/proofs.json"), gubbleConf.CheckUrl)

	require.Equal(t, []keybase1.SelectorEntry{
		keybase1.SelectorEntry{
			IsKey: true,
			Key:   "res",
		},
		keybase1.SelectorEntry{
			IsKey: true,
			Key:   "keybase_proofs",
		},
	}, gubbleConf.CheckPath)

	found := false
	for _, config := range displayConfigs {
		if config.Key == "gubble.social" {
			group := "gubble"
			require.EqualValues(t, &group, config.Group)
			found = true
			break
		}
	}
	require.True(t, found)
}
