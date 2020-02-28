package teams

import (
	"testing"
	"time"

	"github.com/keybase/client/go/kbtest"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"

	"golang.org/x/net/context"
)

func TestAccessRequestAccept(t *testing.T) {
	tc, owner, u1, _, teamName := memberSetupMultiple(t)
	defer tc.Cleanup()

	// owner is logged in and created teamName
	err := tc.Logout()
	require.NoError(t, err)

	// u1 requests access to the team
	err = u1.Login(tc.G)
	require.NoError(t, err)
	_, err = RequestAccess(context.Background(), tc.G, teamName)
	require.NoError(t, err)

	myReqs, err := ListMyAccessRequests(context.Background(), tc.G, &teamName)
	require.NoError(t, err)
	require.Equal(t, 1, len(myReqs))
	require.Equal(t, teamName, myReqs[0].String())

	// teamName is optional, if not given, all pending requests will be returned.
	myReqs, err = ListMyAccessRequests(context.Background(), tc.G, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(myReqs))
	require.Equal(t, teamName, myReqs[0].String())

	// owner lists requests, sees u1 request
	err = tc.Logout()
	require.NoError(t, err)
	err = owner.Login(tc.G)
	require.NoError(t, err)

	reqs, err := ListRequests(context.Background(), tc.G, nil)
	require.NoError(t, err)
	require.Equal(t, 1, len(reqs))
	require.Equal(t, teamName, reqs[0].Name)
	require.Equal(t, u1.Username, reqs[0].Username)
	require.True(t, reqs[0].Ctime.Time().After(time.Now().Add(-1*time.Minute)))
	require.Equal(t, "", reqs[0].FullName.String()) // no fullname in this case

	// owner add u1 to team
	_, err = AddMember(context.Background(), tc.G, teamName, u1.Username, keybase1.TeamRole_WRITER, nil)
	require.NoError(t, err)

	// owner lists requests, sees no requests
	assertNoRequests(tc)

	// u1 requests access to the team again
	err = tc.Logout()
	require.NoError(t, err)
	err = u1.Login(tc.G)
	require.NoError(t, err)

	_, err = RequestAccess(context.Background(), tc.G, teamName)
	require.Error(t, err)
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("error %s (%T), expected libkb.AppStatusError", err, err)
	}
	if aerr.Code != libkb.SCTeamMemberExists {
		t.Errorf("status code: %d, expected %d", aerr.Code, libkb.SCTeamMemberExists)
	}
	err = tc.Logout()
	require.NoError(t, err)

	// owner lists requests, sees no requests
	err = owner.Login(tc.G)
	require.NoError(t, err)
	assertNoRequests(tc)
}

func TestAccessRequestIgnore(t *testing.T) {
	tc, owner, u1, _, teamName := memberSetupMultiple(t)
	defer tc.Cleanup()

	// owner is logged in and created teamName
	err := tc.Logout()
	require.NoError(t, err)

	// u1 requests access to the team
	err = u1.Login(tc.G)
	require.NoError(t, err)

	_, err = RequestAccess(context.Background(), tc.G, teamName)
	require.NoError(t, err)

	// Set no caching mode. If we change our full name and ask UidMapper about
	// it quickly, we might still be getting the old version because of pubsub
	// delay.
	tc.G.UIDMapper.SetTestingNoCachingMode(true)

	// Change full name
	fullName, err := libkb.RandString("test", 5)
	require.NoError(t, err)
	err = kbtest.EditProfile(tc.MetaContext(), keybase1.ProfileEditArg{
		FullName: fullName,
	})
	require.NoError(t, err)

	// owner lists requests, sees u1 request
	err = tc.Logout()
	require.NoError(t, err)
	err = owner.Login(tc.G)
	require.NoError(t, err)

	reqs, err := ListRequests(context.Background(), tc.G, nil)
	require.NoError(t, err)

	require.Len(t, reqs, 1)
	require.Equal(t, teamName, reqs[0].Name)
	require.Equal(t, u1.Username, reqs[0].Username)
	require.True(t, reqs[0].Ctime.Time().After(time.Now().Add(-1*time.Minute)), "ctime within last minute")
	require.Equal(t, fullName, reqs[0].FullName.String())

	// owner ignores u1 request
	err = IgnoreRequest(context.Background(), tc.G, reqs[0].Name, reqs[0].Username)
	require.NoError(t, err)

	// owner lists requests, sees no requests
	assertNoRequests(tc)

	// u1 requests access to the team again
	err = tc.Logout()
	require.NoError(t, err)

	err = u1.Login(tc.G)
	require.NoError(t, err)

	_, err = RequestAccess(context.Background(), tc.G, teamName)
	require.Error(t, err)
	aerr, ok := err.(libkb.AppStatusError)
	require.True(t, ok, "error is libkb.AppStatusError")
	require.Equal(t, libkb.SCTeamTarDuplicate, aerr.Code, "expected status code")

	err = tc.Logout()
	require.NoError(t, err)

	// owner lists requests, sees no requests
	err = owner.Login(tc.G)
	require.NoError(t, err)
	assertNoRequests(tc)
}

func assertNoRequests(tc libkb.TestContext) {
	reqs, err := ListRequests(context.Background(), tc.G, nil /* teamName */)
	require.NoError(tc.T, err)
	require.Len(tc.T, reqs, 0)
}
