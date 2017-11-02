package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestShowcaseTeam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name := createTeam(tc)
	t.Logf("Created team %q", name)

	isShowcased := true
	err = SetTeamShowcase(context.TODO(), tc.G, name, &isShowcased, nil)
	require.NoError(t, err)

	showcase, err := GetTeamShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.Nil(t, nil, showcase.Description)

	description := "Hello world"
	err = SetTeamShowcase(context.TODO(), tc.G, name, nil, &description)
	require.NoError(t, err)

	showcase, err = GetTeamShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.NotNil(t, showcase.Description)
	require.Equal(t, "Hello world", *showcase.Description)

	isShowcased = false
	err = SetTeamShowcase(context.TODO(), tc.G, name, &isShowcased, nil)
	require.NoError(t, err)

	showcase, err = GetTeamShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)

	require.Equal(t, false, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.NotNil(t, showcase.Description)
	require.Equal(t, "Hello world", *showcase.Description)

	tmShowcase, err := GetTeamAndMemberShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, showcase, tmShowcase.TeamShowcase)
	require.Equal(t, false, tmShowcase.IsMemberShowcased)
}

func TestShowcaseMember(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	name := createTeam(tc)
	t.Logf("Created team %q", name)

	var nilTeamShowcase = keybase1.TeamShowcase{IsShowcased: false, Description: nil, SetByUID: nil}

	tmShowcase, err := GetTeamAndMemberShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, false, tmShowcase.IsMemberShowcased)
	require.Equal(t, nilTeamShowcase, tmShowcase.TeamShowcase)

	err = SetTeamMemberShowcase(context.TODO(), tc.G, name, true)
	require.NoError(t, err)

	tmShowcase, err = GetTeamAndMemberShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, tmShowcase.IsMemberShowcased)
	require.Equal(t, nilTeamShowcase, tmShowcase.TeamShowcase)

	isShowcased := true
	description := "Hello Team!"
	err = SetTeamShowcase(context.TODO(), tc.G, name, &isShowcased, &description)
	require.NoError(t, err)

	tmShowcase, err = GetTeamAndMemberShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, tmShowcase.IsMemberShowcased)

	showcase := tmShowcase.TeamShowcase
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.NotNil(t, showcase.Description)
	require.Equal(t, "Hello Team!", *showcase.Description)
}
