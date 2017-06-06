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

	Name           string
	Chain          *TeamSigChainState
	Box            TeamBox
	ReaderKeyMasks []keybase1.ReaderKeyMask

	factory *TeamKeyFactory

	me *libkb.User
}

func NewTeam(g *libkb.GlobalContext, name string) *Team {
	return &Team{Name: name, Contextified: libkb.NewContextified(g)}
}

func (t *Team) SharedSecret(ctx context.Context) ([]byte, error) {
	if t.factory == nil {
		userEncKey, err := t.perUserEncryptionKeyForBox(ctx)
		if err != nil {
			return nil, err
		}

		secret, err := t.Box.Open(userEncKey)
		if err != nil {
			return nil, err
		}

		factory, err := NewTeamKeyFactoryWithSecret(secret, t.Box.Generation)
		if err != nil {
			return nil, err
		}

		signingKey, err := factory.SigningKey()
		if err != nil {
			return nil, err
		}
		encryptionKey, err := factory.EncryptionKey()
		if err != nil {
			return nil, err
		}

		teamKey, err := t.Chain.GetPerTeamKeyAtGeneration(int(t.Box.Generation))
		if err != nil {
			return nil, err
		}

		if !teamKey.SigKID.SecureEqual(signingKey.GetKID()) {
			return nil, errors.New("derived signing key did not match key in team chain")
		}

		if !teamKey.EncKID.SecureEqual(encryptionKey.GetKID()) {
			return nil, errors.New("derived encryption key did not match key in team chain")
		}

		// TODO: check that t.Box.SenderKID is a known device DH key for the
		// user that signed the link.
		// See CORE-5399

		// all checks passed, ok to hold onto the factory for this secret
		t.factory = factory
	}

	return t.factory.SharedSecret(), nil
}

func (t *Team) KBFSKey(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_KBFS)
}

func (t *Team) ChatKey(ctx context.Context) (keybase1.TeamApplicationKey, error) {
	return t.ApplicationKey(ctx, keybase1.TeamApplication_CHAT)
}

func (t *Team) IsMember(ctx context.Context, username string) bool {
	role, err := t.MemberRole(ctx, username)
	if err != nil {
		t.G().Log.Debug("error getting user role: %s", err)
		return false
	}
	if role == keybase1.TeamRole_NONE {
		return false
	}
	return true
}

func (t *Team) MemberRole(ctx context.Context, username string) (keybase1.TeamRole, error) {
	uv, err := loadUserVersionByUsername(ctx, t.G(), username)
	if err != nil {
		return keybase1.TeamRole_NONE, err
	}
	return t.Chain.GetUserRole(uv)
}

func (t *Team) UsernamesWithRole(role keybase1.TeamRole) ([]libkb.NormalizedUsername, error) {
	uvs, err := t.Chain.GetUsersWithRole(role)
	if err != nil {
		return nil, err
	}
	names := make([]libkb.NormalizedUsername, len(uvs))
	for i, uv := range uvs {
		names[i] = libkb.NewNormalizedUsername(uv.Username)
	}
	return names, nil
}

func (t *Team) Members() (keybase1.TeamMembers, error) {
	var members keybase1.TeamMembers

	x, err := t.UsernamesWithRole(keybase1.TeamRole_OWNER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Owners = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_ADMIN)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Admins = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_WRITER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Writers = libkb.NormalizedUsernamesToStrings(x)

	x, err = t.UsernamesWithRole(keybase1.TeamRole_READER)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	members.Readers = libkb.NormalizedUsernamesToStrings(x)

	return members, nil
}

func (t *Team) perUserEncryptionKeyForBox(ctx context.Context) (*libkb.NaclDHKeyPair, error) {
	kr, err := t.G().GetPerUserKeyring()
	if err != nil {
		return nil, err
	}
	// XXX this seems to be necessary:
	if err := kr.Sync(ctx); err != nil {
		return nil, err
	}
	encKey, err := kr.GetEncryptionKeyBySeqno(ctx, t.Box.PerUserKeySeqno)
	if err != nil {
		return nil, err
	}
	if encKey.Private == nil {
		// Should never happen
		return nil, errors.New("per user enckey is locked")
	}

	return encKey, nil
}

func (t *Team) NextSeqno() keybase1.Seqno {
	return t.Chain.GetLatestSeqno() + 1
}

func (t *Team) AllApplicationKeys(ctx context.Context, application keybase1.TeamApplication) (res []keybase1.TeamApplicationKey, err error) {
	secret, err := t.SharedSecret(ctx)
	if err != nil {
		return res, err
	}
	for _, rkm := range t.ReaderKeyMasks {
		if rkm.Application != application {
			continue
		}
		key, err := t.applicationKeyForMask(rkm, secret)
		if err != nil {
			return res, err
		}
		res = append(res, key)
	}
	return res, nil
}

// ApplicationKey returns the most recent key for an application.
func (t *Team) ApplicationKey(ctx context.Context, application keybase1.TeamApplication) (keybase1.TeamApplicationKey, error) {
	secret, err := t.SharedSecret(ctx)
	if err != nil {
		return keybase1.TeamApplicationKey{}, err
	}

	var max keybase1.ReaderKeyMask
	for _, rkm := range t.ReaderKeyMasks {
		if rkm.Application != application {
			continue
		}
		if rkm.Generation < max.Generation {
			continue
		}
		max = rkm
	}

	if max.Application == 0 {
		return keybase1.TeamApplicationKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("no mask found for application %d", application)}
	}

	return t.applicationKeyForMask(max, secret)
}

func (t *Team) ApplicationKeyAtGeneration(application keybase1.TeamApplication, generation int, secret []byte) (keybase1.TeamApplicationKey, error) {
	for _, rkm := range t.ReaderKeyMasks {
		if rkm.Application != application {
			continue
		}
		if rkm.Generation != generation {
			continue
		}
		return t.applicationKeyForMask(rkm, secret)
	}

	return keybase1.TeamApplicationKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("no mask found for application %d, generation %d", application, generation)}
}

func (t *Team) applicationKeyForMask(mask keybase1.ReaderKeyMask, secret []byte) (keybase1.TeamApplicationKey, error) {
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

func (t *Team) ChangeMembership(ctx context.Context, req keybase1.TeamChangeReq) error {
	// make keys for the team
	if _, err := t.SharedSecret(ctx); err != nil {
		return err
	}

	// load the member set specified in req
	memSet, err := newMemberSet(ctx, t.G(), req)
	if err != nil {
		return err
	}

	// create the team section of the signature
	section, err := memSet.Section(t.Chain.GetID())
	if err != nil {
		return err
	}

	// create secret boxes for recipients, possibly rotating the key
	secretBoxes, perTeamKeySection, err := t.recipientBoxes(ctx, memSet)
	if err != nil {
		return err
	}
	section.PerTeamKey = perTeamKeySection

	// create the change item
	sigMultiItem, err := t.sigChangeItem(section)
	if err != nil {
		return err
	}

	// make the payload
	payload := t.sigPayload(sigMultiItem, secretBoxes)

	pretty, err := json.MarshalIndent(payload, "", "\t")
	if err != nil {
		return err
	}
	t.G().Log.Info("payload: %s", pretty)

	// send it to the server
	return t.postMulti(payload)
}

func (t *Team) loadMe() (*libkb.User, error) {
	if t.me == nil {
		me, err := libkb.LoadMe(libkb.NewLoadUserArg(t.G()))
		if err != nil {
			return nil, err
		}
		t.me = me
	}

	return t.me, nil
}

func (t *Team) sigChangeItem(section SCTeamSection) (libkb.SigMultiItem, error) {
	me, err := t.loadMe()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	latestLinkID1, err := libkb.ImportLinkID(t.Chain.GetLatestLinkID())
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	sig, err := ChangeMembershipSig(me, latestLinkID1, t.NextSeqno(), deviceSigningKey, section)
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	signingKey, err := t.factory.SigningKey()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	encryptionKey, err := t.factory.EncryptionKey()
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

	sigJSON, err := sig.Marshal()
	if err != nil {
		return libkb.SigMultiItem{}, err
	}

	latestLinkID2, err := libkb.ImportLinkID(t.Chain.GetLatestLinkID())
	if err != nil {
		return libkb.SigMultiItem{}, err
	}
	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		libkb.LinkTypeChangeMembership,
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
		Type:       string(libkb.LinkTypeChangeMembership),
		SigInner:   string(sigJSON),
		TeamID:     t.Chain.GetID(),
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: encryptionKey.GetKID(),
			Signing:    signingKey.GetKID(),
		},
	}
	return sigMultiItem, nil
}

func (t *Team) recipientBoxes(ctx context.Context, memSet *memberSet) (*PerTeamSharedSecretBoxes, *SCPerTeamKey, error) {
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return nil, nil, err
	}

	// if there are any removals happening, need to rotate the
	// team key, and recipients will be all the users in the team
	// after the removal.
	if memSet.HasRemoval() {
		// key is rotating, so recipients needs to be all the remaining members
		// of the team after the removal (and including any new members in this
		// change)
		existing, err := t.Members()
		if err != nil {
			return nil, nil, err
		}
		if err := memSet.AddRemainingRecipients(ctx, t.G(), existing); err != nil {
			return nil, nil, err
		}
		return t.factory.RotateSharedSecretBoxes(deviceEncryptionKey, memSet.recipients)
	}

	boxes, err := t.factory.SharedSecretBoxes(deviceEncryptionKey, memSet.recipients)
	if err != nil {
		return nil, nil, err
	}
	// No SCPerTeamKey section when the key isn't rotated
	return boxes, nil, err
}

func (t *Team) sigPayload(sigMultiItem libkb.SigMultiItem, secretBoxes *PerTeamSharedSecretBoxes) libkb.JSONPayload {
	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigMultiItem}
	payload["per_team_key"] = secretBoxes
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
