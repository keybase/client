package teams

import (
	"context"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestRotateHiddenSelf(t *testing.T) {
	tc, owner, other, _, name := memberSetupMultiple(t)
	defer tc.Cleanup()

	err := SetRoleWriter(context.TODO(), tc.G, name, other.Username)
	require.NoError(t, err)
	team, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(1), team.Generation())

	secretBefore := team.Data.PerTeamKeySeedsUnverified[team.Generation()].Seed.ToBytes()
	keys1, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, len(keys1), 1)
	require.Equal(t, keys1[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))

	err = team.Rotate(context.TODO())
	require.NoError(t, err)
	after, err := GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, keybase1.PerTeamKeyGeneration(2), after.Generation())
	secretAfter := after.Data.PerTeamKeySeedsUnverified[after.Generation()].Seed.ToBytes()
	require.False(t, libkb.SecureByteArrayEq(secretAfter, secretBefore))
	assertRole(tc, name, owner.Username, keybase1.TeamRole_OWNER)
	assertRole(tc, name, other.Username, keybase1.TeamRole_WRITER)

	keys2, err := after.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, len(keys2), 2)
	require.Equal(t, keys2[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.Equal(t, keys1[0].Key, keys2[0].Key)

	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	err = team.RotateHidden(context.TODO())
	require.NoError(t, err)
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	err = team.Rotate(context.TODO())
	require.NoError(t, err)
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	err = team.RotateHidden(context.TODO())
	require.NoError(t, err)
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)
	err = team.Rotate(context.TODO())
	require.NoError(t, err)
	team, err = GetForTestByStringName(context.TODO(), tc.G, name)
	require.NoError(t, err)

	keys3, err := team.AllApplicationKeys(context.TODO(), keybase1.TeamApplication_CHAT)
	require.NoError(t, err)
	require.Equal(t, len(keys3), 6)
	require.Equal(t, keys3[0].KeyGeneration, keybase1.PerTeamKeyGeneration(1))
	require.Equal(t, keys1[0].Key, keys3[0].Key)
	require.Equal(t, keys2[1].Key, keys3[1].Key)
}
