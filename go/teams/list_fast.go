package teams

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// This is server trust version of TeamList functionality. It will not
// perform any team loads to verify if server does not lie about our
// membership in returned teams. It will also rely on the server to
// return member counts for each team. All of this makes this version
// much faster and less heavy on the server - even though UIDMapper is
// used in the untrusting functions, a lot of calls were made anyway
// during team loads (e.g. merkle paths).

// See also: teams/list.go

func ListTeamsUnverified(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListUnverifiedArg) (*keybase1.AnnotatedTeamList, error) {
	tracer := g.CTimeTracer(ctx, "TeamList.ListTeamsUnverified", true)
	defer tracer.Finish()

	tracer.Stage("Resolve QueryUID")
	var queryUID keybase1.UID
	if arg.UserAssertion != "" {
		res := g.Resolver.ResolveFullExpression(ctx, arg.UserAssertion)
		if res.GetError() != nil {
			return nil, res.GetError()
		}
		queryUID = res.GetUID()
	}

	meUID := g.ActiveDevice.UID()
	if meUID.IsNil() {
		return nil, libkb.LoginRequiredError{}
	}

	tracer.Stage("Server")
	teams, err := getTeamsListFromServer(ctx, g, queryUID, false /* all */, true /* countMembers */)
	if err != nil {
		return nil, err
	}

	if arg.UserAssertion == "" {
		queryUID = meUID
	}

	tracer.Stage("LookupQueryUsername")
	queryUsername, queryFullName, err := getUsernameAndFullName(context.Background(), g, queryUID)
	if err != nil {
		return nil, err
	}

	res := &keybase1.AnnotatedTeamList{
		Teams: nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	if len(teams) == 0 {
		return res, nil
	}

	for _, memberInfo := range teams {
		if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
			g.Log.CDebugf(ctx, "| ListTeamsUnverified skipping implicit team: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)
			continue
		}

		anMemberInfo := keybase1.AnnotatedMemberInfo{
			TeamID:         memberInfo.TeamID,
			FqName:         memberInfo.FqName,
			UserID:         memberInfo.UserID,
			Role:           memberInfo.Role,
			IsImplicitTeam: memberInfo.IsImplicitTeam,
			IsOpenTeam:     memberInfo.IsOpenTeam,
			Implicit:       memberInfo.Implicit,
			Username:       queryUsername.String(),
			FullName:       queryFullName,
			MemberCount:    memberInfo.MemberCount,
			Active:         true,
		}

		res.Teams = append(res.Teams, anMemberInfo)
	}

	return res, nil
}
