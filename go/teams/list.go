package teams

import (
	"fmt"
	"sort"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type statusList struct {
	Teams  []keybase1.MemberInfo `json:"teams"`
	Status libkb.AppStatus       `json:"status"`
}

func (r *statusList) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func getTeamsListFromServer(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, all bool) ([]keybase1.MemberInfo, error) {
	var endpoint string
	if all {
		endpoint = "team/teammates_for_user"
	} else {
		endpoint = "team/for_user"
	}
	a := libkb.NewAPIArg(endpoint)
	if uid.Exists() {
		a.Args = libkb.HTTPArgs{
			"uid": libkb.S{Val: uid.String()},
		}
	}
	a.NetContext = ctx
	a.SessionType = libkb.APISessionTypeREQUIRED
	var list statusList
	if err := g.API.GetDecode(a, &list); err != nil {
		return nil, err
	}
	return list.Teams, nil
}

func List(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.AnnotatedTeamList, error) {
	var uid keybase1.UID
	if arg.UserAssertion != "" {
		res := g.Resolver.ResolveFullExpression(ctx, arg.UserAssertion)
		if res.GetError() != nil {
			return nil, res.GetError()
		}
		uid = res.GetUID()
	}

	meUID := g.ActiveDevice.UID()

	teams, err := getTeamsListFromServer(ctx, g, uid, arg.All)
	if err != nil {
		return nil, err
	}

	teamNames := make(map[string]bool)
	upakLoader := g.GetUPAKLoader()
	annotatedTeams := make([]keybase1.AnnotatedMemberInfo, len(teams))
	administeredTeams := make(map[string]bool)
	for idx, memberInfo := range teams {
		teamNames[memberInfo.FqName] = true
		if memberInfo.UserID == meUID && (memberInfo.Role.IsAdminOrAbove() || (memberInfo.Implicit != nil && memberInfo.Implicit.Role.IsAdminOrAbove())) {
			administeredTeams[memberInfo.FqName] = true
		}

		memberuid := memberInfo.UserID
		username, err := upakLoader.LookupUsername(context.Background(), memberuid)
		if err != nil {
			return nil, err
		}
		fullName, err := engine.GetFullName(context.Background(), g, memberuid)
		if err != nil {
			return nil, err
		}
		annotatedTeams[idx] = keybase1.AnnotatedMemberInfo{
			TeamID:   memberInfo.TeamID,
			FqName:   memberInfo.FqName,
			UserID:   memberInfo.UserID,
			Role:     memberInfo.Role,
			Implicit: memberInfo.Implicit,
			Username: username.String(),
			FullName: fullName,
		}
	}

	annotatedInvites := make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite)
	for teamName := range teamNames {
		_, ok := administeredTeams[teamName]
		if ok {
			t, err := GetForTeamManagementByStringName(ctx, g, teamName, true)
			if err != nil {
				g.Log.Warning("Error while getting team (%s): %v", teamName, err)
				continue
			}
			teamAnnotatedInvites, err := AnnotateInvites(ctx, g, t.chain().inner.ActiveInvites, teamName)
			if err != nil {
				return nil, err
			}
			for teamInviteID, annotatedTeamInvite := range teamAnnotatedInvites {
				annotatedInvites[teamInviteID] = annotatedTeamInvite
			}
		}
	}

	tl := keybase1.AnnotatedTeamList{
		Teams: annotatedTeams,
		AnnotatedActiveInvites: annotatedInvites,
	}

	return &tl, nil
}

func AnnotateInvites(ctx context.Context, g *libkb.GlobalContext, invites map[keybase1.TeamInviteID]keybase1.TeamInvite, teamName string) (map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, error) {

	annotatedInvites := make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, len(invites))
	upakLoader := g.GetUPAKLoader()
	for id, invite := range invites {
		username, err := upakLoader.LookupUsername(context.Background(), invite.Inviter.Uid)
		if err != nil {
			return annotatedInvites, err
		}

		name := invite.Name
		category, err := invite.Type.C()
		if err != nil {
			return nil, err
		}
		if category == keybase1.TeamInviteCategory_KEYBASE {
			// "keybase" invites (i.e. pukless users) have uid for name
			uid, err := keybase1.UIDFromString(string(invite.Name))
			if err != nil {
				return nil, err
			}
			normalized, err := upakLoader.LookupUsername(context.Background(), uid)
			if err != nil {
				return nil, err
			}
			name = keybase1.TeamInviteName(normalized.String())
		}
		annotatedInvites[id] = keybase1.AnnotatedTeamInvite{
			Role:            invite.Role,
			Id:              invite.Id,
			Type:            invite.Type,
			Name:            name,
			InviterUsername: username.String(),
			TeamName:        teamName,
		}
	}
	return annotatedInvites, nil
}

func TeamTree(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamTreeArg) (res keybase1.TeamTreeResult, err error) {
	if !arg.Name.IsRootTeam() {
		return res, fmt.Errorf("cannot get tree of non-root team")
	}

	serverList, err := getTeamsListFromServer(ctx, g, "", false)
	if err != nil {
		return res, err
	}

	// Map from team name (string) to entry
	entryMap := make(map[string]keybase1.TeamTreeEntry)

	// The server might have omitted some teams, oh well.
	// Trusts the server for role.
	// Load the teams by ID to make sure they are valid and get the validated names.
	for _, info := range serverList {
		serverName, err := info.TeamName()
		if err != nil {
			return res, err
		}
		if !serverName.RootAncestorName().Eq(arg.Name) {
			// Skip those not in this tree.
			continue
		}
		team, err := Load(ctx, g, keybase1.LoadTeamArg{
			ID:          info.TeamID,
			ForceRepoll: true,
		})
		if err != nil {
			return res, err
		}
		var admin bool // true if an admin or implicit admin
		if info.Role.IsAdminOrAbove() {
			admin = true
		}
		if info.Implicit != nil && info.Implicit.Role.IsAdminOrAbove() {
			admin = true
		}
		entryMap[team.Name().String()] = keybase1.TeamTreeEntry{
			Name:  team.Name(),
			Admin: admin,
		}
	}

	// Add all parent names (recursively)
	// So that if only A.B.C is in the list, we add A.B and A as well.
	// Adding map entries while iterating is safe.
	// "If map entries are created during iteration, that entry may be produced during the iteration or may be skipped."
	for _, entry := range entryMap {
		name := entry.Name.DeepCopy()
		for name.Depth() > 0 {
			_, ok := entryMap[name.String()]
			if !ok {
				entryMap[name.String()] = keybase1.TeamTreeEntry{
					Name:  name,
					Admin: false,
				}
			}
			name, err = name.Parent()
			if err != nil {
				break
			}
		}
	}

	for _, entry := range entryMap {
		res.Entries = append(res.Entries, entry)
	}

	if len(res.Entries) == 0 {
		return res, fmt.Errorf("team not found: %v", arg.Name)
	}

	// Order into a tree order. Which happens to be alphabetical ordering.
	// Example: [a, a.b, a.b.c, a.b.d, a.e.f, a.e.g]
	sort.Slice(res.Entries, func(i, j int) bool {
		return res.Entries[i].Name.String() < res.Entries[j].Name.String()
	})

	return res, nil
}
