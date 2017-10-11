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
func verifyMemberRoleInTeam(ctx context.Context, member keybase1.MemberInfo, team *Team) (expected bool, err error) {
	if member.Role == keybase1.TeamRole_NONE {
		return true, nil
	}

	memberUV, err := team.chain().GetLatestUVWithUID(member.UserID)
	if err != nil {
		return false, err
	}
	role, err := team.chain().GetUserRole(memberUV)
	if err != nil {
		return false, err
	}
	if role != member.Role {
		return false, fmt.Errorf("unexpected member role: got %v but actual role is %v", member.Role, role)
	}
	return true, nil
}

// getTeamForMember tries to load team in a recent enough state to
// contain member with correct role as set in MemberInfo. It might
// trigger a reload with ForceRepoll if cached state does not match.
func getTeamForMember(ctx context.Context, g *libkb.GlobalContext, member keybase1.MemberInfo, needAdmin bool) (*Team, error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          member.TeamID,
		NeedAdmin:   needAdmin,
		ForceRepoll: false,
	})
	if err != nil {
		return nil, err
	}

	expectedRole, _ := verifyMemberRoleInTeam(ctx, member, team)
	if !expectedRole {
		team, err = Load(ctx, g, keybase1.LoadTeamArg{
			ID:          member.TeamID,
			NeedAdmin:   needAdmin,
			ForceRepoll: true,
		})
		if err != nil {
			return nil, err
		}

		_, err := verifyMemberRoleInTeam(ctx, member, team)
		if err != nil {
			return nil, fmt.Errorf("server was wrong about role in team : %v", err)
		}
	}

	return team, nil
}

func getUserAndFullName(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (username libkb.NormalizedUsername, fullName string, err error) {
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
	queryUsername, queryFullName, err := getUserAndFullName(context.Background(), g, queryUID)
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

	// Process all the teams in parallel. Limit to 15 in parallel so
	// we don't crush the server. errgroup collects errors and returns
	// the first non-nil. subctx is canceled when the group finishes.
	var resLock sync.Mutex
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
			} else {
				username, fullName, err = getUserAndFullName(context.Background(), g, memberUID)
				if err != nil {
					return err
				}
			}

			serverSaysNeedAdmin := memberNeedAdmin(memberInfo, meUID)
			team, err := getTeamForMember(subctx, g, memberInfo, serverSaysNeedAdmin)
			if err != nil {
				g.Log.CDebugf(subctx, "| Error in getTeamForMember: %v", err)
				return err
			}

			type AnnotatedTeamInviteMap map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite
			var anMemberInfo *keybase1.AnnotatedMemberInfo
			var anInvites AnnotatedTeamInviteMap

			anMemberInfo = &keybase1.AnnotatedMemberInfo{
				TeamID:         team.ID,
				FqName:         team.Name().String(),
				UserID:         memberInfo.UserID,
				Role:           memberInfo.Role, // memberInfo.Role has been verified during getTeamForMember
				IsImplicitTeam: team.IsImplicit(),
				Implicit:       memberInfo.Implicit, // This part is still server trust
				Username:       username.String(),
				FullName:       fullName,
			}

			anInvites = make(AnnotatedTeamInviteMap)
			if serverSaysNeedAdmin {
				anInvites, err = AnnotateInvites(subctx, g, team.chain().inner.ActiveInvites, team.Name().String())
				if err != nil {
					return err
				}
			}

			// After this lock it is safe to write out results
			resLock.Lock()
			defer resLock.Unlock()

			res.Teams = append(res.Teams, *anMemberInfo)
			for teamInviteID, annotatedTeamInvite := range anInvites {
				res.AnnotatedActiveInvites[teamInviteID] = annotatedTeamInvite
			}

			return nil
		})
	}

	err = group.Wait()

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

func AnnotateInvites(ctx context.Context, g *libkb.GlobalContext, invites map[keybase1.TeamInviteID]keybase1.TeamInvite, teamName string) (map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite, error) {

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
