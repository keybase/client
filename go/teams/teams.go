package teams

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/keybase/go-codec/codec"

	"golang.org/x/crypto/nacl/secretbox"
	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// A snapshot of a team's state.
// Not threadsafe.
type Team struct {
	libkb.Contextified

	ID   keybase1.TeamID
	Data *keybase1.TeamData

	keyManager *TeamKeyManager

	// rotated is set by rotateBoxes after rotating team key.
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

func (t *Team) CanSkipKeyRotation() bool {
	// Only applies for >=200 member teams.
	const MinTeamSize = 200
	// Aim for one rotation every 24h.
	const KeyRotateInterval = time.Duration(24) * time.Hour

	if t.IsImplicit() {
		// Do not do this optimization for implicit teams.
		return false
	}

	// If cannot decide because of an error, return default false.
	members, err := t.UsersWithRoleOrAbove(keybase1.TeamRole_READER)
	if err != nil {
		return false
	}
	if len(members) < MinTeamSize {
		// Not a big team
		return false
	}

	now := t.G().Clock().Now()
	duration := now.Sub(time.Unix(int64(t.chain().GetLatestPerTeamKeyCTime()), 0))
	if duration > KeyRotateInterval {
		// Last key rotation was more than predefined interval.
		return false
	}
	// Team is big and key was rotated recently - can skip rotation.
	return true
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

func (t *Team) IsSubteam() bool {
	return t.chain().IsSubteam()
}

func (t *Team) IsOpen() bool {
	return t.chain().IsOpen()
}

func (t *Team) OpenTeamJoinAs() keybase1.TeamRole {
	return t.chain().inner.OpenTeamJoinAs
}

func (t *Team) KBFSTLFID() keybase1.TLFID {
	return t.chain().inner.TlfID
}

func (t *Team) KBFSCryptKeys(ctx context.Context, appType keybase1.TeamApplication) []keybase1.CryptKey {
	return t.Data.TlfCryptKeys[appType]
}

func (t *Team) getKeyManager() (km *TeamKeyManager, err error) {
	if t.keyManager == nil {
		gen := t.chain().GetLatestGeneration()
		item, ok := t.Data.PerTeamKeySeeds[gen]
		if !ok {
			return nil, fmt.Errorf("missing team secret for generation: %v", gen)
		}

		t.keyManager, err = NewTeamKeyManagerWithSecret(t.G(), item.Seed, gen)
		if err != nil {
			return nil, err
		}
	}
	return t.keyManager, nil
}

func (t *Team) SharedSecret(ctx context.Context) (ret keybase1.PerTeamKeySeed, err error) {
	defer t.G().CTrace(ctx, "Team#SharedSecret", func() error { return err })()
	km, err := t.getKeyManager()
	if err != nil {
		return ret, err
	}
	return km.SharedSecret(), nil
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

func (t *Team) SeitanInviteTokenKeyLatest(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_SEITAN_INVITE_TOKEN)
}

func (t *Team) SeitanInviteTokenKeyAtGeneration(ctx context.Context, generation keybase1.PerTeamKeyGeneration) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKeyAtGeneration(keybase1.TeamApplication_SEITAN_INVITE_TOKEN, generation)
}

func (t *Team) SigningKey() (key libkb.NaclSigningKeyPair, err error) {
	km, err := t.getKeyManager()
	if err != nil {
		return key, err
	}
	return km.SigningKey()
}

func (t *Team) EncryptionKey() (key libkb.NaclDHKeyPair, err error) {
	km, err := t.getKeyManager()
	if err != nil {
		return key, err
	}
	return km.EncryptionKey()
}

func (t *Team) encryptionKeyAtGen(gen keybase1.PerTeamKeyGeneration) (key libkb.NaclDHKeyPair, err error) {
	item, ok := t.Data.PerTeamKeySeeds[gen]
	if !ok {
		return key, libkb.NotFoundError{Msg: fmt.Sprintf("Key at gen %v not found", gen)}
	}
	keyManager, err := NewTeamKeyManagerWithSecret(t.G(), item.Seed, gen)
	if err != nil {
		return key, err
	}
	return keyManager.EncryptionKey()
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

func (t *Team) myRole(ctx context.Context) (keybase1.TeamRole, error) {
	uv, err := t.currentUserUV(ctx)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	role, err := t.MemberRole(ctx, uv)
	return role, err
}

func (t *Team) UserVersionByUID(ctx context.Context, uid keybase1.UID) (keybase1.UserVersion, error) {
	return t.chain().GetLatestUVWithUID(uid)
}

func (t *Team) AllUserVersionsByUID(ctx context.Context, uid keybase1.UID) []keybase1.UserVersion {
	return t.chain().GetAllUVsWithUID(uid)
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

	seenKBUsers := make(map[string]bool)
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
	// Mark all the usernames we know about
	for _, name := range append(impName.Writers.KeybaseUsers, impName.Readers.KeybaseUsers...) {
		seenKBUsers[name] = true
	}

	// Add the invites
	chainInvites := t.chain().inner.ActiveInvites
	inviteMap, err := AnnotateInvites(ctx, t.G(), t)
	if err != nil {
		return res, err
	}
	isFullyResolved := true
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
			isFullyResolved = false
		case keybase1.TeamInviteCategory_KEYBASE:
			// Check to make sure we don't already have the user in the name
			iname := string(invite.Name)
			if seenKBUsers[iname] {
				continue
			}
			seenKBUsers[iname] = true
			// invite.Name is the username of the invited user, which AnnotateInvites has resolved.
			switch invite.Role {
			case keybase1.TeamRole_OWNER:
				impName.Writers.KeybaseUsers = append(impName.Writers.KeybaseUsers, iname)
			case keybase1.TeamRole_READER:
				impName.Readers.KeybaseUsers = append(impName.Readers.KeybaseUsers, iname)
			default:
				return res, fmt.Errorf("implicit team contains invite to role: %v (%v)", invite.Role,
					invite.Id)
			}
		default:
			return res, fmt.Errorf("unrecognized invite type in implicit team: %v", invtyp)
		}
	}

	impName, err = GetConflictInfo(ctx, t.G(), t.ID, isFullyResolved, impName)
	if err != nil {
		return res, err
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
	return AllApplicationKeys(ctx, t.Data, application, t.chain().GetLatestGeneration())
}

// ApplicationKey returns the most recent key for an application.
func (t *Team) ApplicationKey(ctx context.Context, application keybase1.TeamApplication) (keybase1.TeamApplicationKey, error) {
	latestGen := t.chain().GetLatestGeneration()
	return t.ApplicationKeyAtGeneration(application, latestGen)
}

func (t *Team) ApplicationKeyAtGeneration(
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {
	return ApplicationKeyAtGeneration(t.Data, application, generation)
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
	secretBoxes, perTeamKeySection, teamEKPayload, err := t.rotateBoxes(ctx, memSet)
	if err != nil {
		return err
	}
	section.PerTeamKey = perTeamKeySection

	// post the change to the server
	payloadArgs := sigPayloadArgs{
		secretBoxes:   secretBoxes,
		teamEKPayload: teamEKPayload,
	}
	if err := t.postChangeItem(ctx, section, libkb.LinkTypeRotateKey, nil, payloadArgs); err != nil {
		return err
	}

	t.notify(ctx, keybase1.TeamChangeSet{KeyRotated: true})
	t.storeTeamEKPayload(ctx, teamEKPayload)

	return nil
}

func (t *Team) isAdminOrOwner(m keybase1.UserVersion) (res bool, err error) {
	role, err := t.chain().GetUserRole(m)
	if err != nil {
		return false, err
	}
	if role.IsAdminOrAbove() {
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

type ChangeMembershipOptions struct {
	// Pass "permanent" flag, user will not be able to request access
	// to the team again, admin will have to add them back.
	Permanent bool

	// Do not rotate team key, even on member removals. Server will
	// queue CLKR if client sends removals without rotation.
	SkipKeyRotation bool
}

func (t *Team) ChangeMembershipWithOptions(ctx context.Context, req keybase1.TeamChangeReq, opts ChangeMembershipOptions) (err error) {
	defer t.G().CTrace(ctx, "Team.ChangeMembershipPermanent", func() error { return err })()

	if t.IsSubteam() && len(req.Owners) > 0 {
		return NewSubteamOwnersError()
	}

	// create the change membership section + secretBoxes
	section, secretBoxes, implicitAdminBoxes, teamEKPayload, memberSet, err := t.changeMembershipSection(ctx, req, opts.SkipKeyRotation)
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
		lease, merkleRoot, err = libkb.RequestDowngradeLeaseByTeam(ctx, t.G(), t.ID, downgrades)
		if err != nil {
			return err
		}
		defer func() {
			// We must cancel in the case of an error in postChangeItem, but it's safe to cancel
			// if everything worked. So we always cancel the lease on the way out of this function.
			// See CORE-6473 for a case in which this was needed. And also the test
			// `TestOnlyOwnerLeaveThenUpgradeFriend`.
			err := libkb.CancelDowngradeLease(ctx, t.G(), lease.LeaseID)
			if err != nil {
				t.G().Log.CWarningf(ctx, "Failed to cancel downgrade lease: %s", err.Error())
			}
		}()
	}
	// post the change to the server
	sigPayloadArgs := sigPayloadArgs{
		secretBoxes:        secretBoxes,
		implicitAdminBoxes: implicitAdminBoxes,
		lease:              lease,
		teamEKPayload:      teamEKPayload,
	}

	if opts.Permanent {
		sigPayloadArgs.prePayload = libkb.JSONPayload{"permanent": true}
	}

	if err := t.postChangeItem(ctx, section, libkb.LinkTypeChangeMembership, merkleRoot, sigPayloadArgs); err != nil {
		return err
	}

	t.notify(ctx, keybase1.TeamChangeSet{MembershipChanged: true})

	return nil
}

func (t *Team) ChangeMembership(ctx context.Context, req keybase1.TeamChangeReq) error {
	return t.ChangeMembershipWithOptions(ctx, req, ChangeMembershipOptions{})
}

func (t *Team) downgradeIfOwnerOrAdmin(ctx context.Context) (needsReload bool, err error) {
	defer t.G().CTrace(ctx, "Team#downgradeIfOwnerOrAdmin", func() error { return err })()

	uv, err := t.currentUserUV(ctx)
	if err != nil {
		return false, err
	}

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
		t, err = Load(ctx, t.G(), keybase1.LoadTeamArg{
			ID:          t.ID,
			Public:      t.IsPublic(),
			ForceRepoll: true,
		})
		if err != nil {
			return err
		}
	}

	// Check if we are an implicit admin with no explicit membership
	// in order to give a nice error.
	role, err := t.myRole(ctx)
	if err != nil {
		role = keybase1.TeamRole_NONE
	}
	if role == keybase1.TeamRole_NONE {
		_, err := t.getAdminPermission(ctx, false)
		if err == nil {
			return NewImplicitAdminCannotLeaveError()
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
	uv, err := t.currentUserUV(ctx)
	if err != nil {
		return err
	}

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

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
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

	payload := t.sigPayload([]libkb.SigMultiItem{sigMultiItem}, sigPayloadArgs{})
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
		Public:      t.IsPublic(),
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

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
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

func (t *Team) FindActiveKeybaseInvite(uid keybase1.UID) (keybase1.TeamInvite, keybase1.UserVersion, bool) {
	return t.chain().FindActiveKeybaseInvite(uid)
}

func (t *Team) GetActiveAndObsoleteInvites() (ret map[keybase1.TeamInviteID]keybase1.TeamInvite) {
	ret = make(map[keybase1.TeamInviteID]keybase1.TeamInvite)
	for id, invite := range t.chain().inner.ActiveInvites {
		ret[id] = invite
	}
	for id, invite := range t.chain().inner.ObsoleteInvites {
		ret[id] = invite
	}
	return ret
}

// If uv.Uid is set, then username is ignored.
// Otherwise resolvedUsername and uv are ignored.
func (t *Team) InviteMember(ctx context.Context, username string, role keybase1.TeamRole, resolvedUsername libkb.NormalizedUsername, uv keybase1.UserVersion) (keybase1.TeamAddMemberResult, error) {
	// if a user version was previously loaded, then there is a keybase user for username, but
	// without a PUK or without any keys.
	if uv.Uid.Exists() {
		return t.inviteKeybaseMember(ctx, uv, role, resolvedUsername)
	}

	// If a social, or email, or other type of invite, assert it's not an owner.
	if role.IsOrAbove(keybase1.TeamRole_OWNER) {
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

func (t *Team) inviteKeybaseMember(ctx context.Context, uv keybase1.UserVersion, role keybase1.TeamRole, resolvedUsername libkb.NormalizedUsername) (res keybase1.TeamAddMemberResult, err error) {
	t.G().Log.Debug("team %s invite keybase member %s", t.Name(), uv)

	invite := SCTeamInvite{
		Type: "keybase",
		Name: uv.TeamInviteName(),
		ID:   NewInviteID(),
	}

	existing, err := t.HasActiveInvite(invite.Name, invite.Type)
	if err != nil {
		return res, err
	}

	if existing {
		return res, libkb.ExistsError{Msg: "An invite for this user already exists."}
	}

	if t.IsSubteam() && role == keybase1.TeamRole_OWNER {
		return res, NewSubteamOwnersError()
	}

	invList := []SCTeamInvite{invite}
	cancelList := []SCTeamInviteID{}

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

	// Inviting keybase PUKless member has to remove old invites for that
	// uid first, or it will bounce off the server with an error. There is
	// no hard limit in team player to disallow multiple keybase invites
	// for the same UID, but there is a soft serverside check when
	// signature is posted.
	for inviteID, existingInvite := range t.GetActiveAndObsoleteInvites() {
		// KeybaseUserVersion checks if invite is KEYBASE and errors
		// if not, we can blindly call it for all invites, and continue
		// to next one if we get an error.
		existingUV, err := existingInvite.KeybaseUserVersion()
		if err != nil {
			continue
		}

		if existingUV.Uid != uv.Uid {
			continue
		}

		if uv.EldestSeqno != 0 && existingUV.EldestSeqno > uv.EldestSeqno {
			// We probably know invitee by their outdated EldestSeqno. There
			// is also a server check for this case.
			return res, libkb.ExistsError{
				Msg: fmt.Sprintf("An invite for this user already exists, with higher EldestSeqno (%d > %d)", existingUV.EldestSeqno, uv.EldestSeqno),
			}
		}

		t.G().Log.CDebugf(ctx, "Canceling old Keybase invite: %+v", existingInvite)
		cancelList = append(cancelList, SCTeamInviteID(inviteID))
	}

	if len(cancelList) != 0 {
		t.G().Log.CDebugf(ctx, "Total %d old invites will be canceled.", len(cancelList))
		invites.Cancel = &cancelList
	}

	t.G().Log.CDebugf(ctx, "Adding invite: %+v", invite)
	if err := t.postTeamInvites(ctx, invites); err != nil {
		return res, err
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

func (t *Team) InviteSeitan(ctx context.Context, role keybase1.TeamRole, label keybase1.SeitanKeyLabel) (ikey SeitanIKey, err error) {
	t.G().Log.Debug("team %s invite seitan %v", t.Name(), role)

	ikey, err = GenerateIKey()
	if err != nil {
		return ikey, err
	}

	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return ikey, err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return ikey, err
	}

	_, encoded, err := ikey.GeneratePackedEncryptedKey(ctx, t, label)
	if err != nil {
		return ikey, err
	}

	invite := SCTeamInvite{
		Type: "seitan_invite_token",
		Name: keybase1.TeamInviteName(encoded),
		ID:   inviteID,
	}

	if err := t.postInvite(ctx, invite, role); err != nil {
		return ikey, err
	}

	return ikey, err
}

func (t *Team) InviteSeitanV2(ctx context.Context, role keybase1.TeamRole, label keybase1.SeitanKeyLabel) (ikey SeitanIKeyV2, err error) {
	t.G().Log.Debug("team %s invite seitan %v", t.Name(), role)

	ikey, err = GenerateIKeyV2()
	if err != nil {
		return ikey, err
	}

	sikey, err := ikey.GenerateSIKey()
	if err != nil {
		return ikey, err
	}

	inviteID, err := sikey.GenerateTeamInviteID()
	if err != nil {
		return ikey, err
	}

	_, encoded, err := sikey.GeneratePackedEncryptedKey(ctx, t, label)
	if err != nil {
		return ikey, err
	}

	invite := SCTeamInvite{
		Type: "seitan_invite_token",
		Name: keybase1.TeamInviteName(encoded),
		ID:   inviteID,
	}

	if err := t.postInvite(ctx, invite, role); err != nil {
		return ikey, err
	}

	return ikey, err
}

func (t *Team) postInvite(ctx context.Context, invite SCTeamInvite, role keybase1.TeamRole) error {
	existing, err := t.HasActiveInvite(invite.Name, invite.Type)
	if err != nil {
		return err
	}

	if existing {
		return libkb.ExistsError{Msg: "An invite for this user already exists."}
	}

	if t.IsSubteam() && role == keybase1.TeamRole_OWNER {
		return NewSubteamOwnersError()
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

	if t.IsSubteam() && invites.Owners != nil && len(*invites.Owners) > 0 {
		return NewSubteamOwnersError()
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

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
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

	sigMulti := []libkb.SigMultiItem{sigMultiItem}
	err = t.precheckLinksToPost(ctx, sigMulti)
	if err != nil {
		return err
	}

	payload := t.sigPayload(sigMulti, sigPayloadArgs{})
	err = t.postMulti(payload)
	if err != nil {
		return err
	}

	t.notify(ctx, keybase1.TeamChangeSet{MembershipChanged: true})
	return nil
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
			ID:     *parentID,
			Public: parentID.IsPublic(),
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
	uv, err := t.currentUserUV(ctx)
	if err != nil {
		return nil, err
	}

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

func (t *Team) changeMembershipSection(ctx context.Context, req keybase1.TeamChangeReq, skipKeyRotation bool) (SCTeamSection, *PerTeamSharedSecretBoxes, map[keybase1.TeamID]*PerTeamSharedSecretBoxes, *teamEKPayload, *memberSet, error) {
	// initialize key manager
	if _, err := t.SharedSecret(ctx); err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, err
	}

	admin, err := t.getAdminPermission(ctx, true)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, err
	}

	if t.IsSubteam() && len(req.Owners) > 0 {
		return SCTeamSection{}, nil, nil, nil, nil, NewSubteamOwnersError()
	}

	// load the member set specified in req
	memSet, err := newMemberSetChange(ctx, t.G(), req)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
	}

	section.Members, err = memSet.Section()
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, err
	}

	// create secret boxes for recipients, possibly rotating the key
	secretBoxes, implicitAdminBoxes, perTeamKeySection, teamEKPayload, err := t.recipientBoxes(ctx, memSet, skipKeyRotation)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, err
	}
	section.PerTeamKey = perTeamKeySection

	section.CompletedInvites = req.CompletedInvites
	section.Implicit = t.IsImplicit()
	section.Public = t.IsPublic()

	if len(section.CompletedInvites) > 0 && section.Members == nil {
		// Just mooted invites is fine - if TeamChangeReq is empty,
		// changeMembershipSection returned nil members. But we need
		// empty Members in order to have a valid link.
		section.Members = &SCTeamMembers{}
	}

	return section, secretBoxes, implicitAdminBoxes, teamEKPayload, memSet, nil
}

func (t *Team) postChangeItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot, sigPayloadArgs sigPayloadArgs) error {
	// create the change item
	sigMultiItem, err := t.sigTeamItem(ctx, section, linkType, merkleRoot)
	if err != nil {
		return err
	}

	sigMulti := []libkb.SigMultiItem{sigMultiItem}
	err = t.precheckLinksToPost(ctx, sigMulti)
	if err != nil {
		return err
	}

	// make the payload
	payload := t.sigPayload(sigMulti, sigPayloadArgs)

	// send it to the server
	return t.postMulti(payload)
}

func getCurrentUserUV(ctx context.Context, g *libkb.GlobalContext) (ret keybase1.UserVersion, err error) {
	err = g.GetFullSelfer().WithSelf(ctx, func(u *libkb.User) error {
		ret = u.ToUserVersion()
		return nil
	})
	return ret, err
}

func (t *Team) currentUserUV(ctx context.Context) (keybase1.UserVersion, error) {
	return getCurrentUserUV(ctx, t.G())
}

func loadMeForSignatures(ctx context.Context, g *libkb.GlobalContext) (libkb.UserForSignatures, error) {
	return libkb.LoadSelfForTeamSignatures(ctx, g)
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
	case libkb.LinkTypeKBFSSettings:
		return false
	}

	return true
}

func (t *Team) sigTeamItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot) (libkb.SigMultiItem, error) {
	nextSeqno := t.NextSeqno()
	lastLinkID := t.chain().GetLatestLinkID()

	sig, _, err := t.sigTeamItemRaw(ctx, section, linkType, nextSeqno, lastLinkID, merkleRoot)
	return sig, err
}

func (t *Team) sigTeamItemRaw(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, nextSeqno keybase1.Seqno, lastLinkID keybase1.LinkID, merkleRoot *libkb.MerkleRoot) (libkb.SigMultiItem, keybase1.LinkID, error) {
	me, err := loadMeForSignatures(ctx, t.G())
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}
	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}
	latestLinkID, err := libkb.ImportLinkID(lastLinkID)
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}

	sig, err := ChangeSig(t.G(), me, latestLinkID, nextSeqno, deviceSigningKey, section, linkType, merkleRoot)
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}

	var signingKey libkb.NaclSigningKeyPair
	var encryptionKey libkb.NaclDHKeyPair
	if usesPerTeamKeys(linkType) {
		signingKey, err = t.keyManager.SigningKey()
		if err != nil {
			return libkb.SigMultiItem{}, "", err
		}
		encryptionKey, err = t.keyManager.EncryptionKey()
		if err != nil {
			return libkb.SigMultiItem{}, "", err
		}
		if section.PerTeamKey != nil {
			// need a reverse sig

			// set a nil value (not empty) for reverse_sig (fails without this)
			sig.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewNil())
			reverseSig, _, _, err := libkb.SignJSON(sig, signingKey)
			if err != nil {
				return libkb.SigMultiItem{}, "", err
			}
			sig.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewString(reverseSig))
		}
	}

	seqType := seqTypeForTeamPublicness(t.IsPublic())

	sigJSON, err := sig.Marshal()
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}
	v2Sig, _, newLinkID, err := libkb.MakeSigchainV2OuterSig(
		deviceSigningKey,
		linkType,
		nextSeqno,
		sigJSON,
		latestLinkID,
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
	)
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(linkType),
		SeqType:    seqType,
		SigInner:   string(sigJSON),
		TeamID:     t.ID,
	}
	if usesPerTeamKeys(linkType) {
		sigMultiItem.PublicKeys = &libkb.SigMultiItemPublicKeys{
			Encryption: encryptionKey.GetKID(),
			Signing:    signingKey.GetKID(),
		}
	}

	return sigMultiItem, keybase1.LinkID(newLinkID.String()), nil
}

func (t *Team) recipientBoxes(ctx context.Context, memSet *memberSet, skipKeyRotation bool) (*PerTeamSharedSecretBoxes, map[keybase1.TeamID]*PerTeamSharedSecretBoxes, *SCPerTeamKey, *teamEKPayload, error) {

	// get device key
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, nil, nil, nil, err
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
			return nil, nil, nil, nil, err
		}
		for _, subteam := range subteams {
			subteamBoxes, err := subteam.keyManager.SharedSecretBoxes(ctx, deviceEncryptionKey, adminAndOwnerRecipients)
			if err != nil {
				return nil, nil, nil, nil, err
			}
			implicitAdminBoxes[subteam.ID] = subteamBoxes
		}
	}

	// if there are any removals happening, need to rotate the
	// team key, and recipients will be all the users in the team
	// after the removal.
	if memSet.HasRemoval() {
		if !skipKeyRotation {
			// key is rotating, so recipients needs to be all the remaining members
			// of the team after the removal (and including any new members in this
			// change)
			t.G().Log.Debug("recipientBoxes: Team change request contains removal, rotating team key")
			boxes, perTeamKey, teamEKPayload, err := t.rotateBoxes(ctx, memSet)
			return boxes, implicitAdminBoxes, perTeamKey, teamEKPayload, err
		}

		// If we don't rotate key, continue with the usual boxing.
		t.G().Log.Debug("recipientBoxes: Skipping key rotation")
	}

	// don't need keys for existing members, so remove them from the set
	memSet.removeExistingMembers(ctx, t)
	t.G().Log.Debug("team change request: %d new members", len(memSet.recipients))
	if len(memSet.recipients) == 0 {
		return nil, implicitAdminBoxes, nil, nil, nil
	}

	boxes, err := t.keyManager.SharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	// No SCPerTeamKey section or teamEKPayload when the key isn't rotated
	return boxes, implicitAdminBoxes, nil, nil, err
}

func (t *Team) rotateBoxes(ctx context.Context, memSet *memberSet) (*PerTeamSharedSecretBoxes, *SCPerTeamKey, *teamEKPayload, error) {
	// get device key
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, nil, nil, err
	}

	// rotate the team key for all current members
	existing, err := t.Members()
	if err != nil {
		return nil, nil, nil, err
	}
	if err := memSet.AddRemainingRecipients(ctx, t.G(), existing); err != nil {
		return nil, nil, nil, err
	}

	// Without adding extra admins, get get the recipients for the new teamEK
	recipients := memSet.recipientUids()

	if t.IsSubteam() {
		// rotate needs to be keyed for all admins above it
		allParentAdmins, err := t.G().GetTeamLoader().ImplicitAdmins(ctx, t.ID)
		if err != nil {
			return nil, nil, nil, err
		}
		_, err = memSet.loadGroup(ctx, t.G(), allParentAdmins, true, true)
		if err != nil {
			return nil, nil, nil, err
		}
	}

	t.rotated = true

	boxes, key, err := t.keyManager.RotateSharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return nil, nil, nil, err
	}

	// Once we have the new PTK, let's make the new teamEK
	teamEKPayload, err := t.teamEKPayload(ctx, recipients)
	return boxes, key, teamEKPayload, err
}

type teamEKPayload struct {
	sig      string
	boxes    *[]keybase1.TeamEkBoxMetadata
	metadata keybase1.TeamEkMetadata
	box      *keybase1.TeamEkBoxed
}

func (t *Team) teamEKPayload(ctx context.Context, recipients []keybase1.UID) (*teamEKPayload, error) {
	ekLib := t.G().GetEKLib()
	if ekLib == nil || len(recipients) == 0 {
		return nil, nil
	}

	sigKey, err := t.SigningKey()
	if err != nil {
		return nil, err
	}
	sig, boxes, metadata, box, err := ekLib.PrepareNewTeamEK(ctx, t.ID, sigKey, recipients)
	if err != nil {
		return nil, err
	}

	return &teamEKPayload{
		sig:      sig,
		boxes:    boxes,
		metadata: metadata,
		box:      box,
	}, nil
}

func (t *Team) storeTeamEKPayload(ctx context.Context, teamEKPayload *teamEKPayload) {
	// Add the new teamEK box to local storage, if it was created above.
	if teamEKPayload != nil && teamEKPayload.box != nil {
		if err := t.G().GetTeamEKBoxStorage().Put(ctx, t.ID, teamEKPayload.metadata.Generation, *teamEKPayload.box); err != nil {
			t.G().Log.CErrorf(ctx, "error while saving teamEK box: %s", err)
		}
	}
}

type sigPayloadArgs struct {
	secretBoxes        *PerTeamSharedSecretBoxes
	implicitAdminBoxes map[keybase1.TeamID]*PerTeamSharedSecretBoxes
	lease              *libkb.Lease
	prePayload         libkb.JSONPayload
	legacyTLFUpgrade   *keybase1.TeamGetLegacyTLFUpgrade
	teamEKBoxes        *[]keybase1.TeamEkBoxMetadata
	teamEKPayload      *teamEKPayload
}

func (t *Team) sigPayload(sigMulti []libkb.SigMultiItem, args sigPayloadArgs) libkb.JSONPayload {
	payload := libkb.JSONPayload{}
	// copy the prepayload so we don't mutate it
	for k, v := range args.prePayload {
		payload[k] = v
	}
	payload["sigs"] = sigMulti
	if args.secretBoxes != nil {
		payload["per_team_key"] = args.secretBoxes
	}
	if args.implicitAdminBoxes != nil {
		payload["implicit_team_keys"] = args.implicitAdminBoxes
	}
	if args.lease != nil {
		payload["downgrade_lease_id"] = args.lease.LeaseID
	}
	if args.legacyTLFUpgrade != nil {
		payload["legacy_tlf_upgrade"] = args.legacyTLFUpgrade
	}
	if args.teamEKBoxes != nil && len(*args.teamEKBoxes) > 0 {
		payload["team_ek_rebox"] = libkb.JSONPayload{
			"boxes":   args.teamEKBoxes,
			"team_id": t.ID,
		}
	} else if args.teamEKPayload != nil {
		if args.teamEKPayload.boxes != nil && len(*args.teamEKPayload.boxes) > 0 {
			payload["team_ek"] = libkb.JSONPayload{
				"sig":     args.teamEKPayload.sig,
				"boxes":   args.teamEKPayload.boxes,
				"team_id": t.ID,
			}
		}
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
	_, err := t.G().GetMerkleClient().LookupTeam(t.MetaContext(ctx), t.ID)
	return err
}

// All admins, owners, and implicit admins of this team.
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

	if t.IsSubteam() {
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
			Public:      t.IsPublic(),
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

	err = t.postChangeItem(ctx, section, libkb.LinkTypeSettings, nil, sigPayloadArgs{})
	if err != nil {
		return err
	}

	t.notify(ctx, keybase1.TeamChangeSet{Misc: true})
	return nil
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

func (t *Team) precheckLinksToPost(ctx context.Context, sigMultiItems []libkb.SigMultiItem) (err error) {
	uv, err := t.currentUserUV(ctx)
	if err != nil {
		return err
	}
	return precheckLinksToPost(ctx, t.G(), sigMultiItems, t.chain(), uv)
}

// Try to run `post` (expected to post new team sigchain links).
// Retry it several times if it fails due to being behind the latest team sigchain state.
// Passes the attempt number (initially 0) to `post`.
func RetryOnSigOldSeqnoError(ctx context.Context, g *libkb.GlobalContext, post func(ctx context.Context, attempt int) error) (err error) {
	defer g.CTraceTimed(ctx, "RetryOnSigOldSeqnoError", func() error { return err })()
	const nRetries = 3
	for i := 0; i < nRetries; i++ {
		g.Log.CDebugf(ctx, "| RetryOnSigOldSeqnoError(%v)", i)
		err = post(ctx, i)
		if isSigOldSeqnoError(err) {
			// This error means retry
			continue
		}
		return err
	}
	g.Log.CDebugf(ctx, "| RetryOnSigOldSeqnoError exhausted attempts")
	if err == nil {
		// Should never happen
		return fmt.Errorf("failed retryable team operation")
	}
	// Return the error from the final round
	return err
}

func isSigOldSeqnoError(err error) bool {
	return libkb.IsAppStatusErrorCode(err, keybase1.StatusCode_SCSigOldSeqno)
}

func (t *Team) marshal(incoming interface{}) ([]byte, error) {
	var data []byte
	mh := codec.MsgpackHandle{WriteExt: true}
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(incoming); err != nil {
		return nil, err
	}
	return data, nil
}

func (t *Team) boxKBFSCryptKeys(ctx context.Context, key keybase1.TeamApplicationKey,
	kbfsKeys []keybase1.CryptKey) (string, keybase1.TeamEncryptedKBFSKeysetHash, error) {

	marshaledKeys, err := t.marshal(kbfsKeys)
	if err != nil {
		return "", "", err
	}

	var nonce [libkb.NaclDHNonceSize]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return "", "", err
	}

	var encKey [libkb.NaclSecretBoxKeySize]byte = key.Material()
	sealed := secretbox.Seal(nil, marshaledKeys, &nonce, &encKey)
	dat := keybase1.TeamEncryptedKBFSKeyset{
		V: 1,
		N: nonce[:],
		E: sealed,
	}

	marshaledSealedDat, err := t.marshal(dat)
	if err != nil {
		return "", "", err
	}

	encStr := base64.StdEncoding.EncodeToString(marshaledSealedDat)
	sbytes := sha256.Sum256([]byte(encStr))
	return encStr, keybase1.TeamEncryptedKBFSKeysetHashFromBytes(sbytes[:]), nil
}

func (t *Team) AssociateWithTLFKeyset(ctx context.Context, tlfID keybase1.TLFID,
	cryptKeys []keybase1.CryptKey, appType keybase1.TeamApplication) (err error) {
	defer t.G().CTrace(ctx, "Team.AssociateWithTLFKeyset", func() error { return err })()

	// If we get no crypt keys, just associate TLF ID and bail
	if len(cryptKeys) == 0 {
		t.G().Log.CDebugf(ctx, "AssociateWithTLFKeyset: no crypt keys given, aborting")
		return nil
	}

	// Sort crypt keys by generation (just in case they aren't naturally)
	sort.Slice(cryptKeys, func(i, j int) bool {
		return cryptKeys[i].KeyGeneration < cryptKeys[j].KeyGeneration
	})

	teamKeys, err := t.AllApplicationKeys(ctx, appType)
	if err != nil {
		return err
	}
	if len(teamKeys) == 0 {
		return errors.New("no team keys for TLF associate")
	}
	latestKey := teamKeys[len(teamKeys)-1]
	encStr, hash, err := t.boxKBFSCryptKeys(ctx, latestKey, cryptKeys)
	if err != nil {
		return err
	}

	upgrade := SCTeamKBFSLegacyUpgrade{
		AppType:          appType,
		KeysetHash:       hash,
		LegacyGeneration: cryptKeys[len(cryptKeys)-1].Generation(),
		TeamGeneration:   latestKey.KeyGeneration,
	}
	teamSection := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		KBFS: &SCTeamKBFS{
			Keyset: &upgrade,
		},
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for KBFS settings update")
	}

	sigMultiItem, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeKBFSSettings, mr)
	if err != nil {
		return err
	}

	payload := t.sigPayload([]libkb.SigMultiItem{sigMultiItem}, sigPayloadArgs{
		legacyTLFUpgrade: &keybase1.TeamGetLegacyTLFUpgrade{
			EncryptedKeyset:  encStr,
			LegacyGeneration: cryptKeys[len(cryptKeys)-1].Generation(),
			TeamGeneration:   latestKey.KeyGeneration,
			AppType:          appType,
		},
	})
	return t.postMulti(payload)
}

func (t *Team) AssociateWithTLFID(ctx context.Context, tlfID keybase1.TLFID) (err error) {
	defer t.G().CTrace(ctx, "Team.AssociateWithTLFID", func() error { return err })()

	teamSection := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		KBFS: &SCTeamKBFS{
			TLF: &SCTeamKBFSTLF{
				ID: tlfID,
			},
		},
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for KBFS settings update")
	}

	sigMultiItem, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeKBFSSettings, mr)
	if err != nil {
		return err
	}

	payload := t.sigPayload([]libkb.SigMultiItem{sigMultiItem}, sigPayloadArgs{})
	return t.postMulti(payload)
}

// Send notifyrouter messages.
// Modifies `changes`
// The sequence number of the is assumed to be bumped by 1, so use `NextSeqno()` and not `CurrentSeqno()`.
// Note that we're probably going to be getting this same notification a second time, since it will
// bounce off a gregor and back to us. But they are idempotent, so it should be fine to be double-notified.
func (t *Team) notify(ctx context.Context, changes keybase1.TeamChangeSet) {
	changes.KeyRotated = changes.KeyRotated || t.rotated
	t.G().GetTeamLoader().HintLatestSeqno(ctx, t.ID, t.NextSeqno())
	t.G().NotifyRouter.HandleTeamChangedByBothKeys(ctx, t.ID, t.Name().String(), t.NextSeqno(), t.IsImplicit(), changes)
}

func (t *Team) refreshUIDMapper(ctx context.Context, g *libkb.GlobalContext) {
	for uv := range t.chain().inner.UserLog {
		g.UIDMapper.InformOfEldestSeqno(ctx, g, uv)
	}
	for id, invite := range t.chain().inner.ActiveInvites {
		invtype, err := invite.Type.C()
		if err != nil {
			g.Log.CDebugf(ctx, "Error in invite %s: %s", id, err.Error())
			continue
		}
		if invtype == keybase1.TeamInviteCategory_KEYBASE {
			uv, err := invite.KeybaseUserVersion()
			if err != nil {
				g.Log.CDebugf(ctx, "Error in parsing invite %s: %s", id, err.Error())
			}
			g.UIDMapper.InformOfEldestSeqno(ctx, g, uv)
		}
	}
}

func UpgradeTLFIDToImpteam(ctx context.Context, g *libkb.GlobalContext, tlfName string, tlfID keybase1.TLFID,
	public bool, appType keybase1.TeamApplication, cryptKeys []keybase1.CryptKey) (err error) {
	defer g.CTrace(ctx, fmt.Sprintf("UpgradeTLFIDToImpteam(%s)", tlfID), func() error { return err })()

	var team *Team
	if team, _, _, err = LookupOrCreateImplicitTeam(ctx, g, tlfName, public); err != nil {
		return err
	}

	// Associate the imp team with the TLF ID
	if team.KBFSTLFID().IsNil() {
		if err = team.AssociateWithTLFID(ctx, tlfID); err != nil {
			return err
		}
	} else {
		if team.KBFSTLFID().String() != tlfID.String() {
			return fmt.Errorf("implicit team already associated with different TLF ID: teamID: %s tlfID: %s",
				team.ID, tlfID)
		}
	}

	// Reload the team
	if team, err = Load(ctx, g, keybase1.LoadTeamArg{
		ID:          team.ID,
		ForceRepoll: true,
	}); err != nil {
		return err
	}

	// Post the crypt keys
	return team.AssociateWithTLFKeyset(ctx, tlfID, cryptKeys, appType)
}
