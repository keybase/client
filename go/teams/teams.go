package teams

import (
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type Team struct {
	libkb.Contextified

	ID   keybase1.TeamID
	Data *keybase1.TeamData

	keyManager *TeamKeyManager

	me      *libkb.User
	rotated bool
}

func NewTeam(ctx context.Context, g *libkb.GlobalContext, teamData *keybase1.TeamData) *Team {
	chain := TeamSigChainState{teamData.Chain}
	return &Team{
		Contextified: libkb.NewContextified(g),

		ID:   chain.GetID(),
		Data: teamData,
	}
}

func (t *Team) chain() *TeamSigChainState {
	return &TeamSigChainState{inner: t.Data.Chain}
}

func (t *Team) Name() keybase1.TeamName {
	return t.Data.Name
}

func (t *Team) Generation() keybase1.PerTeamKeyGeneration {
	return t.chain().GetLatestGeneration()
}

func (t *Team) IsPublic() bool {
	return t.chain().IsPublic()
}

func (t *Team) IsImplicit() bool {
	return t.chain().IsImplicit()
}

func (t *Team) IsOpen() bool {
	return t.chain().IsOpen()
}

func (t *Team) OpenTeamJoinAs() keybase1.TeamRole {
	return t.chain().inner.OpenTeamJoinAs
}

func (t *Team) SharedSecret(ctx context.Context) (ret keybase1.PerTeamKeySeed, err error) {
	defer t.G().CTrace(ctx, "Team#SharedSecret", func() error { return err })()
	gen := t.chain().GetLatestGeneration()
	item, ok := t.Data.PerTeamKeySeeds[gen]
	if !ok {
		return ret, fmt.Errorf("missing team secret for generation: %v", gen)
	}

	if t.keyManager == nil {
		t.keyManager, err = NewTeamKeyManagerWithSecret(t.G(), item.Seed, gen)
		if err != nil {
			return ret, err
		}
	}

	return t.keyManager.SharedSecret(), nil
}

func (t *Team) KBFSKey(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_KBFS)
}

func (t *Team) ChatKey(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_CHAT)
}

func (t *Team) GitMetadataKey(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_GIT_METADATA)
}

func (t *Team) IsMember(ctx context.Context, uv keybase1.UserVersion) bool {
	role, err := t.MemberRole(ctx, uv)
	if err != nil {
		t.G().Log.Debug("error getting user role: %s", err)
		return false
	}
	if role == keybase1.TeamRole_NONE {
		return false
	}
	return true
}

func (t *Team) MemberRole(ctx context.Context, uv keybase1.UserVersion) (keybase1.TeamRole, error) {
	return t.chain().GetUserRole(uv)
}

func (t *Team) UserVersionByUID(ctx context.Context, uid keybase1.UID) (keybase1.UserVersion, error) {
	return t.chain().GetLatestUVWithUID(uid)
}

func (t *Team) UsersWithRole(role keybase1.TeamRole) ([]keybase1.UserVersion, error) {
	return t.chain().GetUsersWithRole(role)
}

func (t *Team) UsersWithRoleOrAbove(role keybase1.TeamRole) ([]keybase1.UserVersion, error) {
	return t.chain().GetUsersWithRoleOrAbove(role)
}

func (t *Team) Members() (keybase1.TeamMembers, error) {
	var members keybase1.TeamMembers

	x, err := t.UsersWithRole(keybase1.TeamRole_OWNER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Owners = x
	x, err = t.UsersWithRole(keybase1.TeamRole_ADMIN)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Admins = x
	x, err = t.UsersWithRole(keybase1.TeamRole_WRITER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Writers = x
	x, err = t.UsersWithRole(keybase1.TeamRole_READER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Readers = x

	return members, nil
}

func (t *Team) ImplicitTeamDisplayName(ctx context.Context) (res keybase1.ImplicitTeamDisplayName, err error) {
	impName := keybase1.ImplicitTeamDisplayName{
		IsPublic:     t.IsPublic(),
		ConflictInfo: nil, // TODO should we know this here?
	}

	members, err := t.Members()
	if err != nil {
		return res, err
	}
	// Add the keybase owners
	for _, member := range members.Owners {
		name, err := t.G().GetUPAKLoader().LookupUsername(ctx, member.Uid)
		if err != nil {
			return res, err
		}
		impName.Writers.KeybaseUsers = append(impName.Writers.KeybaseUsers, name.String())
	}
	// Add the keybase readers
	for _, member := range members.Readers {
		name, err := t.G().GetUPAKLoader().LookupUsername(ctx, member.Uid)
		if err != nil {
			return res, err
		}
		impName.Readers.KeybaseUsers = append(impName.Readers.KeybaseUsers, name.String())
	}

	// Add the invites
	chainInvites := t.chain().inner.ActiveInvites
	inviteMap, err := AnnotateInvites(ctx, t.G(), chainInvites, t.Name().String())
	if err != nil {
		return res, err
	}
	for inviteID := range chainInvites {
		invite, ok := inviteMap[inviteID]
		if !ok {
			// this should never happen
			return res, fmt.Errorf("missing invite: %v", inviteID)
		}
		invtyp, err := invite.Type.C()
		if err != nil {
			continue
		}
		switch invtyp {
		case keybase1.TeamInviteCategory_SBS:
			sa := keybase1.SocialAssertion{
				User:    string(invite.Name),
				Service: keybase1.SocialAssertionService(string(invite.Type.Sbs())),
			}
			switch invite.Role {
			case keybase1.TeamRole_OWNER:
				impName.Writers.UnresolvedUsers = append(impName.Writers.UnresolvedUsers, sa)
			case keybase1.TeamRole_READER:
				impName.Readers.UnresolvedUsers = append(impName.Readers.UnresolvedUsers, sa)
			default:
				return res, fmt.Errorf("implicit team contains invite to role: %v (%v)", invite.Role, invite.Id)
			}
		case keybase1.TeamInviteCategory_KEYBASE:
			// invite.Name is the username of the invited user, which AnnotateInvites has resolved.
			switch invite.Role {
			case keybase1.TeamRole_OWNER:
				impName.Writers.KeybaseUsers = append(impName.Writers.KeybaseUsers, string(invite.Name))
			case keybase1.TeamRole_READER:
				impName.Readers.KeybaseUsers = append(impName.Readers.KeybaseUsers, string(invite.Name))
			default:
				return res, fmt.Errorf("implicit team contains invite to role: %v (%v)", invite.Role, invite.Id)
			}
		default:
			return res, fmt.Errorf("unrecognized invite type in implicit team: %v", invtyp)
		}
	}
	return impName, nil
}

func (t *Team) ImplicitTeamDisplayNameString(ctx context.Context) (string, error) {
	impName, err := t.ImplicitTeamDisplayName(ctx)
	if err != nil {
		return "", err
	}
	return FormatImplicitTeamDisplayName(ctx, t.G(), impName)
}

func (t *Team) NextSeqno() keybase1.Seqno {
	return t.CurrentSeqno() + 1
}

func (t *Team) CurrentSeqno() keybase1.Seqno {
	return t.chain().GetLatestSeqno()
}

func (t *Team) AllApplicationKeys(ctx context.Context, application keybase1.TeamApplication) (res []keybase1.TeamApplicationKey, err error) {
	latestGen := t.chain().GetLatestGeneration()
	for gen := keybase1.PerTeamKeyGeneration(1); gen <= latestGen; gen++ {
		appKey, err := t.ApplicationKeyAtGeneration(application, gen)
		if err != nil {
			return res, err
		}
		res = append(res, appKey)
	}
	return res, nil
}

// ApplicationKey returns the most recent key for an application.
func (t *Team) ApplicationKey(ctx context.Context, application keybase1.TeamApplication) (keybase1.TeamApplicationKey, error) {
	latestGen := t.chain().GetLatestGeneration()
	return t.ApplicationKeyAtGeneration(application, latestGen)
}

func (t *Team) ApplicationKeyAtGeneration(
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {

	item, ok := t.Data.PerTeamKeySeeds[generation]
	if !ok {
		return res, libkb.NotFoundError{
			Msg: fmt.Sprintf("no team secret found at generation %v", generation)}
	}
	rkm, err := t.readerKeyMask(application, generation)
	if err != nil {
		return res, err
	}
	return t.applicationKeyForMask(rkm, item.Seed)
}

func (t *Team) applicationKeyForMask(mask keybase1.ReaderKeyMask, secret keybase1.PerTeamKeySeed) (keybase1.TeamApplicationKey, error) {
	if secret.IsZero() {
		return keybase1.TeamApplicationKey{}, errors.New("nil shared secret in Team#applicationKeyForMask")
	}
	var derivationString string
	switch mask.Application {
	case keybase1.TeamApplication_KBFS:
		derivationString = libkb.TeamKBFSDerivationString
	case keybase1.TeamApplication_CHAT:
		derivationString = libkb.TeamChatDerivationString
	case keybase1.TeamApplication_SALTPACK:
		derivationString = libkb.TeamSaltpackDerivationString
	case keybase1.TeamApplication_GIT_METADATA:
		derivationString = libkb.TeamGitMetadataDerivationString
	default:
		return keybase1.TeamApplicationKey{}, errors.New("invalid application id")
	}

	key := keybase1.TeamApplicationKey{
		Application:   mask.Application,
		KeyGeneration: mask.Generation,
	}

	if len(mask.Mask) != 32 {
		return keybase1.TeamApplicationKey{}, fmt.Errorf("mask length: %d, expected 32", len(mask.Mask))
	}

	secBytes := make([]byte, len(mask.Mask))
	n := libkb.XORBytes(secBytes, derivedSecret(secret, derivationString), mask.Mask)
	if n != 32 {
		return key, errors.New("invalid derived secret xor mask size")
	}
	copy(key.Key[:], secBytes)

	return key, nil
}

func (t *Team) readerKeyMask(
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.ReaderKeyMask, err error) {

	m2, ok := t.Data.ReaderKeyMasks[application]
	if !ok {
		return res, NewKeyMaskNotFoundErrorForApplication(application)
	}
	mask, ok := m2[generation]
	if !ok {
		return res, NewKeyMaskNotFoundErrorForApplicationAndGeneration(application, generation)
	}
	return keybase1.ReaderKeyMask{
		Application: application,
		Generation:  generation,
		Mask:        mask,
	}, nil
}

func (t *Team) Rotate(ctx context.Context) error {

	// initialize key manager
	if _, err := t.SharedSecret(ctx); err != nil {
		return err
	}

	// load an empty member set (no membership changes)
	memSet := newMemberSet()

	admin, err := t.getAdminPermission(ctx, false)
	if err != nil {
		return err
	}

	if err := t.ForceMerkleRootUpdate(ctx); err != nil {
		return err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
	}

	// create the team section of the signature
	section.Members, err = memSet.Section()
	if err != nil {
		return err
	}

	// rotate the team key for all current members
	secretBoxes, perTeamKeySection, err := t.rotateBoxes(ctx, memSet)
	if err != nil {
		return err
	}
	section.PerTeamKey = perTeamKeySection

	// post the change to the server
	if err := t.postChangeItem(ctx, section, libkb.LinkTypeRotateKey, nil, sigPayloadArgs{secretBoxes: secretBoxes}); err != nil {
		return err
	}

	// send notification that team key rotated. The sequence number of team bumped by 1 as a
	// result of this work, so use `NextSeqno()` and not `CurrentSeqno()`. Note that we're going
	// to be getting this same notification a second time, since it will bounce off a gregor and
	// back to us. But they are idempotent, so it should be fine to be double-notified.
	t.G().NotifyRouter.HandleTeamChanged(ctx, t.chain().GetID(), t.Name().String(), t.NextSeqno(), keybase1.TeamChangeSet{KeyRotated: true})

	return nil
}

func (t *Team) isAdminOrOwner(m keybase1.UserVersion) (res bool, err error) {
	role, err := t.chain().GetUserRole(m)
	if err != nil {
		return false, err
	}
	if role == keybase1.TeamRole_OWNER || role == keybase1.TeamRole_ADMIN {
		res = true
	}
	return res, nil
}

func (t *Team) getDowngradedUsers(ctx context.Context, ms *memberSet) (uids []keybase1.UID, err error) {

	for _, member := range ms.None {
		// Load member first to check if their eldest_seqno has not changed.
		// If it did, the member was nuked and we do not need to lease.
		_, _, err := loadMember(ctx, t.G(), member.version, true)
		if err != nil {
			if _, reset := err.(libkb.AccountResetError); reset {
				continue
			} else {
				return nil, err
			}
		}

		uids = append(uids, member.version.Uid)
	}

	for _, member := range ms.nonAdmins() {
		admin, err := t.isAdminOrOwner(member.version)
		if err != nil {
			return nil, err
		}
		if admin {
			uids = append(uids, member.version.Uid)
		}
	}

	return uids, nil
}

func (t *Team) ChangeMembershipPermanent(ctx context.Context, req keybase1.TeamChangeReq, permanent bool) error {
	// create the change membership section + secretBoxes
	section, secretBoxes, implicitAdminBoxes, memberSet, err := t.changeMembershipSection(ctx, req)
	if err != nil {
		return err
	}

	if err := t.ForceMerkleRootUpdate(ctx); err != nil {
		return err
	}

	var merkleRoot *libkb.MerkleRoot
	var lease *libkb.Lease

	downgrades, err := t.getDowngradedUsers(ctx, memberSet)
	if err != nil {
		return err
	}

	if len(downgrades) != 0 {
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseByTeam(ctx, t.G(), t.chain().GetID(), downgrades)
		if err != nil {
			return err
		}
	}
	// post the change to the server
	sigPayloadArgs := sigPayloadArgs{
		secretBoxes:        secretBoxes,
		implicitAdminBoxes: implicitAdminBoxes,
		lease:              lease,
	}

	if permanent {
		sigPayloadArgs.prePayload = libkb.JSONPayload{"permanent": true}
	}

	if err := t.postChangeItem(ctx, section, libkb.LinkTypeChangeMembership, merkleRoot, sigPayloadArgs); err != nil {
		return err
	}

	// send notification that team key rotated
	changes := keybase1.TeamChangeSet{MembershipChanged: true, KeyRotated: t.rotated}
	t.G().NotifyRouter.HandleTeamChanged(ctx, t.chain().GetID(), t.Name().String(), t.NextSeqno(), changes)
	return nil
}

func (t *Team) ChangeMembership(ctx context.Context, req keybase1.TeamChangeReq) error {
	return t.ChangeMembershipPermanent(ctx, req, false)
}

func (t *Team) downgradeIfOwnerOrAdmin(ctx context.Context) (needsReload bool, err error) {
	me, err := t.loadMe(ctx)
	if err != nil {
		return false, err
	}

	uv := me.ToUserVersion()
	role, err := t.MemberRole(ctx, uv)
	if err != nil {
		return false, err
	}

	if role.IsAdminOrAbove() {
		reqs := keybase1.TeamChangeReq{Writers: []keybase1.UserVersion{uv}}
		if err := t.ChangeMembership(ctx, reqs); err != nil {
			return false, err
		}

		return true, nil
	}

	return false, nil
}

func (t *Team) Leave(ctx context.Context, permanent bool) error {
	// If we are owner or admin, we have to downgrade ourselves first.
	needsReload, err := t.downgradeIfOwnerOrAdmin(ctx)
	if err != nil {
		return err
	}
	if needsReload {
		t, err = Load(ctx, t.G(), keybase1.LoadTeamArg{ID: t.ID, ForceRepoll: true})
		if err != nil {
			return err
		}
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
	}

	sigPayloadArgs := sigPayloadArgs{
		prePayload: libkb.JSONPayload{"permanent": permanent},
	}
	return t.postChangeItem(ctx, section, libkb.LinkTypeLeave, nil, sigPayloadArgs)
}

func (t *Team) deleteRoot(ctx context.Context, ui keybase1.TeamsUiInterface) error {
	me, err := t.loadMe(ctx)
	if err != nil {
		return err
	}

	uv := me.ToUserVersion()
	role, err := t.MemberRole(ctx, uv)
	if err != nil {
		return err
	}

	if role != keybase1.TeamRole_OWNER {
		return libkb.AppStatusError{
			Code: int(keybase1.StatusCode_SCTeamSelfNotOwner),
			Name: "SELF_NOT_ONWER",
			Desc: "You must be an owner to delete a team",
		}
	}

	confirmed, err := ui.ConfirmRootTeamDelete(ctx, keybase1.ConfirmRootTeamDeleteArg{TeamName: t.Name().String()})
	if err != nil {
		return err
	}
	if !confirmed {
		return errors.New("team delete not confirmed")
	}

	teamSection := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(ctx, libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for team delete root")
	}

	sigMultiItem, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeDeleteRoot, mr)
	if err != nil {
		return err
	}

	payload := t.sigPayload(sigMultiItem, sigPayloadArgs{})
	return t.postMulti(payload)
}

func (t *Team) deleteSubteam(ctx context.Context, ui keybase1.TeamsUiInterface) error {

	// subteam delete consists of two links:
	// 1. delete_subteam in parent chain
	// 2. delete_up_pointer in subteam chain

	if t.IsImplicit() {
		return fmt.Errorf("unsupported delete of implicit subteam")
	}

	parentID := t.chain().GetParentID()
	parentTeam, err := Load(ctx, t.G(), keybase1.LoadTeamArg{
		ID:          *parentID,
		ForceRepoll: true,
	})
	if err != nil {
		return err
	}

	admin, err := parentTeam.getAdminPermission(ctx, true)
	if err != nil {
		return err
	}

	confirmed, err := ui.ConfirmSubteamDelete(ctx, keybase1.ConfirmSubteamDeleteArg{TeamName: t.Name().String()})
	if err != nil {
		return err
	}
	if !confirmed {
		return errors.New("team delete not confirmed")
	}

	subteamName := SCTeamName(t.Data.Name.String())

	entropy, err := makeSCTeamEntropy()
	if err != nil {
		return err
	}
	parentSection := SCTeamSection{
		ID: SCTeamID(parentTeam.ID),
		Subteam: &SCSubteam{
			ID:   SCTeamID(t.ID),
			Name: subteamName, // weird this is required
		},
		Admin:   admin,
		Public:  t.IsPublic(),
		Entropy: entropy,
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(ctx, libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for team delete subteam")
	}

	sigParent, err := parentTeam.sigTeamItem(ctx, parentSection, libkb.LinkTypeDeleteSubteam, mr)
	if err != nil {
		return err
	}

	subSection := SCTeamSection{
		ID:   SCTeamID(t.ID),
		Name: &subteamName, // weird this is required
		Parent: &SCTeamParent{
			ID:      SCTeamID(parentTeam.ID),
			Seqno:   parentTeam.chain().GetLatestSeqno() + 1, // the seqno of the *new* parent link
			SeqType: seqTypeForTeamPublicness(parentTeam.IsPublic()),
		},
		Public: t.IsPublic(),
		Admin:  admin,
	}
	sigSub, err := t.sigTeamItem(ctx, subSection, libkb.LinkTypeDeleteUpPointer, mr)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigParent, sigSub}
	return t.postMulti(payload)
}

func (t *Team) NumActiveInvites() int {
	return t.chain().NumActiveInvites()
}

func (t *Team) HasActiveInvite(name keybase1.TeamInviteName, typ string) (bool, error) {
	it, err := keybase1.TeamInviteTypeFromString(typ, t.G().Env.GetRunMode() == libkb.DevelRunMode)
	if err != nil {
		return false, err
	}
	return t.chain().HasActiveInvite(name, it)
}

func (t *Team) InviteMember(ctx context.Context, username string, role keybase1.TeamRole, resolvedUsername libkb.NormalizedUsername, uv keybase1.UserVersion) (keybase1.TeamAddMemberResult, error) {

	// if a user version was previously loaded, then there is a keybase user for username, but
	// without a PUK or without any keys. Note that we are allowed to invites Owners in this
	// manner. But if we're inviting for anything else, then no owner invites are allowed.
	if uv.Uid.Exists() {
		if role == keybase1.TeamRole_OWNER {
			txt := "We are sorry, you have hit a bug! The user you are inviting (" + username + ") hasn't logged into\n" +
				"Keybase for a while and needs to upgrade their account. Until they do, you can only add them to this team\n" +
				"as an admin, reader or writer. So you have three options: (1) wait until " + username + " upgrades;\n" +
				"(2) wait until all Keybase users get the fixed app (by 2017-11-07); or (3) add " + username + " as an admin (or reader or writer)"
			return keybase1.TeamAddMemberResult{}, errors.New(txt)
		}
		return t.inviteKeybaseMember(ctx, uv, role, resolvedUsername)
	}

	// If a social, or email, or other type of invite, assert it's now an owner.
	if role == keybase1.TeamRole_OWNER {
		return keybase1.TeamAddMemberResult{}, errors.New("You cannot invite an owner to a team.")
	}

	return t.inviteSBSMember(ctx, username, role)
}

func (t *Team) InviteEmailMember(ctx context.Context, email string, role keybase1.TeamRole) error {
	t.G().Log.Debug("team %s invite email member %s", t.Name(), email)

	if role == keybase1.TeamRole_OWNER {
		return errors.New("You cannot invite an owner to a team over email.")
	}

	invite := SCTeamInvite{
		Type: "email",
		Name: keybase1.TeamInviteName(email),
		ID:   NewInviteID(),
	}
	return t.postInvite(ctx, invite, role)
}

func (t *Team) inviteKeybaseMember(ctx context.Context, uv keybase1.UserVersion, role keybase1.TeamRole, resolvedUsername libkb.NormalizedUsername) (keybase1.TeamAddMemberResult, error) {
	t.G().Log.Debug("team %s invite keybase member %s", t.Name(), uv)
	invite := SCTeamInvite{
		Type: "keybase",
		Name: uv.TeamInviteName(),
		ID:   NewInviteID(),
	}
	t.G().Log.CDebugf(ctx, "invite: %+v", invite)
	if err := t.postInvite(ctx, invite, role); err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	return keybase1.TeamAddMemberResult{Invited: true, User: &keybase1.User{Uid: uv.Uid, Username: resolvedUsername.String()}}, nil
}

func (t *Team) inviteSBSMember(ctx context.Context, username string, role keybase1.TeamRole) (keybase1.TeamAddMemberResult, error) {
	// parse username to get social
	typ, name, err := t.parseSocial(username)
	if err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	t.G().Log.Debug("team %s invite sbs member %s/%s", t.Name(), typ, name)

	invite := SCTeamInvite{
		Type: typ,
		Name: keybase1.TeamInviteName(name),
		ID:   NewInviteID(),
	}

	if err := t.postInvite(ctx, invite, role); err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}

	return keybase1.TeamAddMemberResult{Invited: true}, nil
}

func (t *Team) postInvite(ctx context.Context, invite SCTeamInvite, role keybase1.TeamRole) error {
	existing, err := t.HasActiveInvite(invite.Name, invite.Type)
	if err != nil {
		return err
	}
	if existing {
		return libkb.ExistsError{Msg: "An invite for this user already exists."}
	}

	invList := []SCTeamInvite{invite}
	var invites SCTeamInvites
	switch role {
	case keybase1.TeamRole_ADMIN:
		invites.Admins = &invList
	case keybase1.TeamRole_WRITER:
		invites.Writers = &invList
	case keybase1.TeamRole_READER:
		invites.Readers = &invList
	case keybase1.TeamRole_OWNER:
		invites.Owners = &invList
	}

	return t.postTeamInvites(ctx, invites)
}

func (t *Team) postTeamInvites(ctx context.Context, invites SCTeamInvites) error {
	admin, err := t.getAdminPermission(ctx, true)
	if err != nil {
		return err
	}

	entropy, err := makeSCTeamEntropy()
	if err != nil {
		return err
	}

	teamSection := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Invites:  &invites,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		Entropy:  entropy,
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(ctx, libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for team invite")
	}

	sigMultiItem, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeInvite, mr)
	if err != nil {
		return err
	}

	payload := t.sigPayload(sigMultiItem, sigPayloadArgs{})
	return t.postMulti(payload)

}

func (t *Team) traverseUpUntil(ctx context.Context, validator func(t *Team) bool) (targetTeam *Team, err error) {
	targetTeam = t
	for {
		if validator(targetTeam) {
			return targetTeam, nil
		}
		parentID := targetTeam.chain().GetParentID()
		if parentID == nil {
			return nil, nil
		}
		targetTeam, err = Load(ctx, t.G(), keybase1.LoadTeamArg{
			ID: *parentID,
			// This is in a cold path anyway, so might as well trade reliability
			// at the expense of speed.
			ForceRepoll: true,
		})
		if err != nil {
			return nil, err
		}
	}
}

func (t *Team) getAdminPermission(ctx context.Context, required bool) (admin *SCTeamAdmin, err error) {
	me, err := t.loadMe(ctx)
	if err != nil {
		return nil, err
	}

	uv := me.ToUserVersion()
	targetTeam, err := t.traverseUpUntil(ctx, func(s *Team) bool {
		return s.chain().GetAdminUserLogPoint(uv) != nil
	})
	if err != nil {
		return nil, err
	}
	if targetTeam == nil {
		if required {
			err = errors.New("Only admins can perform this operation.")
		}
		return nil, err
	}

	logPoint := targetTeam.chain().GetAdminUserLogPoint(uv)
	ret := SCTeamAdmin{
		TeamID:  SCTeamID(targetTeam.ID),
		Seqno:   logPoint.SigMeta.SigChainLocation.Seqno,
		SeqType: logPoint.SigMeta.SigChainLocation.SeqType,
	}
	return &ret, nil
}

func (t *Team) changeMembershipSection(ctx context.Context, req keybase1.TeamChangeReq) (SCTeamSection, *PerTeamSharedSecretBoxes, map[keybase1.TeamID]*PerTeamSharedSecretBoxes, *memberSet, error) {
	// initialize key manager
	if _, err := t.SharedSecret(ctx); err != nil {
		return SCTeamSection{}, nil, nil, nil, err
	}

	admin, err := t.getAdminPermission(ctx, true)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, err
	}

	// load the member set specified in req
	memSet, err := newMemberSetChange(ctx, t.G(), req)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
	}

	section.Members, err = memSet.Section()
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, err
	}

	// create secret boxes for recipients, possibly rotating the key
	secretBoxes, implicitAdminBoxes, perTeamKeySection, err := t.recipientBoxes(ctx, memSet)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, err
	}
	section.PerTeamKey = perTeamKeySection

	section.CompletedInvites = req.CompletedInvites
	section.Implicit = t.IsImplicit()
	section.Public = t.IsPublic()
	return section, secretBoxes, implicitAdminBoxes, memSet, nil
}

func (t *Team) postChangeItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot, sigPayloadArgs sigPayloadArgs) error {
	// create the change item
	sigMultiItem, err := t.sigTeamItem(ctx, section, linkType, merkleRoot)
	if err != nil {
		return err
	}

	// make the payload
	payload := t.sigPayload(sigMultiItem, sigPayloadArgs)

	// send it to the server
	return t.postMulti(payload)
}

func (t *Team) loadMe(ctx context.Context) (*libkb.User, error) {
	if t.me == nil {
		me, err := libkb.LoadMe(libkb.NewLoadUserArgWithContext(ctx, t.G()))
		if err != nil {
			return nil, err
		}
		t.me = me
	}

	return t.me, nil
}

func usesPerTeamKeys(linkType libkb.LinkType) bool {
	switch linkType {
	case libkb.LinkTypeLeave:
		return false
	case libkb.LinkTypeInvite:
		return false
	case libkb.LinkTypeDeleteRoot:
		return false
	case libkb.LinkTypeDeleteSubteam:
		return false
	case libkb.LinkTypeDeleteUpPointer:
		return false
	}

	return true
}

func (t *Team) sigTeamItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot) (libkb.SigMultiItem, error) {
	me, err := t.loadMe(ctx)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	latestLinkID, err := libkb.ImportLinkID(t.chain().GetLatestLinkID())
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	sig, err := ChangeSig(me, latestLinkID, t.NextSeqno(), deviceSigningKey, section, linkType, merkleRoot)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	var signingKey libkb.NaclSigningKeyPair
	var encryptionKey libkb.NaclDHKeyPair
	if usesPerTeamKeys(linkType) {
		signingKey, err = t.keyManager.SigningKey()
		if err != nil {
			return libkb.SigMultiItem{}, err
		}
		encryptionKey, err = t.keyManager.EncryptionKey()
		if err != nil {
			return libkb.SigMultiItem{}, err
		}
		if section.PerTeamKey != nil {
			// need a reverse sig

			// set a nil value (not empty) for reverse_sig (fails without this)
			sig.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewNil())
			reverseSig, _, _, err := libkb.SignJSON(sig, signingKey)
			if err != nil {
				return libkb.SigMultiItem{}, err
			}
			sig.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewString(reverseSig))
		}
	}

	seqType := seqTypeForTeamPublicness(t.IsPublic())

	sigJSON, err := sig.Marshal()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		linkType,
		t.NextSeqno(),
		sigJSON,
		latestLinkID,
		false, /* hasRevokes */
		seqType,
	)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(linkType),
		SeqType:    seqType,
		SigInner:   string(sigJSON),
		TeamID:     t.chain().GetID(),
	}
	if usesPerTeamKeys(linkType) {
		sigMultiItem.PublicKeys = &libkb.SigMultiItemPublicKeys{
			Encryption: encryptionKey.GetKID(),
			Signing:    signingKey.GetKID(),
		}
	}
	return sigMultiItem, nil
}

func (t *Team) recipientBoxes(ctx context.Context, memSet *memberSet) (*PerTeamSharedSecretBoxes, map[keybase1.TeamID]*PerTeamSharedSecretBoxes, *SCPerTeamKey, error) {

	// get device key
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, nil, nil, err
	}

	// First create all the subteam per-team-key boxes for new implicit admins.
	// We'll return these whether or not we're doing a rotation below.
	// TODO: Should we no-op this if the admins+owners aren't actually new?
	var implicitAdminBoxes map[keybase1.TeamID]*PerTeamSharedSecretBoxes
	adminAndOwnerRecipients := memSet.adminAndOwnerRecipients()
	if len(adminAndOwnerRecipients) > 0 {
		implicitAdminBoxes = map[keybase1.TeamID]*PerTeamSharedSecretBoxes{}
		subteams, err := t.loadAllTransitiveSubteams(ctx, true /*forceRepoll*/)
		if err != nil {
			return nil, nil, nil, err
		}
		for _, subteam := range subteams {
			subteamBoxes, err := subteam.keyManager.SharedSecretBoxes(ctx, deviceEncryptionKey, adminAndOwnerRecipients)
			if err != nil {
				return nil, nil, nil, err
			}
			implicitAdminBoxes[subteam.ID] = subteamBoxes
		}
	}

	// if there are any removals happening, need to rotate the
	// team key, and recipients will be all the users in the team
	// after the removal.
	if memSet.HasRemoval() {
		// key is rotating, so recipients needs to be all the remaining members
		// of the team after the removal (and including any new members in this
		// change)
		t.G().Log.Debug("team change request contains removal, rotating team key")
		boxes, perTeamKey, err := t.rotateBoxes(ctx, memSet)
		return boxes, implicitAdminBoxes, perTeamKey, err
	}

	// don't need keys for existing members, so remove them from the set
	memSet.removeExistingMembers(ctx, t)
	t.G().Log.Debug("team change request: %d new members", len(memSet.recipients))
	if len(memSet.recipients) == 0 {
		return nil, implicitAdminBoxes, nil, nil
	}

	boxes, err := t.keyManager.SharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return nil, nil, nil, err
	}
	// No SCPerTeamKey section when the key isn't rotated
	return boxes, implicitAdminBoxes, nil, err
}

func (t *Team) rotateBoxes(ctx context.Context, memSet *memberSet) (*PerTeamSharedSecretBoxes, *SCPerTeamKey, error) {
	// get device key
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, nil, err
	}

	// rotate the team key for all current members
	existing, err := t.Members()
	if err != nil {
		return nil, nil, err
	}
	if err := memSet.AddRemainingRecipients(ctx, t.G(), existing); err != nil {
		return nil, nil, err
	}

	if t.chain().IsSubteam() {
		// rotate needs to be keyed for all admins above it
		allParentAdmins, err := t.G().GetTeamLoader().ImplicitAdmins(ctx, t.ID)
		if err != nil {
			return nil, nil, err
		}
		_, err = memSet.loadGroup(ctx, t.G(), allParentAdmins, true, true)
		if err != nil {
			return nil, nil, err
		}
	}

	t.rotated = true

	return t.keyManager.RotateSharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
}

type sigPayloadArgs struct {
	secretBoxes        *PerTeamSharedSecretBoxes
	implicitAdminBoxes map[keybase1.TeamID]*PerTeamSharedSecretBoxes
	lease              *libkb.Lease
	prePayload         libkb.JSONPayload
}

func (t *Team) sigPayload(sigMultiItem libkb.SigMultiItem, args sigPayloadArgs) libkb.JSONPayload {
	payload := libkb.JSONPayload{}
	// copy the prepayload so we don't mutate it
	for k, v := range args.prePayload {
		payload[k] = v
	}
	payload["sigs"] = []interface{}{sigMultiItem}
	if args.secretBoxes != nil {
		payload["per_team_key"] = args.secretBoxes
	}
	if args.implicitAdminBoxes != nil {
		payload["implicit_team_keys"] = args.implicitAdminBoxes
	}
	if args.lease != nil {
		payload["downgrade_lease_id"] = args.lease.LeaseID
	}

	if t.G().VDL.DumpPayload() {
		pretty, err := json.MarshalIndent(payload, "", "\t")
		if err != nil {
			t.G().Log.Info("json marshal error: %s", err)
		} else {
			t.G().Log.Info("payload: %s", pretty)
		}
	}

	return payload
}

func (t *Team) postMulti(payload libkb.JSONPayload) error {
	_, err := t.G().API.PostJSON(libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}

// ForceMerkleRootUpdate will call LookupTeam on MerkleClient to
// update cached merkle root to include latest team sigs. Needed if
// client wants to create a signature that refers to an adminship,
// signature's merkle_root has to be more fresh than adminship's.
func (t *Team) ForceMerkleRootUpdate(ctx context.Context) error {
	_, err := t.G().GetMerkleClient().LookupTeam(ctx, t.ID)
	return err
}

func (t *Team) AllAdmins(ctx context.Context) ([]keybase1.UserVersion, error) {
	set := make(map[keybase1.UserVersion]bool)

	owners, err := t.UsersWithRole(keybase1.TeamRole_OWNER)
	if err != nil {
		return nil, err
	}
	for _, m := range owners {
		set[m] = true
	}

	admins, err := t.UsersWithRole(keybase1.TeamRole_ADMIN)
	if err != nil {
		return nil, err
	}
	for _, m := range admins {
		set[m] = true
	}

	if t.chain().IsSubteam() {
		imp, err := t.G().GetTeamLoader().ImplicitAdmins(ctx, t.ID)
		if err != nil {
			return nil, err
		}
		for _, m := range imp {
			set[m] = true
		}
	}

	var all []keybase1.UserVersion
	for uv := range set {
		all = append(all, uv)
	}
	return all, nil
}

func LoadTeamPlusApplicationKeys(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID,
	application keybase1.TeamApplication, refreshers keybase1.TeamRefreshers) (res keybase1.TeamPlusApplicationKeys, err error) {

	team, err := Load(ctx, g, keybase1.LoadTeamArg{
		ID:         id,
		Refreshers: refreshers,
	})
	if err != nil {
		return res, err
	}
	return team.ExportToTeamPlusApplicationKeys(ctx, keybase1.Time(0), application)
}

// Restriction inherited from ListSubteams:
// Only call this on a Team that has been loaded with NeedAdmin.
// Otherwise, you might get incoherent answers due to links that
// were stubbed over the life of the cached object.
func (t *Team) loadAllTransitiveSubteams(ctx context.Context, forceRepoll bool) ([]*Team, error) {
	subteams := []*Team{}
	for _, idAndName := range t.chain().ListSubteams() {
		// Load each subteam...
		subteam, err := Load(ctx, t.G(), keybase1.LoadTeamArg{
			ID:          idAndName.Id,
			NeedAdmin:   true,
			ForceRepoll: true,
		})
		if err != nil {
			return nil, err
		}

		// Force loading the key manager.
		// TODO: Should this be the default, so that we don't need to do it here?
		_, err = subteam.SharedSecret(ctx)
		if err != nil {
			return nil, err
		}

		subteams = append(subteams, subteam)

		// ...and then recursively load each subteam's children.
		recursiveSubteams, err := subteam.loadAllTransitiveSubteams(ctx, forceRepoll)
		if err != nil {
			return nil, err
		}
		subteams = append(subteams, recursiveSubteams...)
	}
	return subteams, nil
}

func (t *Team) PostTeamSettings(ctx context.Context, settings keybase1.TeamSettings) error {
	if _, err := t.SharedSecret(ctx); err != nil {
		return err
	}

	admin, err := t.getAdminPermission(ctx, true)
	if err != nil {
		return err
	}

	scSettings, err := CreateTeamSettings(settings.Open, settings.JoinAs)
	if err != nil {
		return err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Settings: &scSettings,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
	}

	return t.postChangeItem(ctx, section, libkb.LinkTypeSettings, nil, sigPayloadArgs{})
}

func (t *Team) parseSocial(username string) (typ string, name string, err error) {
	assertion, err := libkb.ParseAssertionURL(t.G().MakeAssertionContext(), username, false)
	if err != nil {
		return "", "", err
	}
	if assertion.IsKeybase() {
		return "", "", fmt.Errorf("invalid user assertion %q, keybase assertion should be handled earlier", username)
	}
	typ, name = assertion.ToKeyValuePair()

	return typ, name, nil
}
