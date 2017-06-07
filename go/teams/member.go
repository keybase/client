package teams

import (
	"errors"
	"fmt"

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
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Owners: []string{username}})
}

func SetRoleAdmin(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Admins: []string{username}})
}

func SetRoleWriter(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Writers: []string{username}})
}

func SetRoleReader(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Readers: []string{username}})
}

func AddMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) error {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return err
	}
	if t.IsMember(ctx, username) {
		return fmt.Errorf("user %q is already a member of team %q", username, teamname)
	}
	req, err := reqFromRole(username, role)
	if err != nil {
		return err
	}

	return t.ChangeMembership(ctx, req)
}

func EditMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) error {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return err
	}
	if !t.IsMember(ctx, username) {
		return fmt.Errorf("user %q is not a member of team %q", username, teamname)
	}
	existingRole, err := t.MemberRole(ctx, username)
	if err != nil {
		return err
	}
	if existingRole == role {
		return fmt.Errorf("user %q in team %q already has the role %s", username, teamname, role)
	}
	req, err := reqFromRole(username, role)
	if err != nil {
		return err
	}

	return t.ChangeMembership(ctx, req)
}

func MemberRole(ctx context.Context, g *libkb.GlobalContext, teamname, username string) (keybase1.TeamRole, error) {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	return t.MemberRole(ctx, username)
}

func RemoveMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return err
	}
	if !t.IsMember(ctx, username) {
		return libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username, teamname)}
	}
	req := keybase1.TeamChangeReq{None: []string{username}}
	return t.ChangeMembership(ctx, req)
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req keybase1.TeamChangeReq) error {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return err
	}
	return t.ChangeMembership(ctx, req)
}

func loadUserVersionByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (keybase1.UserVersion, error) {
	res := g.Resolver.ResolveWithBody(username)
	if res.GetError() != nil {
		return keybase1.UserVersion{}, res.GetError()
	}
	return loadUserVersionByUID(ctx, g, res.GetUID())
}

func loadUserVersionByUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (keybase1.UserVersion, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, g, uid)
	upak, _, err := g.GetUPAKLoader().Load(arg)
	if err != nil {
		return keybase1.UserVersion{}, err
	}

	return NewUserVersion(upak.Base.Username, upak.Base.EldestSeqno), nil
}

func reqFromRole(username string, role keybase1.TeamRole) (keybase1.TeamChangeReq, error) {
	var req keybase1.TeamChangeReq
	switch role {
	case keybase1.TeamRole_OWNER:
		req.Owners = []string{username}
	case keybase1.TeamRole_ADMIN:
		req.Admins = []string{username}
	case keybase1.TeamRole_WRITER:
		req.Writers = []string{username}
	case keybase1.TeamRole_READER:
		req.Readers = []string{username}
	default:
		return keybase1.TeamChangeReq{}, errors.New("invalid team role")
	}

	return req, nil
}
