package teams

import (
	"fmt"
	"sort"
	"sync"

	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/semaphore"

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

func memberNeedAdmin(member keybase1.MemberInfo, meUID keybase1.UID) bool {
	return member.UserID == meUID &&
		(member.Role.IsAdminOrAbove() || (member.Implicit != nil && member.Implicit.Role.IsAdminOrAbove()))
}

// verifyMemberRoleInTeam checks if role give in MemberInfo matches
// what team chain says. Nothing is checked when MemberInfo's role is
// NONE, in this context it means that user has implied membership in
// the team and no role given in sigchain.
func verifyMemberRoleInTeam(ctx context.Context, userID keybase1.UID, expectedRole keybase1.TeamRole, team *Team) error {
	if expectedRole == keybase1.TeamRole_NONE {
		return nil
	}

	memberUV, err := team.chain().GetLatestUVWithUID(userID)
	if err != nil {
		return err
	}
	role, err := team.chain().GetUserRole(memberUV)
	if err != nil {
		return err
	}
	if role != expectedRole {
		return fmt.Errorf("unexpected member role: expected %v but actual role is %v", expectedRole, role)
	}
	return nil
}

// getTeamForMember tries to load team in a recent enough state to
// contain member with correct role as set in MemberInfo. It might
// trigger a reload with ForceRepoll if cached state does not match.
func getTeamForMember(ctx context.Context, g *libkb.GlobalContext, member keybase1.MemberInfo, needAdmin bool) (*Team, error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          member.TeamID,
		NeedAdmin:   needAdmin,
		Public:      member.TeamID.IsPublic(),
		ForceRepoll: false,
	})
	if err != nil {
		return nil, err
	}

	err = verifyMemberRoleInTeam(ctx, member.UserID, member.Role, team)
	if err != nil {
		team, err = Load(ctx, g, keybase1.LoadTeamArg{
			ID:          member.TeamID,
			NeedAdmin:   needAdmin,
			Public:      member.TeamID.IsPublic(),
			ForceRepoll: true,
		})
		if err != nil {
			return nil, err
		}

		err = verifyMemberRoleInTeam(ctx, member.UserID, member.Role, team)
		if err != nil {
			return nil, fmt.Errorf("server was wrong about role in team : %v", err)
		}
	}

	return team, nil
}

// getUsernameAndFullName uses UPAKLoader to get username and fullname
// for given UID. It should not be used for fetching data for multiple
// UIDs, for this use UIDMapper.
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

func fillUsernames(ctx context.Context, g *libkb.GlobalContext, res *keybase1.AnnotatedTeamList) error {
	var userList []keybase1.UID
	userSet := map[keybase1.UID]int{}

	for _, member := range res.Teams {
		_, found := userSet[member.UserID]
		if !found {
			userSet[member.UserID] = len(userList)
			userList = append(userList, member.UserID)
		}
	}

	namePkgs, err := g.UIDMapper.MapUIDsToUsernamePackages(ctx, g, userList, 0, 0, true)
	if err != nil {
		return err
	}

	for id := range res.Teams {
		member := &res.Teams[id]
		num := userSet[member.UserID]
		pkg := namePkgs[num]

		member.Username = pkg.NormalizedUsername.String()
		if pkg.FullName != nil {
			member.FullName = string(pkg.FullName.FullName)
		}
	}

	return nil
}

// List info about teams
// If an error is encountered while loading some teams, the team is skipped and no error is returned.
// If an error occurs loading all the info, an error is returned.
func List(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.AnnotatedTeamList, error) {
	tracer := g.CTimeTracer(ctx, "TeamList")
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

	tracer.Stage("Server")
	teams, err := getTeamsListFromServer(ctx, g, queryUID, arg.All)
	if err != nil {
		return nil, err
	}

	if arg.UserAssertion == "" {
		queryUID = meUID
	}

	tracer.Stage("LookupOurUsername")
	queryUsername, queryFullName, err := getUsernameAndFullName(context.Background(), g, queryUID)
	if err != nil {
		return nil, err
	}

	var resLock sync.Mutex
	res := &keybase1.AnnotatedTeamList{
		Teams: nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	// Also save visited admin teams to annotate all invitations
	// afterwards, for all teams at once.
	uniqueAdminTeams := make(map[keybase1.TeamID]*Team)

	if len(teams) == 0 {
		return res, nil
	}

	tracer.Stage("Loads")

	expectEmptyList := true

	// Process all the teams in parallel. Limit to 15 in parallel so
	// we don't crush the server. errgroup collects errors and returns
	// the first non-nil. subctx is canceled when the group finishes.
	const parallelLimit int64 = 15
	sem := semaphore.NewWeighted(parallelLimit)
	group, subctx := errgroup.WithContext(ctx)
	for _, memberInfo := range teams {
		memberInfo := memberInfo // https://golang.org/doc/faq#closures_and_goroutines

		// Skip implicit teams unless --include-implicit-teams was passed from above.
		if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
			g.Log.CDebugf(subctx, "| TeamList skipping implicit team: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)
			continue
		}

		expectEmptyList = false

		group.Go(func() error {
			// Grab one of the parallelLimit slots
			err := sem.Acquire(subctx, 1)
			if err != nil {
				return err
			}
			defer sem.Release(1)
			g.Log.CDebugf(subctx, "| TeamList entry: server-team:%v server-uid:%v", memberInfo.TeamID, memberInfo.UserID)

			memberUID := memberInfo.UserID
			var username libkb.NormalizedUsername
			var fullName string
			if memberUID == queryUID {
				username, fullName = queryUsername, queryFullName
			}

			serverSaysNeedAdmin := memberNeedAdmin(memberInfo, meUID)
			team, err := getTeamForMember(subctx, g, memberInfo, serverSaysNeedAdmin)
			if err != nil {
				g.Log.CDebugf(subctx, "| Error in getTeamForMember %q: %v; skipping member", memberInfo.UserID, err)
				return nil
			}

			anMemberInfo := &keybase1.AnnotatedMemberInfo{
				TeamID:         team.ID,
				FqName:         team.Name().String(),
				UserID:         memberInfo.UserID,
				Role:           memberInfo.Role, // memberInfo.Role has been verified during getTeamForMember
				IsImplicitTeam: team.IsImplicit(),
				Implicit:       memberInfo.Implicit, // This part is still server trust
				// Username and FullName for users that are not the current user
				// are blank initially and filled by fillUsernames.
				Username: username.String(),
				FullName: fullName,
			}

			if !arg.All {
				members, err := team.Members()
				if err == nil {
					anMemberInfo.MemberCount = len(members.AllUIDs())
				} else {
					g.Log.CDebugf(subctx, "| Failed to get Members() for team %q: %v", team.ID, err)
				}
			}

			// After this lock it is safe to write out results
			resLock.Lock()
			defer resLock.Unlock()

			res.Teams = append(res.Teams, *anMemberInfo)
			if serverSaysNeedAdmin {
				// Save team for later, to batch-annotate invitations.
				uniqueAdminTeams[team.ID] = team
			}

			return nil
		})
	}

	err = group.Wait()

	tracer.Stage("Annotating Invites")

	res.AnnotatedActiveInvites, err = AnnotateAllInvites(ctx, g, uniqueAdminTeams)
	if err != nil {
		g.Log.CDebugf(subctx, "Error in annotateAllInvites: %v", err)
	}

	if arg.All && len(res.Teams) != 0 {
		tracer.Stage("FillUsernames")

		err := fillUsernames(ctx, g, res)
		if err != nil {
			return nil, err
		}
	}

	if len(res.Teams) == 0 && !expectEmptyList {
		return res, fmt.Errorf("multiple errors while loading team list")
	}

	return res, err
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

func AnnotateAllInvites(ctx context.Context, g *libkb.GlobalContext, teams map[keybase1.TeamID]*Team) (res map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, err error) {
	// Gather users first
	var userList []keybase1.UID
	userSet := map[keybase1.UID]int{}
	gatherUser := func(uid keybase1.UID) {
		_, found := userSet[uid]
		if !found {
			userSet[uid] = len(userList)
			userList = append(userList, uid)
		}
	}

	for _, team := range teams {
		invites := team.chain().inner.ActiveInvites
		for _, invite := range invites {
			gatherUser(invite.Inviter.Uid)

			category, err := invite.Type.C()
			if err != nil {
				g.Log.CDebugf(ctx, "| AnnotateAllInvites, while gathering users: %v", err)
				continue
			}
			if category == keybase1.TeamInviteCategory_KEYBASE {
				uv, err := invite.KeybaseUserVersion()
				if err != nil {
					g.Log.CDebugf(ctx, "| AnnotateAllInvites, while gathering users: %v", err)
					continue
				}

				gatherUser(uv.Uid)
			}
		}
	}

	namePkgs, err := g.UIDMapper.MapUIDsToUsernamePackages(ctx, g, userList, 0, 0, true)
	if err != nil {
		return res, err
	}

	getUser := func(uid keybase1.UID) (res libkb.UsernamePackage, err error) {
		num, ok := userSet[uid]
		if !ok {
			return res, fmt.Errorf("UID %q was not requested for uid mapping", uid)
		}
		return namePkgs[num], nil
	}

	res = make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite)

	for _, team := range teams {
		teamName := team.Name().String()
		invites := team.chain().inner.ActiveInvites
		for inviteID, invite := range invites {
			inviterPkg, err := getUser(invite.Inviter.Uid)
			if err != nil {
				g.Log.CDebugf(ctx, "| AnnotateAllInvites, while annotating: %v", err)
				continue
			}

			username := inviterPkg.NormalizedUsername

			name := invite.Name
			category, err := invite.Type.C()
			if err != nil {
				return res, err
			}
			var uv keybase1.UserVersion
			if category == keybase1.TeamInviteCategory_KEYBASE {
				// "keybase" invites (i.e. pukless users) have user version for name
				uv, err := invite.KeybaseUserVersion()
				if err != nil {
					// If this errors, it has also errored while gathering users. Skip logging here.
					continue
				}
				pkg, err := getUser(uv.Uid)
				if err != nil {
					// If this errors; same as above.
					continue
				}
				if pkg.FullName == nil {
					g.Log.CDebugf(ctx, "| Failed to get UsernamePackage.FullName for keybase invite for user %q uid %q\n", pkg.NormalizedUsername, uv.Uid)
					continue
				}
				if uv.EldestSeqno != pkg.FullName.EldestSeqno {
					// Not an error - user has just reset, they are not (invited) member anymore.
					continue
				}
				name = keybase1.TeamInviteName(pkg.NormalizedUsername)
			}
			res[inviteID] = keybase1.AnnotatedTeamInvite{
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
	}

	return res, err
}

func AnnotateInvites(ctx context.Context, g *libkb.GlobalContext, team *Team) (res map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, err error) {
	teams := make(map[keybase1.TeamID]*Team)
	teams[team.ID] = team
	return AnnotateAllInvites(ctx, g, teams)
}

// AnnotateInvitesUPAKLoader is a slow but reliable function to
// annotate invites in team. It uses UPAKLoader to fetch user
// for every invite.
func AnnotateInvitesUPAKLoader(ctx context.Context, g *libkb.GlobalContext, invites map[keybase1.TeamInviteID]keybase1.TeamInvite, teamName string) (map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, error) {
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
				continue
			}
			name = keybase1.TeamInviteName(up.Username)
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
