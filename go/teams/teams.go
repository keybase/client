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
	Name keybase1.TeamName
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
		Name: chain.GetName(),
		Data: teamData,
	}
}

func (t *Team) chain() *TeamSigChainState {
	return &TeamSigChainState{inner: t.Data.Chain}
}

func (t *Team) Generation() keybase1.PerTeamKeyGeneration {
	return t.chain().GetLatestGeneration()
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

func (t *Team) UsersWithRole(role keybase1.TeamRole) ([]keybase1.UserVersion, error) {
	return t.chain().GetUsersWithRole(role)
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

func (t *Team) NextSeqno() keybase1.Seqno {
	return t.chain().GetLatestSeqno() + 1
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
		return res, libkb.NotFoundError{
			Msg: fmt.Sprintf("no mask found for application %v", application)}
	}
	mask, ok := m2[generation]
	if !ok {
		return res, libkb.NotFoundError{
			Msg: fmt.Sprintf("no mask found for application %v, generation %v", application, generation)}
	}
	return keybase1.ReaderKeyMask{
		Application: application,
		Generation:  generation,
		Mask:        mask,
	}, nil
}

func (t *Team) Rotate(ctx context.Context) error {

	// make keys for the team
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

	// create the team section of the signature
	section, err := memSet.Section(t.chain().GetID(), admin)
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
	payload := make(libkb.JSONPayload)
	if err := t.postChangeItem(ctx, section, secretBoxes, libkb.LinkTypeRotateKey, nil, nil, payload); err != nil {
		return err
	}

	// send notification that team key rotated
	t.G().NotifyRouter.HandleTeamKeyRotated(ctx, t.chain().GetID(), t.Name.String())

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

func (t *Team) getDowngradedUsers(ms *memberSet) (uids []keybase1.UID, err error) {

	for _, member := range ms.None {
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

func (t *Team) ChangeMembership(ctx context.Context, req keybase1.TeamChangeReq) error {
	// create the change membership section + secretBoxes
	section, secretBoxes, memberSet, err := t.changeMembershipSection(ctx, req)
	if err != nil {
		return err
	}

	if err := t.ForceMerkleRootUpdate(ctx); err != nil {
		return err
	}

	var merkleRoot *libkb.MerkleRoot
	var lease *libkb.Lease

	downgrades, err := t.getDowngradedUsers(memberSet)
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
	payload := make(libkb.JSONPayload)
	if err := t.postChangeItem(ctx, section, secretBoxes, libkb.LinkTypeChangeMembership, lease, merkleRoot, payload); err != nil {
		return err
	}

	if t.rotated {
		// send notification that team key rotated
		t.G().NotifyRouter.HandleTeamKeyRotated(ctx, t.chain().GetID(), t.Name.String())
	}
	return nil
}

func (t *Team) Leave(ctx context.Context, permanent bool) error {
	section, err := newMemberSet().Section(t.chain().GetID(), nil)
	if err != nil {
		return err
	}
	payload := make(libkb.JSONPayload)
	payload["permanent"] = permanent
	return t.postChangeItem(ctx, section, nil, libkb.LinkTypeLeave, nil, nil, payload)
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
		targetTeam, err = GetForTeamManagement(ctx, t.G(), *parentID)
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
			err = errors.New("cannot perform this operation without adminship")
		}
		return nil, err
	}

	logPoint := targetTeam.chain().GetAdminUserLogPoint(uv)
	ret := SCTeamAdmin{
		TeamID:  (SCTeamID)(targetTeam.ID),
		Seqno:   logPoint.SigMeta.SigChainLocation.Seqno,
		SeqType: logPoint.SigMeta.SigChainLocation.SeqType,
	}
	return &ret, nil
}

func (t *Team) changeMembershipSection(ctx context.Context, req keybase1.TeamChangeReq) (SCTeamSection, *PerTeamSharedSecretBoxes, *memberSet, error) {
	// make keys for the team
	if _, err := t.SharedSecret(ctx); err != nil {
		return SCTeamSection{}, nil, nil, err
	}

	admin, err := t.getAdminPermission(ctx, true)
	if err != nil {
		return SCTeamSection{}, nil, nil, err
	}

	// load the member set specified in req
	memSet, err := newMemberSetChange(ctx, t.G(), req)
	if err != nil {
		return SCTeamSection{}, nil, nil, err
	}

	// create the team section of the signature
	section, err := memSet.Section(t.chain().GetID(), admin)
	if err != nil {
		return SCTeamSection{}, nil, nil, err
	}

	// create secret boxes for recipients, possibly rotating the key
	secretBoxes, perTeamKeySection, err := t.recipientBoxes(ctx, memSet)
	if err != nil {
		return SCTeamSection{}, nil, nil, err
	}
	section.PerTeamKey = perTeamKeySection

	return section, secretBoxes, memSet, nil
}

func (t *Team) postChangeItem(ctx context.Context, section SCTeamSection, secretBoxes *PerTeamSharedSecretBoxes, linkType libkb.LinkType, lease *libkb.Lease, merkleRoot *libkb.MerkleRoot, prepayload libkb.JSONPayload) error {
	// create the change item
	sigMultiItem, err := t.sigChangeItem(ctx, section, linkType, merkleRoot)
	if err != nil {
		return err
	}

	// make the payload
	payload := t.sigPayload(sigMultiItem, secretBoxes, lease, prepayload)

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
	return linkType != libkb.LinkTypeLeave
}

func (t *Team) sigChangeItem(ctx context.Context, section SCTeamSection, linkType libkb.LinkType, merkleRoot *libkb.MerkleRoot) (libkb.SigMultiItem, error) {
	me, err := t.loadMe(ctx)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	latestLinkID1, err := libkb.ImportLinkID(t.chain().GetLatestLinkID())
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	sig, err := ChangeSig(me, latestLinkID1, t.NextSeqno(), deviceSigningKey, section, linkType, merkleRoot)

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

	sigJSON, err := sig.Marshal()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	latestLinkID2, err := libkb.ImportLinkID(t.chain().GetLatestLinkID())
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		linkType,
		t.NextSeqno(),
		sigJSON,
		latestLinkID2,
		false, /* hasRevokes */
	)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(linkType),
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

func (t *Team) recipientBoxes(ctx context.Context, memSet *memberSet) (*PerTeamSharedSecretBoxes, *SCPerTeamKey, error) {

	// if there are any removals happening, need to rotate the
	// team key, and recipients will be all the users in the team
	// after the removal.
	if memSet.HasRemoval() {
		// key is rotating, so recipients needs to be all the remaining members
		// of the team after the removal (and including any new members in this
		// change)
		t.G().Log.Debug("team change request contains removal, rotating team key")
		return t.rotateBoxes(ctx, memSet)
	}

	// don't need keys for existing members, so remove them from the set
	memSet.removeExistingMembers(ctx, t)
	t.G().Log.Debug("team change request: %d new members", len(memSet.recipients))
	if len(memSet.recipients) == 0 {
		return nil, nil, nil
	}

	// get device key
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, nil, err
	}

	boxes, err := t.keyManager.SharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return nil, nil, err
	}
	// No SCPerTeamKey section when the key isn't rotated
	return boxes, nil, err
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
	t.rotated = true

	return t.keyManager.RotateSharedSecretBoxes(ctx, deviceEncryptionKey, memSet.recipients)
}

func (t *Team) sigPayload(sigMultiItem libkb.SigMultiItem, secretBoxes *PerTeamSharedSecretBoxes, lease *libkb.Lease, payload libkb.JSONPayload) libkb.JSONPayload {
	payload["sigs"] = []interface{}{sigMultiItem}
	if secretBoxes != nil {
		payload["per_team_key"] = secretBoxes
	}
	if lease != nil {
		payload["downgrade_lease_id"] = lease.LeaseID
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
	if err != nil {
		return err
	}
	return nil
}

// ForceMerkleRootUpdate will call LookupTeam on MerkleClient to
// update cached merkle root to include latest team sigs. Needed if
// client wants to create a signature that refers to an adminship,
// signature's merkle_root has to be more fresh than adminship's.
func (t *Team) ForceMerkleRootUpdate(ctx context.Context) error {
	_, err := t.G().GetMerkleClient().LookupTeam(ctx, t.ID)
	return err
}

func LoadTeamPlusApplicationKeys(ctx context.Context, g *libkb.GlobalContext, id keybase1.TeamID, application keybase1.TeamApplication, refreshers keybase1.TeamRefreshers) (keybase1.TeamPlusApplicationKeys, error) {
	var teamPlusApplicationKeys keybase1.TeamPlusApplicationKeys
	teamByID, err := GetForApplication(ctx, g, id, application, refreshers)
	if err != nil {
		return teamPlusApplicationKeys, err
	}
	return teamByID.ExportToTeamPlusApplicationKeys(ctx, keybase1.Time(0), application)
}
