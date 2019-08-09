package teams

import (
	"fmt"
	"sort"

	"golang.org/x/net/context"

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

func getTeamsListFromServer(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, all bool,
	countMembers bool, includeImplicitTeams bool, rootTeamID keybase1.TeamID) ([]keybase1.MemberInfo, error) {
	var endpoint string
	if all {
		endpoint = "team/teammates_for_user"
	} else {
		endpoint = "team/for_user"
	}
	a := libkb.NewAPIArg(endpoint)
	a.Args = libkb.HTTPArgs{}
	if uid.Exists() {
		a.Args["uid"] = libkb.S{Val: uid.String()}
	}
	if countMembers {
		a.Args["count_members"] = libkb.B{Val: true}
	}
	if !rootTeamID.IsNil() {
		a.Args["root_team_id"] = libkb.S{Val: rootTeamID.String()}
	}
	if includeImplicitTeams {
		a.Args["include_implicit_teams"] = libkb.B{Val: true}
	}
	mctx := libkb.NewMetaContext(ctx, g)
	a.SessionType = libkb.APISessionTypeREQUIRED
	var list statusList
	if err := mctx.G().API.GetDecode(mctx, a, &list); err != nil {
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
func verifyMemberRoleInTeam(ctx context.Context, userID keybase1.UID, expectedRole keybase1.TeamRole,
	team *Team) (res keybase1.UserVersion, err error) {
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

type localLoadedTeams struct {
	libkb.Contextified
	teams map[keybase1.TeamID]*Team
}

func newLocalLoadedTeams(g *libkb.GlobalContext) localLoadedTeams {
	return localLoadedTeams{
		Contextified: libkb.NewContextified(g),
		teams:        make(map[keybase1.TeamID]*Team),
	}
}

// getTeamForMember tries to return *Team in a recent enough state to
// contain member with correct role as set in MemberInfo. It might
// trigger a reload with ForceRepoll if cached state does not match.
func (l *localLoadedTeams) getTeamForMember(ctx context.Context, member keybase1.MemberInfo,
	needAdmin bool) (team *Team, uv keybase1.UserVersion, err error) {
	teamID := member.TeamID
	team = l.teams[teamID]
	if team == nil {
		// Team was not there in local cache - this is the first time
		// localLoadedTeams is asked for this team. Try with no
		// forceRepoll first.
		team, err = Load(ctx, l.G(), keybase1.LoadTeamArg{
			ID:               teamID,
			NeedAdmin:        needAdmin,
			Public:           teamID.IsPublic(),
			ForceRepoll:      false,
			RefreshUIDMapper: true,
		})
		if err != nil {
			return nil, uv, err
		}
		l.teams[teamID] = team
	}

	memberUV, err := verifyMemberRoleInTeam(ctx, member.UserID, member.Role, team)
	if err != nil {
		team, err = Load(ctx, l.G(), keybase1.LoadTeamArg{
			ID:          teamID,
			NeedAdmin:   needAdmin,
			Public:      teamID.IsPublic(),
			ForceRepoll: true,
		})
		if err != nil {
			return nil, uv, err
		}
		l.teams[teamID] = team

		memberUV, err = verifyMemberRoleInTeam(ctx, member.UserID, member.Role, team)
		if err != nil {
			return nil, uv, fmt.Errorf("server was wrong about role in team : %v", err)
		}
	}

	return team, memberUV, nil
}

func getUsernameAndFullName(ctx context.Context, g *libkb.GlobalContext,
	uid keybase1.UID) (username libkb.NormalizedUsername, fullName string, err error) {
	username, err = g.GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", "", err
	}
	fullName, err = libkb.GetFullName(libkb.NewMetaContext(ctx, g), uid)
	if err != nil {
		return "", "", err
	}

	return username, fullName, err
}

func ListTeamsVerified(ctx context.Context, g *libkb.GlobalContext,
	arg keybase1.TeamListVerifiedArg) (*keybase1.AnnotatedTeamList, error) {
	tracer := g.CTimeTracer(ctx, "TeamList.ListTeamsVerified", true)
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
	teams, err := getTeamsListFromServer(ctx, g, queryUID, false, /* all */
		false /* countMembers */, arg.IncludeImplicitTeams, keybase1.NilTeamID())
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
		Teams:                  nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	if len(teams) == 0 {
		return res, nil
	}

	tracer.Stage("Loads")

	loadedTeams := newLocalLoadedTeams(g)
	expectEmptyList := true

	for _, memberInfo := range teams {
		serverSaysNeedAdmin := memberNeedAdmin(memberInfo, meUID)
		team, _, err := loadedTeams.getTeamForMember(ctx, memberInfo, serverSaysNeedAdmin)
		if err != nil {
			m.Debug("| Error in getTeamForMember ID:%s UID:%s: %v; skipping team", memberInfo.TeamID, memberInfo.UserID, err)
			expectEmptyList = false // so we tell user about errors at the end.
			continue
		}

		if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
			m.Debug("| TeamList skipping implicit team: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)
			continue
		}

		expectEmptyList = false

		if memberInfo.UserID != queryUID {
			m.Debug("| Expected memberInfo for UID:%s, got UID:%s", queryUID, memberInfo.UserID)
			continue
		}

		anMemberInfo := &keybase1.AnnotatedMemberInfo{
			TeamID:              team.ID,
			FqName:              team.Name().String(),
			UserID:              memberInfo.UserID,
			Role:                memberInfo.Role, // memberInfo.Role has been verified during getTeamForMember
			IsImplicitTeam:      team.IsImplicit(),
			IsOpenTeam:          team.IsOpen(),
			Implicit:            memberInfo.Implicit, // This part is still server trust
			Username:            queryUsername.String(),
			FullName:            queryFullName,
			MemberCount:         0,
			Status:              keybase1.TeamMemberStatus_ACTIVE,
			AllowProfilePromote: memberInfo.AllowProfilePromote,
			IsMemberShowcased:   memberInfo.IsMemberShowcased,
		}

		if team.IsImplicit() {
			displayName, err := team.ImplicitTeamDisplayNameString(ctx)
			if err != nil {
				m.Warning("| Failed to get ImplicitTeamDisplayNameString() for team %q: %v", team.ID, err)
			} else {
				anMemberInfo.ImpTeamDisplayName = displayName
			}
		}

		members, err := team.Members()
		if err != nil {
			m.Debug("| Failed to get Members() for team %q: %v", team.ID, err)
			continue
		}

		memberUIDs := make(map[keybase1.UID]bool)
		for _, uv := range members.AllUserVersions() {
			memberUIDs[uv.Uid] = true
		}

		invites := team.chain().inner.ActiveInvites
		for invID, invite := range invites {
			category, err := invite.Type.C()
			if err != nil {
				m.Debug("| Failed parsing invite %q in team %q: %v", invID, team.ID, err)
				continue
			}

			if category == keybase1.TeamInviteCategory_KEYBASE {
				uv, err := invite.KeybaseUserVersion()
				if err != nil {
					m.Debug("| Failed parsing invite %q in team %q: %v", invID, team.ID, err)
					continue
				}

				memberUIDs[uv.Uid] = true
			}

		}

		anMemberInfo.MemberCount = len(memberUIDs)
		res.Teams = append(res.Teams, *anMemberInfo)
	}

	if len(res.Teams) == 0 && !expectEmptyList {
		return res, fmt.Errorf("multiple errors while loading team list")
	}

	return res, nil
}

func ListAll(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListTeammatesArg) (*keybase1.AnnotatedTeamList, error) {
	tracer := g.CTimeTracer(ctx, "TeamList.ListAll", true)
	defer tracer.Finish()

	meUID := g.ActiveDevice.UID()
	if meUID.IsNil() {
		return nil, libkb.LoginRequiredError{}
	}

	tracer.Stage("Server")
	teams, err := getTeamsListFromServer(ctx, g, "" /*uid*/, true /*all*/, false /* countMembers */, arg.IncludeImplicitTeams, keybase1.NilTeamID())
	if err != nil {
		return nil, err
	}

	res := &keybase1.AnnotatedTeamList{
		Teams:                  nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	if len(teams) == 0 {
		return res, nil
	}

	tracer.Stage("Loads")

	loadedTeams := newLocalLoadedTeams(g)
	expectEmptyList := true

	for _, memberInfo := range teams {
		serverSaysNeedAdmin := memberNeedAdmin(memberInfo, meUID)
		team, memberUV, err := loadedTeams.getTeamForMember(ctx, memberInfo, serverSaysNeedAdmin)
		if err != nil {
			g.Log.CDebugf(ctx, "| Error in getTeamForMember ID:%s UID:%s: %v; skipping team", memberInfo.TeamID, memberInfo.UserID, err)
			expectEmptyList = false // so we tell user about errors at the end.
			continue
		}

		// TODO: memberUV is always empty for implicit admins that are
		// not real members, because getTeamForMember will not try to
		// look into ancestor teams.

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
			// Assume member is active, later this field might be
			// mutated to false after consulting UIDMapper.
			Status: keybase1.TeamMemberStatus_ACTIVE,
		}

		res.Teams = append(res.Teams, *anMemberInfo)

		if anMemberInfo.UserID == meUID {
			// Go through team invites - only once per TeamID.
			parseInvitesNoAnnotate(ctx, g, team, res)
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

	namePkgs, err := uidmap.MapUIDsReturnMap(ctx, g.UIDMapper, g, uids,
		defaultFullnameFreshness, defaultNetworkTimeBudget, true)
	if err != nil {
		// UIDMap returned an error, but there may be useful data in the result.
		g.Log.CDebugf(ctx, "| MapUIDsReturnMap returned: %v", err)
	}

	for i := range res.Teams {
		member := &res.Teams[i]
		if pkg, ok := namePkgs[member.UserID]; ok {
			member.Username = pkg.NormalizedUsername.String()
			if pkg.FullName != nil {
				member.FullName = string(pkg.FullName.FullName)
				// TODO: We can't check if purely implicit admin is
				// reset because we are not looking deep enough to get
				// member uv. member.EldestSeqno will always be 0 for
				// implicit admins. Only flag members that have actual
				// role in the team here.
				if member.Role != keybase1.TeamRole_NONE && pkg.FullName.EldestSeqno != member.EldestSeqno {
					member.Status = keybase1.TeamMemberStatus_RESET
				}
				if pkg.FullName.Status == keybase1.StatusCode_SCDeleted {
					member.Status = keybase1.TeamMemberStatus_DELETED
				}
			}
		}
	}
	for i, invite := range res.AnnotatedActiveInvites {
		if pkg, ok := namePkgs[invite.Inviter.Uid]; ok {
			invite.InviterUsername = pkg.NormalizedUsername.String()
			res.AnnotatedActiveInvites[i] = invite
		}
	}

	return res, nil
}

func ListSubteamsRecursive(ctx context.Context, g *libkb.GlobalContext,
	parentTeamName string, forceRepoll bool) (res []keybase1.TeamIDAndName, err error) {
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
	pkey, err := SeitanDecodePKey(string(invite.Name))
	if err != nil {
		return name, err
	}
	keyAndLabel, err := pkey.DecryptKeyAndLabel(ctx, team)
	if err != nil {
		return name, err
	}

	version, err := keyAndLabel.V()
	if err != nil {
		return name, err
	}
	var label keybase1.SeitanKeyLabel
	switch version {
	case keybase1.SeitanKeyAndLabelVersion_V1:
		v1 := keyAndLabel.V1()
		label = v1.L
	case keybase1.SeitanKeyAndLabelVersion_V2:
		v2 := keyAndLabel.V2()
		label = v2.L
	default:
		return "", fmt.Errorf("Unknown version: %v", version)
	}

	labelType, err := label.T()
	if err != nil {
		return name, err
	}
	switch labelType {
	case keybase1.SeitanKeyLabelType_SMS:
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

	return "", nil
}

type AnnotatedInviteMap map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite

func AnnotateInvites(ctx context.Context, g *libkb.GlobalContext, team *Team) (AnnotatedInviteMap, error) {
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
		status := keybase1.TeamMemberStatus_ACTIVE
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
				status = keybase1.TeamMemberStatus_RESET
			}
			if up.Status == keybase1.StatusCode_SCDeleted {
				status = keybase1.TeamMemberStatus_DELETED
			}
			name = keybase1.TeamInviteName(up.Username)
		} else if category == keybase1.TeamInviteCategory_SEITAN {
			name, err = AnnotateSeitanInvite(ctx, team, invite)
			if err != nil {
				// There are seitan invites in the wild from before
				// https://github.com/keybase/client/pull/9816 These can no
				// longer be decrypted, we hide them.
				g.Log.CDebugf(ctx, "error annotating seitan invite (%v): %v", id, err)
				continue
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
			Status:          status,
		}
	}
	return annotatedInvites, nil
}

func addKeybaseInviteToRes(ctx context.Context, memb keybase1.TeamMemberDetails,
	membs []keybase1.TeamMemberDetails) []keybase1.TeamMemberDetails {
	for idx, existing := range membs {
		if memb.Uv.Uid.Equal(existing.Uv.Uid) && !existing.Status.IsActive() {
			membs[idx] = memb
			return membs
		}
	}
	return append(membs, memb)
}

// AnnotateInvitesUIDMapper does what AnnotateInvites does but using
// UIDMapper, so it's fast but may be wrong. It also puts any keybase
// invites to members set which reference should be passed as argument.
// PUKless members also will not be present in returned AnnotatedInviteMap.
func AnnotateInvitesUIDMapper(ctx context.Context, g *libkb.GlobalContext, team *Team,
	members *keybase1.TeamMembersDetails) (AnnotatedInviteMap, error) {
	invites := team.chain().inner.ActiveInvites
	annotatedInvites := make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, len(invites))
	if len(invites) == 0 {
		return annotatedInvites, nil
	}

	// UID list to pass to UIDMapper to get full names. Duplicate UIDs
	// are fine, MapUIDsReturnMap will filter them out.
	var uids []keybase1.UID
	for _, invite := range invites {
		uids = append(uids, invite.Inviter.Uid)

		category, err := invite.Type.C()
		if err != nil {
			return nil, err
		}
		if category == keybase1.TeamInviteCategory_KEYBASE {
			uv, err := invite.KeybaseUserVersion()
			if err != nil {
				return nil, err
			}
			uids = append(uids, uv.Uid)
		}
	}

	namePkgs, err := uidmap.MapUIDsReturnMap(ctx, g.UIDMapper, g, uids,
		defaultFullnameFreshness, defaultNetworkTimeBudget, true)
	if err != nil {
		// UIDMap returned an error, but there may be useful data in the result.
		g.Log.CDebugf(ctx, "AnnotateInvitesUIDMapper: MapUIDsReturnMap returned: %v", err)
	}

	teamName := team.Name().String()
	for id, invite := range invites {
		username := namePkgs[invite.Inviter.Uid].NormalizedUsername

		name := invite.Name
		category, err := invite.Type.C()
		if err != nil {
			return nil, err
		}
		var uv keybase1.UserVersion
		if category == keybase1.TeamInviteCategory_KEYBASE {
			// "keybase" invites (i.e. pukless users) have user version for name
			uv, err := invite.KeybaseUserVersion()
			if err != nil {
				return nil, err
			}
			pkg := namePkgs[uv.Uid]
			status := keybase1.TeamMemberStatus_ACTIVE
			var fullName keybase1.FullName
			if pkg.FullName != nil {
				if pkg.FullName.EldestSeqno != uv.EldestSeqno {
					status = keybase1.TeamMemberStatus_RESET
				}
				if pkg.FullName.Status == keybase1.StatusCode_SCDeleted {
					status = keybase1.TeamMemberStatus_DELETED
				}
				fullName = pkg.FullName.FullName
			}

			details := keybase1.TeamMemberDetails{
				Uv:       uv,
				Username: pkg.NormalizedUsername.String(),
				NeedsPUK: true,
				FullName: fullName,
				Status:   status,
			}

			switch invite.Role {
			case keybase1.TeamRole_OWNER:
				members.Owners = addKeybaseInviteToRes(ctx, details, members.Owners)
			case keybase1.TeamRole_ADMIN:
				members.Admins = addKeybaseInviteToRes(ctx, details, members.Admins)
			case keybase1.TeamRole_WRITER:
				members.Writers = addKeybaseInviteToRes(ctx, details, members.Writers)
			case keybase1.TeamRole_READER:
				members.Readers = addKeybaseInviteToRes(ctx, details, members.Readers)
			}

			// Continue to skip adding this invite to annotatedInvites
			continue
		} else if category == keybase1.TeamInviteCategory_SEITAN {
			name, err = AnnotateSeitanInvite(ctx, team, invite)
			if err != nil {
				// There are seitan invites in the wild from before
				// https://github.com/keybase/client/pull/9816 These can no
				// longer be decrypted, we hide them.
				g.Log.CDebugf(ctx, "error annotating seitan invite (%v): %v", id, err)
				continue
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
		}
	}

	return annotatedInvites, nil
}

func parseInvitesNoAnnotate(ctx context.Context, g *libkb.GlobalContext, team *Team, res *keybase1.AnnotatedTeamList) {
	invites := team.chain().inner.ActiveInvites
	for invID, invite := range invites {
		category, err := invite.Type.C()
		if err != nil {
			g.Log.CDebugf(ctx, "| parseInvitesNoAnnotate failed to parse invite %q for team %q: %v", invID, team.ID, err)
			continue
		}

		if category == keybase1.TeamInviteCategory_KEYBASE {
			// Treat KEYBASE invites (for PUK-less users) as
			// team members.
			uv, err := invite.KeybaseUserVersion()
			if err != nil {
				g.Log.CDebugf(ctx, "| parseInvitesNoAnnotate failed to parse invite %q for team %q (name is not proper UV): %v", invID, team.ID, err)
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
				Status:         keybase1.TeamMemberStatus_ACTIVE,
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

func TeamTree(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamTreeArg) (res keybase1.TeamTreeResult, err error) {
	serverList, err := getTeamsListFromServer(ctx, g, "" /* uid */, false, /* all */
		false /* countMembers */, false /* includeImplicitTeams */, arg.Name.RootID())
	if err != nil {
		return res, err
	}
	rootName := arg.Name.RootAncestorName()

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
		if !rootName.IsAncestorOf(serverName) && !rootName.Eq(serverName) {
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

	// Add all parent names (recursively) So that if only A.B.C is in the list,
	// we add A.B and A as well.  Adding map entries while iterating is safe.
	// "If map entries are created during iteration, that entry may be produced
	// during the iteration or may be skipped."
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
			if err != nil || (!rootName.IsAncestorOf(name) && !rootName.Eq(name)) {
				break
			}
		}
	}

	for _, entry := range entryMap {
		res.Entries = append(res.Entries, entry)
	}

	if len(res.Entries) == 0 {
		g.Log.CDebugf(ctx, "| TeamTree not teams matched")
		// Try to get a nicer error by loading the team directly.
		_, err = Load(ctx, g, keybase1.LoadTeamArg{Name: arg.Name.String()})
		if err != nil {
			return res, err
		}
		return res, fmt.Errorf("team not found: %v", rootName)
	}

	// Order into a tree order. Which happens to be alphabetical ordering.
	// Example: [a, a.b, a.b.c, a.b.d, a.e.f, a.e.g]
	sort.Slice(res.Entries, func(i, j int) bool {
		return res.Entries[i].Name.String() < res.Entries[j].Name.String()
	})

	return res, nil
}
