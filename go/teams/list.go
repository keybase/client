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
		Teams: nil,
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

		anMemberInfo.MemberCount, err = team.calculateAndCacheMemberCount(ctx)
		if err != nil {
			continue
		}

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
		Teams: nil,
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
	}

	if len(teams) == 0 && !expectEmptyList {
		return res, fmt.Errorf("Multiple errors during loading listAll")
	}

	tracer.Stage("UIDMapper")

	var uids []keybase1.UID
	for _, member := range res.Teams {
		uids = append(uids, member.UserID)
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

const blankSeitanLabel = "<token without label>"

func ComputeSeitanInviteDisplayName(ctx context.Context, team *Team, invite keybase1.TeamInvite) (name keybase1.TeamInviteDisplayName, err error) {
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
		smsName := blankSeitanLabel
		if sms.F != "" && sms.N != "" {
			smsName = fmt.Sprintf("%s (%s)", sms.F, sms.N)
		} else if sms.F != "" {
			smsName = sms.F
		} else if sms.N != "" {
			smsName = sms.N
		}
		return keybase1.TeamInviteDisplayName(smsName), nil
	case keybase1.SeitanKeyLabelType_GENERIC:
		return keybase1.TeamInviteDisplayName(label.Generic().L), nil
	default:
		return keybase1.TeamInviteDisplayName(blankSeitanLabel), nil
	}
}

func ComputeInvitelinkDisplayName(mctx libkb.MetaContext, team *Team, invite keybase1.TeamInvite) (name keybase1.TeamInviteDisplayName, err error) {
	pkey, err := SeitanDecodePKey(string(invite.Name))
	if err != nil {
		return name, err
	}
	keyAndLabel, err := pkey.DecryptKeyAndLabel(mctx.Ctx(), team)
	if err != nil {
		return name, err
	}

	version, err := keyAndLabel.V()
	if err != nil {
		return name, err
	}
	if version != keybase1.SeitanKeyAndLabelVersion_Invitelink {
		return name, fmt.Errorf("AnnotateInvitelink: version not an invitelink: %v", version)
	}

	ikey := keyAndLabel.Invitelink().I
	sikey, err := GenerateSIKeyInvitelink(ikey)
	if err != nil {
		return name, err
	}
	id, err := sikey.GenerateShortTeamInviteID()
	if err != nil {
		return name, err
	}

	url := GenerateInvitelinkURL(mctx, ikey, id)
	name = keybase1.TeamInviteDisplayName(url)
	return name, nil
}

func annotateTeamUsedInviteLogPoints(points []keybase1.TeamUsedInviteLogPoint, namePkgs map[keybase1.UID]libkb.UsernamePackage) (ret []keybase1.AnnotatedTeamUsedInviteLogPoint) {
	for _, point := range points {
		username := namePkgs[point.Uv.Uid].NormalizedUsername
		ret = append(ret, keybase1.AnnotatedTeamUsedInviteLogPoint{TeamUsedInviteLogPoint: point, Username: username.String()})
	}
	return ret
}

// GetAnnotatedInvitesAndMembersForUI returns annotated invites and members lists from the sigchain,
// except that Keybase-type invites are treated as team members. This is for the purpose of
// collecting them together in the UI.
func GetAnnotatedInvitesAndMembersForUI(mctx libkb.MetaContext, team *Team,
) (members []keybase1.TeamMemberDetails, annotatedInvites []keybase1.AnnotatedTeamInvite, err error) {

	allAnnotatedInvites, err := getAnnotatedInvites(mctx, team)
	if err != nil {
		return nil, nil, err
	}
	members, err = MembersDetails(mctx.Ctx(), mctx.G(), team)
	if err != nil {
		return nil, nil, err
	}

	for _, annotatedInvite := range allAnnotatedInvites {
		inviteC, err := annotatedInvite.InviteMetadata.Invite.Type.C()
		if err != nil {
			return nil, nil, err
		}
		extC, err := annotatedInvite.InviteExt.C()
		if err != nil {
			return nil, nil, err
		}
		if inviteC != extC {
			return nil, nil, fmt.Errorf("got invite category %v from invite but %v from inviteExt", inviteC, extC)
		}
		if inviteC == keybase1.TeamInviteCategory_KEYBASE {
			code, err := annotatedInvite.InviteMetadata.Status.Code()
			if err != nil {
				return nil, nil, err
			}
			if code != keybase1.TeamInviteMetadataStatusCode_ACTIVE {
				// Skip non active keybase-type invites
				continue
			}

			keybaseExt := annotatedInvite.InviteExt.Keybase()
			details := keybase1.TeamMemberDetails{
				Uv:       keybaseExt.InviteeUv,
				Username: keybaseExt.Username,
				NeedsPUK: true,
				FullName: keybaseExt.FullName,
				Status:   keybaseExt.Status,
				Role:     annotatedInvite.InviteMetadata.Invite.Role,
			}

			// Add the keybase-type invite to the members list. However, if there already exists a
			// cryptomember who is inactive (reset or deleted), and additionally there is a
			// keybase-type invite for the same UID, overwrite the inactive one with the invite.
			overrodeExistingInactiveMember := false
			for idx, member := range members {
				if details.Uv.Uid.Equal(member.Uv.Uid) && !member.Status.IsActive() {
					members[idx] = details
					overrodeExistingInactiveMember = true
				}
			}
			if !overrodeExistingInactiveMember {
				members = append(members, details)
			}
		} else {
			annotatedInvites = append(annotatedInvites, annotatedInvite)
		}
	}

	return members, annotatedInvites, nil
}

func getAnnotatedInvites(mctx libkb.MetaContext, team *Team) (annotatedInvites []keybase1.AnnotatedTeamInvite, err error) {
	inviteMDs := team.chain().inner.InviteMetadatas
	if len(inviteMDs) == 0 {
		return nil, nil
	}

	// UID list to pass to UIDMapper to get full names. Duplicate UIDs
	// are fine, MapUIDsReturnMap will filter them out.
	var uids []keybase1.UID
	for _, inviteMD := range inviteMDs {
		invite := inviteMD.Invite
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
		for _, usedInviteLogPoint := range inviteMD.UsedInvites {
			uids = append(uids, usedInviteLogPoint.Uv.Uid)
		}
	}

	namePkgs, err := uidmap.MapUIDsReturnMapMctx(mctx, uids, defaultFullnameFreshness,
		defaultNetworkTimeBudget, true)
	if err != nil {
		// UIDMap returned an error, but there may be useful data in the result.
		mctx.Debug("AnnotateInvites: MapUIDsReturnMap failed: %s", err)
	}

	teamName := team.Name().String()
	for _, inviteMD := range inviteMDs {
		invite := inviteMD.Invite
		inviterUsername := namePkgs[invite.Inviter.Uid].NormalizedUsername

		category, err := invite.Type.C()
		if err != nil {
			return nil, err
		}
		// defaults; overridden by some invite types later
		inviteExt := keybase1.NewAnnotatedTeamInviteExtDefault(category)
		displayName := keybase1.TeamInviteDisplayName(invite.Name)
		switch category {
		case keybase1.TeamInviteCategory_SBS:
			displayName = keybase1.TeamInviteDisplayName(fmt.Sprintf("%s@%s", invite.Name, string(invite.Type.Sbs())))
		case keybase1.TeamInviteCategory_KEYBASE:
			// "keybase" invites (i.e. pukless users) have user version for name
			inviteeUV, err := invite.KeybaseUserVersion()
			if err != nil {
				return nil, err
			}
			pkg := namePkgs[inviteeUV.Uid]
			status := keybase1.TeamMemberStatus_ACTIVE
			var fullName keybase1.FullName
			if pkg.FullName != nil {
				if pkg.FullName.EldestSeqno != inviteeUV.EldestSeqno {
					status = keybase1.TeamMemberStatus_RESET
				}
				if pkg.FullName.Status == keybase1.StatusCode_SCDeleted {
					status = keybase1.TeamMemberStatus_DELETED
				}
				fullName = pkg.FullName.FullName
			}

			if pkg.NormalizedUsername.IsNil() {
				return nil, fmt.Errorf("failed to get username from UIDMapper for uv %v", inviteeUV)
			}

			displayName = keybase1.TeamInviteDisplayName(pkg.NormalizedUsername.String())
			inviteExt = keybase1.NewAnnotatedTeamInviteExtWithKeybase(keybase1.KeybaseInviteExt{
				InviteeUv: inviteeUV,
				Status:    status,
				FullName:  fullName,
				Username:  pkg.NormalizedUsername.String(),
			})
		case keybase1.TeamInviteCategory_SEITAN:
			displayName, err = ComputeSeitanInviteDisplayName(mctx.Ctx(), team, invite)
			if err != nil {
				// There are seitan invites in the wild from before
				// https://github.com/keybase/client/pull/9816 These can no
				// longer be decrypted, we hide them.
				mctx.Debug("error annotating seitan invite (%v): %v", invite.Id, err)
				continue
			}
		case keybase1.TeamInviteCategory_INVITELINK:
			displayName, err = ComputeInvitelinkDisplayName(mctx, team, invite)
			if err != nil {
				mctx.Warning("error annotating invitelink (%v): %v", invite.Id, err)
				continue
			}
			inviteExt = keybase1.NewAnnotatedTeamInviteExtWithInvitelink(keybase1.InvitelinkInviteExt{
				AnnotatedUsedInvites: annotateTeamUsedInviteLogPoints(inviteMD.UsedInvites, namePkgs),
			})
		default:
		}

		now := mctx.G().Clock().Now()
		isValid, validityDescription := inviteMD.ComputeValidity(now, team.Data.Chain.UserLog)
		annotatedInvites = append(annotatedInvites, keybase1.AnnotatedTeamInvite{
			InviteMetadata:      inviteMD,
			DisplayName:         displayName,
			InviterUsername:     inviterUsername.String(),
			TeamName:            teamName,
			InviteExt:           inviteExt,
			IsValid:             isValid,
			ValidityDescription: validityDescription,
		})
	}

	// Sort most recent first
	sort.Slice(annotatedInvites, func(i, j int) bool {
		iSeqno := annotatedInvites[i].InviteMetadata.TeamSigMeta.SigMeta.SigChainLocation.Seqno
		jSeqno := annotatedInvites[j].InviteMetadata.TeamSigMeta.SigMeta.SigChainLocation.Seqno
		return iSeqno >= jSeqno
	})

	return annotatedInvites, nil
}

func TeamTreeUnverified(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamTreeUnverifiedArg) (res keybase1.TeamTreeResult, err error) {
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
