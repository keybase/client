package teams

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"

	"golang.org/x/net/context"
)

func TestAccessRequestAccept(t *testing.T) {
	tc, owner, u1, _, teamName := memberSetupMultiple(t)
	defer tc.Cleanup()

	// owner is logged in and created teamName
	tc.G.Logout()

	// u1 requests access to the team
	if err := u1.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := RequestAccess(context.Background(), tc.G, teamName); err != nil {
		t.Fatal(err)
	}

	// owner lists requests, sees u1 request
	tc.G.Logout()
	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	reqs, err := ListRequests(context.Background(), tc.G)
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

	// owner add u1 to team
	if _, err := AddMember(context.Background(), tc.G, teamName, u1.Username, keybase1.TeamRole_WRITER); err != nil {
		t.Fatal(err)
	}

	// owner lists requests, sees no requests
	assertNoRequests(tc)

	// u1 requests access to the team again
	tc.G.Logout()
	if err := u1.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	err = RequestAccess(context.Background(), tc.G, teamName)
	if err == nil {
		t.Fatal("second RequestAccess success, expected error")
	}
	aerr, ok := err.(libkb.AppStatusError)
	if !ok {
		t.Fatalf("error %s (%T), expected libkb.AppStatusError", err, err)
	}
	if aerr.Code != libkb.SCTeamMemberExists {
		t.Errorf("status code: %d, expected %d", aerr.Code, libkb.SCTeamMemberExists)
	}
	tc.G.Logout()

	// owner lists requests, sees no requests
	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	assertNoRequests(tc)
}

func TestAccessRequestIgnore(t *testing.T) {
	tc, owner, u1, _, teamName := memberSetupMultiple(t)
	defer tc.Cleanup()

	// owner is logged in and created teamName
	tc.G.Logout()

	// u1 requests access to the team
	if err := u1.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	if err := RequestAccess(context.Background(), tc.G, teamName); err != nil {
		t.Fatal(err)
	}

	// owner lists requests, sees u1 request
	tc.G.Logout()
	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	reqs, err := ListRequests(context.Background(), tc.G)
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

	// owner ignores u1 request
	if err := IgnoreRequest(context.Background(), tc.G, reqs[0].Name, reqs[0].Username); err != nil {
		t.Fatal(err)
	}

	// owner lists requests, sees no requests
	assertNoRequests(tc)

	// u1 requests access to the team again
	tc.G.Logout()
	if err := u1.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	err = RequestAccess(context.Background(), tc.G, teamName)
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
	tc.G.Logout()

	// owner lists requests, sees no requests
	if err := owner.Login(tc.G); err != nil {
		t.Fatal(err)
	}
	assertNoRequests(tc)
}

func assertNoRequests(tc libkb.TestContext) {
	reqs, err := ListRequests(context.Background(), tc.G)
	if err != nil {
		tc.T.Fatal(err)
	}
	if len(reqs) != 0 {
		tc.T.Fatalf("num requests: %d, expected 0", len(reqs))
	}
}
