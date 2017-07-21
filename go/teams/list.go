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

func getTeamsListFromServer(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) ([]keybase1.MemberInfo, error) {
	a := libkb.NewAPIArg("team/for_user")
	a.NetContext = ctx
	a.SessionType = libkb.APISessionTypeREQUIRED
	if uid.Exists() {
		a.Args = libkb.HTTPArgs{
			"uid": libkb.S{Val: uid.String()},
		}
	}
	var list statusList
	if err := g.API.GetDecode(a, &list); err != nil {
		return nil, err
	}
	return list.Teams, nil
}

func List(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.TeamList, error) {
	var uid keybase1.UID
	if arg.UserAssertion != "" {
		res := g.Resolver.ResolveFullExpression(ctx, arg.UserAssertion)
		if res.GetError() != nil {
			return nil, res.GetError()
		}
		uid = res.GetUID()
	}

	list, err := getTeamsListFromServer(ctx, g, uid)
	if err != nil {
		return nil, err
	}

	if uid.IsNil() {
		uid = g.Env.GetUID()
	}

	// get user card for full name
	fullName, err := engine.GetFullName(context.Background(), g, uid)
	if err != nil {
		return nil, err
	}

	// and upak for username
	username, err := g.GetUPAKLoader().LookupUsername(context.Background(), uid)
	if err != nil {
		return nil, err
	}

	tl := keybase1.TeamList{
		Uid:      uid,
		Username: username.String(),
		FullName: fullName,
		Teams:    list,
	}
	return &tl, nil
}

func TeamTree(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamTreeArg) (res keybase1.TeamTreeResult, err error) {
	if !arg.Name.IsRootTeam() {
		return res, fmt.Errorf("cannot get tree of non-root team")
	}

	serverList, err := getTeamsListFromServer(ctx, g, "")
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
