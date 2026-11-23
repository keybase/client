package systests

import (
	"testing"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

type teamChangedRecorder struct {
	libkb.NoopNotifyListener
	ch chan keybase1.TeamChangedArg
}

func (r *teamChangedRecorder) TeamChanged(teamID keybase1.TeamID, kinds keybase1.TeamChangedKinds,
	roleMapVersion keybase1.UserTeamVersion,
) {
	select {
	case r.ch <- keybase1.TeamChangedArg{TeamID: teamID, Kinds: kinds, RoleMapVersion: roleMapVersion}:
	default:
	}
}

// waitForAll waits until every condition has matched some teamChanged, in any
// order.
func (r *teamChangedRecorder) waitForAll(t *testing.T, conds map[string]func(keybase1.TeamChangedArg) bool) {
	timeout := time.After(20 * time.Second)
	for len(conds) > 0 {
		select {
		case arg := <-r.ch:
			for what, cond := range conds {
				if cond(arg) {
					delete(conds, what)
				}
			}
		case <-timeout:
			for what := range conds {
				require.Fail(t, "no teamChanged for "+what)
			}
			return
		}
	}
}

func TestTeamChangedKinds(t *testing.T) {
	tt := newTeamTester(t)
	defer tt.cleanup()

	ann := tt.addUser("ann")
	bob := tt.addUser("bob")
	teamID, teamName := ann.createTeam2()

	bobRec := &teamChangedRecorder{ch: make(chan keybase1.TeamChangedArg, 100)}
	bob.tc.G.NotifyRouter.AddListener(bobRec)
	// a loaded role map, so the next one has something to compare against
	_, err := bob.tc.G.GetTeamRoleMapManager().Get(bob.MetaContext(), false)
	require.NoError(t, err)

	ann.addTeamMember(teamName.String(), bob.username, keybase1.TeamRole_ADMIN)
	bobRec.waitForAll(t, map[string]func(keybase1.TeamChangedArg) bool{
		"membership after add": func(a keybase1.TeamChangedArg) bool {
			return a.TeamID.Eq(teamID) && a.Kinds.Membership
		},
		"role map after add": func(a keybase1.TeamChangedArg) bool {
			return a.TeamID == "" && a.Kinds == keybase1.TeamChangedKinds{RoleMap: true} && a.RoleMapVersion > 0
		},
		"roles after add": func(a keybase1.TeamChangedArg) bool {
			return a.TeamID.Eq(teamID) && a.Kinds == keybase1.TeamChangedKinds{Roles: true}
		},
	})

	ann.removeTeamMember(teamName.String(), bob.username)
	bobRec.waitForAll(t, map[string]func(keybase1.TeamChangedArg) bool{
		"exit after removal": func(a keybase1.TeamChangedArg) bool {
			return a.TeamID.Eq(teamID) && a.Kinds == keybase1.TeamChangedKinds{Exited: true}
		},
	})
}
