package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func GetTeamShowcase(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamShowcase, err error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{Name: teamname})
	if err != nil {
		return ret, fixupTeamGetError(ctx, g, err, teamname, false)
	}
	if team.IsImplicit() {
		return ret, fmt.Errorf("cannot manage implicit team by name")
	}
	return GetTeamShowcaseByID(ctx, g, team.ID)
}

func GetTeamShowcaseByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (ret keybase1.TeamShowcase, err error) {
	arg := apiArg("team/get")
	arg.Args.Add("id", libkb.S{Val: teamID.String()})

	var rt rawTeam
	mctx := libkb.NewMetaContext(ctx, g)
	if err := mctx.G().API.GetDecode(mctx, arg, &rt); err != nil {
		return ret, err
	}
	return rt.Showcase, nil
}

type memberShowcaseRes struct {
	Status      libkb.AppStatus `json:"status"`
	IsShowcased bool            `json:"is_showcased"`
}

func (c *memberShowcaseRes) GetAppStatus() *libkb.AppStatus {
	return &c.Status
}

func GetTeamAndMemberShowcase(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamAndMemberShowcase, err error) {
	t, err := GetForDisplayByStringName(ctx, g, teamname)
	if err != nil {
		return ret, err
	}

	role, err := t.myRole(ctx)
	if err != nil {
		return ret, err
	}

	arg := apiArg("team/get")
	arg.Args.Add("id", libkb.S{Val: t.ID.String()})

	var teamRet rawTeam
	mctx := libkb.NewMetaContext(ctx, g)
	if err := mctx.G().API.GetDecode(mctx, arg, &teamRet); err != nil {
		return ret, err
	}
	ret.TeamShowcase = teamRet.Showcase

	// team/member_showcase endpoint is available either for
	// admins/owners, or for everyone if AnyMemberShowcase is set,
	// but this does not include implicit admins.
	if (teamRet.Showcase.AnyMemberShowcase && role != keybase1.TeamRole_NONE) || role.IsOrAbove(keybase1.TeamRole_ADMIN) {
		arg = apiArg("team/member_showcase")
		arg.Args.Add("tid", libkb.S{Val: t.ID.String()})

		var memberRet memberShowcaseRes
		if err := mctx.G().API.GetDecode(mctx, arg, &memberRet); err != nil {
			if appErr, ok := err.(libkb.AppStatusError); ok &&
				appErr.Code == int(keybase1.StatusCode_SCTeamShowcasePermDenied) {
				// It is possible that we were still a member when
				// GetForTeamManagement* was called, but we are not a member
				// anymore, so `team/member_showcase` fails. Note that this
				// endpoint does not work for implicit admins, hence the role
				// checks before calling it - but if we have outdated team
				// information, we might still end up here not being allowed
				// to call it and getting this error.
				mctx.Debug("GetTeamAndMemberShowcase hit a race with team %q", teamname)
				return ret, nil
			}

			return ret, err
		}

		ret.IsMemberShowcased = memberRet.IsShowcased
	}

	return ret, nil
}

func SetTeamShowcase(ctx context.Context, g *libkb.GlobalContext, teamname string, isShowcased *bool, description *string, anyMemberShowcase *bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	if isShowcased == nil && description == nil && anyMemberShowcase == nil {
		return errors.New("at least one argument has to be non-nil")
	}

	arg := apiArg("team/team_showcase")
	arg.Args.Add("tid", libkb.S{Val: string(t.ID)})
	if isShowcased != nil {
		arg.Args.Add("is_showcased", libkb.B{Val: *isShowcased})
	}
	if description != nil {
		if len(*description) > 0 {
			arg.Args.Add("description", libkb.S{Val: *description})
		} else {
			arg.Args.Add("clear_description", libkb.B{Val: true})
		}
	}
	if anyMemberShowcase != nil {
		arg.Args.Add("any_member_showcase", libkb.B{Val: *anyMemberShowcase})
	}
	mctx := libkb.NewMetaContext(ctx, g)
	if _, err := mctx.G().API.Post(mctx, arg); err != nil {
		return err
	}
	t.notifyNoChainChange(ctx, keybase1.TeamChangeSet{Misc: true})
	return nil
}

func SetTeamMemberShowcase(ctx context.Context, g *libkb.GlobalContext, teamname string, isShowcased bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
	if err != nil {
		return err
	}

	mctx := libkb.NewMetaContext(ctx, g)
	arg := apiArg("team/member_showcase")
	arg.Args.Add("tid", libkb.S{Val: string(t.ID)})
	arg.Args.Add("is_showcased", libkb.B{Val: isShowcased})
	_, err = mctx.G().API.Post(mctx, arg)
	if err != nil {
		return err
	}

	// Clear usercard cache so when user goes to People tab,
	// fresh card will be loaded.
	u := g.ActiveDevice.UID()
	mctx.Debug("Clearing Card cache for %s", u)
	if err := g.CardCache().Delete(u); err != nil {
		mctx.Debug("Error in CardCache.Delete: %s", err)
	}
	g.UserChanged(ctx, u)
	return nil
}
