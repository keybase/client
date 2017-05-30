package teams

import (
	"errors"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func Members(ctx context.Context, g *libkb.GlobalContext, name string) (keybase1.TeamMembers, error) {
	t, err := Get(ctx, g, name)
	if err != nil {
		return keybase1.TeamMembers{}, err
	}
	return t.Members()
}

func AddWriter(ctx context.Context, g *libkb.GlobalContext, teamname, username string) error {
	t, err := Get(ctx, g, teamname)
	if err != nil {
		return err
	}

	uv, err := loadUserVersionByUsername(ctx, g, username)
	if err != nil {
		return err
	}
	nameSeq, err := libkb.MakeNameWithEldestSeqno(uv.Username.String(), uv.EldestSeqno)
	if err != nil {
		return err
	}

	// perTeamKey, err := t.Chain.GetLatestPerTeamKey()

	perTeamSecret, err := t.SharedSecret(ctx)
	if err != nil {
		return err
	}
	perTeamSigningKey, perTeamEncryptionKey, err := generatePerTeamKeysFromSecret(perTeamSecret)
	if err != nil {
		return err
	}

	teamSec, err := t.Section()
	if err != nil {
		return err
	}
	teamSec.Members = &SCTeamMembers{
		Writers: &[]SCTeamMember{SCTeamMember(nameSeq)},
	}

	deviceSigningKey, err := t.G().ActiveDevice.SigningKey()
	if err != nil {
		return err
	}
	deviceEncryptionKey, err := t.G().ActiveDevice.EncryptionKey()
	if err != nil {
		return err
	}

	// seems overkill to load full user for this, but:
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(t.G()))
	if err != nil {
		return err
	}

	sig, err := ChangeMembershipSig(me, t.Chain.GetLatestLinkID(), t.NextSeqno(), deviceSigningKey, teamSec)
	if err != nil {
		return err
	}

	sigJSON, err := sig.Marshal()
	if err != nil {
		return err
	}
	v2Sig, err := makeSigchainV2OuterSig(
		deviceSigningKey,
		libkb.LinkTypeChangeMembership,
		t.NextSeqno(),
		sigJSON,
		t.Chain.GetLatestLinkID(),
		false, /* hasRevokes */
	)
	if err != nil {
		return err
	}

	sigMultiItem := libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: deviceSigningKey.GetKID(),
		Type:       string(libkb.LinkTypeChangeMembership),
		SigInner:   string(sigJSON),
		TeamID:     t.Chain.GetID(),
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: perTeamEncryptionKey.GetKID(),
			Signing:    perTeamSigningKey.GetKID(),
		},
	}

	recipient, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(t.G(), username))
	if err != nil {
		return err
	}
	recipientKey := recipient.GetComputedKeyFamily().GetLatestPerUserKey()
	if recipientKey == nil {
		return errors.New("cannot add a member that does not have a per-user key")
	}
	secretboxRecipients := map[string]keybase1.PerUserKey{
		recipient.GetName(): *recipientKey,
	}
	secretboxes, err := boxTeamSharedSecret(perTeamSecret, deviceEncryptionKey, secretboxRecipients)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{sigMultiItem}
	payload["per_team_key"] = secretboxes

	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}

	return nil
}

func loadUserVersionByUsername(ctx context.Context, g *libkb.GlobalContext, username string) (UserVersion, error) {
	res := g.Resolver.ResolveWithBody(username)
	if res.GetError() != nil {
		return UserVersion{}, res.GetError()
	}
	return loadUserVersionByUID(ctx, g, res.GetUID())
}

func loadUserVersionByUID(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (UserVersion, error) {
	arg := libkb.NewLoadUserByUIDArg(ctx, g, uid)
	upak, _, err := g.GetUPAKLoader().Load(arg)
	if err != nil {
		return UserVersion{}, err
	}

	return NewUserVersion(upak.Base.Username, upak.Base.EldestSeqno), nil
}
