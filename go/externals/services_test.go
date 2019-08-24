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

	config, err := proofServices.parseServerConfig(m, entry)
	require.NoError(t, err)
	require.NotNil(t, config.ProofConfigs)
	require.NotNil(t, config.DisplayConfigs)
	require.NotZero(t, len(config.ProofConfigs))
	require.NotZero(t, len(config.DisplayConfigs))

	// assert that we parse the dev gubble configuration correctly
	var gubbleConf *GenericSocialProofConfig
	for _, config := range config.ProofConfigs {
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
	require.NotZero(t, len(gubbleConf.DisplayName))
	require.NotZero(t, len(gubbleConf.Description))

	serverURI, err := tc.G.Env.GetServerURI()
	require.NoError(t, err)

	gubbleRoot := fmt.Sprintf("%s/_/gubble_universe/gubble_social", serverURI)
	gubbleAPIRoot := fmt.Sprintf("%s/_/api/1.0/gubble_universe/gubble_social", serverURI)
	require.Equal(t, fmt.Sprintf("%s%s", gubbleRoot, "/%{username}"), gubbleConf.ProfileUrl)
	require.Equal(t, fmt.Sprintf("%s%s", gubbleRoot, "?kb_username=%{kb_username}&username=%{username}&sig_hash=%{sig_hash}&kb_ua=%{kb_ua}"), gubbleConf.PrefillUrl)
	require.Equal(t, fmt.Sprintf("%s%s", gubbleAPIRoot, "/%{username}/proofs.json"), gubbleConf.CheckUrl)

	require.Equal(t, []keybase1.SelectorEntry{
		{
			IsKey: true,
			Key:   "res",
		},
		{
			IsKey: true,
			Key:   "keybase_proofs",
		},
	}, gubbleConf.CheckPath)

	require.Equal(t, []keybase1.SelectorEntry{
		{
			IsKey: true,
			Key:   "res",
		},
		{
			IsKey: true,
			Key:   "avatar",
		},
	}, gubbleConf.AvatarPath)

	foundGubble := false
	foundFacebook := false
	for _, config := range config.DisplayConfigs {
		if config.Key == "gubble.social" {
			group := "Gubble instance"
			require.NotNil(t, config.Group)
			require.EqualValues(t, group, *config.Group)
			require.False(t, config.CreationDisabled)
			foundGubble = true
			if foundFacebook {
				break
			}
		}
		if config.Key == "facebook" {
			require.True(t, config.CreationDisabled)
			foundFacebook = true
			if foundGubble {
				break
			}
		}
	}
	require.True(t, foundGubble && foundFacebook)
}
