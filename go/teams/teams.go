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
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	hidden "github.com/keybase/client/go/teams/hidden"
	jsonw "github.com/keybase/go-jsonw"
)

// Teamer is an interface that can fit a materialized Team (just below) or intermediary temporary products
// that are available during the team load process. It has access to both the main and hidden chain data
// so that we can ask questions like "what is the maximal on-chain PTK generation."
type Teamer interface {
	MainChain() *keybase1.TeamData
	HiddenChain() *keybase1.HiddenTeamChain
}

// A snapshot of a team's state.
// Not threadsafe.
type Team struct {
	libkb.Contextified

	ID     keybase1.TeamID
	Data   *keybase1.TeamData
	Hidden *keybase1.HiddenTeamChain

	keyManager *TeamKeyManager

	// rotated is set by rotateBoxes after rotating team key.
	rotated bool
}

// Used to order multiple signatures to post
type teamSectionWithLinkType struct {
	linkType libkb.LinkType
	section  SCTeamSection
}

func (t *Team) MainChain() *keybase1.TeamData          { return t.Data }
func (t *Team) HiddenChain() *keybase1.HiddenTeamChain { return t.Hidden }

var _ Teamer = (*Team)(nil)

func NewTeam(ctx context.Context, g *libkb.GlobalContext, teamData *keybase1.TeamData, hidden *keybase1.HiddenTeamChain) *Team {
	return &Team{
		Contextified: libkb.NewContextified(g),

		ID:     teamData.ID(),
		Data:   teamData,
		Hidden: hidden,
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

	if t.IsOpen() {
		// Skip all rotations in open teams.
		return true
	}

	// If cannot decide because of an error, return default false.
	members, err := t.UsersWithRoleOrAbove(keybase1.TeamRole_BOT)
	if err != nil {
		return false
	}
	if len(members) < MinTeamSize {
		// Not a big team
		return false
	}

	now := t.G().Clock().Now()
	duration := now.Sub(time.Unix(int64(t.chain().GetLatestPerTeamKeyCTime()), 0))
	if duration > KeyRotateInterval { //nolint
		// Last key rotation was more than predefined interval.
		return false
	}
	// Team is big and key was rotated recently - can skip rotation.
	return true
}

func (t *Team) chain() *TeamSigChainState {
	return &TeamSigChainState{inner: t.Data.Chain, hidden: t.Hidden}
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

func (t *Team) KBFSTLFIDs() []keybase1.TLFID {
	return t.chain().inner.TlfIDs
}

func (t *Team) LatestKBFSTLFID() (res keybase1.TLFID) {
	ids := t.KBFSTLFIDs()
	if len(ids) > 0 {
		res = ids[len(ids)-1]
	}
	return res
}

func (t *Team) KBFSCryptKeys(ctx context.Context, appType keybase1.TeamApplication) []keybase1.CryptKey {
	return t.Data.TlfCryptKeys[appType]
}

func (t *Team) getKeyManager(ctx context.Context) (km *TeamKeyManager, err error) {
	if t.keyManager == nil {
		gen := t.chain().GetLatestGeneration()
		item, err := GetAndVerifyPerTeamKey(t.MetaContext(ctx), t, gen)
		if err != nil {
			return nil, err
		}
		t.keyManager, err = NewTeamKeyManagerWithSeedItem(t.ID, item)
		if err != nil {
			return nil, err
		}
	}
	return t.keyManager, nil
}

func (t *Team) SharedSecret(ctx context.Context) (ret keybase1.PerTeamKeySeed, err error) {
	defer t.G().CTrace(ctx, "Team#SharedSecret", func() error { return err })()
	km, err := t.getKeyManager(ctx)
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

func (t *Team) SaltpackEncryptionKeyLatest(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_SALTPACK)
}

func (t *Team) ChatKeyAtGeneration(ctx context.Context, generation keybase1.PerTeamKeyGeneration) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKeyAtGeneration(ctx, keybase1.TeamApplication_CHAT, generation)
}

func (t *Team) SaltpackEncryptionKeyAtGeneration(ctx context.Context, generation keybase1.PerTeamKeyGeneration) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKeyAtGeneration(ctx, keybase1.TeamApplication_SALTPACK, generation)
}

func (t *Team) SeitanInviteTokenKeyAtGeneration(ctx context.Context, generation keybase1.PerTeamKeyGeneration) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKeyAtGeneration(ctx, keybase1.TeamApplication_SEITAN_INVITE_TOKEN, generation)
}

func (t *Team) SigningKID(ctx context.Context) (kid keybase1.KID, err error) {
	gen := t.chain().GetLatestGeneration()
	chainKey, err := newTeamSigChainState(t).GetPerTeamKeyAtGeneration(gen)
	if err != nil {
		return kid, err
	}
	return chainKey.SigKID, nil
}

func (t *Team) SigningKey(ctx context.Context) (key libkb.NaclSigningKeyPair, err error) {
	km, err := t.getKeyManager(ctx)
	if err != nil {
		return key, err
	}
	return km.SigningKey()
}

func (t *Team) EncryptionKey(ctx context.Context) (key libkb.NaclDHKeyPair, err error) {
	km, err := t.getKeyManager(ctx)
	if err != nil {
		return key, err
	}
	return km.EncryptionKey()
}

func (t *Team) encryptionKeyAtGen(ctx context.Context, gen keybase1.PerTeamKeyGeneration) (key libkb.NaclDHKeyPair, err error) {
	item, err := GetAndVerifyPerTeamKey(libkb.NewMetaContext(ctx, t.G()), t, gen)
	if err != nil {
		return key, err
	}
	keyManager, err := NewTeamKeyManagerWithSeedItem(t.ID, item)
	if err != nil {
		return key, err
	}
	return keyManager.EncryptionKey()
}

func (t *Team) IsMember(ctx context.Context, uv keybase1.UserVersion) bool {
	role, err := t.MemberRole(ctx, uv)
	if err != nil {
		t.G().Log.CDebugf(ctx, "error getting user role: %s", err)
		return false
	}
	return role != keybase1.TeamRole_NONE
}

func (t *Team) MemberCtime(ctx context.Context, uv keybase1.UserVersion) *keybase1.Time {
	return t.chain().MemberCtime(uv)
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

func (t *Team) AllUserVersions(ctx context.Context) []keybase1.UserVersion {
	return t.chain().GetAllUVs()
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

	x, err = t.UsersWithRole(keybase1.TeamRole_BOT)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Bots = x

	x, err = t.UsersWithRole(keybase1.TeamRole_RESTRICTEDBOT)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.RestrictedBots = x

	return members, nil
}

func (t *Team) ImplicitTeamDisplayName(ctx context.Context) (res keybase1.ImplicitTeamDisplayName, err error) {
	return t.implicitTeamDisplayName(ctx, false)
}

func (t *Team) ImplicitTeamDisplayNameNoConflicts(ctx context.Context) (res keybase1.ImplicitTeamDisplayName, err error) {
	return t.implicitTeamDisplayName(ctx, true)
}

func (t *Team) implicitTeamDisplayName(ctx context.Context, skipConflicts bool) (res keybase1.ImplicitTeamDisplayName, err error) {
	defer t.G().CTrace(ctx, "Team.ImplicitTeamDisplayName", func() error { return err })()

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
		case keybase1.TeamInviteCategory_PHONE, keybase1.TeamInviteCategory_EMAIL:
			typ, err := invite.Type.String()
			if err != nil {
				return res, fmt.Errorf("Failed to handle invite type %v: %s", invtyp, err)
			}
			sa := keybase1.SocialAssertion{
				User:    string(invite.Name),
				Service: keybase1.SocialAssertionService(typ),
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
		case keybase1.TeamInviteCategory_UNKNOWN:
			return res, fmt.Errorf("unknown invite type in implicit team: %q", invite.Type.Unknown())
		default:
			return res, fmt.Errorf("unrecognized invite type in implicit team: %v", invtyp)
		}
	}
	if !skipConflicts {
		impName, err = GetConflictInfo(ctx, t.G(), t.ID, isFullyResolved, impName)
		if err != nil {
			return res, err
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
	return AllApplicationKeys(t.MetaContext(ctx), t, application, t.chain().GetLatestGeneration())
}

func (t *Team) AllApplicationKeysWithKBFS(ctx context.Context, application keybase1.TeamApplication) (res []keybase1.TeamApplicationKey, err error) {
	return AllApplicationKeysWithKBFS(t.MetaContext(ctx), t, application,
		t.chain().GetLatestGeneration())
}

// ApplicationKey returns the most recent key for an application.
func (t *Team) ApplicationKey(ctx context.Context, application keybase1.TeamApplication) (keybase1.TeamApplicationKey, error) {
	latestGen := t.chain().GetLatestGeneration()
	return t.ApplicationKeyAtGeneration(ctx, application, latestGen)
}

func (t *Team) ApplicationKeyAtGeneration(ctx context.Context,
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {
	return ApplicationKeyAtGeneration(t.MetaContext(ctx), t, application, generation)
}

func (t *Team) ApplicationKeyAtGenerationWithKBFS(ctx context.Context,
	application keybase1.TeamApplication, generation keybase1.PerTeamKeyGeneration) (res keybase1.TeamApplicationKey, err error) {
	return ApplicationKeyAtGenerationWithKBFS(t.MetaContext(ctx), t, application, generation)
}

func (t *Team) TeamBotSettings() (map[keybase1.UserVersion]keybase1.TeamBotSettings, error) {
	botSettings := t.chain().TeamBotSettings()
	// It's possible that we added a RESTRICTEDBOT member without posting any
	// settings for them. Fill in default values (no access) for those members
	restrictedBots, err := t.UsersWithRole(keybase1.TeamRole_RESTRICTEDBOT)
	if err != nil {
		return nil, err
	}
	for _, uv := range restrictedBots {
		if _, ok := botSettings[uv]; !ok {
			botSettings[uv] = keybase1.TeamBotSettings{}
		}
	}
	return botSettings, nil
}

func addSummaryHash(section *SCTeamSection, boxes *PerTeamSharedSecretBoxes) error {
	if boxes == nil {
		return nil
	}
	bps := boxes.boxPublicSummary
	if bps == nil || bps.IsEmpty() {
		return nil
	}
	bsh := SCTeamBoxSummaryHash(bps.HashHexEncoded())
	section.BoxSummaryHash = &bsh
	return nil
}

func (t *Team) Rotate(ctx context.Context, rt keybase1.RotationType) (err error) {
	return t.rotate(ctx, rt)
}

func (t *Team) rotate(ctx context.Context, rt keybase1.RotationType) (err error) {
	mctx := t.MetaContext(ctx).WithLogTag("ROT")
	defer mctx.Trace(fmt.Sprintf("Team#rotate(%s,%s)", t.ID, rt), func() error { return err })()

	rt, err = hidden.CheckFeatureGateForSupportWithRotationType(mctx, t.ID, true /* isWrite */, rt)
	if err != nil {
		return err
	}

	// initialize key manager
	if _, err := t.SharedSecret(mctx.Ctx()); err != nil {
		return err
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(mctx, libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}

	// load an empty member set (no membership changes)
	memSet := newMemberSet()

	// Try to get the admin perms if they are available, if not, proceed anyway
	var admin *SCTeamAdmin
	admin, err = t.getAdminPermission(mctx.Ctx())
	if err != nil {
		mctx.Debug("Rotate: unable to get admin permission: %v, attempting without admin section", err)
		admin = nil
	}

	if err := t.ForceMerkleRootUpdate(mctx.Ctx()); err != nil {
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
	secretBoxes, perTeamKeySection, teamEKPayload, err := t.rotateBoxes(mctx.Ctx(), memSet)
	if err != nil {
		return err
	}
	section.PerTeamKey = perTeamKeySection

	err = addSummaryHash(&section, secretBoxes)
	if err != nil {
		return err
	}

	// post the change to the server
	payloadArgs := sigPayloadArgs{
		secretBoxes:   secretBoxes,
		teamEKPayload: teamEKPayload,
	}

	if rt == keybase1.RotationType_VISIBLE {
		err = t.rotatePostVisible(mctx.Ctx(), section, mr, payloadArgs)
	} else {
		err = t.rotatePostHidden(mctx.Ctx(), section, mr, payloadArgs)
	}
	if err != nil {
		return err
	}

	t.storeTeamEKPayload(mctx.Ctx(), teamEKPayload)
	createTeambotKeys(t.G(), t.ID, memSet.restrictedBotRecipientUids())

	return nil
}

func (t *Team) rotatePostVisible(ctx context.Context, section SCTeamSection, mr *libkb.MerkleRoot, payloadArgs sigPayloadArgs) error {
	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return err
	}
	section.Ratchets = ratchet.ToTeamSection()
	payloadArgs.ratchetBlindingKeys = ratchet.ToSigPayload()

	latestSeqno, err := t.postChangeItem(ctx, section, libkb.LinkTypeRotateKey, mr, payloadArgs)
	if err != nil {
		return err
	}
	return t.notify(ctx, keybase1.TeamChangeSet{KeyRotated: true}, latestSeqno)
}

func (t *Team) rotatePostHidden(ctx context.Context, section SCTeamSection, mr *libkb.MerkleRoot, payloadArgs sigPayloadArgs) error {
	mctx := libkb.NewMetaContext(ctx, t.G())

	// Generate a "sig multi item" that we POST up to the API endpoint
	smi, ratchet, err := t.rotateHiddenGenerateSigMultiItem(mctx, section, mr)
	if err != nil {
		return err
	}

	links := []libkb.SigMultiItem{*smi}

	err = t.precheckLinksToPost(ctx, links)
	if err != nil {
		return err
	}

	// Combine the "sig multi item" above with the various off-chain items, like boxes.
	payload := t.sigPayload(links, payloadArgs)

	// Post the changes up to the server
	err = t.postMulti(mctx, payload)
	if err != nil {
		return err
	}

	// Inform local caching that we've ratcheted forward the hidden chain with a change
	// that we made.
	tmp := mctx.G().GetHiddenTeamChainManager().Ratchet(mctx, t.ID, *ratchet)
	if tmp != nil {
		mctx.Warning("Failed to ratchet forward team chain: %s", tmp.Error())
	}

	// We rotated the key but didn't change the visibile chain
	return t.notifyNoChainChange(ctx, keybase1.TeamChangeSet{KeyRotated: true})
}

func teamAdminToSig3ChainLocation(admin *SCTeamAdmin) (*sig3.ChainLocation, error) {
	if admin == nil {
		return nil, nil
	}
	id, err := admin.TeamID.ToTeamID()
	if err != nil {
		return nil, err
	}
	s3id, err := sig3.ImportTeamID(id)
	if err != nil {
		return nil, err
	}
	return &sig3.ChainLocation{
		TeamID:    *s3id,
		Seqno:     admin.Seqno,
		ChainType: admin.SeqType,
	}, nil

}

func (t *Team) rotateHiddenGenerateSigMultiItem(mctx libkb.MetaContext, section SCTeamSection, mr *libkb.MerkleRoot) (ret *libkb.SigMultiItem, ratchets *keybase1.HiddenTeamChainRatchetSet, err error) {

	currentSeqno := t.CurrentSeqno()
	lastLinkID := t.chain().GetLatestLinkID()

	mainChainPrev := keybase1.LinkTriple{
		Seqno:   currentSeqno,
		SeqType: keybase1.SeqType_SEMIPRIVATE,
		LinkID:  lastLinkID,
	}

	me, err := loadMeForSignatures(mctx.Ctx(), mctx.G())
	if err != nil {
		return nil, nil, err
	}
	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return nil, nil, err
	}
	hiddenPrev, err := t.G().GetHiddenTeamChainManager().Tail(mctx, t.ID)
	if err != nil {
		return nil, nil, err
	}

	sk, err := t.keyManager.SigningKey()
	if err != nil {
		return nil, nil, err
	}

	ek, err := t.keyManager.EncryptionKey()
	if err != nil {
		return nil, nil, err
	}

	admin, err := teamAdminToSig3ChainLocation(section.Admin)
	if err != nil {
		return nil, nil, err
	}

	ret, ratchets, err = hidden.GenerateKeyRotation(mctx, hidden.GenerateKeyRotationParams{
		TeamID:           t.ID,
		IsPublic:         t.IsPublic(),
		IsImplicit:       t.IsImplicit(),
		MerkleRoot:       mr,
		Me:               me,
		SigningKey:       deviceSigningKey,
		MainPrev:         mainChainPrev,
		HiddenPrev:       hiddenPrev,
		Gen:              t.keyManager.Generation(),
		NewSigningKey:    sk,
		NewEncryptionKey: ek,
		Check:            t.keyManager.Check(),
		Admin:            admin,
	})

	return ret, ratchets, err
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
		_, err := loadMember(ctx, t.G(), member.version, true)
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
	defer t.G().CTrace(ctx, "Team.ChangeMembershipWithOptions", func() error { return err })()

	if t.IsSubteam() && len(req.Owners) > 0 {
		return NewSubteamOwnersError()
	}

	// create the change membership section + secretBoxes
	section, secretBoxes, implicitAdminBoxes, teamEKPayload, memberSet, ratchet, err := t.changeMembershipSection(ctx, req, opts.SkipKeyRotation)
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
			// We must cancel in the case of an error in postMulti, but it's safe to cancel
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
		secretBoxes:         secretBoxes,
		implicitAdminBoxes:  implicitAdminBoxes,
		lease:               lease,
		teamEKPayload:       teamEKPayload,
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}

	if opts.Permanent {
		sigPayloadArgs.prePayload = libkb.JSONPayload{"permanent": true}
	}

	// Add a ChangeMembership section and possibly a BotSettings section.
	sections := []teamSectionWithLinkType{
		{
			linkType: libkb.LinkTypeChangeMembership,
			section:  section,
		},
	}

	// If we are adding any restricted bots add a bot_settings link
	if len(req.RestrictedBots) > 0 {
		section, _, err := t.botSettingsSection(ctx, req.RestrictedBots, ratchet, merkleRoot)
		if err != nil {
			return err
		}
		sections = append(sections, teamSectionWithLinkType{
			linkType: libkb.LinkTypeTeamBotSettings,
			section:  section,
		})
	}

	payload, latestSeqno, err := t.changeItemsPayload(ctx, sections, merkleRoot, sigPayloadArgs)
	if err != nil {
		return err
	}

	var recipients, botRecipients []keybase1.UserVersion
	for uv := range memberSet.recipients {
		recipients = append(recipients, uv)
	}
	for uv := range memberSet.restrictedBotRecipients {
		botRecipients = append(botRecipients, uv)
	}
	newMemSet := newMemberSet()
	_, err = newMemSet.loadGroup(ctx, t.G(), recipients, storeMemberKindRecipient, true)
	if err != nil {
		return err
	}
	_, err = newMemSet.loadGroup(ctx, t.G(), botRecipients, storeMemberKindRestrictedBotRecipient, true)
	if err != nil {
		return err
	}
	if !memberSet.recipients.Eq(newMemSet.recipients) {
		return BoxRaceError{inner: fmt.Errorf("team box summary changed during sig creation; retry required")}
	}

	err = t.postMulti(libkb.NewMetaContext(ctx, t.G()), payload)
	if err != nil {
		return err
	}

	err = t.notify(ctx, keybase1.TeamChangeSet{MembershipChanged: true}, latestSeqno)
	if err != nil {
		return err
	}
	t.storeTeamEKPayload(ctx, teamEKPayload)
	createTeambotKeys(t.G(), t.ID, memberSet.restrictedBotRecipientUids())

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

func (t *Team) makeRatchet(ctx context.Context) (ret *hidden.Ratchet, err error) {
	return t.chain().makeHiddenRatchet(libkb.NewMetaContext(ctx, t.G()))
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
		_, err := t.getAdminPermission(ctx)
		switch err.(type) {
		case nil, AdminPermissionRequiredError:
			return NewImplicitAdminCannotLeaveError()
		}
	}

	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		Ratchets: ratchet.ToTeamSection(),
	}

	sigPayloadArgs := sigPayloadArgs{
		prePayload:          libkb.JSONPayload{"permanent": permanent},
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}
	latestSeqno, err := t.postChangeItem(ctx, section, libkb.LinkTypeLeave, nil, sigPayloadArgs)
	if err != nil {
		return err
	}

	return t.notify(ctx, keybase1.TeamChangeSet{MembershipChanged: true}, latestSeqno)
}

func (t *Team) deleteRoot(ctx context.Context, ui keybase1.TeamsUiInterface) error {
	m := t.MetaContext(ctx)
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
			Name: "SELF_NOT_OWNER",
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

	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return err
	}

	teamSection := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		Ratchets: ratchet.ToTeamSection(),
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for team delete root")
	}

	sigMultiItem, latestSeqno, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeDeleteRoot, mr)
	if err != nil {
		return err
	}

	sigPayloadArgs := sigPayloadArgs{
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}
	payload := t.sigPayload([]libkb.SigMultiItem{sigMultiItem}, sigPayloadArgs)
	err = t.postMulti(m, payload)
	if err != nil {
		return err
	}
	return t.HintLatestSeqno(m, latestSeqno)
}

func (t *Team) deleteSubteam(ctx context.Context, ui keybase1.TeamsUiInterface) error {

	m := t.MetaContext(ctx)

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

	admin, err := parentTeam.getAdminPermission(ctx)
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
	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return err
	}
	parentSection := SCTeamSection{
		ID: SCTeamID(parentTeam.ID),
		Subteam: &SCSubteam{
			ID:   SCTeamID(t.ID),
			Name: subteamName, // weird this is required
		},
		Admin:    admin,
		Public:   t.IsPublic(),
		Entropy:  entropy,
		Ratchets: ratchet.ToTeamSection(),
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for team delete subteam")
	}

	sigParent, _, err := parentTeam.sigTeamItem(ctx, parentSection, libkb.LinkTypeDeleteSubteam, mr)
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
	sigSub, latestSeqno, err := t.sigTeamItem(ctx, subSection, libkb.LinkTypeDeleteUpPointer, mr)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigParent, sigSub}
	ratchet.AddToJSONPayload(payload)
	err = t.postMulti(m, payload)
	if err != nil {
		return err
	}
	return t.HintLatestSeqno(m, latestSeqno)
}

func (t *Team) NumActiveInvites() int {
	return t.chain().NumActiveInvites()
}

func (t *Team) HasActiveInvite(mctx libkb.MetaContext, name keybase1.TeamInviteName, typ string) (bool, error) {
	it, err := TeamInviteTypeFromString(mctx, typ)
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
		return t.inviteKeybaseMember(libkb.NewMetaContext(ctx, t.G()), uv, role, resolvedUsername)
	}

	// If a social, or email, or other type of invite, assert it's not an owner.
	if role.IsOrAbove(keybase1.TeamRole_OWNER) {
		return keybase1.TeamAddMemberResult{}, errors.New("You cannot invite an owner to a team.")
	}

	return t.inviteSBSMember(ctx, username, role)
}

func (t *Team) InviteEmailPhoneMember(ctx context.Context, name string, role keybase1.TeamRole, typ string) error {
	t.G().Log.CDebugf(ctx, "team %s invite %s member %s", t.Name(), typ, name)

	if role == keybase1.TeamRole_OWNER {
		return errors.New("You cannot invite an owner to a team over email.")
	}

	invite := SCTeamInvite{
		Type: typ,
		Name: keybase1.TeamInviteName(name),
		ID:   NewInviteID(),
	}
	return t.postInvite(ctx, invite, role)
}

func (t *Team) inviteKeybaseMember(mctx libkb.MetaContext, uv keybase1.UserVersion, role keybase1.TeamRole, resolvedUsername libkb.NormalizedUsername) (res keybase1.TeamAddMemberResult, err error) {
	mctx.Debug("team %s invite keybase member %s", t.Name(), uv)

	invite := SCTeamInvite{
		Type: "keybase",
		Name: uv.TeamInviteName(),
		ID:   NewInviteID(),
	}

	existing, err := t.HasActiveInvite(mctx, invite.Name, invite.Type)
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

		mctx.Debug("Canceling old Keybase invite: %+v", existingInvite)
		cancelList = append(cancelList, SCTeamInviteID(inviteID))
	}

	if len(cancelList) != 0 {
		mctx.Debug("Total %d old invites will be canceled.", len(cancelList))
		invites.Cancel = &cancelList
	}

	mctx.Debug("Adding invite: %+v", invite)
	if err := t.postTeamInvites(mctx.Ctx(), invites); err != nil {
		return res, err
	}
	return keybase1.TeamAddMemberResult{Invited: true, User: &keybase1.User{Uid: uv.Uid, Username: resolvedUsername.String()}}, nil
}

func (t *Team) inviteSBSMember(ctx context.Context, username string, role keybase1.TeamRole) (keybase1.TeamAddMemberResult, error) {
	// parse username to get social
	typ, name, err := parseSocialAssertion(libkb.NewMetaContext(ctx, t.G()), username)
	if err != nil {
		return keybase1.TeamAddMemberResult{}, err
	}
	t.G().Log.CDebugf(ctx, "team %s invite sbs member %s/%s", t.Name(), typ, name)

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
	defer t.G().CTraceTimed(ctx, fmt.Sprintf("InviteSeitan: team: %v, role: %v", t.Name(), role), func() error { return err })()

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
	defer t.G().CTraceTimed(ctx, fmt.Sprintf("InviteSeitanV2: team: %v, role: %v", t.Name(), role), func() error { return err })()

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
	existing, err := t.HasActiveInvite(t.MetaContext(ctx), invite.Name, invite.Type)
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
	case keybase1.TeamRole_RESTRICTEDBOT, keybase1.TeamRole_BOT:
		return fmt.Errorf("bot roles disallowed for invites")
	case keybase1.TeamRole_READER:
		invites.Readers = &invList
	case keybase1.TeamRole_WRITER:
		invites.Writers = &invList
	case keybase1.TeamRole_ADMIN:
		invites.Admins = &invList
	case keybase1.TeamRole_OWNER:
		invites.Owners = &invList
	}
	if invites.Len() == 0 {
		return fmt.Errorf("invalid invite, 0 members invited")
	}

	return t.postTeamInvites(ctx, invites)
}

func (t *Team) postTeamInvites(ctx context.Context, invites SCTeamInvites) error {
	m := t.MetaContext(ctx)

	admin, err := t.getAdminPermission(ctx)
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

	ratchet, err := t.makeRatchet(ctx)
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
		Ratchets: ratchet.ToTeamSection(),
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for team invite")
	}

	sigMultiItem, latestSeqno, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeInvite, mr)
	if err != nil {
		return err
	}

	sigMulti := []libkb.SigMultiItem{sigMultiItem}
	err = t.precheckLinksToPost(ctx, sigMulti)
	if err != nil {
		return err
	}

	sigPayloadArgs := sigPayloadArgs{
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}

	payload := t.sigPayload(sigMulti, sigPayloadArgs)
	err = t.postMulti(m, payload)
	if err != nil {
		return err
	}

	return t.notify(ctx, keybase1.TeamChangeSet{MembershipChanged: true}, latestSeqno)
}

// NOTE since this function uses `Load` and not `load2`, readSubteamID cannot
// be passed through, this call will fail if a user is not a member of the
// parent team (or child of the parent team) for which the validator validates
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

func (t *Team) getAdminPermission(ctx context.Context) (admin *SCTeamAdmin, err error) {
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
		return nil, NewAdminPermissionRequiredError()
	}

	logPoint := targetTeam.chain().GetAdminUserLogPoint(uv)
	ret := SCTeamAdmin{
		TeamID:  SCTeamID(targetTeam.ID),
		Seqno:   logPoint.SigMeta.SigChainLocation.Seqno,
		SeqType: logPoint.SigMeta.SigChainLocation.SeqType,
	}
	return &ret, nil
}

func (t *Team) changeMembershipSection(ctx context.Context, req keybase1.TeamChangeReq, skipKeyRotation bool) (SCTeamSection, *PerTeamSharedSecretBoxes, map[keybase1.TeamID]*PerTeamSharedSecretBoxes, *teamEKPayload, *memberSet, *hidden.Ratchet, error) {
	// initialize key manager
	if _, err := t.SharedSecret(ctx); err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	admin, err := t.getAdminPermission(ctx)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	if t.IsSubteam() && len(req.Owners) > 0 {
		return SCTeamSection{}, nil, nil, nil, nil, nil, NewSubteamOwnersError()
	}

	// load the member set specified in req
	memSet, err := newMemberSetChange(ctx, t.G(), req)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		Ratchets: ratchet.ToTeamSection(),
	}

	section.Members, err = memSet.Section()
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	// create secret boxes for recipients, possibly rotating the key
	secretBoxes, implicitAdminBoxes, perTeamKeySection, teamEKPayload, err := t.recipientBoxes(ctx, memSet, skipKeyRotation)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	section.PerTeamKey = perTeamKeySection

	err = addSummaryHash(&section, secretBoxes)
	if err != nil {
		return SCTeamSection{}, nil, nil, nil, nil, nil, err
	}

	section.CompletedInvites = req.CompletedInvites
	section.Implicit = t.IsImplicit()
	section.Public = t.IsPublic()

	if len(section.CompletedInvites) > 0 && section.Members == nil {
		// Just mooted invites is fine - if TeamChangeReq is empty,
		// changeMembershipSection returned nil members. But we need
		// empty Members in order to have a valid link.
		section.Members = &SCTeamMembers{}
	}

	return section, secretBoxes, implicitAdminBoxes, teamEKPayload, memSet, ratchet, nil
}

func (t *Team) changeItemsPayload(ctx context.Context, sections []teamSectionWithLinkType,
	merkleRoot *libkb.MerkleRoot, sigPayloadArgs sigPayloadArgs) (libkb.JSONPayload, keybase1.Seqno, error) {

	var readySigs []libkb.SigMultiItem
	nextSeqno := t.NextSeqno()
	latestLinkID := t.chain().GetLatestLinkID()

	for _, section := range sections {
		sigMultiItem, linkID, err := t.sigTeamItemRaw(ctx, section.section,
			section.linkType, nextSeqno, latestLinkID, merkleRoot)
		if err != nil {
			return nil, keybase1.Seqno(0), err
		}
		nextSeqno++
		latestLinkID = linkID
		readySigs = append(readySigs, sigMultiItem)
	}

	if err := t.precheckLinksToPost(ctx, readySigs); err != nil {
		return nil, keybase1.Seqno(0), err
	}

	payload := t.sigPayload(readySigs, sigPayloadArgs)
	return payload, nextSeqno - 1, nil
}

func (t *Team) changeItemPayload(ctx context.Context, section SCTeamSection, linkType libkb.LinkType,
	merkleRoot *libkb.MerkleRoot, sigPayloadArgs sigPayloadArgs) (libkb.JSONPayload, keybase1.Seqno, error) {
	// create the change item
	sigMultiItem, latestSeqno, err := t.sigTeamItem(ctx, section, linkType, merkleRoot)
	if err != nil {
		return nil, keybase1.Seqno(0), err
	}

	sigMulti := []libkb.SigMultiItem{sigMultiItem}
	err = t.precheckLinksToPost(ctx, sigMulti)
	if err != nil {
		return nil, keybase1.Seqno(0), err
	}

	// make the payload
	payload := t.sigPayload(sigMulti, sigPayloadArgs)
	return payload, latestSeqno, nil
}

func (t *Team) postChangeItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot, sigPayloadArgs sigPayloadArgs) (keybase1.Seqno, error) {
	payload, latestSeqno, err := t.changeItemPayload(ctx, section, linkType, merkleRoot, sigPayloadArgs)
	if err != nil {
		return keybase1.Seqno(0), err
	}
	// send it to the server
	err = t.postMulti(libkb.NewMetaContext(ctx, t.G()), payload)
	if err != nil {
		return keybase1.Seqno(0), err
	}
	return latestSeqno, nil
}

func (t *Team) currentUserUV(ctx context.Context) (keybase1.UserVersion, error) {
	return t.G().GetMeUV(ctx)
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

func (t *Team) sigTeamItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot) (libkb.SigMultiItem, keybase1.Seqno, error) {
	nextSeqno := t.NextSeqno()
	lastLinkID := t.chain().GetLatestLinkID()

	sig, _, err := t.sigTeamItemRaw(ctx, section, linkType, nextSeqno, lastLinkID, merkleRoot)
	return sig, nextSeqno, err
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
			err := sig.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewNil())
			if err != nil {
				return libkb.SigMultiItem{}, "", err
			}
			reverseSig, _, _, err := libkb.SignJSON(sig, signingKey)
			if err != nil {
				return libkb.SigMultiItem{}, "", err
			}
			err = sig.SetValueAtPath("body.team.per_team_key.reverse_sig", jsonw.NewString(reverseSig))
			if err != nil {
				return libkb.SigMultiItem{}, "", err
			}
		}
	}

	seqType := seqTypeForTeamPublicness(t.IsPublic())

	sigJSON, err := sig.Marshal()
	if err != nil {
		return libkb.SigMultiItem{}, "", err
	}
	v2Sig, _, newLinkID, err := libkb.MakeSigchainV2OuterSig(
		t.MetaContext(ctx),
		deviceSigningKey,
		linkType,
		nextSeqno,
		sigJSON,
		latestLinkID,
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
		nil,
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

func (t *Team) recipientBoxes(ctx context.Context, memSet *memberSet, skipKeyRotation bool) (
	*PerTeamSharedSecretBoxes, map[keybase1.TeamID]*PerTeamSharedSecretBoxes,
	*SCPerTeamKey, *teamEKPayload, error) {

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
			subteamBoxes, err := subteam.keyManager.SharedSecretBoxes(t.MetaContext(ctx), deviceEncryptionKey, adminAndOwnerRecipients)
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
			t.G().Log.CDebugf(ctx, "recipientBoxes: Team change request contains removal, rotating team key")
			boxes, perTeamKey, teamEKPayload, err := t.rotateBoxes(ctx, memSet)
			return boxes, implicitAdminBoxes, perTeamKey, teamEKPayload, err
		}

		// If we don't rotate key, continue with the usual boxing.
		t.G().Log.CDebugf(ctx, "recipientBoxes: Skipping key rotation")
	}

	// don't need keys for existing or restricted bot members, so remove them from the set
	memSet.removeExistingMembers(ctx, t)
	t.G().Log.CDebugf(ctx, "team change request: %d new members", len(memSet.recipients))
	if len(memSet.recipients) == 0 {
		return nil, implicitAdminBoxes, nil, nil, nil
	}

	boxes, err := t.keyManager.SharedSecretBoxes(t.MetaContext(ctx), deviceEncryptionKey, memSet.recipients)
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

	// rotate the team key for all current members except restricted bots.
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
		_, err = memSet.loadGroup(ctx, t.G(), allParentAdmins, storeMemberKindRecipient, true)
		if err != nil {
			return nil, nil, nil, err
		}
	}

	t.rotated = true

	boxes, key, err := t.keyManager.RotateSharedSecretBoxes(t.MetaContext(ctx), deviceEncryptionKey, memSet.recipients)
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

	sigKey, err := t.SigningKey(ctx)
	if err != nil {
		return nil, err
	}
	mctx := libkb.NewMetaContext(ctx, t.G())
	sig, boxes, metadata, box, err := ekLib.PrepareNewTeamEK(mctx, t.ID, sigKey, recipients)
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
		mctx := libkb.NewMetaContext(ctx, t.G())
		boxed := keybase1.NewTeamEphemeralKeyBoxedWithTeam(*teamEKPayload.box)
		if err := t.G().GetTeamEKBoxStorage().Put(mctx, t.ID, teamEKPayload.metadata.Generation, boxed); err != nil {
			t.G().Log.CErrorf(ctx, "error while saving teamEK box: %s", err)
		}
	}
}

// createTeambotKeys generates teambotKeys and teambotEKs for the given bot
// member list. Runs in the background on member addition or team rotation.
func createTeambotKeys(g *libkb.GlobalContext, teamID keybase1.TeamID, bots []keybase1.UID) {
	mctx := libkb.NewMetaContextBackground(g)
	go func() {
		var err error
		defer mctx.TraceTimed(fmt.Sprintf("createTeambotKeys: %d bot members", len(bots)), func() error { return err })()
		if len(bots) == 0 {
			return
		}

		// Load the team in case we need to grab the latest PTK generation after a rotation.
		team, err := Load(mctx.Ctx(), g, keybase1.LoadTeamArg{
			ID: teamID,
		})
		if err != nil {
			return
		}

		ekLib := mctx.G().GetEKLib()
		keyer := mctx.G().GetTeambotMemberKeyer()
		makeChatKey, makeKVStoreKey := true, true
		chatKey, err := team.ChatKey(mctx.Ctx())
		if err != nil {
			mctx.Debug("unable to get teamApplication key %v, aborting TeambotKey appkey creation", err)
			makeChatKey = false
		}
		kvStoreKey, err := team.ApplicationKey(mctx.Ctx(), keybase1.TeamApplication_KVSTORE)
		if err != nil {
			mctx.Debug("unable to get teamApplication key %v, aborting TeambotKey creation", err)
			makeKVStoreKey = false
		}

		for _, uid := range bots {
			guid := gregor1.UID(uid.ToBytes())
			if ekLib != nil {
				if teambotEK, created, err := ekLib.GetOrCreateLatestTeambotEK(mctx, teamID, guid); err != nil {
					mctx.Debug("unable to GetOrCreateLatestTeambotEK for %v, %v", guid, err)
				} else {
					mctx.Debug("published TeambotEK generation %d for %v, newly created: %v", teambotEK.Generation(), uid, created)
				}
			}
			if keyer != nil {
				if makeChatKey {
					if teambotKey, created, err := keyer.GetOrCreateTeambotKey(mctx, teamID, guid, chatKey); err != nil {
						mctx.Debug("unable to GetOrCreateTeambotKey application %v, uid: %v, %v",
							keybase1.TeamApplication_CHAT, guid, err)
					} else {
						mctx.Debug("published TeambotKey app: %v generation %d for %v, newly created: %v",
							keybase1.TeamApplication_CHAT, teambotKey.Generation(), uid, created)
					}
				}
				if makeKVStoreKey {
					if teambotKey, created, err := keyer.GetOrCreateTeambotKey(mctx, teamID, guid, kvStoreKey); err != nil {
						mctx.Debug("unable to GetOrCreateTeambotKey application %v, uid: %v, %v",
							keybase1.TeamApplication_KVSTORE, guid, err)
					} else {
						mctx.Debug("published TeambotKey app: %v generation %d for %v, newly created: %v",
							keybase1.TeamApplication_KVSTORE, teambotKey.Generation(), uid, created)
					}
				}
			}
		}
	}()
}

type sigPayloadArgs struct {
	secretBoxes         *PerTeamSharedSecretBoxes
	implicitAdminBoxes  map[keybase1.TeamID]*PerTeamSharedSecretBoxes
	lease               *libkb.Lease
	prePayload          libkb.JSONPayload
	legacyTLFUpgrade    *keybase1.TeamGetLegacyTLFUpgrade
	teamEKBoxes         *[]keybase1.TeamEkBoxMetadata
	teamEKPayload       *teamEKPayload
	ratchetBlindingKeys hidden.EncodedRatchetBlindingKeySet
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
	args.ratchetBlindingKeys.AddToJSONPayload(payload)
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

func (t *Team) postMulti(mctx libkb.MetaContext, payload libkb.JSONPayload) error {
	_, err := t.G().API.PostJSON(mctx, libkb.APIArg{
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
	return ForceMerkleRootUpdateByTeamID(t.MetaContext(ctx), t.ID)
}

func ForceMerkleRootUpdateByTeamID(mctx libkb.MetaContext, teamID keybase1.TeamID) error {
	_, err := mctx.G().GetMerkleClient().LookupTeam(mctx, teamID)
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

func (t *Team) PostTeamSettings(ctx context.Context, settings keybase1.TeamSettings, rotate bool) error {
	if _, err := t.SharedSecret(ctx); err != nil {
		return err
	}

	admin, err := t.getAdminPermission(ctx)
	if err != nil {
		return err
	}

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}

	scSettings, err := CreateTeamSettings(settings.Open, settings.JoinAs)
	if err != nil {
		return err
	}

	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return err
	}

	section := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Admin:    admin,
		Settings: &scSettings,
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		Ratchets: ratchet.ToTeamSection(),
	}

	payloadArgs := sigPayloadArgs{
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}
	var maybeEKPayload *teamEKPayload
	var botMembers []keybase1.UID
	if rotate {
		// Create empty Members section. We are not changing memberships, but
		// it's needed for key rotation.
		memSet := newMemberSet()
		section.Members, err = memSet.Section()
		if err != nil {
			return err
		}
		secretBoxes, perTeamKeySection, teamEKPayload, err := t.rotateBoxes(ctx, memSet)
		if err != nil {
			return err
		}
		section.PerTeamKey = perTeamKeySection
		payloadArgs.secretBoxes = secretBoxes
		payloadArgs.teamEKPayload = teamEKPayload
		maybeEKPayload = teamEKPayload // for storeTeamEKPayload, after post succeeds
		botMembers = memSet.restrictedBotRecipientUids()
	}
	latestSeqno, err := t.postChangeItem(ctx, section, libkb.LinkTypeSettings, mr, payloadArgs)
	if err != nil {
		return err
	}

	if rotate {
		err := t.notify(ctx, keybase1.TeamChangeSet{KeyRotated: true, Misc: true}, latestSeqno)
		if err != nil {
			return err
		}
		t.storeTeamEKPayload(ctx, maybeEKPayload)
		createTeambotKeys(t.G(), t.ID, botMembers)
	} else {
		err := t.notify(ctx, keybase1.TeamChangeSet{Misc: true}, latestSeqno)
		if err != nil {
			return err
		}
	}
	return nil
}

func (t *Team) botSettingsSection(ctx context.Context, bots map[keybase1.UserVersion]keybase1.TeamBotSettings,
	ratchet *hidden.Ratchet, merkleRoot *libkb.MerkleRoot) (SCTeamSection, *hidden.Ratchet, error) {
	if _, err := t.SharedSecret(ctx); err != nil {
		return SCTeamSection{}, nil, err
	}

	admin, err := t.getAdminPermission(ctx)
	if err != nil {
		return SCTeamSection{}, nil, err
	}

	scBotSettings, err := CreateTeamBotSettings(bots)
	if err != nil {
		return SCTeamSection{}, nil, err
	}
	if ratchet == nil {
		ratchet, err = t.makeRatchet(ctx)
		if err != nil {
			return SCTeamSection{}, nil, err
		}
	}

	section := SCTeamSection{
		ID:          SCTeamID(t.ID),
		Implicit:    t.IsImplicit(),
		Public:      t.IsPublic(),
		Admin:       admin,
		BotSettings: &scBotSettings,
		Ratchets:    ratchet.ToTeamSection(),
	}
	return section, ratchet, nil
}

func (t *Team) PostTeamBotSettings(ctx context.Context, bots map[keybase1.UserVersion]keybase1.TeamBotSettings) error {

	mr, err := t.G().MerkleClient.FetchRootFromServer(t.MetaContext(ctx), libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}

	section, ratchet, err := t.botSettingsSection(ctx, bots, nil, mr)
	if err != nil {
		return err
	}

	payloadArgs := sigPayloadArgs{
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}
	_, err = t.postChangeItem(ctx, section, libkb.LinkTypeTeamBotSettings, mr, payloadArgs)
	return err
}

func (t *Team) precheckLinksToPost(ctx context.Context, sigMultiItems []libkb.SigMultiItem) (err error) {
	uv, err := t.currentUserUV(ctx)
	if err != nil {
		return err
	}
	return precheckLinksToPost(ctx, t.G(), sigMultiItems, t.chain(), uv)
}

// Try to run `post` (expected to post new team sigchain links).
// Retry it several times if it fails due to being behind the latest team sigchain state or due to other retryable errors.
// Passes the attempt number (initially 0) to `post`.
func RetryIfPossible(ctx context.Context, g *libkb.GlobalContext, post func(ctx context.Context, attempt int) error) (err error) {
	mctx := libkb.NewMetaContext(ctx, g)
	defer mctx.TraceTimed("RetryIfPossible", func() error { return err })()
	const nRetries = 3
	for i := 0; i < nRetries; i++ {
		mctx.Debug("| RetryIfPossible(%v)", i)
		err = post(mctx.Ctx(), i)
		switch {
		case isSigOldSeqnoError(err):
			mctx.Debug("| retrying due to SigOldSeqnoError %d", i)
		case isStaleBoxError(err):
			mctx.Debug("| retrying due to StaleBoxError %d", i)
		case isTeamBadGenerationError(err):
			mctx.Debug("| retrying due to Bad Generation Error (%s) %d", err, i)
		case isSigBadTotalOrder(err):
			mctx.Debug("| retrying since update would violate total ordering for team %d", i)
		case isSigMissingRatchet(err):
			mctx.Debug("| retrying since the server wanted a ratchet and we didn't provide one %d", i)
		case isHiddenAppendPrecheckError(err):
			mctx.Debug("| retrying since we hit a hidden append precheck error")
		case libkb.IsEphemeralRetryableError(err):
			mctx.Debug("| retrying since we hit a retryable ephemeral error %v, attempt %d", err, i)
		default:
			return err
		}
	}
	mctx.Debug("| RetryIfPossible exhausted attempts")
	if err == nil {
		// Should never happen
		return fmt.Errorf("failed retryable team operation")
	}
	// Return the error from the final round
	return err
}

func isHiddenAppendPrecheckError(err error) bool {
	perr, ok := err.(PrecheckAppendError)
	if !ok {
		return false
	}
	_, ok = perr.Inner.(hidden.LoaderError)
	return ok
}

func isSigOldSeqnoError(err error) bool {
	return libkb.IsAppStatusCode(err, keybase1.StatusCode_SCSigOldSeqno)
}

func isSigBadTotalOrder(err error) bool {
	return libkb.IsAppStatusCode(err, keybase1.StatusCode_SCSigBadTotalOrder)
}

func isSigMissingRatchet(err error) bool {
	return libkb.IsAppStatusCode(err, keybase1.StatusCode_SCSigMissingRatchet)
}

func isTeamBadGenerationError(err error) bool {
	return libkb.IsAppStatusCode(err, keybase1.StatusCode_SCTeamBadGeneration)
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
	m := t.MetaContext(ctx)
	defer m.Trace("Team.AssociateWithTLFKeyset", func() error { return err })()

	// If we get no crypt keys, just associate TLF ID and bail
	if len(cryptKeys) == 0 {
		m.Debug("AssociateWithTLFKeyset: no crypt keys given, aborting")
		return nil
	}

	// Sort crypt keys by generation (just in case they aren't naturally)
	sort.Slice(cryptKeys, func(i, j int) bool {
		return cryptKeys[i].KeyGeneration < cryptKeys[j].KeyGeneration
	})

	latestKey, err := t.ApplicationKey(ctx, appType)
	if err != nil {
		return err
	}
	encStr, hash, err := t.boxKBFSCryptKeys(ctx, latestKey, cryptKeys)
	if err != nil {
		return err
	}

	ratchet, err := t.makeRatchet(ctx)
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
		Ratchets: ratchet.ToTeamSection(),
	}

	mr, err := m.G().MerkleClient.FetchRootFromServer(m, libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for KBFS settings update")
	}

	sigMultiItem, latestSeqno, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeKBFSSettings, mr)
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
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	})

	err = t.postMulti(m, payload)
	if err != nil {
		return err
	}

	return t.HintLatestSeqno(m, latestSeqno)
}

func (t *Team) AssociateWithTLFID(ctx context.Context, tlfID keybase1.TLFID) (err error) {
	m := t.MetaContext(ctx)
	defer m.Trace("Team.AssociateWithTLFID", func() error { return err })()

	if tlfID.Eq(t.LatestKBFSTLFID()) {
		m.Debug("No updated needed, TLFID already set to %s", tlfID)
		return nil
	}

	ratchet, err := t.makeRatchet(ctx)
	if err != nil {
		return err
	}

	teamSection := SCTeamSection{
		ID:       SCTeamID(t.ID),
		Implicit: t.IsImplicit(),
		Public:   t.IsPublic(),
		KBFS: &SCTeamKBFS{
			TLF: &SCTeamKBFSTLF{
				ID: tlfID,
			},
		},
		Ratchets: ratchet.ToTeamSection(),
	}

	mr, err := m.G().MerkleClient.FetchRootFromServer(m, libkb.TeamMerkleFreshnessForAdmin)
	if err != nil {
		return err
	}
	if mr == nil {
		return errors.New("No merkle root available for KBFS settings update")
	}

	sigMultiItem, latestSeqno, err := t.sigTeamItem(ctx, teamSection, libkb.LinkTypeKBFSSettings, mr)
	if err != nil {
		return err
	}

	sigPayloadArgs := sigPayloadArgs{
		ratchetBlindingKeys: ratchet.ToSigPayload(),
	}
	payload := t.sigPayload([]libkb.SigMultiItem{sigMultiItem}, sigPayloadArgs)
	err = t.postMulti(libkb.NewMetaContext(ctx, t.G()), payload)
	if err != nil {
		return err
	}
	return t.HintLatestSeqno(m, latestSeqno)
}

func (t *Team) notifyNoChainChange(ctx context.Context, changes keybase1.TeamChangeSet) error {
	return t.notify(ctx, changes, keybase1.Seqno(0))
}

// Send notifyrouter messages.
// Modifies `changes`
// Update to the latest seqno that we're passing though, don't make any assumptions about number of sigs.
// Note that we're probably going to be getting this same notification a second time, since it will
// bounce off a gregor and back to us. But they are idempotent, so it should be fine to be double-notified.
func (t *Team) notify(ctx context.Context, changes keybase1.TeamChangeSet, latestSeqno keybase1.Seqno) error {
	changes.KeyRotated = changes.KeyRotated || t.rotated
	m := libkb.NewMetaContext(ctx, t.G())
	var err error
	if latestSeqno > 0 {
		err = HintLatestSeqno(m, t.ID, latestSeqno)
	}
	t.G().NotifyRouter.HandleTeamChangedByBothKeys(ctx, t.ID, t.Name().String(), t.NextSeqno(), t.IsImplicit(), changes, keybase1.Seqno(0), keybase1.Seqno(0))
	return err
}

func (t *Team) HintLatestSeqno(m libkb.MetaContext, n keybase1.Seqno) error {
	return HintLatestSeqno(m, t.ID, n)
}

func HintLatestSeqno(m libkb.MetaContext, id keybase1.TeamID, n keybase1.Seqno) error {
	err := m.G().GetTeamLoader().HintLatestSeqno(m.Ctx(), id, n)
	if err != nil {
		m.Warning("error in TeamLoader#HintLatestSeqno: %v", err)
	}
	e2 := m.G().GetFastTeamLoader().HintLatestSeqno(m, id, n)
	if e2 != nil {
		m.Warning("error in FastTeamLoader#HintLatestSeqno: %v", err)
	}
	if err != nil {
		return err
	}
	return e2
}

func HintLatestHiddenSeqno(m libkb.MetaContext, id keybase1.TeamID, n keybase1.Seqno) error {
	err := m.G().GetHiddenTeamChainManager().HintLatestSeqno(m, id, n)
	if err != nil {
		m.Warning("error in HintLatestHiddenSeqno: %v", err)
	}
	return err
}

func (t *Team) refreshUIDMapper(ctx context.Context, g *libkb.GlobalContext) {
	for uv := range t.chain().inner.UserLog {
		_, err := g.UIDMapper.InformOfEldestSeqno(ctx, g, uv)
		if err != nil {
			g.Log.CDebugf(ctx, "Error informing eldest seqno: %+v", err.Error())
		}
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
			_, err = g.UIDMapper.InformOfEldestSeqno(ctx, g, uv)
			if err != nil {
				g.Log.CDebugf(ctx, "Error informing eldest seqno: %+v", err.Error())
			}
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
	if team.LatestKBFSTLFID().IsNil() {
		if err = team.AssociateWithTLFID(ctx, tlfID); err != nil {
			return err
		}
	} else {
		if team.LatestKBFSTLFID().String() != tlfID.String() {
			return fmt.Errorf("implicit team already associated with different TLF ID: teamID: %s tlfID: %s",
				team.ID, tlfID)
		}
	}

	// Reload the team
	if team, err = Load(ctx, g, keybase1.LoadTeamArg{
		ID:          team.ID,
		Public:      public,
		ForceRepoll: true,
	}); err != nil {
		return err
	}

	// Post the crypt keys
	return team.AssociateWithTLFKeyset(ctx, tlfID, cryptKeys, appType)
}

func TeamInviteTypeFromString(mctx libkb.MetaContext, inviteTypeStr string) (keybase1.TeamInviteType, error) {
	switch inviteTypeStr {
	case "keybase":
		return keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_KEYBASE), nil
	case "email":
		return keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_EMAIL), nil
	case "seitan_invite_token":
		return keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_SEITAN), nil
	case "phone":
		return keybase1.NewTeamInviteTypeDefault(keybase1.TeamInviteCategory_PHONE), nil
	case "twitter", "github", "facebook", "reddit", "hackernews", "pgp", "http", "https", "dns":
		return keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork(inviteTypeStr)), nil
	default:
		if mctx.G().GetProofServices().GetServiceType(mctx.Ctx(), inviteTypeStr) != nil {
			return keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork(inviteTypeStr)), nil
		}

		isDev := mctx.G().Env.GetRunMode() == libkb.DevelRunMode
		if isDev && inviteTypeStr == "rooter" {
			return keybase1.NewTeamInviteTypeWithSbs(keybase1.TeamInviteSocialNetwork(inviteTypeStr)), nil
		}
		// Don't want to break existing clients if we see an unknown invite type.
		return keybase1.NewTeamInviteTypeWithUnknown(inviteTypeStr), nil
	}
}

func FreezeTeam(mctx libkb.MetaContext, teamID keybase1.TeamID) error {
	err3 := mctx.G().GetHiddenTeamChainManager().Freeze(mctx, teamID)
	if err3 != nil {
		mctx.Debug("error freezing in hidden team chain manager: %v", err3)
	}
	err1 := mctx.G().GetTeamLoader().Freeze(mctx.Ctx(), teamID)
	if err1 != nil {
		mctx.Debug("error freezing in team cache: %v", err1)
	}
	err2 := mctx.G().GetFastTeamLoader().Freeze(mctx, teamID)
	if err2 != nil {
		mctx.Debug("error freezing in fast team cache: %v", err2)
	}
	return libkb.CombineErrors(err1, err2, err3)
}

func TombstoneTeam(mctx libkb.MetaContext, teamID keybase1.TeamID) error {
	err3 := mctx.G().GetHiddenTeamChainManager().Tombstone(mctx, teamID)
	if err3 != nil {
		mctx.Debug("error tombstoning in hidden team chain manager: %v", err3)
		if _, ok := err3.(hidden.TombstonedError); ok {
			err3 = nil
		}
	}
	err1 := mctx.G().GetTeamLoader().Tombstone(mctx.Ctx(), teamID)
	if err1 != nil {
		mctx.Debug("error tombstoning in team cache: %v", err1)
		if _, ok := err1.(TeamTombstonedError); ok {
			err1 = nil
		}
	}
	err2 := mctx.G().GetFastTeamLoader().Tombstone(mctx, teamID)
	if err2 != nil {
		mctx.Debug("error tombstoning in fast team cache: %v", err2)
		if _, ok := err2.(TeamTombstonedError); ok {
			err2 = nil
		}
	}
	return libkb.CombineErrors(err1, err2, err3)
}

type TeamShim struct {
	Data   *keybase1.TeamData
	Hidden *keybase1.HiddenTeamChain
}

func (t *TeamShim) MainChain() *keybase1.TeamData          { return t.Data }
func (t *TeamShim) HiddenChain() *keybase1.HiddenTeamChain { return t.Hidden }

var _ Teamer = (*TeamShim)(nil)

func KeySummary(t Teamer) string {
	if t == nil {
		return "Ø"
	}
	return fmt.Sprintf("{main:%s, hidden:%s}", t.MainChain().KeySummary(), t.HiddenChain().KeySummary())
}
