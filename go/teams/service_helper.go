package teams

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/engine"
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
	t, err := GetMaybeAdminByStringName(ctx, g, name)
	if err != nil {
		return res, err
	}
	res.KeyGeneration = t.Generation()
	res.Members, err = members(ctx, g, t, forceRepoll)
	if err != nil {
		return res, err
	}

	activeInvites := t.chain().inner.ActiveInvites
	annotatedInvites, err := AnnotateInvites(ctx, g, activeInvites, t.Name().String())
	if err != nil {
		return res, err
	}
	res.AnnotatedActiveInvites = annotatedInvites

	// put any keybase invites in the members list
	for invID, invite := range annotatedInvites {
		cat, err := invite.Type.C()
		if err != nil {
			return res, err
		}
		if cat != keybase1.TeamInviteCategory_KEYBASE {
			continue
		}
		details := keybase1.TeamMemberDetails{
			Uv:       invite.Uv,
			Username: string(invite.Name),
			Active:   true,
			NeedsPUK: true,
		}
		switch invite.Role {
		case keybase1.TeamRole_OWNER:
			res.Members.Owners = append(res.Members.Owners, details)
		case keybase1.TeamRole_ADMIN:
			res.Members.Admins = append(res.Members.Admins, details)
		case keybase1.TeamRole_WRITER:
			res.Members.Writers = append(res.Members.Writers, details)
		case keybase1.TeamRole_READER:
			res.Members.Readers = append(res.Members.Readers, details)
		}

		// and remove them from the invite list
		delete(res.AnnotatedActiveInvites, invID)
	}

	res.Settings.Open = t.IsOpen()
	res.Settings.JoinAs = t.chain().inner.OpenTeamJoinAs
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

func tryToCompleteInvites(ctx context.Context, g *libkb.GlobalContext, team *Team, username string, uv keybase1.UserVersion, req *keybase1.TeamChangeReq) error {
	if team.NumActiveInvites() == 0 {
		return nil
	}

	proofs, err := getUserProofs(ctx, g, username)
	if err != nil {
		return err
	}

	actx := g.MakeAssertionContext()

	var completedInvites = map[keybase1.TeamInviteID]keybase1.UserVersionPercentForm{}

	for i, invite := range team.chain().inner.ActiveInvites {
		g.Log.CDebugf(ctx, "tryToCompleteInvites invite %q %+v", i, invite)
		ityp, err := invite.Type.String()
		if err != nil {
			return err
		}
		category, err := invite.Type.C()
		if err != nil {
			return err
		}

		if category != keybase1.TeamInviteCategory_SBS {
			continue
		}

		proofsWithType := proofs.Get([]string{ityp})

		var proof *libkb.Proof
		for _, p := range proofsWithType {
			if p.Value == string(invite.Name) {
				proof = &p
				break
			}
		}

		if proof == nil {
			continue
		}

		assertionStr := fmt.Sprintf("%s@%s", string(invite.Name), ityp)
		g.Log.CDebugf(ctx, "Found proof in user's ProofSet: key: %s value: %q; invite proof is %s", proof.Key, proof.Value, assertionStr)

		resolveResult := g.Resolver.ResolveFullExpressionNeedUsername(ctx, assertionStr)
		g.Log.CDebugf(ctx, "Resolve result is: %+v", resolveResult)
		if resolveResult.GetError() != nil || resolveResult.GetUID() != uv.Uid {
			// Cannot resolve invitation or it does not match user
			continue
		}

		parsedAssertion, err := libkb.AssertionParseAndOnly(actx, assertionStr)
		if err != nil {
			return err
		}

		resolvedAssertion := libkb.ResolvedAssertion{
			UID:           uv.Uid,
			Assertion:     parsedAssertion,
			ResolveResult: resolveResult,
		}
		if err := verifyResolveResult(ctx, g, resolvedAssertion); err == nil {
			completedInvites[invite.Id] = uv.PercentForm()
		}
	}

	req.CompletedInvites = completedInvites
	return nil
}

func AddMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) (keybase1.TeamAddMemberResult, error) {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	resolvedUsername, uv, err := loadUserVersionPlusByUsername(ctx, g, username)
	g.Log.CDebugf(ctx, "team.AddMember: loadUserVersionPlusByUsername(%s) -> (%s, %v, %v)", username, resolvedUsername, uv, err)
	if err != nil {
		if err == errInviteRequired {
			return t.InviteMember(ctx, username, role, resolvedUsername, uv)
		}
		if _, ok := err.(libkb.NotFoundError); ok {
			return keybase1.TeamAddMemberResult{}, libkb.NotFoundError{
				Msg: fmt.Sprintf("Not found: user %v", username),
			}
		}
		return keybase1.TeamAddMemberResult{}, err
	}
	if t.IsMember(ctx, uv) {
		return keybase1.TeamAddMemberResult{}, libkb.ExistsError{Msg: fmt.Sprintf("user %q (%s) is already a member of team %q", username, resolvedUsername, teamname)}
	}
	req, err := reqFromRole(uv, role)
	if err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	existingUV, err := t.UserVersionByUID(ctx, uv.Uid)
	if err == nil {
		// Case where same UV (uid+seqno) already exists is covered by
		// `t.IsMember` check above. This only checks if there is a reset
		// member in the team to automatically remove them (so AddMember
		// can function as a Re-Add).
		if existingUV.EldestSeqno > uv.EldestSeqno {
			return keybase1.TeamAddMemberResult{}, fmt.Errorf("newer version of user %q already exists in team %q (%v > %v)", resolvedUsername, teamname, existingUV.EldestSeqno, uv.EldestSeqno)
		}
		req.None = []keybase1.UserVersion{existingUV}
	}
	timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 2*time.Second)
	if err := tryToCompleteInvites(timeoutCtx, g, t, username, uv, &req); err != nil {
		g.Log.CWarningf(ctx, "team.AddMember: error during tryToCompleteInvites: %v", err)
	}
	timeoutCancel()
	if err := t.ChangeMembership(ctx, req); err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	return keybase1.TeamAddMemberResult{User: &keybase1.User{Uid: uv.Uid, Username: resolvedUsername.String()}}, nil
}

func InviteEmailMember(ctx context.Context, g *libkb.GlobalContext, teamname, email string, role keybase1.TeamRole) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	return t.InviteEmailMember(ctx, email, role)
}

func AddEmailsBulk(ctx context.Context, g *libkb.GlobalContext, teamname, emails string, role keybase1.TeamRole) (keybase1.BulkRes, error) {
	var res keybase1.BulkRes
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return keybase1.BulkRes{}, err
	}

	emailList := splitBulk(emails)
	g.Log.CDebugf(ctx, "team %s: bulk email invite count: %d", teamname, len(emailList))

	var invites []SCTeamInvite
	for _, e := range emailList {
		if !libkb.CheckEmail.F(e) {
			g.Log.CDebugf(ctx, "team %s: skipping malformed email %q", teamname, e)
			res.Malformed = append(res.Malformed, e)
			continue
		}
		name := keybase1.TeamInviteName(e)
		existing, err := t.HasActiveInvite(name, "email")
		if err != nil {
			return keybase1.BulkRes{}, err
		}
		if existing {
			g.Log.CDebugf(ctx, "team %s: invite for %s already exists, omitting from invite list", teamname, e)
			res.AlreadyInvited = append(res.AlreadyInvited, e)
			continue
		}
		inv := SCTeamInvite{
			Type: "email",
			Name: name,
			ID:   NewInviteID(),
		}
		invites = append(invites, inv)
		res.Invited = append(res.Invited, e)
	}
	if len(invites) == 0 {
		g.Log.CDebugf(ctx, "team %s: after exisitng filter, no one to invite", teamname)
		return res, nil
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
		return keybase1.BulkRes{}, fmt.Errorf("unknown team role: %s", role)
	}

	g.Log.CDebugf(ctx, "team %s: after exisitng filter, inviting %d emails as %s", teamname, len(invites), role)
	err = t.postTeamInvites(ctx, teamInvites)
	if err != nil {
		return keybase1.BulkRes{}, err
	}
	return res, nil
}

func EditMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
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
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	return t.MemberRole(ctx, uv)
}

func RemoveMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, permanent bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		if err == errInviteRequired {
			return removeMemberInvite(ctx, g, t, username, uv)
		}
		return err
	}

	existingUV, err := t.UserVersionByUID(ctx, uv.Uid)
	if err != nil {
		return libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username, teamname)}
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithContext(ctx, g))
	if err != nil {
		return err
	}

	if me.GetNormalizedName().Eq(libkb.NewNormalizedUsername(username)) {
		return Leave(ctx, g, teamname, false)
	}
	req := keybase1.TeamChangeReq{None: []keybase1.UserVersion{existingUV}}

	if permanent && !t.IsOpen() {
		return fmt.Errorf("team %q is not open, cannot permanently remove member", teamname)
	}
	return t.ChangeMembershipPermanent(ctx, req, permanent)
}

func CancelEmailInvite(ctx context.Context, g *libkb.GlobalContext, teamname, email string) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	if !libkb.CheckEmail.F(email) {
		return errors.New("Invalid email address")
	}

	return removeMemberInviteOfType(ctx, g, t, keybase1.TeamInviteName(email), "email")
}

func Leave(ctx context.Context, g *libkb.GlobalContext, teamname string, permanent bool) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
	if err != nil {
		return err
	}
	err = t.Leave(ctx, permanent)
	if err != nil {
		return err
	}
	// Assume this is for the private team
	public := false
	err = g.GetTeamLoader().Delete(ctx, t.ID, public)
	if err != nil {
		g.Log.CDebugf(ctx, "team.Leave: error deleting team cache: %v", err)
	}
	return nil
}

func Delete(ctx context.Context, g *libkb.GlobalContext, ui keybase1.TeamsUiInterface, teamname string) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return err
	}

	if t.chain().IsSubteam() {
		return t.deleteSubteam(ctx, ui)
	}
	return t.deleteRoot(ctx, ui)
}

func AcceptInvite(ctx context.Context, g *libkb.GlobalContext, token string) error {
	arg := apiArg(ctx, "team/token")
	arg.Args.Add("token", libkb.S{Val: token})
	_, err := g.API.Post(arg)
	return err
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req keybase1.TeamChangeReq) error {
	// Don't needAdmin because we might be leaving, and this needs no information from stubbable links.
	t, err := GetForTeamManagementByStringName(ctx, g, teamname, false)
	if err != nil {
		return err
	}
	return t.ChangeMembership(ctx, req)
}

var errInviteRequired = errors.New("invite required for username")

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

func RequestAccess(ctx context.Context, g *libkb.GlobalContext, teamname string) error {
	arg := apiArg(ctx, "team/request_access")
	arg.Args.Add("team", libkb.S{Val: teamname})
	_, err := g.API.Post(arg)
	return err
}

func TeamAcceptInviteOrRequestAccess(ctx context.Context, g *libkb.GlobalContext, tokenOrName string) error {
	// First try to accept as an invite
	err := AcceptInvite(ctx, g, tokenOrName)
	if err != nil {
		// Failing that, request access as a team name
		err = RequestAccess(ctx, g, tokenOrName)
	}
	return err
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
			Username: ar.Username,
		}
	}

	return joinRequests, nil
}

func IgnoreRequest(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
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
	arg.Args.Add("team", libkb.S{Val: teamname})
	arg.Args.Add("uid", libkb.S{Val: uv.Uid.String()})
	_, err = g.API.Post(arg)
	return err
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
		StaleOK: true,
	})

	if err != nil {
		return keybase1.TeamID(""), err
	}

	return team.Name.RootAncestorName().ToTeamID(), nil
}

func ReAddMemberAfterReset(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, username string) error {
	t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
	if err != nil {
		return err
	}
	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}

	existingUV, err := t.UserVersionByUID(ctx, uv.Uid)
	if err != nil {
		return libkb.NotFoundError{Msg: fmt.Sprintf("user %q has never been a member of this team.", username)}
	}

	if existingUV.EldestSeqno == uv.EldestSeqno {
		return libkb.ExistsError{Msg: fmt.Sprintf("user %q has not reset, no need to re-add", username)}
	} else if existingUV.EldestSeqno > uv.EldestSeqno {
		return fmt.Errorf("newer version of user %q already exists in team %q (%v > %v)", username, teamID, existingUV.EldestSeqno, uv.EldestSeqno)
	}

	existingRole, err := t.MemberRole(ctx, existingUV)
	if err != nil {
		return err
	}

	req, err := reqFromRole(uv, existingRole)
	if err != nil {
		return err
	}

	req.None = []keybase1.UserVersion{existingUV}
	return t.ChangeMembership(ctx, req)
}

func ChangeTeamSettings(ctx context.Context, g *libkb.GlobalContext, teamName string, settings keybase1.TeamSettings) error {
	t, err := GetForTeamManagementByStringName(ctx, g, teamName, true)
	if err != nil {
		return err
	}

	if !settings.Open && !t.IsOpen() {
		return libkb.NoOpError{Desc: "Team is already closed."}
	}

	if settings.Open && t.IsOpen() && t.OpenTeamJoinAs() == settings.JoinAs {
		return libkb.NoOpError{
			Desc: fmt.Sprintf("Team is already open with default role: %s.", strings.ToLower(t.OpenTeamJoinAs().String())),
		}
	}

	return t.PostTeamSettings(ctx, settings)
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

func removeInviteID(ctx context.Context, team *Team, invID keybase1.TeamInviteID) error {
	cancelList := []SCTeamInviteID{SCTeamInviteID(invID)}
	invites := SCTeamInvites{
		Cancel: &cancelList,
	}
	return team.postTeamInvites(ctx, invites)
}

// splitBulk splits on whitespace or comma.
func splitBulk(s string) []string {
	f := func(c rune) bool {
		return unicode.IsSpace(c) || c == ','
	}
	return strings.FieldsFunc(s, f)
}
