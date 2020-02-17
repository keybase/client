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
	if err := u1.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if _, err := RequestAccess(context.Background(), tc.G, teamName); err != nil {
		t.Fatal(err)
	}
	fullName, err := libkb.RandString("test", 5)
	if err != nil {
		t.Fatal(err)
	}
	if err := kbtest.EditProfile(u1.User.MetaContext(context.Background()), keybase1.ProfileEditArg{
		FullName: fullName,
	}); err != nil {
		t.Fatal(err)
	}
	require.NoError(t, tc.G.UIDMapper.ClearUIDFullName(context.Background(), tc.G, u1.User.GetUID()))

	// owner lists requests, sees u1 request
	err = tc.Logout()
	require.NoError(t, err)
	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	reqs, err := ListRequests(context.Background(), tc.G, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(reqs) != 1 {
		t.Fatalf("num requests: %d, expected 1", len(reqs))
	}
	if reqs[0].Name != teamName {
		t.Errorf("request team name: %q, expected %q", reqs[0].Name, teamName)
	}
	if reqs[0].Username != u1.Username {
		t.Errorf("request username: %q, expected %q", reqs[0].Username, u1.Username)
	}
	if !reqs[0].Ctime.Time().After(time.Now().Add(-1 * time.Minute)) {
		t.Errorf("request ctime %q, expected during last minute", reqs[0].Ctime)
	}
	if reqs[0].FullName.String() != fullName {
		t.Errorf("request full name %q, expected %q", reqs[0].FullName, fullName)
	}

	// owner ignores u1 request
	if err := IgnoreRequest(context.Background(), tc.G, reqs[0].Name, reqs[0].Username); err != nil {
		t.Fatal(err)
	}

	// owner lists requests, sees no requests
	assertNoRequests(tc)

	// u1 requests access to the team again
	err = tc.Logout()
	require.NoError(t, err)
	if err := u1.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	_, err = RequestAccess(context.Background(), tc.G, teamName)
	if err == nil {
		t.Fatal("second RequestAccess success, expected error")
	}
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("error %s (%T), expected libkb.AppStatusError", err, err)
	}
	if aerr.Code != libkb.SCTeamTarDuplicate {
		t.Errorf("status code: %d, expected %d", aerr.Code, libkb.SCTeamTarDuplicate)
	}
	err = tc.Logout()
	require.NoError(t, err)

	// owner lists requests, sees no requests
	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	assertNoRequests(tc)
}

func assertNoRequests(tc libkb.TestContext) {
	reqs, err := ListRequests(context.Background(), tc.G, nil)
	if err != nil {
		tc.T.Fatal(err)
	}
	if len(reqs) != 0 {
		tc.T.Fatalf("num requests: %d, expected 0", len(reqs))
	}
}
