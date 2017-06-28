package teams

import (
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

func List(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamListArg) (*keybase1.TeamList, error) {
	var uid keybase1.UID
	if arg.UserAssertion != "" {
		res := g.Resolver.ResolveFullExpression(ctx, arg.UserAssertion)
		if res.GetError() != nil {
			return nil, res.GetError()
		}
		uid = res.GetUID()
	}

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
		Teams:    list.Teams,
	}
	return &tl, nil
}
