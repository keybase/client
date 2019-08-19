package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestShowcaseTeam(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	notifications := kbtest.NewTeamNotifyListener()
	tc.G.SetService()
	tc.G.NotifyRouter.AddListener(notifications)

	namex, teamID := createTeam2(tc)
	name := namex.String()
	t.Logf("Created team %q", name)

	isShowcased := true
	err = SetTeamShowcase(context.TODO(), tc.G, name, &isShowcased, nil, nil)
	require.NoError(t, err)
	kbtest.CheckTeamMiscNotifications(tc, notifications)

	showcase, err := GetTeamShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.Nil(t, nil, showcase.Description)

	showcase, err = GetTeamShowcaseByID(context.TODO(), tc.G, teamID)
	require.NoError(t, err)
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.Nil(t, nil, showcase.Description)

	description := "Hello world"
	err = SetTeamShowcase(context.TODO(), tc.G, name, nil, &description, nil)
	require.NoError(t, err)
	kbtest.CheckTeamMiscNotifications(tc, notifications)

	showcase, err = GetTeamShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.NotNil(t, showcase.Description)
	require.Equal(t, "Hello world", *showcase.Description)

	showcase, err = GetTeamShowcaseByID(context.TODO(), tc.G, teamID)
	require.NoError(t, err)
	require.Equal(t, true, showcase.IsShowcased)
	require.NotNil(t, showcase.SetByUID)
	require.Equal(t, user.User.GetUID(), *showcase.SetByUID)
	require.NotNil(t, showcase.Description)
	require.Equal(t, "Hello world", *showcase.Description)

	isShowcased = false
	err = SetTeamShowcase(context.TODO(), tc.G, name, &isShowcased, nil, nil)
	require.NoError(t, err)
	kbtest.CheckTeamMiscNotifications(tc, notifications)

	showcase, err = GetTeamShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)

	showcase, err = GetTeamShowcaseByID(context.TODO(), tc.G, teamID)
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

	notifications := kbtest.NewTeamNotifyListener()
	tc.G.SetService()
	tc.G.NotifyRouter.AddListener(notifications)

	name := createTeam(tc)
	t.Logf("Created team %q", name)

	var defaultTeamShowcase = keybase1.TeamShowcase{IsShowcased: false, Description: nil, SetByUID: nil, AnyMemberShowcase: true}

	tmShowcase, err := GetTeamAndMemberShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, false, tmShowcase.IsMemberShowcased)
	require.Equal(t, defaultTeamShowcase, tmShowcase.TeamShowcase)

	err = SetTeamMemberShowcase(context.TODO(), tc.G, name, true)
	require.NoError(t, err)

	tmShowcase, err = GetTeamAndMemberShowcase(context.TODO(), tc.G, name)
	require.NoError(t, err)
	require.Equal(t, true, tmShowcase.IsMemberShowcased)
	require.Equal(t, defaultTeamShowcase, tmShowcase.TeamShowcase)

	isShowcased := true
	description := "Hello Team!"
	err = SetTeamShowcase(context.TODO(), tc.G, name, &isShowcased, &description, nil)
	require.NoError(t, err)
	kbtest.CheckTeamMiscNotifications(tc, notifications)

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

func TestShowcasePermissions(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	notifications := kbtest.NewTeamNotifyListener()
	tc.G.SetService()
	tc.G.NotifyRouter.AddListener(notifications)

	_, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	namex, teamID := createTeam2(tc)
	team := namex.String()
	t.Logf("Created team %q", team)

	isShowcased := true
	description := "This team is showcased"
	anyMemberShowcase := false
	err = SetTeamShowcase(context.TODO(), tc.G, team, &isShowcased, &description, &anyMemberShowcase)
	require.NoError(t, err)
	kbtest.CheckTeamMiscNotifications(tc, notifications)

	err = SetTeamMemberShowcase(context.TODO(), tc.G, team, true)
	require.NoError(t, err)

	_, err = AddMember(context.TODO(), tc.G, team, user.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	tc.G.Logout(context.TODO())
	err = user.Login(tc.G)
	require.NoError(t, err)

	// Set- functions should check membership and not issue request
	// when user is not an admin or higher.
	isShowcased = false
	err = SetTeamShowcase(context.TODO(), tc.G, team, &isShowcased, nil, nil)
	require.Error(t, err)

	// AppStatusErrors means we bounced off server instead of being
	// stopped by API helper code.
	_, ok := err.(libkb.AppStatusError)
	require.False(t, ok)

	// But we expect to hit server error here: because server checks
	// anyMemberShowcase, not us.
	err = SetTeamMemberShowcase(context.TODO(), tc.G, team, true)
	require.Error(t, err)
	_, ok = err.(libkb.AppStatusError)
	require.True(t, ok)

	// Get- functions should still work.
	ret, err := GetTeamAndMemberShowcase(context.TODO(), tc.G, team)
	require.NoError(t, err)
	require.False(t, ret.IsMemberShowcased) // false by default
	require.NotNil(t, ret.TeamShowcase.Description)
	require.Equal(t, description, *ret.TeamShowcase.Description)
	require.True(t, ret.TeamShowcase.IsShowcased)

	ret2, err := GetTeamShowcase(context.TODO(), tc.G, team)
	require.NoError(t, err)
	require.Equal(t, ret.TeamShowcase, ret2)

	ret2, err = GetTeamShowcaseByID(context.TODO(), tc.G, teamID)
	require.NoError(t, err)
	require.Equal(t, ret.TeamShowcase, ret2)
}

func TestShowcaseAnyMember(t *testing.T) {
	tc := SetupTest(t, "team", 1)
	defer tc.Cleanup()

	user, err := kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	_, err = kbtest.CreateAndSignupFakeUser("team", tc.G)
	require.NoError(t, err)

	team := createTeam(tc)
	t.Logf("Created team %q", team)

	_, err = AddMember(context.TODO(), tc.G, team, user.Username, keybase1.TeamRole_READER, nil)
	require.NoError(t, err)

	tc.G.Logout(context.TODO())
	err = user.Login(tc.G)
	require.NoError(t, err)

	t.Logf("Logged in as %q (reader)", user.Username)

	ret, err := GetTeamAndMemberShowcase(context.TODO(), tc.G, team)
	require.NoError(t, err)
	require.False(t, ret.IsMemberShowcased) // false by default

	err = SetTeamMemberShowcase(context.TODO(), tc.G, team, true)
	require.NoError(t, err)

	ret, err = GetTeamAndMemberShowcase(context.TODO(), tc.G, team)
	require.NoError(t, err)
	require.True(t, ret.IsMemberShowcased) // membership is true and we are a reader
}
