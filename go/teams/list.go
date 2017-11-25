package teams

import (
	"fmt"
	"sort"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/uidmap"
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

func memberNeedAdmin(member keybase1.MemberInfo, meUID keybase1.UID) bool {
	return member.UserID == meUID &&
		(member.Role.IsAdminOrAbove() || (member.Implicit != nil && member.Implicit.Role.IsAdminOrAbove()))
}

// verifyMemberRoleInTeam checks if role give in MemberInfo matches
// what team chain says. Nothing is checked when MemberInfo's role is
// NONE, in this context it means that user has implied membership in
// the team and no role given in sigchain.
func verifyMemberRoleInTeam(ctx context.Context, userID keybase1.UID, expectedRole keybase1.TeamRole, team *Team) (res keybase1.UserVersion, err error) {
	if expectedRole == keybase1.TeamRole_NONE {
		return res, nil
	}

	memberUV, err := team.chain().GetLatestUVWithUID(userID)
	if err != nil {
		return res, err
	}
	role, err := team.chain().GetUserRole(memberUV)
	if err != nil {
		return res, err
	}
	if role != expectedRole {
		return res, fmt.Errorf("unexpected member role: expected %v but actual role is %v", expectedRole, role)
	}
	return memberUV, nil
}

// getTeamForMember tries to load team in a recent enough state to
// contain member with correct role as set in MemberInfo. It might
// trigger a reload with ForceRepoll if cached state does not match.
func getTeamForMember(ctx context.Context, g *libkb.GlobalContext, member keybase1.MemberInfo, needAdmin bool) (team *Team, uv keybase1.UserVersion, err error) {
	team, err = Load(ctx, g, keybase1.LoadTeamArg{
		ID:          member.TeamID,
		NeedAdmin:   needAdmin,
		Public:      member.TeamID.IsPublic(),
		ForceRepoll: false,
	})
	if err != nil {
		return nil, uv, err
	}

	memberUV, err := verifyMemberRoleInTeam(ctx, member.UserID, member.Role, team)
	if err != nil {
		team, err = Load(ctx, g, keybase1.LoadTeamArg{
			ID:          member.TeamID,
			NeedAdmin:   needAdmin,
			Public:      member.TeamID.IsPublic(),
			ForceRepoll: true,
		})
		if err != nil {
			return nil, uv, err
		}

		memberUV, err = verifyMemberRoleInTeam(ctx, member.UserID, member.Role, team)
		if err != nil {
			return nil, uv, fmt.Errorf("server was wrong about role in team : %v", err)
		}
	}

	return team, memberUV, nil
}

func getUsernameAndFullName(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (username libkb.NormalizedUsername, fullName string, err error) {
	username, err = g.GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", "", err
	}
	fullName, err = engine.GetFullName(ctx, g, uid)
	if err != nil {
		return "", "", err
	}

	return username, fullName, err
}

type pendingTeamMember struct {
	team keybase1.TeamID
	uv   keybase1.UserVersion
}

func ListTeams(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.AnnotatedTeamList, error) {
	tracer := g.CTimeTracer(ctx, "TeamList.ListTeams")
	defer tracer.Finish()

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
	teams, err := getTeamsListFromServer(ctx, g, queryUID, false)
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

	var membersForTeams []pendingTeamMember
	teamPositionInList := make(map[keybase1.TeamID]int)

	res := &keybase1.AnnotatedTeamList{
		Teams: nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	if len(teams) == 0 {
		return res, nil
	}

	tracer.Stage("Loads")

	expectEmptyList := true

	for _, memberInfo := range teams {
		serverSaysNeedAdmin := memberNeedAdmin(memberInfo, meUID)
		team, _, err := getTeamForMember(ctx, g, memberInfo, serverSaysNeedAdmin)
		if err != nil {
			g.Log.CDebugf(ctx, "| Error in getTeamForMember ID:%s UID:%s: %v; skipping team", memberInfo.TeamID, memberInfo.UserID, err)
			expectEmptyList = false // so we tell user about errors at the end.
			continue
		}

		if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
			g.Log.CDebugf(ctx, "| TeamList skipping implicit team: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)
			continue
		}

		expectEmptyList = false

		if memberInfo.UserID != queryUID {
			g.Log.CDebugf(ctx, "| Expected memberInfo for UID:%s, got UID:%s", queryUID, memberInfo.UserID)
			continue
		}

		anMemberInfo := &keybase1.AnnotatedMemberInfo{
			TeamID:         team.ID,
			FqName:         team.Name().String(),
			UserID:         memberInfo.UserID,
			Role:           memberInfo.Role, // memberInfo.Role has been verified during getTeamForMember
			IsImplicitTeam: team.IsImplicit(),
			Implicit:       memberInfo.Implicit, // This part is still server trust
			Username:       queryUsername.String(),
			FullName:       queryFullName,
			MemberCount:    0,
			Active:         true,
		}

		members, err := team.Members()
		if err != nil {
			g.Log.CDebugf(ctx, "| Failed to get Members() for team %q: %v", team.ID, err)
			continue
		}

		// See "TODO" after this for-loop.
		/*
			for _, uv := range members.AllUserVersions() {
				membersForTeams = append(membersForTeams, pendingTeamMember{
					team: team.ID,
					uv:   uv,
				})
			}
		*/

		anMemberInfo.MemberCount = len(members.AllUIDs())

		invites := team.chain().inner.ActiveInvites
		for invID, invite := range invites {
			category, err := invite.Type.C()
			if err != nil {
				g.Log.CDebugf(ctx, "| Failed parsing invite %q in team %q: %v", invID, team.ID, err)
				continue
			}

			if category == keybase1.TeamInviteCategory_KEYBASE {
				_, err := invite.KeybaseUserVersion()
				if err != nil {
					g.Log.CDebugf(ctx, "| Failed parsing invite %q in team %q: %v", invID, team.ID, err)
					continue
				}

				anMemberInfo.MemberCount++

				/*
					membersForTeams = append(membersForTeams, pendingTeamMember{
						team: team.ID,
						uv:   uv,
					})
				*/
			}
		}

		teamPositionInList[team.ID] = len(res.Teams)
		res.Teams = append(res.Teams, *anMemberInfo)
	}

	tracer.Stage("MemberCounts")

	var uids []keybase1.UID
	for _, member := range membersForTeams {
		uids = append(uids, member.uv.Uid)
	}

	// TODO: For now, we decided that reset-user members still count
	// towards final team member count. If we want to change this
	// decision, commented out is code to check members with UIDMapper
	// and only count non-reset members as well as non-reset pukless
	// members.
	/*
		namePkgs, err := uidmap.MapUIDsReturnMap(g.UIDMapper, ctx, g, uids, 0, 10*time.Second, true)
		if err != nil {
			g.Log.CWarningf(ctx, "| Unable to verify team members - member counts were not loaded: %v", err)
			return res, nil
		}

		for _, member := range membersForTeams {
			pkg := namePkgs[member.uv.Uid]
			var memberReset bool
			if pkg.FullName != nil && pkg.FullName.EldestSeqno != member.uv.EldestSeqno {
				memberReset = true
			}

			if !memberReset {
				if i, ok := teamPositionInList[member.team]; ok {
					res.Teams[i].MemberCount++
				}
			}
		}
	*/

	if len(res.Teams) == 0 && !expectEmptyList {
		return res, fmt.Errorf("multiple errors while loading team list")
	}

	return res, nil
}

func ListAll(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.AnnotatedTeamList, error) {
	tracer := g.CTimeTracer(ctx, "TeamList.ListAll")
	defer tracer.Finish()

	meUID := g.ActiveDevice.UID()
	if meUID.IsNil() {
		return nil, libkb.LoginRequiredError{}
	}

	tracer.Stage("Server")
	teams, err := getTeamsListFromServer(ctx, g, "" /*uid*/, true /*all*/)
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

	tracer.Stage("Loads")

	expectEmptyList := true

	for _, memberInfo := range teams {
		serverSaysNeedAdmin := memberNeedAdmin(memberInfo, meUID)
		team, memberUV, err := getTeamForMember(ctx, g, memberInfo, serverSaysNeedAdmin)
		if err != nil {
			g.Log.CDebugf(ctx, "| Error in getTeamForMember ID:%s UID:%s: %v; skipping team", memberInfo.TeamID, memberInfo.UserID, err)
			expectEmptyList = false // so we tell user about errors at the end.
			continue
		}

		if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
			g.Log.CDebugf(ctx, "| TeamList skipping implicit team: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)
			continue
		}

		anMemberInfo := &keybase1.AnnotatedMemberInfo{
			TeamID:         team.ID,
			FqName:         team.Name().String(),
			UserID:         memberInfo.UserID,
			EldestSeqno:    memberUV.EldestSeqno,
			Role:           memberInfo.Role, // memberInfo.Role has been verified during getTeamForMember
			IsImplicitTeam: team.IsImplicit(),
			Implicit:       memberInfo.Implicit, // This part is still server trust
			Active:         true,                // assume member is active, fillUsernames might mutate this to false.
		}

		res.Teams = append(res.Teams, *anMemberInfo)

		if anMemberInfo.UserID == meUID {
			// Go through team invites - only once per TeamID.
			invites := team.chain().inner.ActiveInvites
			for invID, invite := range invites {
				category, err := invite.Type.C()
				if err != nil {
					continue
				}

				if category == keybase1.TeamInviteCategory_KEYBASE {
					// Treat KEYBASE invites (for PUK-less users) as
					// team members.
					uv, err := invite.KeybaseUserVersion()
					if err != nil {
						continue
					}

					res.Teams = append(res.Teams, keybase1.AnnotatedMemberInfo{
						TeamID:         team.ID,
						FqName:         team.Name().String(),
						UserID:         uv.Uid,
						EldestSeqno:    uv.EldestSeqno,
						Role:           invite.Role,
						IsImplicitTeam: team.IsImplicit(),
						Implicit:       nil,
						Active:         true,
					})
				} else if category == keybase1.TeamInviteCategory_SEITAN {
					// no-op - do not parse seitans. We shouldn't even
					// see them - they should all be stubbed out.
				} else {
					res.AnnotatedActiveInvites[invID] = keybase1.AnnotatedTeamInvite{
						Role:     invite.Role,
						Id:       invite.Id,
						Type:     invite.Type,
						Name:     invite.Name,
						Inviter:  invite.Inviter,
						TeamName: team.Name().String(),
					}
				}
			}
		}
	}

	if len(teams) == 0 && !expectEmptyList {
		return res, fmt.Errorf("Multiple errors during loading listAll")
	}

	tracer.Stage("UIDMapper")

	var uids []keybase1.UID
	for _, member := range res.Teams {
		uids = append(uids, member.UserID)
	}
	for _, invite := range res.AnnotatedActiveInvites {
		uids = append(uids, invite.Inviter.Uid)
	}

	namePkgs, err := uidmap.MapUIDsReturnMap(g.UIDMapper, ctx, g, uids, 0, 0, true)
	if err != nil {
		g.Log.CWarningf(ctx, "| Unable to load team members, uidmap returned: %v", err)
		return res, nil
	}

	for i := range res.Teams {
		member := &res.Teams[i]
		pkg := namePkgs[member.UserID]

		member.Username = pkg.NormalizedUsername.String()
		if pkg.FullName != nil {
			member.FullName = string(pkg.FullName.FullName)
			if pkg.FullName.EldestSeqno != member.EldestSeqno {
				member.Active = false
			}
		}
	}
	for i, invite := range res.AnnotatedActiveInvites {
		pkg := namePkgs[invite.Inviter.Uid]

		invite.InviterUsername = pkg.NormalizedUsername.String()
		res.AnnotatedActiveInvites[i] = invite
	}

	return res, nil
}

// List info about teams
// If an error is encountered while loading some teams, the team is skipped and no error is returned.
// If an error occurs loading all the info, an error is returned.
func List(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.AnnotatedTeamList, error) {
	if arg.All {
		return ListAll(ctx, g, arg)
	}
	return ListTeams(ctx, g, arg)
}

func ListSubteamsRecursive(ctx context.Context, g *libkb.GlobalContext, parentTeamName string, forceRepoll bool) (res []keybase1.TeamIDAndName, err error) {
	parent, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:        parentTeamName,
		NeedAdmin:   true,
		ForceRepoll: forceRepoll,
	})
	if err != nil {
		return nil, err
	}

	teams, err := parent.loadAllTransitiveSubteams(ctx, forceRepoll)
	if err != nil {
		return nil, err
	}

	for _, team := range teams {
		res = append(res, keybase1.TeamIDAndName{
			Id:   team.ID,
			Name: team.Name(),
		})
	}
	return res, nil
}

func AnnotateSeitanInvite(ctx context.Context, team *Team, invite keybase1.TeamInvite) (name keybase1.TeamInviteName, err error) {
	peikey, err := SeitanDecodePEIKey(string(invite.Name))
	if err != nil {
		return name, err
	}
	ikeyAndLabel, err := peikey.DecryptIKeyAndLabel(ctx, team)
	if err != nil {
		return name, err
	}
	version, err := ikeyAndLabel.V()
	if err != nil {
		return name, err
	}
	switch version {
	case keybase1.SeitanIKeyAndLabelVersion_V1:
		v1 := ikeyAndLabel.V1()
		label := v1.L
		labelType, err := label.T()
		if err != nil {
			return name, err
		}
		switch labelType {
		case keybase1.SeitanIKeyLabelType_SMS:
			sms := label.Sms()
			var smsName string
			if sms.F != "" && sms.N != "" {
				smsName = fmt.Sprintf("%s (%s)", sms.F, sms.N)
			} else if sms.F != "" {
				smsName = sms.F
			} else if sms.N != "" {
				smsName = sms.N
			}

			return keybase1.TeamInviteName(smsName), nil
		}
	}

	return "", nil
}

func AnnotateInvites(ctx context.Context, g *libkb.GlobalContext, team *Team) (map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, error) {
	invites := team.chain().inner.ActiveInvites
	teamName := team.Name().String()

	annotatedInvites := make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, len(invites))
	upakLoader := g.GetUPAKLoader()
	for id, invite := range invites {
		username, err := upakLoader.LookupUsername(ctx, invite.Inviter.Uid)
		if err != nil {
			return annotatedInvites, err
		}

		name := invite.Name
		category, err := invite.Type.C()
		if err != nil {
			return nil, err
		}
		var uv keybase1.UserVersion
		var active = true
		if category == keybase1.TeamInviteCategory_KEYBASE {
			// "keybase" invites (i.e. pukless users) have user version for name
			var err error
			uv, err = invite.KeybaseUserVersion()
			if err != nil {
				return nil, err
			}
			up, err := upakLoader.LoadUserPlusKeys(context.Background(), uv.Uid, "")
			if err != nil {
				return nil, err
			}
			if uv.EldestSeqno != up.EldestSeqno {
				active = false
			}
			name = keybase1.TeamInviteName(up.Username)
		} else if category == keybase1.TeamInviteCategory_SEITAN {
			name, err = AnnotateSeitanInvite(ctx, team, invite)
			if err != nil {
				return annotatedInvites, err
			}
		}

		annotatedInvites[id] = keybase1.AnnotatedTeamInvite{
			Role:            invite.Role,
			Id:              invite.Id,
			Type:            invite.Type,
			Name:            name,
			Uv:              uv,
			Inviter:         invite.Inviter,
			InviterUsername: username.String(),
			TeamName:        teamName,
			UserActive:      active,
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
