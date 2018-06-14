package teams

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func GetTeamShowcase(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamShowcase, err error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
	if err != nil {
		return ret, err
	}

	arg := apiArg(ctx, "team/get")
	arg.Args.Add("id", libkb.S{Val: t.ID.String()})

	var rt rawTeam
	if err := g.API.GetDecode(arg, &rt); err != nil {
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

	arg := apiArg(ctx, "team/get")
	arg.Args.Add("id", libkb.S{Val: t.ID.String()})

	var teamRet rawTeam
	if err := g.API.GetDecode(arg, &teamRet); err != nil {
		return ret, err
	}
	ret.TeamShowcase = teamRet.Showcase

	// team/member_showcase endpoint is available either for
	// admins/owners, or for everyone if AnyMemberShowcase is set,
	// but this does not include implicit admins.
	if (teamRet.Showcase.AnyMemberShowcase && role != keybase1.TeamRole_NONE) || role.IsOrAbove(keybase1.TeamRole_ADMIN) {
		arg = apiArg(ctx, "team/member_showcase")
		arg.Args.Add("tid", libkb.S{Val: t.ID.String()})

		var memberRet memberShowcaseRes
		if err := g.API.GetDecode(arg, &memberRet); err != nil {
			if appErr, ok := err.(libkb.AppStatusError); ok &&
				appErr.Code == int(keybase1.StatusCode_SCTeamShowcasePermDenied) {
				// It is possible that we were still a member when
				// GetForTeamManagement* was called, but we are not a member
				// anymore, so `team/member_showcase` fails. Note that this
				// endpoint does not work for implicit admins, hence the role
				// checks before calling it - but if we have outdated team
				// information, we might still end up here not being allowed
				// to call it and getting this error.
				g.Log.CDebugf(ctx, "GetTeamAndMemberShowcase hit a race with team %q", teamname)
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

	arg := apiArg(ctx, "team/team_showcase")
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
	if _, err := g.API.Post(arg); err != nil {
		return err
	}
	t.notify(ctx, keybase1.TeamChangeSet{Misc: true})
	return nil
}

func SetTeamMemberShowcase(ctx context.Context, g *libkb.GlobalContext, teamname string, isShowcased bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
	if err != nil {
		return err
	}

	arg := apiArg(ctx, "team/member_showcase")
	arg.Args.Add("tid", libkb.S{Val: string(t.ID)})
	arg.Args.Add("is_showcased", libkb.B{Val: isShowcased})
	_, err = g.API.Post(arg)
	if err != nil {
		return err
	}

	// Clear usercard cache so when user goes to People tab,
	// fresh card will be loaded.
	u := g.ActiveDevice.UID()
	g.Log.CDebugf(ctx, "Clearing Card cache for %s", u)
	if err := g.CardCache().Delete(u); err != nil {
		g.Log.CDebugf(ctx, "Error in CardCache.Delete: %s", err)
	}
	g.UserChanged(u)
	return nil
}
