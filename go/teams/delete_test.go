package teams

import (
	"testing"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
)

func TestDeleteRoot(t *testing.T) {
	tc, u, teamname := memberSetup(t)

	assertRole(tc, teamname, u.Username, keybase1.TeamRole_OWNER)

	if err := Delete(context.Background(), tc.G, teamname); err != nil {
		t.Fatal(err)
	}

	_, err := GetForTeamManagementByStringName(context.Background(), tc.G, teamname, false)
	if err == nil {
		t.Fatal("no error getting deleted team")
	}

}
