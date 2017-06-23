package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func membersUIDsToUsernames(ctx context.Context, g *libkb.GlobalContext, m keybase1.TeamMembers) (keybase1.TeamMembersUsernames, error) {
	var ret keybase1.TeamMembersUsernames
	var err error
	ret.Owners, err = userVersionsToUsernames(ctx, g, m.Owners)
	if err != nil {
		return ret, err
	}
	ret.Admins, err = userVersionsToUsernames(ctx, g, m.Admins)
	if err != nil {
		return ret, err
	}
	ret.Writers, err = userVersionsToUsernames(ctx, g, m.Writers)
	if err != nil {
		return ret, err
	}
	ret.Readers, err = userVersionsToUsernames(ctx, g, m.Readers)
	if err != nil {
		return ret, err
	}
	return ret, nil
}

func Members(ctx context.Context, g *libkb.GlobalContext, name string) (keybase1.TeamMembersUsernames, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, name)
	if err != nil {
		return keybase1.TeamMembersUsernames{}, err
	}
	members, err := t.Members()
	if err != nil {
		return keybase1.TeamMembersUsernames{}, err
	}
	return membersUIDsToUsernames(ctx, g, members)
}

func uidToUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	return g.GetUPAKLoader().LookupUsername(ctx, uid)
}

func userVersionsToUsernames(ctx context.Context, g *libkb.GlobalContext, uvs []keybase1.UserVersion) (ret []string, err error) {
	for _, uv := range uvs {
		un, err := uidToUsername(ctx, g, uv.Uid)
		if err != nil {
			return nil, err
		}
		ret = append(ret, string(un))
	}
	return ret, nil
}

func SetRoleOwner(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Owners: []keybase1.UserVersion{uv}})
}

func SetRoleAdmin(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Admins: []keybase1.UserVersion{uv}})
}

func SetRoleWriter(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Writers: []keybase1.UserVersion{uv}})
}

func SetRoleReader(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Readers: []keybase1.UserVersion{uv}})
}

func AddMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
	if err != nil {
		return err
	}
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	if t.IsMember(ctx, uv) {
		return fmt.Errorf("user %q is already a member of team %q", username, teamname)
	}
	req, err := reqFromRole(uv, role)
	if err != nil {
		return err
	}

	return t.ChangeMembership(ctx, req)
}

func EditMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
	if err != nil {
		return err
	}
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	if !t.IsMember(ctx, uv) {
		return fmt.Errorf("user %q is not a member of team %q", username, teamname)
	}
	existingRole, err := t.MemberRole(ctx, uv)
	if err != nil {
		return err
	}
	if existingRole == role {
		return fmt.Errorf("user %q in team %q already has the role %s", username, teamname, role)
	}

	req, err := reqFromRole(uv, role)
	if err != nil {
		return err
	}

	return t.ChangeMembership(ctx, req)
}

func MemberRole(ctx context.Context, g *libkb.GlobalContext, teamname, username string) (keybase1.TeamRole, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	return t.MemberRole(ctx, uv)
}

func RemoveMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
	if err != nil {
		return err
	}
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	if !t.IsMember(ctx, uv) {
		return libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username, teamname)}
	}
	req := keybase1.TeamChangeReq{None: []keybase1.UserVersion{uv}}
	return t.ChangeMembership(ctx, req)
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req keybase1.TeamChangeReq) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
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
	return loadUserVersionByUIDCheckUsername(ctx, g, res.GetUID(), username)
}

func loadUserVersionByUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (keybase1.UserVersion, error) {
	return loadUserVersionByUIDCheckUsername(ctx, g, uid, "")
}

func loadUserVersionByUIDCheckUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, un string) (keybase1.UserVersion, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, g, uid)
	upak, _, err := g.GetUPAKLoader().Load(arg)
	if err != nil {
		return keybase1.UserVersion{}, err
	}
	if un != "" && !libkb.NormalizedUsername(un).Eq(libkb.NormalizedUsername(upak.Base.Username)) {
		return keybase1.UserVersion{}, libkb.BadUsernameError{N: un}
	}

	return NewUserVersion(upak.Base.Uid, upak.Base.EldestSeqno), nil
}

func reqFromRole(uv keybase1.UserVersion, role keybase1.TeamRole) (keybase1.TeamChangeReq, error) {

	var req keybase1.TeamChangeReq
	list := []keybase1.UserVersion{uv}
	switch role {
	case keybase1.TeamRole_OWNER:
		req.Owners = list
	case keybase1.TeamRole_ADMIN:
		req.Admins = list
	case keybase1.TeamRole_WRITER:
		req.Writers = list
	case keybase1.TeamRole_READER:
		req.Readers = list
	default:
		return keybase1.TeamChangeReq{}, errors.New("invalid team role")
	}

	return req, nil
}

func makeIdentifyLiteRes(id keybase1.TeamID, name keybase1.TeamName) keybase1.IdentifyLiteRes {
	return keybase1.IdentifyLiteRes{
		Ul: keybase1.UserOrTeamLite{
			Id:   id.AsUserOrTeam(),
			Name: name.String(),
		},
	}
}

func identifyLiteByID(ctx context.Context, g *libkb.GlobalContext, utid keybase1.UserOrTeamID, id2 keybase1.TeamID) (res keybase1.IdentifyLiteRes, err error) {

	var id1 keybase1.TeamID
	id1, err = utid.AsTeam()
	if err != nil {
		return res, err
	}

	if id1.Exists() && id2.Exists() && !id1.Eq(id2) {
		return res, errors.New("two team IDs given that don't match")
	}
	if !id1.Exists() {
		id1 = id2
	}
	if !id1.Exists() {
		return res, errors.New("empty IDs given")
	}
	var name keybase1.TeamName
	name, err = ResolveIDToName(ctx, g, id1)
	if err != nil {
		return res, err
	}

	return makeIdentifyLiteRes(id1, name), nil
}

func identifyLiteByName(ctx context.Context, g *libkb.GlobalContext, name keybase1.TeamName) (res keybase1.IdentifyLiteRes, err error) {
	var id keybase1.TeamID
	id, err = ResolveNameToID(ctx, g, name)
	if err != nil {
		return res, err
	}
	return makeIdentifyLiteRes(id, name), nil
}

func IdentifyLite(ctx context.Context, g *libkb.GlobalContext, arg keybase1.IdentifyLiteArg, au libkb.AssertionURL) (res keybase1.IdentifyLiteRes, err error) {

	if arg.Id.Exists() || au.IsTeamID() {
		return identifyLiteByID(ctx, g, arg.Id, au.ToTeamID())
	}
	if au.IsTeamName() {
		return identifyLiteByName(ctx, g, au.ToTeamName())
	}
	err = errors.New("could not identify team by ID or name")
	return res, err
}
