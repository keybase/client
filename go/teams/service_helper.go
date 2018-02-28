package teams

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func LoadTeamPlusApplicationKeys(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID,
	application keybase1.TeamApplication, refreshers keybase1.TeamRefreshers) (res keybase1.TeamPlusApplicationKeys, err error) {

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:         id,
		Public:     id.IsPublic(), // infer publicness from id
		Refreshers: refreshers,
	})
	if err != nil {
		return res, err
	}
	return team.ExportToTeamPlusApplicationKeys(ctx, keybase1.Time(0), application)
}

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
	tracer := g.CTimeTracer(ctx, "TeamDetails", true)
	defer tracer.Finish()

	// Assume private team
	public := false

	tracer.Stage("load team")
	t, err := GetMaybeAdminByStringName(ctx, g, name, public)
	if err != nil {
		return res, err
	}
	res.KeyGeneration = t.Generation()
	tracer.Stage("members")
	res.Members, err = members(ctx, g, t, forceRepoll)
	if err != nil {
		return res, err
	}

	tracer.Stage("invites")
	annotatedInvites, err := AnnotateInvitesUIDMapper(ctx, g, t, &res.Members)
	if err != nil {
		return res, err
	}
	res.AnnotatedActiveInvites = annotatedInvites

	res.Settings.Open = t.IsOpen()
	res.Settings.JoinAs = t.chain().inner.OpenTeamJoinAs
	return res, nil
}

// List all the admins of ancestor teams.
// Includes admins of the specified team only if they are also admins of ancestor teams.
func ImplicitAdmins(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (res []keybase1.TeamMemberDetails, err error) {
	defer g.CTraceTimed(ctx, fmt.Sprintf("teams::ImplicitAdmins(%v)", teamID), func() error { return err })()
	if teamID.IsRootTeam() {
		// Root teams have only explicit admins.
		return nil, nil
	}
	uvs, err := g.GetTeamLoader().ImplicitAdmins(ctx, teamID)
	if err != nil {
		return nil, err
	}

	return userVersionsToDetails(ctx, g, uvs, true /* forceRepoll */)
}

func members(ctx context.Context, g *libkb.GlobalContext, t *Team, forceRepoll bool) (keybase1.TeamMembersDetails, error) {
	members, err := t.Members()
	if err != nil {
		return keybase1.TeamMembersDetails{}, err
	}
	return membersUIDsToUsernames(ctx, g, members, forceRepoll)
}

func userVersionsToDetails(ctx context.Context, g *libkb.GlobalContext, uvs []keybase1.UserVersion, forceRepoll bool) (ret []keybase1.TeamMemberDetails, err error) {
	uids := make([]keybase1.UID, len(uvs), len(uvs))
	for i, uv := range uvs {
		uids[i] = uv.Uid
	}
	packages, err := g.UIDMapper.MapUIDsToUsernamePackages(ctx, g, uids, 10*time.Minute, 0, true)
	if err != nil {
		return nil, err
	}

	ret = make([]keybase1.TeamMemberDetails, len(uvs), len(uvs))

	for i, uv := range uvs {
		pkg := packages[i]
		active := true
		var fullName keybase1.FullName
		if pkg.FullName != nil {
			if pkg.FullName.EldestSeqno != uv.EldestSeqno {
				active = false
			}
			fullName = pkg.FullName.FullName
		}
		ret[i] = keybase1.TeamMemberDetails{
			Uv:       uvs[i],
			Username: pkg.NormalizedUsername.String(),
			FullName: fullName,
			Active:   active,
		}
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

func getUserProofs(ctx context.Context, g *libkb.GlobalContext, username string) (*libkb.ProofSet, error) {
	arg := keybase1.Identify2Arg{
		UserAssertion:    username,
		UseDelegateUI:    false,
		Reason:           keybase1.IdentifyReason{Reason: "clear invitation when adding team member"},
		CanSuppressUI:    true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
		NeedProofSet:     true,
	}
	eng := engine.NewResolveThenIdentify2(g, &arg)
	ectx := &engine.Context{
		NetContext: ctx,
	}
	if err := engine.RunEngine(eng, ectx); err != nil {
		return nil, err
	}
	return eng.GetProofSet(), nil
}

func AddMemberByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, username string, role keybase1.TeamRole) (res keybase1.TeamAddMemberResult, err error) {
	var inviteRequired bool
	resolvedUsername, uv, err := loadUserVersionPlusByUsername(ctx, g, username)
	g.Log.CDebugf(ctx, "team.AddMember: loadUserVersionPlusByUsername(%s) -> (%s, %v, %v)", username, resolvedUsername, uv, err)
	if err != nil {
		if err == errInviteRequired {
			inviteRequired = true
		} else if _, ok := err.(libkb.NotFoundError); ok {
			return keybase1.TeamAddMemberResult{}, libkb.NotFoundError{
				Msg: fmt.Sprintf("User not found: %v", username),
			}
		} else {
			return keybase1.TeamAddMemberResult{}, err
		}
	}

	err = RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true /*needAdmin*/)
		if err != nil {
			return err
		}

		if inviteRequired && !uv.Uid.Exists() {
			// Handle social invites without transactions.
			res, err = t.InviteMember(ctx, username, role, resolvedUsername, uv)
			return err
		}

		tx := CreateAddMemberTx(t)
		err = tx.AddMemberByUsername(ctx, resolvedUsername.String(), role)
		if err != nil {
			return err
		}

		timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 2*time.Second)
		if err := tx.CompleteSocialInvitesFor(timeoutCtx, uv, username); err != nil {
			g.Log.CWarningf(ctx, "Failed in CompleteSocialInvitesFor, no invites will be cleared. Err was: %v", err)
		}
		timeoutCancel()

		err = tx.Post(ctx)
		if err != nil {
			return err
		}

		// return value assign to escape closure
		res = keybase1.TeamAddMemberResult{
			User:    &keybase1.User{Uid: uv.Uid, Username: resolvedUsername.String()},
			Invited: inviteRequired,
		}
		return nil
	})
	return res, err
}

func AddMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) (res keybase1.TeamAddMemberResult, err error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name: teamname,
	})
	if err != nil {
		return res, err
	}
	return AddMemberByID(ctx, g, team.ID, username, role)
}

func ReAddMemberAfterReset(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	username string) error {
	arg := libkb.NewLoadUserArg(g).
		WithNetContext(ctx).
		WithName(username).
		WithPublicKeyOptional().
		WithForcePoll(true)
	upak, _, err := g.GetUPAKLoader().LoadV2(arg)
	if err != nil {
		return err
	}
	uv := upak.Current.ToUserVersion()
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
		if err != nil {
			return err
		}

		var existingRole keybase1.TeamRole
		existingUV, err := t.UserVersionByUID(ctx, uv.Uid)
		if err == nil {
			// User is existing crypto member - get their current role.
			role, err := t.MemberRole(ctx, existingUV)
			if err != nil {
				return err
			}
			existingRole = role
		} else {
			// UV not found - look for invites.
			invite, foundUV, found := t.FindActiveKeybaseInvite(uv.Uid)
			if !found {
				// username is neither crypto UV nor keybase invite in
				// that team. bail out.
				return libkb.NotFoundError{Msg: fmt.Sprintf("User %q (%s) is not a member of this team.",
					username, uv.Uid)}
			}

			existingRole = invite.Role
			existingUV = foundUV
		}

		if existingUV.EldestSeqno == uv.EldestSeqno {
			return libkb.ExistsError{
				Msg: fmt.Sprintf("user %s has not reset, no need to re-add, existing: %v new: %v",
					username, existingUV.EldestSeqno, uv.EldestSeqno),
			}
		}

		hasPUK := len(upak.Current.PerUserKeys) > 0

		tx := CreateAddMemberTx(t)
		if err := tx.ReAddMemberToImplicitTeam(ctx, uv, hasPUK, existingRole); err != nil {
			return err
		}

		return tx.Post(ctx)
	})
}

func InviteEmailMember(ctx context.Context, g *libkb.GlobalContext, teamname, email string, role keybase1.TeamRole) error {
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
		if err != nil {
			return err
		}

		return t.InviteEmailMember(ctx, email, role)
	})
}

func AddEmailsBulk(ctx context.Context, g *libkb.GlobalContext, teamname, emails string, role keybase1.TeamRole) (resOuter keybase1.BulkRes, err error) {
	emailList := splitBulk(emails)
	g.Log.CDebugf(ctx, "team %s: bulk email invite count: %d", teamname, len(emailList))

	err = RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		var res keybase1.BulkRes

		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
		if err != nil {
			return err
		}

		var invites []SCTeamInvite
		for _, email := range emailList {
			addr, err := mail.ParseAddress(email)
			if err != nil {
				g.Log.CDebugf(ctx, "team %s: skipping malformed email %q: %s", teamname, email, err)
				res.Malformed = append(res.Malformed, email)
				continue
			}
			name := keybase1.TeamInviteName(addr.Address)
			existing, err := t.HasActiveInvite(name, "email")
			if err != nil {
				return err
			}
			if existing {
				g.Log.CDebugf(ctx, "team %s: invite for %s already exists, omitting from invite list",
					teamname, name)
				res.AlreadyInvited = append(res.AlreadyInvited, addr.Address)
				continue
			}
			inv := SCTeamInvite{
				Type: "email",
				Name: name,
				ID:   NewInviteID(),
			}
			invites = append(invites, inv)
			res.Invited = append(res.Invited, addr.Address)
		}
		if len(invites) == 0 {
			g.Log.CDebugf(ctx, "team %s: after exisitng filter, no one to invite", teamname)
			// return value assign to escape closure
			resOuter = res
			return nil
		}

		var teamInvites SCTeamInvites
		switch role {
		case keybase1.TeamRole_ADMIN:
			teamInvites.Admins = &invites
		case keybase1.TeamRole_WRITER:
			teamInvites.Writers = &invites
		case keybase1.TeamRole_READER:
			teamInvites.Readers = &invites
		case keybase1.TeamRole_OWNER:
			teamInvites.Owners = &invites
		default:
			return fmt.Errorf("unknown team role: %s", role)
		}

		g.Log.CDebugf(ctx, "team %s: after exisitng filter, inviting %d emails as %s", teamname, len(invites), role)
		err = t.postTeamInvites(ctx, teamInvites)
		if err != nil {
			return err
		}
		// return value assign to escape closure
		resOuter = res
		return nil
	})
	return resOuter, err
}

func EditMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) error {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err == errInviteRequired {
		g.Log.CDebugf(ctx, "team %s: edit member %s, member is an invite link", teamname, username)
		return editMemberInvite(ctx, g, teamname, username, role, uv)
	}
	if err != nil {
		return err
	}

	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
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
			g.Log.CDebugf(ctx, "bailing out, role given is the same as current")
			return nil
		}

		req, err := reqFromRole(uv, role)
		if err != nil {
			return err
		}

		return t.ChangeMembership(ctx, req)
	})
}

func editMemberInvite(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole, uv keybase1.UserVersion) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	// Note that there could be a problem if removeMemberInvite works but AddMember doesn't
	// as the original invite will be lost.  But the user will get an error and can try
	// again.
	if err := removeMemberInvite(ctx, g, t, username, uv); err != nil {
		g.Log.CDebugf(ctx, "editMemberInvite error in removeMemberInvite: %s", err)
		return err
	}
	// use AddMember in case it's possible to add them directly now
	if _, err := AddMember(ctx, g, teamname, username, role); err != nil {
		g.Log.CDebugf(ctx, "editMemberInvite error in AddMember: %s", err)
		return err
	}
	return nil
}

func MemberRole(ctx context.Context, g *libkb.GlobalContext, teamname, username string) (role keybase1.TeamRole, err error) {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}

	err = RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
		if err != nil {
			return err
		}
		// return value assign to escape closure
		role, err = t.MemberRole(ctx, uv)
		return err
	})
	return role, err
}

func RemoveMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {

	var inviteRequired bool
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		switch err {
		case errInviteRequired:
			inviteRequired = true
		case errUserDeleted: // no-op
		default:
			return err
		}
		g.Log.CDebugf(ctx, "loadUserVersionByUsername(%s) returned %v,%q", username, uv, err)
		err = nil
	}

	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
		if err != nil {
			return err
		}

		if inviteRequired && !uv.Uid.Exists() {
			// This branch only handles social invites. Keybase-type
			// invites are handled by next removeMemberInvite call below.
			return removeMemberInvite(ctx, g, t, username, uv)
		}

		existingUV, err := t.UserVersionByUID(ctx, uv.Uid)
		if err != nil {
			// Try to remove as an invite
			if ierr := removeMemberInvite(ctx, g, t, username, uv); ierr == nil {
				return nil
			}
			return libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username,
				teamname)}
		}

		me, err := libkb.LoadMe(libkb.NewLoadUserArgWithContext(ctx, g))
		if err != nil {
			return err
		}

		if me.GetNormalizedName().Eq(libkb.NewNormalizedUsername(username)) {
			return Leave(ctx, g, teamname, false)
		}
		req := keybase1.TeamChangeReq{None: []keybase1.UserVersion{existingUV}}

		// Ban for open teams only.
		permanent := t.IsOpen()
		return t.ChangeMembershipPermanent(ctx, req, permanent)
	})
}

func CancelEmailInvite(ctx context.Context, g *libkb.GlobalContext, teamname, email string) error {
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
		if err != nil {
			return err
		}

		if !libkb.CheckEmail.F(email) {
			return errors.New("Invalid email address")
		}

		return removeMemberInviteOfType(ctx, g, t, keybase1.TeamInviteName(email), "email")
	})
}

func CancelInviteByID(ctx context.Context, g *libkb.GlobalContext, teamname string, inviteID keybase1.TeamInviteID) error {
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
		if err != nil {
			return err
		}

		// Service-side check for invite id, even though we operate on
		// TeamInviteID type, API consumer can give us any string.
		if _, err := keybase1.TeamInviteIDFromString(string(inviteID)); err != nil {
			return fmt.Errorf("Invalid invite ID: %s", err)
		}

		return removeInviteID(ctx, t, inviteID)
	})
}

func Leave(ctx context.Context, g *libkb.GlobalContext, teamname string, permanent bool) error {
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
		if err != nil {
			return err
		}
		err = t.Leave(ctx, permanent)
		if err != nil {
			return err
		}
		// Assume this is for the private team
		err = g.GetTeamLoader().Delete(ctx, t.ID)
		if err != nil {
			g.Log.CDebugf(ctx, "team.Leave: error deleting team cache: %v", err)
		}
		return nil
	})
}

func Delete(ctx context.Context, g *libkb.GlobalContext, ui keybase1.TeamsUiInterface, teamname string) error {
	// This retry can cause multiple confirmation popups for the user
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
		if err != nil {
			return err
		}

		if t.chain().IsSubteam() {
			return t.deleteSubteam(ctx, ui)
		}
		return t.deleteRoot(ctx, ui)
	})
}

func AcceptInvite(ctx context.Context, g *libkb.GlobalContext, token string) error {
	arg := apiArg(ctx, "team/token")
	arg.Args.Add("token", libkb.S{Val: token})
	_, err := g.API.Post(arg)
	return err
}

func parseAndAcceptSeitanTokenV1(ctx context.Context, g *libkb.GlobalContext, tok string) (wasSeitan bool, err error) {
	seitan, err := ParseIKeyFromString(tok)
	if err != nil {
		g.Log.CDebugf(ctx, "ParseIKeyFromString error: %s", err)
		g.Log.CDebugf(ctx, "returning TeamInviteBadToken instead")
		return false, libkb.TeamInviteBadTokenError{}
	}
	err = AcceptSeitan(ctx, g, seitan)
	return true, err
}

func parseAndAcceptSeitanTokenV2(ctx context.Context, g *libkb.GlobalContext, tok string) (wasSeitan bool, err error) {
	seitan, err := ParseIKeyV2FromString(tok)
	if err != nil {
		g.Log.CDebugf(ctx, "ParseIKeyV2FromString error: %s", err)
		g.Log.CDebugf(ctx, "returning TeamInviteBadToken instead")
		return false, libkb.TeamInviteBadTokenError{}
	}
	err = AcceptSeitanV2(ctx, g, seitan)
	return true, err

}

func ParseAndAcceptSeitanToken(ctx context.Context, g *libkb.GlobalContext, tok string) (wasSeitan bool, err error) {
	seitanVersion, err := ParseSeitanVersion(tok)
	if err != nil {
		return wasSeitan, err
	}
	switch seitanVersion {
	case SeitanVersion1:
		wasSeitan, err = parseAndAcceptSeitanTokenV1(ctx, g, tok)
	case SeitanVersion2:
		wasSeitan, err = parseAndAcceptSeitanTokenV2(ctx, g, tok)
	default:
		wasSeitan = false
		err = errors.New("Invalid SeitanVersion")
	}
	return wasSeitan, err
}

func AcceptSeitan(ctx context.Context, g *libkb.GlobalContext, ikey SeitanIKey) error {
	uv, err := getCurrentUserUV(ctx, g)
	if err != nil {
		return err
	}

	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return err
	}

	unixNow := time.Now().Unix()
	_, encoded, err := sikey.GenerateAcceptanceKey(uv.Uid, uv.EldestSeqno, unixNow)
	if err != nil {
		return err
	}

	g.Log.CDebugf(ctx, "seitan invite ID: %v", inviteID)

	arg := apiArg(ctx, "team/seitan")
	arg.Args.Add("akey", libkb.S{Val: encoded})
	arg.Args.Add("now", libkb.HTTPTime{Val: keybase1.Time(unixNow)})
	arg.Args.Add("invite_id", libkb.S{Val: string(inviteID)})
	_, err = g.API.Post(arg)
	return err
}

func ProcessSeitanV2(ikey SeitanIKeyV2, uv keybase1.UserVersion, kbtime keybase1.Time) (sig string,
	inviteID SCTeamInviteID, err error) {

	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return sig, inviteID, err
	}

	inviteID, err = sikey.GenerateTeamInviteID()
	if err != nil {
		return sig, inviteID, err
	}

	_, encoded, err := sikey.GenerateSignature(uv.Uid, uv.EldestSeqno, inviteID, kbtime)
	if err != nil {
		return sig, inviteID, err
	}

	return encoded, inviteID, nil
}

func AcceptSeitanV2(ctx context.Context, g *libkb.GlobalContext, ikey SeitanIKeyV2) error {
	uv, err := getCurrentUserUV(ctx, g)
	if err != nil {
		return err
	}

	now := keybase1.ToTime(time.Now())
	encoded, inviteID, err := ProcessSeitanV2(ikey, uv, now)
	if err != nil {
		return err
	}

	g.Log.CDebugf(ctx, "seitan invite ID: %v", inviteID)

	arg := apiArg(ctx, "team/seitan_v2")
	arg.Args.Add("sig", libkb.S{Val: encoded})
	arg.Args.Add("now", libkb.HTTPTime{Val: now})
	arg.Args.Add("invite_id", libkb.S{Val: string(inviteID)})
	_, err = g.API.Post(arg)
	return err
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req keybase1.TeamChangeReq) error {
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		// Don't needAdmin because we might be leaving, and this needs no information from stubbable links.
		t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
		if err != nil {
			return err
		}
		return t.ChangeMembership(ctx, req)
	})
}

var errInviteRequired = errors.New("invite required for username")
var errUserDeleted = errors.New("user is deleted")

func loadUserVersionPlusByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (libkb.NormalizedUsername, keybase1.UserVersion, error) {
	// need username here as `username` parameter might be social assertion, also username
	// is used for chat notification recipient
	res := g.Resolver.ResolveFullExpressionNeedUsername(ctx, username)
	if res.GetError() != nil {
		if e, ok := res.GetError().(libkb.ResolutionError); ok && e.Kind == libkb.ResolutionErrorNotFound {
			// couldn't find a keybase user for username assertion
			return "", keybase1.UserVersion{}, errInviteRequired
		}
		return "", keybase1.UserVersion{}, res.GetError()
	}

	uv, err := loadUserVersionByUIDCheckUsername(ctx, g, res.GetUID(), res.GetUsername())
	if err != nil {
		return res.GetNormalizedUsername(), uv, err
	}
	return res.GetNormalizedUsername(), uv, nil
}

func loadUserVersionAndPUKedByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (uname libkb.NormalizedUsername, uv keybase1.UserVersion, hasPUK bool, err error) {
	uname, uv, err = loadUserVersionPlusByUsername(ctx, g, username)
	if err == nil {
		hasPUK = true
	} else {
		if err == errInviteRequired {
			err = nil
			hasPUK = false
		} else {
			return "", keybase1.UserVersion{}, false, err
		}
	}
	return uname, uv, hasPUK, nil
}

func loadUserVersionByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (keybase1.UserVersion, error) {
	res := g.Resolver.ResolveWithBody(username)
	if res.GetError() != nil {
		if e, ok := res.GetError().(libkb.ResolutionError); ok && e.Kind == libkb.ResolutionErrorNotFound {
			// couldn't find a keybase user for username assertion
			return keybase1.UserVersion{}, errInviteRequired
		}
		return keybase1.UserVersion{}, res.GetError()
	}

	return loadUserVersionByUIDCheckUsername(ctx, g, res.GetUID(), res.GetUsername())
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

	uv := NewUserVersion(upak.Current.Uid, upak.Current.EldestSeqno)
	if upak.Current.Status == keybase1.StatusCode_SCDeleted {
		return uv, errUserDeleted
	}
	if len(upak.Current.PerUserKeys) == 0 {
		return uv, errInviteRequired
	}

	return uv, nil
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

func kbInviteFromRole(uv keybase1.UserVersion, role keybase1.TeamRole) (SCTeamInvites, error) {
	invite := SCTeamInvite{
		Type: "keybase",
		Name: uv.TeamInviteName(),
		ID:   NewInviteID(),
	}
	var invites SCTeamInvites
	list := []SCTeamInvite{invite}
	switch role {
	case keybase1.TeamRole_OWNER:
		invites.Owners = &list
	case keybase1.TeamRole_ADMIN:
		invites.Admins = &list
	case keybase1.TeamRole_WRITER:
		invites.Writers = &list
	case keybase1.TeamRole_READER:
		invites.Readers = &list
	default:
		return SCTeamInvites{}, errors.New("invalid team role")
	}

	return invites, nil
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
	if utid.Exists() {
		id1, err = utid.AsTeam()
		if err != nil {
			return res, err
		}
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
	return res, errors.New("could not identify team by ID or name")
}

func memberInvite(ctx context.Context, g *libkb.GlobalContext, teamname string, iname keybase1.TeamInviteName, itype keybase1.TeamInviteType) (*keybase1.TeamInvite, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return nil, err
	}
	return t.chain().FindActiveInvite(iname, itype)
}

func RequestAccess(ctx context.Context, g *libkb.GlobalContext, teamname string) (keybase1.TeamRequestAccessResult, error) {
	arg := apiArg(ctx, "team/request_access")
	arg.Args.Add("team", libkb.S{Val: teamname})
	apiRes, err := g.API.Post(arg)

	ret := keybase1.TeamRequestAccessResult{}
	if apiRes != nil && apiRes.Body != nil {
		// "is_open" key may not be included in result payload and it's
		// not an error.
		ret.Open, _ = apiRes.Body.AtKey("is_open").GetBool()
	}
	return ret, err
}

func TeamAcceptInviteOrRequestAccess(ctx context.Context, g *libkb.GlobalContext, tokenOrName string) (keybase1.TeamAcceptOrRequestResult, error) {
	g.Log.CDebugf(ctx, "trying seitan token")

	// If token looks at all like Seitan, don't pass to functions that might log or send to server.
	maybeSeitan, keepSecret := ParseSeitanTokenFromPaste(tokenOrName)
	if keepSecret {
		g.Log.CDebugf(ctx, "found seitan-ish token")
		wasSeitan, err := ParseAndAcceptSeitanToken(ctx, g, maybeSeitan)
		return keybase1.TeamAcceptOrRequestResult{WasSeitan: wasSeitan}, err
	}

	g.Log.CDebugf(ctx, "trying email-style invite")
	err := AcceptInvite(ctx, g, tokenOrName)
	if err == nil {
		return keybase1.TeamAcceptOrRequestResult{
			WasToken: true,
		}, nil
	}
	g.Log.CDebugf(ctx, "email-style invite error: %v", err)
	var reportErr error
	switch err := err.(type) {
	case libkb.TeamInviteTokenReusedError:
		reportErr = err
	default:
		reportErr = libkb.TeamInviteBadTokenError{}
	}

	g.Log.CDebugf(ctx, "trying team name")
	_, err = keybase1.TeamNameFromString(tokenOrName)
	if err == nil {
		ret2, err := RequestAccess(ctx, g, tokenOrName)
		ret := keybase1.TeamAcceptOrRequestResult{
			WasTeamName: true,
			WasOpenTeam: ret2.Open, // this is probably just false in error case
		}
		return ret, err
	}
	g.Log.CDebugf(ctx, "not a team name")

	// We don't know what this thing is. Return the error from AcceptInvite.
	return keybase1.TeamAcceptOrRequestResult{}, reportErr
}

type accessRequest struct {
	FQName   string          `json:"fq_name"`
	TeamID   keybase1.TeamID `json:"team_id"`
	UID      keybase1.UID    `json:"uid"`
	Username string          `json:"username"`
}

type accessRequestList struct {
	Requests []accessRequest `json:"requests"`
	Status   libkb.AppStatus `json:"status"`
}

func (r *accessRequestList) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func ListRequests(ctx context.Context, g *libkb.GlobalContext) ([]keybase1.TeamJoinRequest, error) {
	arg := apiArg(ctx, "team/laar")

	var arList accessRequestList
	if err := g.API.GetDecode(arg, &arList); err != nil {
		return nil, err
	}

	joinRequests := make([]keybase1.TeamJoinRequest, len(arList.Requests))
	for i, ar := range arList.Requests {
		joinRequests[i] = keybase1.TeamJoinRequest{
			Name:     ar.FQName,
			Username: libkb.NewNormalizedUsername(ar.Username).String(),
		}
	}

	return joinRequests, nil
}

type myAccessRequestsList struct {
	Requests []struct {
		FQName string          `json:"fq_name"`
		TeamID keybase1.TeamID `json:"team_id"`
	} `json:"requests"`
	Status libkb.AppStatus `json:"status"`
}

func (r *myAccessRequestsList) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func ListMyAccessRequests(ctx context.Context, g *libkb.GlobalContext, teamName *string) (res []keybase1.TeamName, err error) {
	arg := apiArg(ctx, "team/my_access_requests")
	if teamName != nil {
		arg.Args.Add("team", libkb.S{Val: *teamName})
	}

	var arList myAccessRequestsList
	if err := g.API.GetDecode(arg, &arList); err != nil {
		return nil, err
	}

	for _, req := range arList.Requests {
		name, err := keybase1.TeamNameFromString(req.FQName)
		if err != nil {
			return nil, err
		}
		res = append(res, name)
	}

	return res, nil
}

func IgnoreRequest(ctx context.Context, g *libkb.GlobalContext, teamName, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		if err == errInviteRequired {
			return libkb.NotFoundError{
				Msg: fmt.Sprintf("No keybase user found (%s)", username),
			}
		}
		return err
	}
	arg := apiArg(ctx, "team/deny_access")
	arg.Args.Add("team", libkb.S{Val: teamName})
	arg.Args.Add("uid", libkb.S{Val: uv.Uid.String()})
	if _, err := g.API.Post(arg); err != nil {
		return err
	}
	t, err := GetForTeamManagementByStringName(ctx, g, teamName, true)
	if err != nil {
		return err
	}
	t.notify(ctx, keybase1.TeamChangeSet{Misc: true})
	return nil
}

func apiArg(ctx context.Context, endpoint string) libkb.APIArg {
	arg := libkb.NewAPIArgWithNetContext(ctx, endpoint)
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	return arg
}

func GetRootID(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.TeamID, error) {
	team, err := g.GetTeamLoader().Load(ctx, keybase1.LoadTeamArg{
		ID:      id,
		Public:  id.IsPublic(),
		StaleOK: true,
	})

	if err != nil {
		return keybase1.TeamID(""), err
	}

	return team.Name.RootAncestorName().ToTeamID(id.IsPublic()), nil
}

func ChangeTeamSettings(ctx context.Context, g *libkb.GlobalContext, teamName string, settings keybase1.TeamSettings) error {
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByStringName(ctx, g, teamName, true)
		if err != nil {
			return err
		}

		if !settings.Open && !t.IsOpen() {
			g.Log.CDebugf(ctx, "team is already closed, just returning: %s", teamName)
			return nil
		}

		if settings.Open && t.IsOpen() && t.OpenTeamJoinAs() == settings.JoinAs {
			g.Log.CDebugf(ctx, "team is already open with default role: team: %s role: %s",
				teamName, strings.ToLower(t.OpenTeamJoinAs().String()))
			return nil
		}

		return t.PostTeamSettings(ctx, settings)
	})
}

func removeMemberInvite(ctx context.Context, g *libkb.GlobalContext, team *Team, username string, uv keybase1.UserVersion) error {
	var lookingFor keybase1.TeamInviteName
	var typ string
	if !uv.IsNil() {
		lookingFor = uv.TeamInviteName()
		typ = "keybase"
	} else {
		ptyp, name, err := team.parseSocial(username)
		if err != nil {
			return err
		}
		lookingFor = keybase1.TeamInviteName(name)
		typ = ptyp
	}

	return removeMemberInviteOfType(ctx, g, team, lookingFor, typ)
}

func removeMemberInviteOfType(ctx context.Context, g *libkb.GlobalContext, team *Team, inviteName keybase1.TeamInviteName, typ string) error {
	g.Log.CDebugf(ctx, "looking for active invite in %s for %s/%s", team.Name(), typ, inviteName)

	// make sure this is a valid invite type
	itype, err := keybase1.TeamInviteTypeFromString(typ, g.Env.GetRunMode() == libkb.DevelRunMode)
	if err != nil {
		return err
	}
	validatedType, err := itype.String()
	if err != nil {
		return err
	}

	for _, inv := range team.chain().inner.ActiveInvites {
		invTypeStr, err := inv.Type.String()
		if err != nil {
			return err
		}
		if invTypeStr != validatedType {
			continue
		}
		if inv.Name != inviteName {
			continue
		}

		g.Log.CDebugf(ctx, "found invite %s for %s/%s, removing it", inv.Id, validatedType, inviteName)
		return removeInviteID(ctx, team, inv.Id)
	}

	g.Log.CDebugf(ctx, "no invites found to remove for %s/%s", validatedType, inviteName)

	return libkb.NotFoundError{}
}

func removeMultipleInviteIDs(ctx context.Context, team *Team, invIDs []keybase1.TeamInviteID) error {
	var cancelList []SCTeamInviteID
	for _, invID := range invIDs {
		cancelList = append(cancelList, SCTeamInviteID(invID))
	}
	invites := SCTeamInvites{
		Cancel: &cancelList,
	}
	return team.postTeamInvites(ctx, invites)
}

func removeInviteID(ctx context.Context, team *Team, invID keybase1.TeamInviteID) error {
	cancelList := []SCTeamInviteID{SCTeamInviteID(invID)}
	invites := SCTeamInvites{
		Cancel: &cancelList,
	}
	return team.postTeamInvites(ctx, invites)
}

// splitBulk splits on newline or comma.
func splitBulk(s string) []string {
	f := func(c rune) bool {
		return c == '\n' || c == ','
	}
	split := strings.FieldsFunc(s, f)
	for i, s := range split {
		split[i] = strings.TrimSpace(s)
	}
	return split
}

func CreateSeitanToken(ctx context.Context, g *libkb.GlobalContext, teamname string, role keybase1.TeamRole, label keybase1.SeitanKeyLabel) (keybase1.SeitanIKey, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return "", err
	}
	ikey, err := t.InviteSeitan(ctx, role, label)
	if err != nil {
		return "", err
	}

	return keybase1.SeitanIKey(ikey), err
}

func CreateSeitanTokenV2(ctx context.Context, g *libkb.GlobalContext, teamname string, role keybase1.TeamRole, label keybase1.SeitanKeyLabel) (keybase1.SeitanIKeyV2, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return "", err
	}
	ikey, err := t.InviteSeitanV2(ctx, role, label)
	if err != nil {
		return "", err
	}

	return keybase1.SeitanIKeyV2(ikey), err
}

// CreateTLF is called by KBFS when a TLF ID is associated with an implicit team.
// Should work on either named or implicit teams.
func CreateTLF(ctx context.Context, g *libkb.GlobalContext, arg keybase1.CreateTLFArg) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("CreateTLF(%v)", arg), func() error { return err })()
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		// Need admin because only admins can issue this link
		t, err := GetForTeamManagementByTeamID(ctx, g, arg.TeamID, false)
		if err != nil {
			return err
		}
		role, err := t.myRole(ctx)
		if err != nil {
			return err
		}
		if !role.IsWriterOrAbove() {
			return fmt.Errorf("permission denied: need writer access (or above)")
		}
		return t.AssociateWithTLFID(ctx, arg.TlfID)
	})
}

func GetKBFSTeamSettings(ctx context.Context, g *libkb.GlobalContext, isPublic bool, teamID keybase1.TeamID) (res keybase1.KBFSTeamSettings, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("GetKBFSTeamSettings(%v,%v)", isPublic, teamID), func() error { return err })()
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:     teamID,
		Public: isPublic,
	})
	if err != nil {
		return res, err
	}
	res.TlfID = team.KBFSTLFID()
	g.Log.CDebugf(ctx, "res: %+v", res)
	return res, err
}

func CanUserPerform(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamOperation, err error) {
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

	isRoleOrAbove := func(role keybase1.TeamRole) (bool, error) {

		return teamRole.IsOrAbove(role), nil
	}

	isWriter := func() (bool, error) {
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
	admin, err = isRoleOrAbove(keybase1.TeamRole_ADMIN)
	if err != nil {
		return ret, err
	}

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

	ret.CreateChannel, err = isWriter()
	if err != nil {
		return ret, err
	}

	ret.SetMemberShowcase, err = canMemberShowcase()
	if err != nil {
		return ret, err
	}

	ret.DeleteChannel = admin
	ret.RenameChannel = admin
	ret.EditChannelDescription = admin
	ret.DeleteChatHistory = admin

	return ret, err
}

func RotateKey(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("RotateKey(%v)", teamID), func() error { return err })()
	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, attempt int) error {
		team, err := Load(ctx, g, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      teamID.IsPublic(),
			ForceRepoll: attempt > 0,
		})
		if err != nil {
			return err
		}

		return team.Rotate(ctx)
	})
}

func TeamDebug(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (res keybase1.TeamDebugRes, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("TeamDebug(%v)", teamID), func() error { return err })()
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		Public:      teamID.IsPublic(),
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return keybase1.TeamDebugRes{Chain: team.Data.Chain}, nil
}

func MapImplicitTeamIDToDisplayName(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, isPublic bool) (folder keybase1.Folder, err error) {

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:     id,
		Public: isPublic,
	})
	if err != nil {
		return folder, err
	}

	itdn, err := team.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return folder, err
	}

	folder.Name, err = FormatImplicitTeamDisplayName(ctx, g, itdn)
	if err != nil {
		return folder, err
	}
	folder.Private = !isPublic
	if isPublic {
		folder.FolderType = keybase1.FolderType_PUBLIC
	} else {
		folder.FolderType = keybase1.FolderType_PRIVATE
	}
	return folder, nil
}

type disableTARsRes struct {
	Status   libkb.AppStatus `json:"status"`
	Disabled bool            `json:"disabled"`
}

func (c *disableTARsRes) GetAppStatus() *libkb.AppStatus {
	return &c.Status
}

func GetTarsDisabled(ctx context.Context, g *libkb.GlobalContext, teamname string) (bool, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return false, err
	}

	arg := apiArg(ctx, "team/disable_tars")
	arg.Args.Add("tid", libkb.S{Val: t.ID.String()})
	var ret disableTARsRes
	if err := g.API.GetDecode(arg, &ret); err != nil {
		return false, err
	}

	return ret.Disabled, nil
}

func SetTarsDisabled(ctx context.Context, g *libkb.GlobalContext, teamname string, disabled bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	arg := apiArg(ctx, "team/disable_tars")
	arg.Args.Add("tid", libkb.S{Val: t.ID.String()})
	arg.Args.Add("disabled", libkb.B{Val: disabled})
	if _, err := g.API.Post(arg); err != nil {
		return err
	}
	t.notify(ctx, keybase1.TeamChangeSet{Misc: true})
	return nil
}
