package teams

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func membersUIDsToUsernames(ctx context.Context, g *libkb.GlobalContext, m keybase1.TeamMembers, forceRepoll bool) (keybase1.TeamMembersDetails, error) {
	var ret keybase1.TeamMembersDetails
	var err error
	ret.Owners, err = userVersionsToDetails(ctx, g, m.Owners, forceRepoll)
	if err != nil {
		return ret, err
	}
	ret.Admins, err = userVersionsToDetails(ctx, g, m.Admins, forceRepoll)
	if err != nil {
		return ret, err
	}
	ret.Writers, err = userVersionsToDetails(ctx, g, m.Writers, forceRepoll)
	if err != nil {
		return ret, err
	}
	ret.Readers, err = userVersionsToDetails(ctx, g, m.Readers, forceRepoll)
	if err != nil {
		return ret, err
	}
	return ret, nil
}

func Details(ctx context.Context, g *libkb.GlobalContext, name string, forceRepoll bool) (res keybase1.TeamDetails, err error) {
	t, err := GetForTeamManagementByStringName(ctx, g, name)
	if err != nil {
		return res, err
	}
	res.KeyGeneration = t.Generation()
	res.Members, err = members(ctx, g, t, forceRepoll)
	if err != nil {
		return res, err
	}
	return res, nil
}

func members(ctx context.Context, g *libkb.GlobalContext, t *Team, forceRepoll bool) (keybase1.TeamMembersDetails, error) {
	members, err := t.Members()
	if err != nil {
		return keybase1.TeamMembersDetails{}, err
	}
	return membersUIDsToUsernames(ctx, g, members, forceRepoll)
}

func userVersionToDetails(ctx context.Context, g *libkb.GlobalContext, uv keybase1.UserVersion, forceRepoll bool) (res keybase1.TeamMemberDetails, err error) {
	_, nun, err := loadMember(ctx, g, uv, forceRepoll)
	active := true
	if err != nil {
		if _, reset := err.(libkb.AccountResetError); reset {
			active = false
		} else {
			return res, err
		}
	}
	return keybase1.TeamMemberDetails{
		Uv:       uv,
		Username: nun.String(),
		Active:   active,
	}, nil
}

func userVersionsToDetails(ctx context.Context, g *libkb.GlobalContext, uvs []keybase1.UserVersion, forceRepoll bool) (ret []keybase1.TeamMemberDetails, err error) {
	for _, uv := range uvs {
		det, err := userVersionToDetails(ctx, g, uv, forceRepoll)
		if err != nil {
			return nil, err
		}
		ret = append(ret, det)
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
		if err == errInviteRequired {
			return inviteMember(ctx, g, t, username, role, uv)
		}
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

func inviteMember(ctx context.Context, g *libkb.GlobalContext, team *Team, username string, role keybase1.TeamRole, uv keybase1.UserVersion) error {
	return t.InviteMember(ctx, username, role, uv)
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

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithContext(ctx, g))
	if err != nil {
		return err
	}

	if me.GetNormalizedName().Eq(libkb.NewNormalizedUsername(username)) {
		return Leave(ctx, g, teamname, false)
	}
	req := keybase1.TeamChangeReq{None: []keybase1.UserVersion{uv}}
	return t.ChangeMembership(ctx, req)
}

func Leave(ctx context.Context, g *libkb.GlobalContext, teamname string, permanent bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
	if err != nil {
		return err
	}
	return t.Leave(ctx, permanent)
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req keybase1.TeamChangeReq) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname)
	if err != nil {
		return err
	}
	return t.ChangeMembership(ctx, req)
}

var errInviteRequired = errors.New("invite required for username")

func loadUserVersionByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (keybase1.UserVersion, error) {
	res := g.Resolver.ResolveWithBody(username)
	if res.GetError() != nil {
		if e, ok := res.GetError().(libkb.ResolutionError); ok && e.Kind == libkb.ResolutionErrorNotFound {
			// couldn't find a keybase user for username assertion
			return keybase1.UserVersion{}, errInviteRequired
		}
		return keybase1.UserVersion{}, res.GetError()
	}

	return loadUserVersionByUIDCheckUsername(ctx, g, res.GetUID(), username)
}

func loadUserVersionByUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (keybase1.UserVersion, error) {
	return loadUserVersionByUIDCheckUsername(ctx, g, uid, "")
}

func loadUserVersionByUIDCheckUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID, un string) (keybase1.UserVersion, error) {
	upak, err := loadUPAK2(ctx, g, uid, true /*forcePoll */)
	if err != nil {
		return keybase1.UserVersion{}, err
	}
	if un != "" && !libkb.NormalizedUsername(un).Eq(libkb.NormalizedUsername(upak.Current.Username)) {
		return keybase1.UserVersion{}, libkb.BadUsernameError{N: un}
	}

	if len(upak.Current.PerUserKeys) == 0 {
		return NewUserVersion(upak.Current.Uid, upak.Current.EldestSeqno), errInviteRequired
	}

	return NewUserVersion(upak.Current.Uid, upak.Current.EldestSeqno), nil
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
