package teams

import (
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// needAdmin must be set when interacting with links that have a possibility of being stubbed.
func GetForTeamManagementByStringName(ctx context.Context, g *libkb.GlobalContext, name string, needAdmin bool) (*Team, error) {
	// assume private team
	public := false

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		Public:      public,
		ForceRepoll: true,
		NeedAdmin:   needAdmin,
	})
	if err != nil {
		return nil, fixupTeamGetError(ctx, g, err, name, public)
	}
	if team.IsImplicit() {
		return nil, fmt.Errorf("cannot manage implicit team by name")
	}

	return team, nil
}

func GetForDisplayByStringName(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	// assume private team
	public := false

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:                      name,
		Public:                    public,
		ForceRepoll:               true,
		AllowNameLookupBurstCache: true,
	})
	if err != nil {
		return nil, fixupTeamGetError(ctx, g, err, name, public)
	}
	if team.IsImplicit() {
		return nil, fmt.Errorf("cannot display implicit team by name")
	}
	return team, nil
}

func GetForTeamManagementByTeamID(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, needAdmin bool) (*Team, error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          id,
		Public:      id.IsPublic(), // infer publicness from team id
		ForceRepoll: true,
		NeedAdmin:   needAdmin,
	})
	return team, fixupTeamGetError(ctx, g, err, id.String(), id.IsPublic())
}

func GetTeamByNameForTest(ctx context.Context, g *libkb.GlobalContext, name string, public bool, needAdmin bool) (*Team, error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:        name,
		Public:      public,
		ForceRepoll: true,
		NeedAdmin:   needAdmin,
	})
	return team, fixupTeamGetError(ctx, g, err, name, public)
}

// Get a team with no stubbed links if we are an admin. Use this instead of NeedAdmin when you don't
// know whether you are an admin. This always causes roundtrips. Doesn't work for implicit admins.
func GetMaybeAdminByStringName(ctx context.Context, g *libkb.GlobalContext, name string, public bool) (*Team, error) {
	// Find out our up-to-date role.
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:                      name,
		Public:                    public,
		ForceRepoll:               true,
		RefreshUIDMapper:          true,
		AllowNameLookupBurstCache: true,
	})
	if err != nil {
		return nil, fixupTeamGetError(ctx, g, err, name, public)
	}
	me, err := loadUserVersionByUID(ctx, g, g.Env.GetUID())
	if err != nil {
		return nil, err
	}
	role, err := team.MemberRole(ctx, me)
	if err != nil {
		return nil, err
	}
	if role.IsAdminOrAbove() {
		// Will hit the cache _unless_ we had a cached non-admin team
		// and are now an admin.
		team, err = Load(ctx, g, keybase1.LoadTeamArg{
			Name:                      name,
			Public:                    public,
			NeedAdmin:                 true,
			AllowNameLookupBurstCache: true,
		})
		if err != nil {
			return nil, err
		}
	}
	return team, nil
}
