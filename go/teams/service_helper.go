package teams

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/avatars"
	email_utils "github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func LoadTeamPlusApplicationKeys(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID,
	application keybase1.TeamApplication, refreshers keybase1.TeamRefreshers, includeKBFSKeys bool) (res keybase1.TeamPlusApplicationKeys, err error) {

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:         id,
		Public:     id.IsPublic(), // infer publicness from id
		Refreshers: refreshers,
	})
	if err != nil {
		return res, err
	}
	return team.ExportToTeamPlusApplicationKeys(ctx, keybase1.Time(0), application, includeKBFSKeys)
}

// GetAnnotatedTeam bundles up various data, both on and off chain, about a specific team for
// consumption by the UI. In particular, it supplies almost all of the information on a team's
// subpage in the Teams tab.
// It always repolls to ensure latest version of a team, but member infos (username, full name, if
// they reset or not) are subject to UIDMapper caching.
func GetAnnotatedTeam(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (res keybase1.AnnotatedTeam, err error) {
	tracer := g.CTimeTracer(ctx, "GetAnnotatedTeam", true)
	defer tracer.Finish()

	mctx := libkb.NewMetaContext(ctx, g)

	tracer.Stage("load team")
	t, err := GetMaybeAdminByID(ctx, g, teamID, teamID.IsPublic())
	if err != nil {
		return res, err
	}

	settings := t.Settings()

	tracer.Stage("members & invites")
	members, annotatedInvites, err := GetAnnotatedInvitesAndMembersForUI(mctx, t)
	if err != nil {
		return res, err
	}
	members = membersFilterDeletedUsers(mctx.Ctx(), mctx.G(), members)
	members = membersHideInactiveDuplicates(mctx.Ctx(), mctx.G(), members)
	if settings.Open {
		g.Log.CDebugf(ctx, "GetAnnotatedTeam: %q is an open team, filtering reset writers and readers", t.Name().String())
		members = keybase1.FilterInactiveReadersWriters(members)
	}

	tracer.Stage("transitive subteams")
	transitiveSubteamsUnverified, err := ListSubteamsUnverified(mctx, t.Name())
	if err != nil {
		return res, err
	}

	teamNameStr := t.Name().String()
	myRole, err := t.myRole(ctx)
	if err != nil {
		return res, err
	}
	var joinRequests []keybase1.TeamJoinRequest
	var tarsDisabled bool
	if myRole.IsOrAbove(keybase1.TeamRole_ADMIN) {
		joinRequests, err = ListRequests(ctx, g, &teamNameStr)
		if err != nil {
			return res, err
		}
		tarsDisabled, err = GetTarsDisabled(ctx, g, teamID)
		if err != nil {
			return res, err
		}
	}

	showcase, err := GetTeamShowcase(ctx, g, teamID)
	if err != nil {
		return res, err
	}

	return keybase1.AnnotatedTeam{
		TeamID:                       teamID,
		Name:                         t.Name().String(),
		TransitiveSubteamsUnverified: transitiveSubteamsUnverified,
		Members:                      members,
		Invites:                      annotatedInvites,
		Settings:                     settings,
		JoinRequests:                 joinRequests,
		TarsDisabled:                 tarsDisabled,
		KeyGeneration:                t.Generation(),
		Showcase:                     showcase,
	}, nil
}

func GetAnnotatedTeamByName(ctx context.Context, g *libkb.GlobalContext, teamName string) (res keybase1.AnnotatedTeam, err error) {
	nameParsed, err := keybase1.TeamNameFromString(teamName)
	if err != nil {
		return res, err
	}
	teamID, err := ResolveNameToID(ctx, g, nameParsed)
	if err != nil {
		return res, err
	}
	return GetAnnotatedTeam(ctx, g, teamID)
}

func Details(ctx context.Context, g *libkb.GlobalContext, name string) (res keybase1.TeamDetails, err error) {
	t, err := GetAnnotatedTeamByName(ctx, g, name)
	if err != nil {
		return res, err
	}
	return t.ToLegacyTeamDetails(), nil
}

func membersFilterDeletedUsers(ctx context.Context, g *libkb.GlobalContext, members []keybase1.TeamMemberDetails) (ret []keybase1.TeamMemberDetails) {
	for _, member := range members {
		if member.Status != keybase1.TeamMemberStatus_DELETED {
			ret = append(ret, member)
		} else {
			g.Log.CDebugf(ctx, "membersHideDeletedUsers filtered out row: %v %v", member.Uv, member.Status)
		}
	}
	return ret
}

// If a UID appears multiple times with different TeamMemberStatus, only show the 'ACTIVE' version.
// This can happen when an owner resets and is re-added by an admin (though the admin could
// choose to remove the old owner if they so wished).
func membersHideInactiveDuplicates(ctx context.Context, g *libkb.GlobalContext, members []keybase1.TeamMemberDetails) (ret []keybase1.TeamMemberDetails) {
	seenActive := make(map[keybase1.UID]bool)
	// Scan for active rows
	for _, member := range members {
		if member.Status == keybase1.TeamMemberStatus_ACTIVE {
			seenActive[member.Uv.Uid] = true
		}
	}
	// Filter out superseded inactive rows
	for _, member := range members {
		if member.Status == keybase1.TeamMemberStatus_ACTIVE || !seenActive[member.Uv.Uid] {
			ret = append(ret, member)
		} else {
			g.Log.CDebugf(ctx, "membersHideInactiveDuplicates filtered out row: %v %v", member.Uv, member.Status)
		}
	}
	return ret
}

func MembersDetails(ctx context.Context, g *libkb.GlobalContext, t *Team) (ret []keybase1.TeamMemberDetails, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	m, err := t.Members()
	if err != nil {
		return nil, err
	}

	owners, err := userVersionsToDetails(mctx, m.Owners, t)
	if err != nil {
		return nil, err
	}
	admins, err := userVersionsToDetails(mctx, m.Admins, t)
	if err != nil {
		return nil, err
	}
	writers, err := userVersionsToDetails(mctx, m.Writers, t)
	if err != nil {
		return nil, err
	}
	readers, err := userVersionsToDetails(mctx, m.Readers, t)
	if err != nil {
		return nil, err
	}
	bots, err := userVersionsToDetails(mctx, m.Bots, t)
	if err != nil {
		return nil, err
	}
	restrictedBots, err := userVersionsToDetails(mctx, m.RestrictedBots, t)
	if err != nil {
		return nil, err
	}
	ret = append(ret, owners...)
	ret = append(ret, admins...)
	ret = append(ret, writers...)
	ret = append(ret, readers...)
	ret = append(ret, bots...)
	ret = append(ret, restrictedBots...)
	return ret, nil
}

// userVersionsToDetails returns a slice of TeamMemberDetails objects, to be
// used in relation to a specific team. It requires the *Team parameter to get
// the role and joinTime.
func userVersionsToDetails(mctx libkb.MetaContext, uvs []keybase1.UserVersion, t *Team) (ret []keybase1.TeamMemberDetails, err error) {
	uids := make([]keybase1.UID, len(uvs))
	for i, uv := range uvs {
		uids[i] = uv.Uid
	}
	packages, err := mctx.G().UIDMapper.MapUIDsToUsernamePackages(mctx.Ctx(), mctx.G(), uids,
		defaultFullnameFreshness, defaultNetworkTimeBudget, true /* forceNetworkForFullNames */)
	if err != nil {
		return nil, err
	}

	ret = make([]keybase1.TeamMemberDetails, len(uvs))

	for i, uv := range uvs {
		pkg := packages[i]
		status := keybase1.TeamMemberStatus_ACTIVE
		var fullName keybase1.FullName
		if pkg.FullName != nil {
			if pkg.FullName.EldestSeqno != uv.EldestSeqno {
				status = keybase1.TeamMemberStatus_RESET
			}
			if pkg.FullName.Status == keybase1.StatusCode_SCDeleted {
				status = keybase1.TeamMemberStatus_DELETED
			}
			fullName = pkg.FullName.FullName
		}
		role, err := t.chain().GetUserRole(uv)
		if err != nil {
			return nil, err
		}
		ret[i] = keybase1.TeamMemberDetails{
			Uv:       uvs[i],
			Username: pkg.NormalizedUsername.String(),
			FullName: fullName,
			Status:   status,
			Role:     role,
		}
		if status == keybase1.TeamMemberStatus_ACTIVE && t != nil {
			joinTime, err := t.UserLastJoinTime(uv)
			if err != nil {
				return nil, err
			}
			ret[i].JoinTime = &joinTime
		}
	}
	return ret, nil
}

func SetRoleOwner(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Owners: []keybase1.UserVersion{uv}})
}

func SetRoleAdmin(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Admins: []keybase1.UserVersion{uv}})
}

func SetRoleWriter(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Writers: []keybase1.UserVersion{uv}})
}

func SetRoleReader(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Readers: []keybase1.UserVersion{uv}})
}

func SetRoleBot(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}
	return ChangeRoles(ctx, g, teamname, keybase1.TeamChangeReq{Bots: []keybase1.UserVersion{uv}})
}

func SetRoleRestrictedBot(ctx context.Context, g *libkb.GlobalContext, teamname, username string,
	botSettings keybase1.TeamBotSettings) error {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}
	req := keybase1.TeamChangeReq{
		RestrictedBots: map[keybase1.UserVersion]keybase1.TeamBotSettings{
			uv: botSettings,
		},
	}
	return ChangeRoles(ctx, g, teamname, req)
}

func getUserProofsNoTracking(ctx context.Context, g *libkb.GlobalContext, username string) (*libkb.ProofSet, *libkb.IdentifyOutcome, error) {
	arg := keybase1.Identify2Arg{
		UserAssertion:    username,
		UseDelegateUI:    false,
		Reason:           keybase1.IdentifyReason{Reason: "clear invitation when adding team member"},
		CanSuppressUI:    true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_RESOLVE_AND_CHECK,
		NeedProofSet:     true,
		ActLoggedOut:     true,
	}
	eng := engine.NewResolveThenIdentify2(g, &arg)
	m := libkb.NewMetaContext(ctx, g)
	if err := engine.RunEngine2(m, eng); err != nil {
		return nil, nil, err
	}
	return eng.GetProofSet(), eng.GetIdentifyOutcome(), nil
}

func AddMemberByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, username string,
	role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings, emailInviteMsg *string) (res keybase1.TeamAddMemberResult, err error) {

	err = RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true /*needAdmin*/)
		if err != nil {
			return err
		}

		loggedInRole, err := t.myRole(ctx)
		if err != nil {
			return err
		}
		if role == keybase1.TeamRole_OWNER && loggedInRole == keybase1.TeamRole_ADMIN {
			return fmt.Errorf("Cannot add owner to team as an admin")
		}

		tx := CreateAddMemberTx(t)
		tx.AllowPUKless = true
		tx.EmailInviteMsg = emailInviteMsg
		resolvedUsername, uv, invite, err := tx.AddOrInviteMemberByAssertion(ctx, username, role, botSettings)
		if err != nil {
			return err
		}

		if !uv.IsNil() {
			// Try to mark completed any invites for the user's social assertions.
			// This can be a time-intensive process since it involves checking proofs.
			// It is limited to a few seconds and failure is non-fatal.
			timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 2*time.Second)
			if err := tx.CompleteSocialInvitesFor(timeoutCtx, uv, username); err != nil {
				g.Log.CDebugf(ctx, "Failed in CompleteSocialInvitesFor, no invites will be cleared. Err was: %v", err)
			}
			timeoutCancel()
		}

		err = tx.Post(libkb.NewMetaContext(ctx, g))
		if err != nil {
			return err
		}

		// return value assign to escape closure
		res = keybase1.TeamAddMemberResult{
			User:    &keybase1.User{Uid: uv.Uid, Username: resolvedUsername.String()},
			Invited: invite,
		}
		return nil
	})
	return res, err
}

func AddMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string, role keybase1.TeamRole,
	botSettings *keybase1.TeamBotSettings) (res keybase1.TeamAddMemberResult, err error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:        teamname,
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return AddMemberByID(ctx, g, team.ID, username, role, botSettings, nil /* emailInviteMsg */)
}

type AddMembersRes struct {
	Invite   bool                     // Whether the membership addition was an invite.
	Username libkb.NormalizedUsername // Resolved username. May be nil for social assertions.
}

// AddMembers adds a bunch of people to a team. Assertions can contain usernames or social assertions.
// Adds them all in a transaction so it's all or nothing.
// If the first transaction fails due to TeamContactSettingsBlock error, it
// will remove restricted users returned by the error, and retry once.
// On success, returns a list where len(added) + len(noAdded) = len(assertions) and in
// corresponding order, with restricted users having an empty AddMembersRes.
//
// @emailInviteMsg *string is an argument used as a welcome message in email invitations sent from the server
func AddMembers(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, users []keybase1.UserRolePair,
	emailInviteMsg *string) (added []AddMembersRes, notAdded []keybase1.User, err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	tracer := g.CTimeTracer(ctx, "team.AddMembers", true)
	defer tracer.Finish()

	// restrictedUsers is nil initially, but if first attempt at adding members
	// results in "contact settings block error", restrictedUsers becomes a set
	// of blocked uids.
	var restrictedUsers contactRestrictedUsers

	addNonRestrictedMembersFunc := func(ctx context.Context, _ int) error {
		added = []AddMembersRes{}
		notAdded = []keybase1.User{}

		team, err := GetForTeamManagementByTeamID(ctx, g, teamID, true /*needAdmin*/)
		if err != nil {
			return err
		}

		if team.IsSubteam() && keybase1.UserRolePairsHaveOwner(users) {
			// Do the "owner in subteam" check early before we do anything else.
			return NewSubteamOwnersError()
		}

		tx := CreateAddMemberTx(team)
		tx.AllowPUKless = true
		tx.EmailInviteMsg = emailInviteMsg

		type sweepEntry struct {
			Assertion string
			UV        keybase1.UserVersion
		}
		var sweep []sweepEntry
		for _, user := range users {
			candidate, err := tx.ResolveUPKV2FromAssertion(mctx, user.Assertion)
			if err != nil {
				return NewAddMembersError(candidate.Full, err)
			}

			g.Log.CDebugf(ctx, "%q resolved to %s", user.Assertion, candidate.DebugString())

			if restricted, kbUser := restrictedUsers.checkCandidate(candidate); restricted {
				// Skip users with contact setting restrictions.
				notAdded = append(notAdded, kbUser)
				continue
			}

			username, uv, invite, err := tx.AddOrInviteMemberCandidate(ctx, candidate, user.Role, user.BotSettings)
			if err != nil {
				if _, ok := err.(AttemptedInviteSocialOwnerError); ok {
					return err
				}
				return NewAddMembersError(candidate.Full, err)
			}
			var normalizedUsername libkb.NormalizedUsername
			if !username.IsNil() {
				normalizedUsername = username
			}

			added = append(added, AddMembersRes{
				Invite:   invite,
				Username: normalizedUsername,
			})
			if !uv.IsNil() {
				sweep = append(sweep, sweepEntry{
					Assertion: user.Assertion,
					UV:        uv,
				})
			}
		}

		// Try to mark completed any invites for the users' social assertions.
		// This can be a time-intensive process since it involves checking proofs.
		// It is limited to a few seconds and failure is non-fatal.
		timeoutCtx, timeoutCancel := context.WithTimeout(ctx, 2*time.Second)
		for _, x := range sweep {
			if err := tx.CompleteSocialInvitesFor(timeoutCtx, x.UV, x.Assertion); err != nil {
				g.Log.CWarningf(ctx, "Failed in CompleteSocialInvitesFor(%v, %v) -> %v", x.UV, x.Assertion, err)
			}
		}
		timeoutCancel()

		return tx.Post(libkb.NewMetaContext(ctx, g))
	}

	// try to add
	err = RetryIfPossible(ctx, g, addNonRestrictedMembersFunc)
	if blockError, ok := err.(libkb.TeamContactSettingsBlockError); ok {
		mctx.Debug("AddMembers: initial attempt failed with contact settings error: %v", err)
		uids := blockError.BlockedUIDs()
		if len(uids) == len(users) {
			// If all users can't be added, quit. Do this check before calling
			// `unpackContactRestrictedUsers` to avoid allocating and setting
			// up the uid set if we fall in this case.
			mctx.Debug("AddMembers: initial attempt failed and all users were restricted from being added. Not retrying.")
			return nil, nil, err
		}
		restrictedUsers = unpackContactRestrictedUsers(blockError)
		mctx.Debug("AddMembers: retrying without restricted users: %+v", blockError.BlockedUsernames())
		err = RetryIfPossible(ctx, g, addNonRestrictedMembersFunc)
	}

	if err != nil {
		return nil, nil, err
	}
	return added, notAdded, nil
}

func ReAddMemberAfterReset(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	username string) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("ReAddMemberAfterReset(%v,%v)", teamID, username), &err)()
	err = reAddMemberAfterResetInner(ctx, g, teamID, username)
	switch err.(type) {
	case UserHasNotResetError:
		// No-op is ok
		g.Log.CDebugf(ctx, "suppressing error: %v", err)
		return nil
	default:
		return err
	}
}

func reAddMemberAfterResetInner(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
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
	_ = g.Pegboard.TrackUPAK(libkb.NewMetaContext(ctx, g), upak.Current)
	uv := upak.Current.ToUserVersion()
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
		if err != nil {
			return err
		}

		// Look for invites first - invite will always be obsoleted (and
		// removed) by membership or another invite; but membership can
		// stay un-removed when superseded by new invite (is removed by
		// new membership though).
		var existingRole keybase1.TeamRole
		var existingBotSettings *keybase1.TeamBotSettings
		invite, existingUV, found := t.FindActiveKeybaseInvite(uv.Uid)
		if found {
			// User is PUKless member.
			existingRole = invite.Role
		} else {
			foundUV, err := t.UserVersionByUID(ctx, uv.Uid)
			if err != nil {
				if _, ok := err.(libkb.NotFoundError); ok {
					// username is neither crypto UV nor keybase invite in
					// that team. bail out.
					return libkb.NotFoundError{Msg: fmt.Sprintf("User %q (%s) is not a member of this team.",
						username, uv.Uid)}
				}
				// ... or something else failed
				return err
			}

			// User is existing crypto member - get their current role.
			role, err := t.MemberRole(ctx, foundUV)
			if err != nil {
				return err
			}
			existingRole = role
			existingUV = foundUV

			if existingRole.IsRestrictedBot() {
				bots, err := t.TeamBotSettings()
				if err != nil {
					return err
				}
				botSettings, ok := bots[existingUV]
				if !ok {
					botSettings = keybase1.TeamBotSettings{}
				}
				existingBotSettings = &botSettings
			}
		}

		if existingUV.EldestSeqno == uv.EldestSeqno {
			return NewUserHasNotResetError("user %s has not reset, no need to re-add, existing: %v new: %v",
				username, existingUV.EldestSeqno, uv.EldestSeqno)
		}

		hasPUK := len(upak.Current.PerUserKeys) > 0

		loggedInRole, err := t.myRole(ctx)
		if err != nil {
			return err
		}

		targetRole := existingRole
		if existingRole.IsOrAbove(loggedInRole) {
			// If an admin is trying to re-add an owner, re-add them as an admin.
			// An admin cannot grant owner privileges, so this is the best we can do.
			targetRole = loggedInRole
		}

		if !t.IsImplicit() {
			_, err = AddMemberByID(ctx, g, t.ID, username, targetRole, existingBotSettings, nil /* emailInviteMsg */)
			return err
		}

		tx := CreateAddMemberTx(t)
		tx.AllowPUKless = true
		if err := tx.ReAddMemberToImplicitTeam(ctx, uv, hasPUK, targetRole, existingBotSettings); err != nil {
			return err
		}

		return tx.Post(libkb.NewMetaContext(ctx, g))
	})
}

func InviteEmailPhoneMember(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, name string, typ string, role keybase1.TeamRole) error {
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
		if err != nil {
			return err
		}

		return t.InviteEmailPhoneMember(ctx, name, role, typ)
	})
}

func AddEmailsBulk(ctx context.Context, g *libkb.GlobalContext, teamname, emails string, role keybase1.TeamRole) (res keybase1.BulkRes, err error) {
	mctx := libkb.NewMetaContext(ctx, g)

	mctx.Debug("parsing email list for team %q", teamname)

	actx := mctx.G().MakeAssertionContext(mctx)

	emailList := email_utils.ParseSeparatedEmails(mctx, emails, &res.Malformed)
	var toAdd []keybase1.UserRolePair
	for _, email := range emailList {
		assertion, err := libkb.ParseAssertionURLKeyValue(actx, "email", email, false /* strict */)
		if err != nil {
			res.Malformed = append(res.Malformed, email)
			mctx.Debug("Failed to create assertion from email %q: %s", email, err)
			continue
		}
		toAdd = append(toAdd, keybase1.UserRolePair{Assertion: assertion.String(), Role: role})
	}

	if len(toAdd) == 0 {
		// Nothing to do.
		return res, nil
	}

	t, err := GetForTeamManagementByStringName(ctx, g, teamname, true)
	if err != nil {
		return res, err
	}

	_, _, err = AddMembers(ctx, g, t.ID, toAdd, nil /* emailInviteMsg */)
	return res, err
}

func EditMember(ctx context.Context, g *libkb.GlobalContext, teamname, username string,
	role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) error {
	teamGetter := func() (*Team, error) { return GetForTeamManagementByStringName(ctx, g, teamname, true) }
	return editMember(ctx, g, teamGetter, username, role, botSettings)
}

func EditMemberByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	username string, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) error {
	teamGetter := func() (*Team, error) { return GetForTeamManagementByTeamID(ctx, g, teamID, true) }
	return editMember(ctx, g, teamGetter, username, role, botSettings)
}

func EditMembers(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, users []keybase1.UserRolePair) (res keybase1.TeamEditMembersResult, err error) {
	var failedToEdit []keybase1.UserRolePair

	for _, userRolePair := range users {
		err := EditMemberByID(ctx, g, teamID, userRolePair.Assertion, userRolePair.Role, userRolePair.BotSettings)
		if err != nil {
			failedToEdit = append(failedToEdit, userRolePair)
			continue
		}
	}

	res = keybase1.TeamEditMembersResult{Failures: failedToEdit}
	return res, nil
}

func editMember(ctx context.Context, g *libkb.GlobalContext, teamGetter func() (*Team, error),
	username string, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) error {

	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err == errInviteRequired {
		return editMemberInvite(ctx, g, teamGetter, username, role, uv, botSettings)
	}
	if err != nil {
		return err
	}

	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := teamGetter()
		if err != nil {
			return err
		}
		if !t.IsMember(ctx, uv) {
			return libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username, t.Name())}
		}
		existingRole, err := t.MemberRole(ctx, uv)
		if err != nil {
			return err
		}

		if existingRole == role {
			if !role.IsRestrictedBot() {
				g.Log.CDebugf(ctx, "bailing out, role given is the same as current")
				return nil
			}
			teamBotSettings, err := t.TeamBotSettings()
			if err != nil {
				return err
			}
			existingBotSettings := teamBotSettings[uv]
			if botSettings.Eq(&existingBotSettings) {
				g.Log.CDebugf(ctx, "bailing out, role given is the same as current, botSettings unchanged")
				return nil
			}
		}

		req, err := reqFromRole(uv, role, botSettings)
		if err != nil {
			return err
		}

		return t.ChangeMembership(ctx, req)
	})

}

func editMemberInvite(ctx context.Context, g *libkb.GlobalContext, teamGetter func() (*Team, error),
	username string, role keybase1.TeamRole,
	uv keybase1.UserVersion, botSettings *keybase1.TeamBotSettings) error {
	t, err := teamGetter()
	if err != nil {
		return err
	}
	g.Log.CDebugf(ctx, "team %s: edit member %s, member is an invite link", t.ID, username)

	// Note that there could be a problem if removeMemberInvite works but AddMember doesn't
	// as the original invite will be lost. But the user will get an error and can try
	// again.
	if err := removeMemberInvite(ctx, g, t, username, uv); err != nil {
		g.Log.CDebugf(ctx, "editMemberInvite error in removeMemberInvite: %s", err)
		return err
	}
	// use AddMember in case it's possible to add them directly now
	if _, err := AddMemberByID(ctx, g, t.ID, username, role, nil, nil /* emailInviteMsg */); err != nil {
		g.Log.CDebugf(ctx, "editMemberInvite error in AddMember: %s", err)
		return err
	}
	return nil
}

func SetBotSettings(ctx context.Context, g *libkb.GlobalContext, teamname, username string,
	botSettings keybase1.TeamBotSettings) error {
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByStringName(ctx, g, teamname, false)
	}

	return setBotSettings(ctx, g, teamGetter, username, botSettings)
}

func SetBotSettingsByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	username string, botSettings keybase1.TeamBotSettings) error {
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByTeamID(ctx, g, teamID, false)
	}
	return setBotSettings(ctx, g, teamGetter, username, botSettings)
}

func setBotSettings(ctx context.Context, g *libkb.GlobalContext, teamGetter func() (*Team, error),
	username string, botSettings keybase1.TeamBotSettings) error {

	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return err
	}

	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := teamGetter()
		if err != nil {
			return err
		}

		if !t.IsMember(ctx, uv) {
			return libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username, t.Name())}
		}
		role, err := t.MemberRole(ctx, uv)
		if err != nil {
			return err
		}
		if !role.IsRestrictedBot() {
			return fmt.Errorf("%s is not a %v, but has the role %v",
				username, keybase1.TeamRole_RESTRICTEDBOT, role)
		}

		return t.PostTeamBotSettings(ctx, map[keybase1.UserVersion]keybase1.TeamBotSettings{
			uv: botSettings,
		})
	})
}

func GetBotSettings(ctx context.Context, g *libkb.GlobalContext,
	teamname, username string) (res keybase1.TeamBotSettings, err error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:        teamname,
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return getBotSettings(ctx, g, team, username)
}

func GetBotSettingsByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	username string) (res keybase1.TeamBotSettings, err error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:          teamID,
		ForceRepoll: true,
	})
	if err != nil {
		return res, err
	}
	return getBotSettings(ctx, g, team, username)
}

func getBotSettings(ctx context.Context, g *libkb.GlobalContext,
	team *Team, username string) (res keybase1.TeamBotSettings, err error) {
	uv, err := loadUserVersionByUsername(ctx, g, username, true /* useTracking */)
	if err != nil {
		return res, err
	}

	if !team.IsMember(ctx, uv) {
		return res, libkb.NotFoundError{Msg: fmt.Sprintf("user %q is not a member of team %q", username, team.Name())}
	}

	role, err := team.MemberRole(ctx, uv)
	if err != nil {
		return res, err
	}
	if !role.IsRestrictedBot() {
		return res, fmt.Errorf("%s is not a %v, but has the role %v",
			username, keybase1.TeamRole_RESTRICTEDBOT, role)
	}

	botSettings, err := team.TeamBotSettings()
	if err != nil {
		return res, err
	}
	return botSettings[uv], nil
}

func MemberRole(ctx context.Context, g *libkb.GlobalContext, teamname, username string) (role keybase1.TeamRole, err error) {
	uv, err := loadUserVersionByUsername(ctx, g, username, false /* useTracking */)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}

	err = RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
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

func MemberRoleFromID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, username string) (role keybase1.TeamRole, err error) {
	uv, err := loadUserVersionByUsername(ctx, g, username, false /* useTracking */)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}

	err = RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, false)
		if err != nil {
			return err
		}
		// return value assign to escape closure
		role, err = t.MemberRole(ctx, uv)
		return err
	})
	return role, err
}

func RemoveMemberSingle(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	member keybase1.TeamMemberToRemove) (err error) {
	members := []keybase1.TeamMemberToRemove{member}
	res, err := RemoveMembers(ctx, g, teamID, members, false /* NoErrorOnPartialFailure */)
	if err != nil {
		msg := fmt.Sprintf("failed to remove member: %s", err)
		if len(res.Failures) > 0 {
			if res.Failures[0].ErrorAtTarget != nil {
				msg += "; " + *res.Failures[0].ErrorAtTarget
			}
			if res.Failures[0].ErrorAtSubtree != nil {
				msg += "; " + *res.Failures[0].ErrorAtSubtree
			}
		}
		err = errors.New(msg)
	}
	return err
}

func RemoveMembers(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID,
	members []keybase1.TeamMemberToRemove, shouldNotErrorOnPartialFailure bool,
) (res keybase1.TeamRemoveMembersResult, err error) {
	mctx := libkb.NewMetaContext(ctx, g)

	// Preliminary checks
	for _, member := range members {
		typ, err := member.Type()
		if err != nil {
			return res, err
		}
		switch typ {
		case keybase1.TeamMemberToRemoveType_ASSERTION:
		case keybase1.TeamMemberToRemoveType_INVITEID:
		default:
			return res, fmt.Errorf("unknown TeamMemberToRemoveType %v", typ)
		}
	}

	// Removals
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByTeamID(ctx, g, teamID, true /* needAdmin */)
	}
	errstrp := func(e error) *string {
		if e == nil {
			return nil
		}
		s := e.Error()
		return &s
	}
	var failures []keybase1.RemoveTeamMemberFailure
	for _, member := range members {
		typ, _ := member.Type()
		switch typ {
		case keybase1.TeamMemberToRemoveType_ASSERTION:
			targetErr := remove(ctx, g, teamGetter, member.Assertion().Assertion)
			var subtreeErr error
			if member.Assertion().RemoveFromSubtree {
				if targetErr == nil {
					subtreeErr = removeMemberFromSubtree(mctx, teamID, member.Assertion().Assertion)
				} else {
					subtreeErr = errors.New("did not attempt to remove from subtree since removal failed at specified team")
				}
			}
			if targetErr != nil || subtreeErr != nil {
				failures = append(failures, keybase1.RemoveTeamMemberFailure{
					TeamMember:     member,
					ErrorAtTarget:  errstrp(targetErr),
					ErrorAtSubtree: errstrp(subtreeErr),
				})
			}
		case keybase1.TeamMemberToRemoveType_INVITEID:
			targetErr := CancelInviteByID(ctx, g, teamID, member.Inviteid().InviteID)
			if targetErr != nil {
				failures = append(failures, keybase1.RemoveTeamMemberFailure{
					TeamMember:     member,
					ErrorAtSubtree: errstrp(targetErr),
				})
			}
		}
	}

	if !shouldNotErrorOnPartialFailure && len(failures) > 0 {
		err = fmt.Errorf("failed to remove %d members", len(failures))
	} else {
		err = nil
	}
	return keybase1.TeamRemoveMembersResult{Failures: failures}, err
}

// removeMemberFromSubtree removes member from all teams in the subtree of targetTeamID,
// *not including* targetTeamID itself
func removeMemberFromSubtree(mctx libkb.MetaContext, targetTeamID keybase1.TeamID,
	assertion string) error {
	// We don't care about the roles; we just want the list of teams. So we can pass our
	// own username.
	myUsername := mctx.G().Env.GetUsername()
	guid := 0
	treeloader, err := NewTreeloader(mctx, myUsername.String(), targetTeamID, guid,
		false /* includeAncestors */)
	if err != nil {
		return fmt.Errorf("could not start loading subteams: %w", err)
	}
	// All or nothing; we can assume all results will be OK.
	teamTreeMemberships, err := treeloader.LoadSync(mctx)
	if err != nil {
		return fmt.Errorf("could not load subteams: %w", err)
	}
	var errs []error
	for _, membership := range teamTreeMemberships {
		status, _ := membership.Result.S()
		if status != keybase1.TeamTreeMembershipStatus_OK {
			return fmt.Errorf("removeMemberFromSubtree: unexpectedly got a non-OK status from Treeloader.LoadSync: %v", status)
		}

		teamID := membership.Result.Ok().TeamID

		// Don't remove member from the targetTeam; just the subtree
		if teamID == targetTeamID {
			continue
		}

		teamGetter := func() (*Team, error) {
			return GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
		}

		removeErr := remove(mctx.Ctx(), mctx.G(), teamGetter, assertion)
		var memberNotFoundErr *MemberNotFoundInChainError
		switch {
		case removeErr == nil:
		case errors.As(removeErr, &memberNotFoundErr):
			// If the member was not found in the sigchain (either via invite or cryptomember), we can
			// ignore the error. Because we got team memberships for ourselves and not the user, we
			// can't use the membership data provided by the Treeloader. (We're not using the
			// membership data from the treeloader because it does not support looking up by invites).
		default:
			errs = append(errs, fmt.Errorf("failed to remove from %s: %w",
				membership.TeamName, removeErr))
		}
	}
	return libkb.CombineErrors(errs...)
}

func RemoveMemberByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, username string) error {
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByTeamID(ctx, g, teamID, true)
	}
	return remove(ctx, g, teamGetter, username)
}

// RemoveMember removes members by username or assertions. For a function that can handle removal
// from subteams and inviteIDs, see RemoveMemberSingle and RemoveMembers.
func RemoveMember(ctx context.Context, g *libkb.GlobalContext, teamName string, username string) error {
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByStringName(ctx, g, teamName, true)
	}
	return remove(ctx, g, teamGetter, username)
}

func remove(ctx context.Context, g *libkb.GlobalContext, teamGetter func() (*Team, error), username string) error {
	var inviteRequired bool
	uv, err := loadUserVersionByUsername(ctx, g, username, false /* useTracking */)
	if err != nil {
		switch err {
		case errInviteRequired:
			inviteRequired = true
		case errUserDeleted: // no-op
		default:
			return err
		}
		g.Log.CDebugf(ctx, "loadUserVersionByUsername(%s) returned %v,%q", username, uv, err)
	}

	me, err := loadMeForSignatures(ctx, g)
	if err != nil {
		return err
	}

	if me.GetNormalizedName().Eq(libkb.NewNormalizedUsername(username)) {
		return leave(ctx, g, teamGetter, false)
	}

	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := teamGetter()
		if err != nil {
			return err
		}

		if inviteRequired && !uv.Uid.Exists() {
			// Remove a non-keybase invite.
			return removeMemberInvite(ctx, g, t, username, uv)
		}

		if _, _, found := t.FindActiveKeybaseInvite(uv.Uid); found {
			// Remove keybase invites.
			return removeKeybaseTypeInviteForUID(ctx, g, t, uv.Uid)
		}

		existingUV, err := t.UserVersionByUID(ctx, uv.Uid)
		if err != nil {
			return NewMemberNotFoundInChainError(libkb.NotFoundError{Msg: fmt.Sprintf(
				"user %q is not a member of team %q", username, t.Name())})
		}

		removePermanently := t.IsOpen() ||
			t.WasMostRecentlyAddedByInvitelink(existingUV)
		req := keybase1.TeamChangeReq{None: []keybase1.UserVersion{existingUV}}
		opts := ChangeMembershipOptions{
			Permanent:       removePermanently,
			SkipKeyRotation: t.CanSkipKeyRotation(),
		}
		return t.ChangeMembershipWithOptions(ctx, req, opts)
	})
}

func CancelEmailInvite(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, email string) (err error) {
	g.CTrace(ctx, "CancelEmailInvite", &err)
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
		if err != nil {
			return err
		}

		if !libkb.CheckEmail.F(email) {
			return errors.New("Invalid email address")
		}

		return removeMemberInviteOfType(ctx, g, t, keybase1.TeamInviteName(email), "email")
	})
}

func CancelInviteByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, inviteID keybase1.TeamInviteID) (err error) {
	g.CTrace(ctx, "CancelInviteByID", &err)
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
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

func leave(ctx context.Context, g *libkb.GlobalContext, teamGetter func() (*Team, error), permanent bool) error {
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := teamGetter()
		if err != nil {
			return err
		}
		err = t.Leave(ctx, permanent)
		if err != nil {
			return err
		}

		err = FreezeTeam(libkb.NewMetaContext(ctx, g), t.ID)
		if err != nil {
			g.Log.CDebugf(ctx, "leave FreezeTeam error: %+v", err)
		}

		return nil
	})
}

func LeaveByID(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID, permanent bool) error {
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByTeamID(ctx, g, teamID, false)
	}
	return leave(ctx, g, teamGetter, permanent)
}

func Leave(ctx context.Context, g *libkb.GlobalContext, teamname string, permanent bool) error {
	teamGetter := func() (*Team, error) {
		return GetForTeamManagementByStringName(ctx, g, teamname, false)
	}
	return leave(ctx, g, teamGetter, permanent)
}

func Delete(ctx context.Context, g *libkb.GlobalContext, ui keybase1.TeamsUiInterface, teamID keybase1.TeamID) error {
	alreadyConfirmed := false
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, teamID, true)
		if err != nil {
			return err
		}

		if !alreadyConfirmed {
			var confirmed bool
			if t.chain().IsSubteam() {
				confirmed, err = ui.ConfirmSubteamDelete(ctx, keybase1.ConfirmSubteamDeleteArg{TeamName: t.Name().String()})
			} else {
				confirmed, err = ui.ConfirmRootTeamDelete(ctx, keybase1.ConfirmRootTeamDeleteArg{TeamName: t.Name().String()})
			}
			if err != nil {
				return err
			}
			if !confirmed {
				return errors.New("team delete not confirmed")
			}
			alreadyConfirmed = true
		}

		if t.chain().IsSubteam() {
			err = t.deleteSubteam(ctx)
		} else {
			err = t.deleteRoot(ctx)
		}
		if err != nil {
			return err
		}

		err = TombstoneTeam(libkb.NewMetaContext(ctx, g), t.ID)
		if err != nil {
			g.Log.CDebugf(ctx, "Delete TombstoneTeam error: %+v", err)
			if g.Env.GetRunMode() == libkb.DevelRunMode {
				return err
			}
		}

		return nil
	})
}

func AcceptServerTrustInvite(ctx context.Context, g *libkb.GlobalContext, token string) error {
	mctx := libkb.NewMetaContext(ctx, g)
	arg := apiArg("team/token")
	arg.Args.Add("token", libkb.S{Val: token})
	_, err := mctx.G().API.Post(mctx, arg)
	return err
}

func ChangeRoles(ctx context.Context, g *libkb.GlobalContext, teamname string, req keybase1.TeamChangeReq) error {
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
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

// loadUserVersionByUsername is a wrapper around `engine.ResolveAndCheck` to
// return UV by username or assertion. When the argument does not resolve to a
// Keybase user with PUK, `errInviteRequired` is returned.
//
// Returns `errInviteRequired` if given argument cannot be brought in as a
// crypto member - so it is either a reset and not provisioned Keybase user
// (keybase-type invite is required), or a social assertion that does not
// resolve to a user.
//
// NOTE: This also doesn't try to resolve server-trust assertions.
func loadUserVersionByUsername(ctx context.Context, g *libkb.GlobalContext, username string, useTracking bool) (keybase1.UserVersion, error) {
	m := libkb.NewMetaContext(ctx, g)
	upk, err := engine.ResolveAndCheck(m, username, useTracking)
	if err != nil {
		if e, ok := err.(libkb.ResolutionError); ok && e.Kind == libkb.ResolutionErrorNotFound {
			// couldn't find a keybase user for username assertion
			return keybase1.UserVersion{}, errInviteRequired
		}
		return keybase1.UserVersion{}, err
	}

	return filterUserCornerCases(ctx, upk)
}

func loadUserVersionByUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (keybase1.UserVersion, error) {
	upak, err := loadUPAK2(ctx, g, uid, true /*forcePoll */)
	if err != nil {
		return keybase1.UserVersion{}, err
	}
	return filterUserCornerCases(ctx, upak.Current)
}

func filterUserCornerCases(ctx context.Context, upak keybase1.UserPlusKeysV2) (keybase1.UserVersion, error) {
	uv := upak.ToUserVersion()
	if upak.Status == keybase1.StatusCode_SCDeleted {
		return uv, errUserDeleted
	}
	if len(upak.PerUserKeys) == 0 {
		return uv, errInviteRequired
	}
	return uv, nil
}

func reqFromRole(uv keybase1.UserVersion, role keybase1.TeamRole, botSettings *keybase1.TeamBotSettings) (req keybase1.TeamChangeReq, err error) {
	list := []keybase1.UserVersion{uv}
	if !role.IsRestrictedBot() && botSettings != nil {
		return req, fmt.Errorf("Unexpected botSettings for role %v", role)
	}
	switch role {
	case keybase1.TeamRole_OWNER:
		req.Owners = list
	case keybase1.TeamRole_ADMIN:
		req.Admins = list
	case keybase1.TeamRole_WRITER:
		req.Writers = list
	case keybase1.TeamRole_READER:
		req.Readers = list
	case keybase1.TeamRole_BOT:
		req.Bots = list
	case keybase1.TeamRole_RESTRICTEDBOT:
		if botSettings == nil {
			return req, errors.New("botSettings must be specified for RESTRICTEDBOT role")
		}
		req.RestrictedBots = map[keybase1.UserVersion]keybase1.TeamBotSettings{
			uv: *botSettings,
		}
	default:
		return req, errors.New("invalid team role")
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

func RequestAccess(ctx context.Context, g *libkb.GlobalContext, teamname string) (keybase1.TeamRequestAccessResult, error) {
	arg := apiArg("team/request_access")
	arg.Args.Add("team", libkb.S{Val: teamname})
	mctx := libkb.NewMetaContext(ctx, g)
	apiRes, err := g.API.Post(mctx, arg)

	ret := keybase1.TeamRequestAccessResult{}
	if apiRes != nil && apiRes.Body != nil {
		// "is_open" key may not be included in result payload and it's
		// not an error.
		ret.Open, _ = apiRes.Body.AtKey("is_open").GetBool()
	}
	return ret, err
}

func TeamAcceptInviteOrRequestAccess(ctx context.Context, g *libkb.GlobalContext, ui keybase1.TeamsUiInterface, tokenOrName string) (keybase1.TeamAcceptOrRequestResult, error) {
	g.Log.CDebugf(ctx, "trying seitan token")

	mctx := libkb.NewMetaContext(ctx, g)

	// If token looks at all like Seitan, don't pass to functions that might log or send to server.
	maybeSeitanToken, isSeitany := ParseSeitanTokenFromPaste(tokenOrName)
	if isSeitany {
		g.Log.CDebugf(ctx, "found seitan-y token")
		wasSeitan, err := ParseAndAcceptSeitanToken(mctx, ui, maybeSeitanToken)
		return keybase1.TeamAcceptOrRequestResult{WasSeitan: wasSeitan}, err
	}

	g.Log.CDebugf(ctx, "trying email-style invite")
	err := AcceptServerTrustInvite(ctx, g, tokenOrName)
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
	Ctime    time.Time       `json:"ctime"`
	Username string          `json:"username"`
}

type accessRequestList struct {
	Requests []accessRequest `json:"requests"`
	Status   libkb.AppStatus `json:"status"`
}

func (r *accessRequestList) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

// Lists all requests in all of user-owned teams or a single team and tries to
// resolve their full names.
//
// Full names are not guaranteed to be present in the response. Given a large
// enough volume of access requests by unknown (to us) users, it's possible to
// run into a scenario where resolving thousands of username bundles would take
// longer than the 10s.
func ListRequests(ctx context.Context, g *libkb.GlobalContext, teamName *string) ([]keybase1.TeamJoinRequest, error) {
	var arg libkb.APIArg
	mctx := libkb.NewMetaContext(ctx, g)
	if teamName != nil {
		arg = apiArg("team/access_requests")
		arg.Args.Add("team", libkb.S{Val: *teamName})
	} else {
		arg = apiArg("team/laar")
	}

	var arList accessRequestList
	if err := mctx.G().API.GetDecode(mctx, arg, &arList); err != nil {
		return nil, err
	}

	var (
		joinRequests  = make([]keybase1.TeamJoinRequest, len(arList.Requests))
		requesterUIDs = make([]keybase1.UID, len(arList.Requests))
	)
	for i, ar := range arList.Requests {
		username := libkb.NewNormalizedUsername(ar.Username)
		uid := libkb.GetUIDByNormalizedUsername(g, username)

		requesterUIDs[i] = uid
		joinRequests[i] = keybase1.TeamJoinRequest{
			Name:     ar.FQName,
			Username: username.String(),
			Ctime:    keybase1.ToUnixTime(ar.Ctime),
		}
	}

	packages, err := g.UIDMapper.MapUIDsToUsernamePackages(ctx, g, requesterUIDs,
		defaultFullnameFreshness, 10*time.Second, true /* forceNetworkForFullNames */)
	if err != nil {
		g.Log.Debug("TeamsListRequests: failed to run uid mapper: %s", err)
	}
	for i, uid := range requesterUIDs {
		if packages[i].NormalizedUsername.IsNil() {
			g.Log.Debug("TeamsListRequests: failed to get username for: %s", uid)
			continue
		}
		if packages[i].FullName != nil {
			joinRequests[i].FullName = packages[i].FullName.FullName
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
	mctx := libkb.NewMetaContext(ctx, g)
	arg := apiArg("team/my_access_requests")
	if teamName != nil {
		arg.Args.Add("team", libkb.S{Val: *teamName})
	}

	var arList myAccessRequestsList
	if err := mctx.G().API.GetDecode(mctx, arg, &arList); err != nil {
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
	mctx := libkb.NewMetaContext(ctx, g)
	uv, err := loadUserVersionByUsername(ctx, g, username, false /* useTracking */)
	if err != nil {
		if err == errInviteRequired {
			return libkb.NotFoundError{
				Msg: fmt.Sprintf("No keybase user found (%s)", username),
			}
		}
		return err
	}
	arg := apiArg("team/deny_access")
	arg.Args.Add("team", libkb.S{Val: teamName})
	arg.Args.Add("uid", libkb.S{Val: uv.Uid.String()})
	if _, err := mctx.G().API.Post(mctx, arg); err != nil {
		return err
	}
	t, err := GetForTeamManagementByStringName(ctx, g, teamName, true)
	if err != nil {
		return err
	}
	return t.notifyNoChainChange(ctx, keybase1.TeamChangeSet{Misc: true})
}

func apiArg(endpoint string) libkb.APIArg {
	arg := libkb.NewAPIArg(endpoint)
	arg.Args = libkb.NewHTTPArgs()
	arg.SessionType = libkb.APISessionTypeREQUIRED
	return arg
}

func GetRootID(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (keybase1.TeamID, error) {
	team, _, err := g.GetTeamLoader().Load(ctx, keybase1.LoadTeamArg{
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
	mctx := libkb.NewMetaContext(ctx, g)
	id, err := GetTeamIDByNameRPC(mctx, teamName)
	if err != nil {
		return err
	}
	return ChangeTeamSettingsByID(ctx, g, id, settings)
}

func ChangeTeamSettingsByID(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID,
	settings keybase1.TeamSettings) error {
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
		t, err := GetForTeamManagementByTeamID(ctx, g, id, true)
		if err != nil {
			return err
		}

		if !settings.Open && !t.IsOpen() {
			g.Log.CDebugf(ctx, "team is already closed, just returning: %s", id)
			return nil
		}

		if settings.Open && t.IsOpen() && t.OpenTeamJoinAs() == settings.JoinAs {
			g.Log.CDebugf(ctx, "team is already open with default role: team: %s role: %s",
				id, strings.ToLower(t.OpenTeamJoinAs().String()))
			return nil
		}

		// Rotate if team is moving from open to closed.
		rotateKey := t.IsOpen() && !settings.Open
		return t.PostTeamSettings(ctx, settings, rotateKey)
	})
}

func removeMemberInvite(ctx context.Context, g *libkb.GlobalContext, team *Team, username string, uv keybase1.UserVersion) (err error) {
	g.CTrace(ctx, "removeMemberInvite", &err)
	var lookingFor keybase1.TeamInviteName
	var typ string
	if !uv.IsNil() {
		lookingFor = uv.TeamInviteName()
		typ = "keybase"
	} else {
		ptyp, name, err := parseSocialAssertion(libkb.NewMetaContext(ctx, g), username)
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
	itype, err := TeamInviteTypeFromString(libkb.NewMetaContext(ctx, g), typ)
	if err != nil {
		return err
	}
	validatedType, err := itype.String()
	if err != nil {
		return err
	}

	for _, invMD := range team.chain().ActiveInvites() {
		inv := invMD.Invite
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
	return NewMemberNotFoundInChainError(libkb.NotFoundError{})
}

func removeKeybaseTypeInviteForUID(ctx context.Context, g *libkb.GlobalContext, team *Team, uid keybase1.UID) (err error) {
	g.CTrace(ctx, "removeKeybaseTypeInviteForUID", &err)
	g.Log.CDebugf(ctx, "looking for active or obsolete keybase-type invite in %s for %s", team.Name(), uid)

	// Remove all invites with given UID, so we don't have to worry
	// about old teams that might have duplicates.

	var toRemove []keybase1.TeamInviteID
	allInvites := team.GetActiveAndObsoleteInvites()
	for _, invite := range allInvites {
		if inviteUv, err := invite.KeybaseUserVersion(); err == nil {
			if inviteUv.Uid.Equal(uid) {
				g.Log.CDebugf(ctx, "found keybase-type invite %s for %s, removing", invite.Id, invite.Name)
				toRemove = append(toRemove, invite.Id)
			}
		}
	}

	if len(toRemove) > 0 {
		g.Log.CDebugf(ctx, "found %d keybase-type invites for %s, trying to post remove invite link",
			len(toRemove), uid)
		return removeMultipleInviteIDs(ctx, team, toRemove)
	}

	g.Log.CDebugf(ctx, "no keybase-invites found to remove %s", uid)
	return NewMemberNotFoundInChainError(libkb.NotFoundError{})
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

func removeInviteID(ctx context.Context, team *Team, invID keybase1.TeamInviteID) (err error) {
	defer team.MetaContext(ctx).Trace("remoteInviteID", &err)()
	cancelList := []SCTeamInviteID{SCTeamInviteID(invID)}
	invites := SCTeamInvites{
		Cancel: &cancelList,
	}
	return team.postTeamInvites(ctx, invites)
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

func CreateInvitelink(mctx libkb.MetaContext, teamname string,
	role keybase1.TeamRole, maxUses keybase1.TeamInviteMaxUses,
	etime *keybase1.UnixTime) (invitelink keybase1.Invitelink, err error) {
	t, err := GetForTeamManagementByStringName(mctx.Ctx(), mctx.G(), teamname, true)
	if err != nil {
		return invitelink, err
	}
	ikey, id, err := t.InviteInvitelink(mctx.Ctx(), role, maxUses, etime)
	if err != nil {
		return invitelink, err
	}
	shortID, err := id.ToShortInviteID()
	if err != nil {
		return invitelink, err
	}
	return keybase1.Invitelink{
		Ikey: ikey,
		Url:  GenerateInvitelinkURL(mctx, ikey, shortID),
	}, err
}

// CreateTLF is called by KBFS when a TLF ID is associated with an implicit team.
// Should work on either named or implicit teams.
func CreateTLF(ctx context.Context, g *libkb.GlobalContext, arg keybase1.CreateTLFArg) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("CreateTLF(%v)", arg), &err)()
	ctx = libkb.WithLogTag(ctx, "CREATETLF")
	return RetryIfPossible(ctx, g, func(ctx context.Context, _ int) error {
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
	defer g.CTrace(ctx, fmt.Sprintf("GetKBFSTeamSettings(%v,%v)", isPublic, teamID), &err)()
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:     teamID,
		Public: isPublic,
	})
	if err != nil {
		return res, err
	}
	res.TlfID = team.LatestKBFSTLFID()
	g.Log.CDebugf(ctx, "res: %+v", res)
	return res, err
}

func CanUserPerform(ctx context.Context, g *libkb.GlobalContext, teamname string) (ret keybase1.TeamOperation, err error) {
	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		Name:                      teamname,
		StaleOK:                   true,
		Public:                    false, // assume private team
		AllowNameLookupBurstCache: true,
		AuditMode:                 keybase1.AuditMode_SKIP,
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

	getIsImplicitAdmin := func() (bool, error) {
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

	isRoleOrAbove := teamRole.IsOrAbove

	canMemberShowcase := func() (bool, error) {
		if teamRole.IsOrAbove(keybase1.TeamRole_ADMIN) {
			return true, nil
		} else if teamRole == keybase1.TeamRole_NONE {
			return false, nil
		}
		showcase, err := GetTeamShowcase(ctx, g, team.ID)
		if err != nil {
			return false, err
		}
		return showcase.AnyMemberShowcase, nil
	}

	getHasOtherOwner := func() (bool, error) {
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

	isBot := isRoleOrAbove(keybase1.TeamRole_BOT)
	isWriter := isRoleOrAbove(keybase1.TeamRole_WRITER)
	isAdmin := isRoleOrAbove(keybase1.TeamRole_ADMIN)
	isOwner := isRoleOrAbove(keybase1.TeamRole_OWNER)
	isImplicitAdmin, err := getIsImplicitAdmin()
	if err != nil {
		return ret, err
	}

	// team settings
	ret.ListFirst = isImplicitAdmin
	ret.JoinTeam = teamRole == keybase1.TeamRole_NONE && isImplicitAdmin
	ret.SetPublicityAny = isAdmin || isImplicitAdmin
	ret.ManageMembers = isAdmin || isImplicitAdmin
	ret.ManageSubteams = isAdmin || isImplicitAdmin
	ret.RenameTeam = team.IsSubteam() && isImplicitAdmin
	ret.SetTeamShowcase = isAdmin || isImplicitAdmin
	ret.ChangeOpenTeam = isAdmin || isImplicitAdmin
	ret.ChangeTarsDisabled = isAdmin || isImplicitAdmin
	ret.EditTeamDescription = isAdmin || isImplicitAdmin
	ret.ManageBots = isAdmin || isImplicitAdmin
	ret.ManageEmojis = isWriter
	ret.DeleteOtherEmojis = isAdmin
	ret.SetMemberShowcase, err = canMemberShowcase()
	if err != nil {
		return ret, err
	}
	if team.chain().IsSubteam() {
		ret.DeleteTeam = isImplicitAdmin
	} else {
		ret.DeleteTeam = isOwner
	}

	// only check hasOtherOwner if we have to.
	if teamRole != keybase1.TeamRole_NONE {
		leaveTeam := true
		if isOwner {
			hasOtherOwner, err := getHasOtherOwner()
			if err != nil {
				return ret, err
			}
			leaveTeam = hasOtherOwner
		}
		ret.LeaveTeam = leaveTeam
	}

	// chat settings
	ret.Chat = isBot
	ret.CreateChannel = isWriter
	ret.RenameChannel = isWriter
	ret.EditChannelDescription = isWriter
	ret.DeleteChannel = isAdmin
	ret.SetRetentionPolicy = isAdmin
	ret.SetMinWriterRole = isAdmin
	ret.DeleteChatHistory = isAdmin
	ret.DeleteOtherMessages = isAdmin
	ret.PinMessage = isWriter

	return ret, err
}

func RotateKey(ctx context.Context, g *libkb.GlobalContext, arg keybase1.TeamRotateKeyArg) (err error) {
	teamID := arg.TeamID
	defer g.CTrace(ctx, fmt.Sprintf("RotateKey(%+v)", arg), &err)()
	return RetryIfPossible(ctx, g, func(ctx context.Context, attempt int) error {
		team, err := Load(ctx, g, keybase1.LoadTeamArg{
			ID:          teamID,
			Public:      teamID.IsPublic(),
			ForceRepoll: attempt > 0,
		})
		if err != nil {
			return err
		}
		return team.Rotate(ctx, arg.Rt)
	})
}

func RotateKeyVisible(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) error {
	return RotateKey(ctx, g, keybase1.TeamRotateKeyArg{TeamID: id, Rt: keybase1.RotationType_VISIBLE})
}

func TeamDebug(ctx context.Context, g *libkb.GlobalContext, teamID keybase1.TeamID) (res keybase1.TeamDebugRes, err error) {
	defer g.CTrace(ctx, fmt.Sprintf("TeamDebug(%v)", teamID), &err)()
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

	if !team.IsImplicit() {
		return folder, NewExplicitTeamOperationError("MapImplicitTeamIDToDisplayName")
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

func GetTarsDisabled(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID) (bool, error) {
	mctx := libkb.NewMetaContext(ctx, g)
	arg := apiArg("team/disable_tars")
	arg.Args.Add("tid", libkb.S{Val: id.String()})
	var ret disableTARsRes
	if err := mctx.G().API.GetDecode(mctx, arg, &ret); err != nil {
		return false, err
	}

	return ret.Disabled, nil
}

func SetTarsDisabled(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, disabled bool) error {
	mctx := libkb.NewMetaContext(ctx, g)
	t, err := GetForTeamManagementByTeamID(ctx, g, id, true)
	if err != nil {
		return err
	}

	arg := apiArg("team/disable_tars")
	arg.Args.Add("tid", libkb.S{Val: id.String()})
	arg.Args.Add("disabled", libkb.B{Val: disabled})
	if _, err := mctx.G().API.Post(mctx, arg); err != nil {
		return err
	}
	return t.notifyNoChainChange(ctx, keybase1.TeamChangeSet{Misc: true})
}

type listProfileAddServerRes struct {
	libkb.AppStatusEmbed
	Teams []listProfileAddResEntry `json:"teams"`
}

type listProfileAddResEntry struct {
	TeamID     keybase1.TeamID `json:"team_id"`
	FqName     string          `json:"fq_name"`
	IsOpenTeam bool            `json:"is_open_team"`
	// Whether the caller has admin powers.
	CallerAdmin bool `json:"caller_admin"`
	// Whether the 'them' user is an explicit member.
	ThemMember bool `json:"them_member"`
}

func TeamProfileAddList(ctx context.Context, g *libkb.GlobalContext, username string) (res []keybase1.TeamProfileAddEntry, err error) {
	uname := kbun.NewNormalizedUsername(username)
	uid, err := g.GetUPAKLoader().LookupUID(ctx, uname)
	if err != nil {
		return nil, err
	}
	arg := apiArg("team/list_profile_add")
	arg.Args.Add("uid", libkb.S{Val: uid.String()})
	var serverRes listProfileAddServerRes
	mctx := libkb.NewMetaContext(ctx, g)
	if err = mctx.G().API.GetDecode(mctx, arg, &serverRes); err != nil {
		return nil, err
	}
	for _, entry := range serverRes.Teams {
		teamName, err := keybase1.TeamNameFromString(entry.FqName)
		if err != nil {
			mctx.Debug("TeamProfileAddList server returned bad team name %v: %v", entry.FqName, err)
			continue
		}
		disabledReason := ""
		if !entry.CallerAdmin {
			disabledReason = fmt.Sprintf("Only admins can add people.")
		} else if entry.ThemMember {
			disabledReason = fmt.Sprintf("%v is already a member.", uname.String())
		}
		res = append(res, keybase1.TeamProfileAddEntry{
			TeamID:         entry.TeamID,
			TeamName:       teamName,
			Open:           entry.IsOpenTeam,
			DisabledReason: disabledReason,
		})
	}
	return res, nil
}

func ChangeTeamAvatar(mctx libkb.MetaContext, arg keybase1.UploadTeamAvatarArg) error {
	team, err := Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		Name:        arg.Teamname,
		Public:      false,
		ForceRepoll: false,
		NeedAdmin:   true,
	})
	if err != nil {
		return fixupTeamGetError(mctx.Ctx(), mctx.G(), err, arg.Teamname, false /* public */)
	}

	if err := avatars.UploadImage(mctx, arg.Filename, &team.ID, arg.Crop); err != nil {
		return err
	}

	if arg.SendChatNotification {
		SendTeamChatChangeAvatar(mctx, team.Name().String(), mctx.G().Env.GetUsername().String())
	}
	return nil
}

func FindNextMerkleRootAfterRemoval(mctx libkb.MetaContext, arg keybase1.FindNextMerkleRootAfterTeamRemovalBySigningKeyArg) (res keybase1.NextMerkleRootRes, err error) {
	defer mctx.Trace(fmt.Sprintf("teams.FindNextMerkleRootAfterRemoval(%+v)", arg), &err)()

	team, err := Load(mctx.Ctx(), mctx.G(), keybase1.LoadTeamArg{
		ID:          arg.Team,
		Public:      arg.IsPublic,
		ForceRepoll: false,
		NeedAdmin:   false,
	})
	if err != nil {
		return res, err
	}
	upak, _, err := mctx.G().GetUPAKLoader().LoadV2(libkb.NewLoadUserArgWithMetaContext(mctx).
		WithUID(arg.Uid).
		WithPublicKeyOptional().
		WithForcePoll(false))
	if err != nil {
		return res, err
	}

	vers, _ := upak.FindKID(arg.SigningKey)
	if vers == nil {
		return res, libkb.NotFoundError{Msg: fmt.Sprintf("KID %s not found for %s", arg.SigningKey, arg.Uid)}
	}

	uv := vers.ToUserVersion()
	logPoints := team.chain().inner.UserLog[uv]
	demotionPredicate := func(p keybase1.UserLogPoint) bool {
		if arg.AnyRoleAllowed {
			return !p.Role.IsBotOrAbove()
		}
		return !p.Role.IsWriterOrAbove()
	}
	var earliestDemotion int
	var logPoint *keybase1.UserLogPoint
	for i := len(logPoints) - 1; i >= 0; i-- {
		if demotionPredicate(logPoints[i]) {
			earliestDemotion = i
		} else if earliestDemotion != 0 {
			p := logPoints[earliestDemotion].DeepCopy()
			logPoint = &p
			break
		}
	}
	if logPoint == nil {
		return res, libkb.NotFoundError{Msg: fmt.Sprintf("no downgraded log point for user found")}
	}

	return libkb.FindNextMerkleRootAfterTeamRemoval(mctx, keybase1.FindNextMerkleRootAfterTeamRemovalArg{
		Uid:               arg.Uid,
		Team:              arg.Team,
		IsPublic:          arg.IsPublic,
		TeamSigchainSeqno: logPoint.SigMeta.SigChainLocation.Seqno,
		Prev:              logPoint.SigMeta.PrevMerkleRootSigned,
	})
}

func ProfileTeamLoad(mctx libkb.MetaContext, arg keybase1.LoadTeamArg) (res keybase1.ProfileTeamLoadRes, err error) {
	pre := mctx.G().Clock().Now()
	_, err = Load(mctx.Ctx(), mctx.G(), arg)
	post := mctx.G().Clock().Now()
	res.LoadTimeNsec = post.Sub(pre).Nanoseconds()
	return res, err
}

func GetTeamIDByNameRPC(mctx libkb.MetaContext, teamName string) (res keybase1.TeamID, err error) {
	nameParsed, err := keybase1.TeamNameFromString(teamName)
	if err != nil {
		return "", err
	}
	id, err := ResolveNameToID(mctx.Ctx(), mctx.G(), nameParsed)
	if err != nil {
		return "", err
	}
	return id, nil
}

func FindAssertionsInTeamNoResolve(mctx libkb.MetaContext, teamID keybase1.TeamID, assertions []string) (ret []string, err error) {
	team, err := GetForTeamManagementByTeamID(mctx.Ctx(), mctx.G(), teamID, true /* needAdmin */)
	if err != nil {
		return nil, err
	}

	// Don't check one assertion more than once, if we got duplicates.
	checkedAssertions := make(map[string]bool)

	actx := externals.MakeAssertionContext(mctx)
	for _, assertionStr := range assertions {
		if _, found := checkedAssertions[assertionStr]; found {
			continue
		}
		checkedAssertions[assertionStr] = true

		assertion, err := libkb.AssertionParseAndOnly(actx, assertionStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse assertion %q: %w", assertionStr, err)
		}

		urls := assertion.CollectUrls(nil)
		if len(urls) > 1 {
			continue
		}

		url := urls[0]
		if url.IsKeybase() {
			// Load the user to get the right eldest seqno. We don't want
			// untrusted seqnos here from uidmapper, because UI might be
			// making decisions about whom to add to the team basing on
			// results from this function.
			loadUserArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithName(url.GetValue()).WithPublicKeyOptional()
			user, err := libkb.LoadUser(loadUserArg)
			if err != nil {
				if _, ok := err.(libkb.NotFoundError); ok {
					// User not found - that's fine.
					continue
				}
				return nil, fmt.Errorf("error when loading user for assertion %q: %w", assertionStr, err)
			}
			if user.GetStatus() != keybase1.StatusCode_SCOk {
				// User is deleted or something. Just skip for now.
				continue
			}
			uv := user.ToUserVersion()
			_, kbInviteUV, found := team.FindActiveKeybaseInvite(user.GetUID())
			if found && kbInviteUV.Eq(uv) {
				// Either user still doesn't have a PUK, or if they do, they
				// should be added automatically through team_rekeyd
				// notification soon.
				ret = append(ret, assertionStr)
				continue
			}

			teamUVs := team.AllUserVersionsByUID(mctx.Ctx(), user.GetUID())
			for _, teamUV := range teamUVs {
				if teamUV.Eq(uv) {
					ret = append(ret, assertionStr)
					break
				}
				// or else user is in the team but with old UV, so it's fine to
				// add them again.
			}
		} else {
			social, err := assertion.ToSocialAssertion()
			if err != nil {
				return nil, fmt.Errorf(
					"Don't know what to do with %q - not a social assertion or keybase username: %w",
					assertionStr, err)
			}
			hasInvite, err := team.HasActiveInvite(mctx, social.TeamInviteName(), social.TeamInviteType())
			if err != nil {
				return nil, fmt.Errorf("Failed checking %q: %w", assertionStr, err)
			}
			if hasInvite {
				ret = append(ret, assertionStr)
			}
		}
	}

	return ret, nil
}
