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

	tracer.Stage("server")
	teams, err := getTeamsListFromServer(ctx, g, queryUID, arg.All)
	if err != nil {
		return nil, err
	}

	tracer.Stage("loads")

	var resLock sync.Mutex
	res := &keybase1.AnnotatedTeamList{
		Teams: nil,
		AnnotatedActiveInvites: make(map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite),
	}

	// Process all the teams in parallel. Limit to 15 in parallel so we don't crush the server.
	// errgroup collects errors and returns the first non-nil.
	// subctx is canceled when the group finishes.
	const parallelLimit int64 = 15
	sem := semaphore.NewWeighted(parallelLimit)
	group, subctx := errgroup.WithContext(ctx)
	for _, memberInfo := range teams {
		memberInfo := memberInfo // https://golang.org/doc/faq#closures_and_goroutines
		group.Go(func() error {
			// Grab one of the parallelLimit slots
			err := sem.Acquire(subctx, 1)
			if err != nil {
				return err
			}
			defer sem.Release(1)

			// Skip implicit teams unless --include-implicit-teams was passed from above.
			if memberInfo.IsImplicitTeam && !arg.IncludeImplicitTeams {
				return nil
			}

			var isAdminSaysServer bool
			if memberInfo.UserID == meUID &&
				(memberInfo.Role.IsAdminOrAbove() || (memberInfo.Implicit != nil && memberInfo.Implicit.Role.IsAdminOrAbove())) {

				isAdminSaysServer = true
			}

			memberUID := memberInfo.UserID

			username, err := g.GetUPAKLoader().LookupUsername(context.Background(), memberUID)
			if err != nil {
				return err
			}
			fullName, err := engine.GetFullName(context.Background(), g, memberUID)
			if err != nil {
				return err
			}

			type AnnotatedTeamInviteMap map[keybase1.TeamInviteID]keybase1.AnnotatedTeamInvite

			loadTeamForAMI := func(force bool) (anMemberInfo *keybase1.AnnotatedMemberInfo, anInvites AnnotatedTeamInviteMap,
				retry bool, err error) {

				g.Log.CDebugf(subctx, "TeamList loading(%v, force=%v)", memberInfo.TeamID, force)

				team, err := Load(subctx, g, keybase1.LoadTeamArg{
					ID:          memberInfo.TeamID,
					NeedAdmin:   isAdminSaysServer,
					ForceRepoll: force,
				})
				if err != nil {
					return nil, nil, false, err
				}

				role := keybase1.TeamRole_NONE
				if memberInfo.Role != keybase1.TeamRole_NONE {
					memberUV, err := team.chain().GetLatestUVWithUID(memberUID)
					if err != nil {
						// retryable because the role of this member might have changed since cache hit
						return nil, nil, true, fmt.Errorf("did not find %v (for role %v)", username, memberInfo.Role)
					}
					role, err = team.chain().GetUserRole(memberUV)
					if err != nil {
						return nil, nil, false, err
					}
				}
				if role != memberInfo.Role {
					return nil, nil, true, fmt.Errorf("got unexpected role: %v", role.String())
				}

				anMemberInfo = &keybase1.AnnotatedMemberInfo{
					TeamID:         team.ID,
					FqName:         team.Name().String(),
					UserID:         memberUID,
					Role:           role,
					IsImplicitTeam: team.IsImplicit(),
					Implicit:       memberInfo.Implicit, // This part is still server trust
					Username:       username.String(),
					FullName:       fullName,
				}

				anInvites = make(AnnotatedTeamInviteMap)
				if isAdminSaysServer {
					anInvites, err = AnnotateInvites(subctx, g, team.chain().inner.ActiveInvites, team.Name().String())
					if err != nil {
						return nil, nil, false, err
					}
				}

				return anMemberInfo, anInvites, false, nil
			}

			var anMemberInfo *keybase1.AnnotatedMemberInfo
			var anInvites AnnotatedTeamInviteMap

			// Load the team in order to use local data instead of server-trust for fields.
			// Try once without ForceRepoll and then once with. In case the cache is stale.
			// This could be simpler and faster if the server returned the latest seqno as a hint.
			anMemberInfo, anInvites, retry, err := loadTeamForAMI(false)
			if err != nil {
				if retry {
					anMemberInfo, anInvites, retry, err = loadTeamForAMI(false)
				}
			}
			if err != nil {
				g.Log.Warning("Error while getting team (%s): %v", memberInfo.FqName, err)
				return nil
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

	if len(res.Teams) == 0 && len(teams) > 0 {
		return res, fmt.Errorf("multiple errors while loading team list")
	}

	return res, err
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
		if category == keybase1.TeamInviteCategory_KEYBASE {
			// "keybase" invites (i.e. pukless users) have user version for name
			uv, err := invite.KeybaseUserVersion()
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
