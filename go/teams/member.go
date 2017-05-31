package teams

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func Members(ctx context.Context, g *libkb.GlobalContext, name string) (keybase1.TeamMembers, error) {
	t, err := Get(ctx, g, name)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	return t.Members()
}

func SetRoleOwner(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, ChangeReq{Owners: []string{username}})
}

func SetRoleAdmin(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, ChangeReq{Admins: []string{username}})
}

func SetRoleWriter(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, ChangeReq{Writers: []string{username}})
}

func SetRoleReader(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, ChangeReq{Readers: []string{username}})
}

func RemoveMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, ChangeReq{None: []string{username}})
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req ChangeReq) error {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return err
	}
	return t.ChangeMembership(ctx, req)
}

func loadUserVersionByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (UserVersion, error) {
	res := g.Resolver.ResolveWithBody(username)
	if res.GetError() != nil {
		return UserVersion{}, res.GetError()
	}
	return loadUserVersionByUID(ctx, g, res.GetUID())
}

func loadUserVersionByUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (UserVersion, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, g, uid)
	upak, _, err := g.GetUPAKLoader().Load(arg)
	if err != nil {
		return UserVersion{}, err
	}

	return NewUserVersion(upak.Base.Username, upak.Base.EldestSeqno), nil
}
