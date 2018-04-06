package teams

import (
	"fmt"
	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
	"time"
)

const (
	cacheSize = 10
	cacheLife = 10 * time.Second
)

func CanUserPerform(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamOperation, err error) {
	return g.GetTeamLoader().CanUserPerform(ctx, teamname)
}

func (l *TeamLoader) CanUserPerform(ctx context.Context, teamname string) (ret keybase1.TeamOperation, err error) {
	return l.canUserPerformLoader.load(ctx, teamname)
}

type canUserPerformLoader struct {
	libkb.Contextified
	// Single-flight locks per team name.
	// (Private and public loads of the same ID will block each other, should be fine)
	locktab libkb.LockTable
	lru     *lru.Cache
}

func newCanUserPerformLoader(g *libkb.GlobalContext) *canUserPerformLoader {
	lru, err := lru.New(cacheSize)
	if err != nil {
		g.Log.Fatalf("Bad LRU Constructor: %s", err.Error())
	}
	return &canUserPerformLoader{
		Contextified: libkb.NewContextified(g),
		lru:          lru,
	}
}

type teamOpsCacheObj struct {
	obj      keybase1.TeamOperation
	cachedAt time.Time
}

func (c *canUserPerformLoader) load(ctx context.Context, teamname string) (ret keybase1.TeamOperation, err error) {

	defer c.G().CVTrace(ctx, libkb.VLog0, fmt.Sprintf("canUserPerformLoader#load(%s)", teamname), func() error { return err })()

	lock := c.locktab.AcquireOnName(ctx, c.G(), teamname)
	defer lock.Release(ctx)

	c.G().VDL.CLogf(ctx, libkb.VLog0, "| past single-flight lock")

	found := false
	if val, ok := c.lru.Get(teamname); ok {
		c.G().VDL.CLogf(ctx, libkb.VLog0, "| found in LRU cache")
		if tmp, ok := val.(*teamOpsCacheObj); ok {
			age := c.G().GetClock().Now().Sub(tmp.cachedAt)
			if age < cacheLife {
				c.G().VDL.CLogf(ctx, libkb.VLog0, "| cached object was fresh (loaded %v ago)", age)
				ret = tmp.obj
				found = true
			} else {
				c.G().VDL.CLogf(ctx, libkb.VLog0, "| cached object expired %v ago", (age - cacheLife))
				c.lru.Remove(teamname)
			}
		} else {
			c.G().Log.CErrorf(ctx, "| object in LRU was of wrong type")
		}
	} else {
		c.G().VDL.CLogf(ctx, libkb.VLog0, "| object cache miss")
	}

	if !found {
		ret, err = canUserPerform(ctx, c.G(), teamname)
		if err == nil {
			c.G().VDL.CLogf(ctx, libkb.VLog0, "| caching object after successful fetch")
			c.lru.Add(teamname, &teamOpsCacheObj{ret, c.G().GetClock().Now()})
		}
	}

	return ret, err
}

func canUserPerform(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamOperation, err error) {

	defer g.CTrace(ctx, fmt.Sprintf("canUserPerform(%s)", teamname), func() error { return err })()

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:    teamname,
		StaleOK: true,
		Public:  false, // assume private team
	})
	if err != nil {
		// Note: we eat the error here, assuming it meant this user
		// is not a member
		g.Log.CWarningf(ctx, "CanUserPerform team Load failure, continuing: %v)", err)
		return ret, nil
	}
	meUV, err := team.currentUserUV(ctx)
	if err != nil {
		return ret, err
	}

	isImplicitAdmin := func() (bool, error) {
		if team.ID.IsRootTeam() {
			return false, nil
		}
		uvs, err := g.GetTeamLoader().ImplicitAdmins(ctx, team.ID)
		if err != nil {
			return false, err
		}
		for _, uv := range uvs {
			if uv == meUV {
				return true, nil
			}
		}
		return false, nil
	}

	teamRole, err := team.MemberRole(ctx, meUV)
	if err != nil {
		return ret, err
	}

	isRoleOrAbove := func(role keybase1.TeamRole) bool {
		return teamRole.IsOrAbove(role)
	}

	isWriter := func() bool {
		return isRoleOrAbove(keybase1.TeamRole_WRITER)
	}

	canMemberShowcase := func() (bool, error) {
		if err != nil {
			return false, err
		}
		if teamRole.IsOrAbove(keybase1.TeamRole_ADMIN) {
			return true, nil
		} else if teamRole == keybase1.TeamRole_NONE {
			return false, nil
		}
		showcase, err := GetTeamShowcase(ctx, g, teamname)
		if err != nil {
			return false, err
		}
		return showcase.AnyMemberShowcase, nil
	}

	hasOtherOwner := func() (bool, error) {
		owners, err := team.UsersWithRole(keybase1.TeamRole_OWNER)
		if err != nil {
			return false, err
		}
		if len(owners) > 1 {
			return true, nil
		}
		for _, owner := range owners {
			if owner == meUV {
				g.Log.CDebugf(ctx, "hasOtherOwner: I am the sole owner")
				return false, nil
			}
		}
		return true, nil
	}

	var implicitAdmin bool
	implicitAdmin, err = isImplicitAdmin()
	if err != nil {
		return ret, err
	}
	var admin bool
	admin = isRoleOrAbove(keybase1.TeamRole_ADMIN)

	ret.ManageMembers = admin || implicitAdmin
	ret.ManageSubteams = admin || implicitAdmin
	ret.SetTeamShowcase = admin || implicitAdmin
	ret.ChangeOpenTeam = admin || implicitAdmin
	ret.ChangeTarsDisabled = admin || implicitAdmin

	ret.ListFirst = implicitAdmin
	ret.JoinTeam = teamRole == keybase1.TeamRole_NONE && implicitAdmin
	ret.SetPublicityAny = admin || implicitAdmin

	if teamRole != keybase1.TeamRole_NONE {
		leaveTeam := true
		if teamRole == keybase1.TeamRole_OWNER {
			leaveTeam, err = hasOtherOwner()
			if err != nil {
				return ret, err
			}
		}
		ret.LeaveTeam = leaveTeam
	}

	writer := isWriter()
	ret.CreateChannel = writer

	ret.SetMemberShowcase, err = canMemberShowcase()
	if err != nil {
		return ret, err
	}

	ret.DeleteChannel = admin
	ret.RenameChannel = writer
	ret.EditChannelDescription = writer
	ret.DeleteChatHistory = admin
	ret.SetRetentionPolicy = admin
	ret.Chat = isRoleOrAbove(keybase1.TeamRole_READER)

	return ret, err
}
