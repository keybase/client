package teams

import (
	"fmt"
	"sort"
	"strings"

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

	m := libkb.NewMetaContext(ctx, g)

	tracer.Stage("Resolve QueryUID")
	var queryUID keybase1.UID
	if arg.UserAssertion != "" {
		res := g.Resolver.ResolveFullExpression(m, arg.UserAssertion)
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

	// We have a very simple cache in case we error out on this call. In the
	// case of a network error we try to serve old cached data if we have some.
	// The cache is updated on successful requests but otherwise unmaintained
	// so should only be used if we are trying to return a best-effort result.
	cacheKey := listTeamsUnverifiedCacheKey(meUID, queryUID, arg.IncludeImplicitTeams)
	teams, err := getTeamsListFromServer(ctx, g, queryUID,
		false /* all */, true /* countMembers */, arg.IncludeImplicitTeams, keybase1.NilTeamID())
	switch err.(type) {
	case nil:
		if err = g.GetKVStore().PutObj(cacheKey, nil, teams); err != nil {
			m.Debug("| ListTeamsUnverified unable to put cache item: %v", err)
		}
	case libkb.APINetError:
		if found, cerr := g.GetKVStore().GetInto(&teams, cacheKey); cerr != nil || !found {
			// Nothing we can do here.
			m.Debug("| ListTeamsUnverified unable to get cache item: %v, found: %v", cerr, found)
			return nil, err
		}
	default:
		return nil, err
	}

	res := &keybase1.AnnotatedTeamList{
		Teams:                  nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	if len(teams) == 0 {
		return res, nil
	}

	if arg.UserAssertion == "" {
		queryUID = meUID
	}

	tracer.Stage("LookupQueryUsername")
	queryUsername, queryFullName, err := getUsernameAndFullName(context.Background(), g, queryUID)
	if err != nil {
		return nil, err
	}

	for _, memberInfo := range teams {
		if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
			m.Debug("| ListTeamsUnverified skipping implicit team: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)
			continue
		}

		anMemberInfo := keybase1.AnnotatedMemberInfo{
			TeamID:              memberInfo.TeamID,
			FqName:              memberInfo.FqName,
			UserID:              memberInfo.UserID,
			Role:                memberInfo.Role,
			IsImplicitTeam:      memberInfo.IsImplicitTeam,
			IsOpenTeam:          memberInfo.IsOpenTeam,
			Implicit:            memberInfo.Implicit,
			Username:            queryUsername.String(),
			FullName:            queryFullName,
			MemberCount:         memberInfo.MemberCount,
			Status:              keybase1.TeamMemberStatus_ACTIVE,
			AllowProfilePromote: memberInfo.AllowProfilePromote,
			IsMemberShowcased:   memberInfo.IsMemberShowcased,
		}

		res.Teams = append(res.Teams, anMemberInfo)
	}

	return res, nil
}

func listTeamsUnverifiedCacheKey(meUID, queryUID keybase1.UID, includeImplicitTeams bool) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBTeamList,
		Key: fmt.Sprintf("%v-%v-%v", meUID, queryUID, includeImplicitTeams),
	}
}

func ListSubteamsUnverified(mctx libkb.MetaContext, name keybase1.TeamName) (res keybase1.SubteamListResult, err error) {
	tracer := mctx.G().CTimeTracer(mctx.Ctx(), "TeamList.ListSubteamsUnverified", true)
	defer tracer.Finish()

	meUID := mctx.G().ActiveDevice.UID()
	if meUID.IsNil() {
		return res, libkb.LoginRequiredError{}
	}

	emptyUID := keybase1.UID("")
	teams, err := getTeamsListFromServer(mctx.Ctx(), mctx.G(), emptyUID,
		false /* all */, true /* countMembers */, false /* includeImplicitTeams */, name.RootID())
	if err != nil {
		return res, libkb.LoginRequiredError{}
	}

	var entries []keybase1.SubteamListEntry
	for _, potentialSubteam := range teams {
		if isSubteamByName(name, potentialSubteam.FqName) {
			subteamName, err := keybase1.TeamNameFromString(potentialSubteam.FqName)
			if err != nil {
				return res, err
			}
			entries = append(entries, keybase1.SubteamListEntry{Name: subteamName, MemberCount: potentialSubteam.MemberCount})
		}
	}

	// Order alphabetically: e.g. [a, a.b, a.b.c, a.b.d, a.e.f, a.e.g]
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name.String() < entries[j].Name.String()
	})

	res.Entries = entries
	return res, nil
}

func isSubteamByName(teamName keybase1.TeamName, potentialSubteamName string) bool {
	// e.g. strings.HasPrefix("keybase.private", "keybase.") => true
	return strings.HasPrefix(potentialSubteamName, teamName.String()+".")
}
