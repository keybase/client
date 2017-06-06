package teams

import (
	"encoding/json"
	"errors"
	"fmt"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func Get(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	f := newFinder(g)
	return f.find(ctx, g, name)
}

type finder struct {
	libkb.Contextified
}

func newFinder(g *libkb.GlobalContext) *finder {
	return &finder{
		Contextified: libkb.NewContextified(g),
	}
}

func (f *finder) find(ctx context.Context, g *libkb.GlobalContext, name string) (*Team, error) {
	raw, err := f.rawTeam(ctx, name)
	if err != nil {
		return nil, err
	}

	links, err := f.chainLinks(ctx, raw)
	if err != nil {
		return nil, err
	}

	player, err := f.newPlayer(ctx, links)
	if err != nil {
		return nil, err
	}

	state, err := player.GetState()
	if err != nil {
		return nil, err
	}

	// TODO validate reader key masks
	td := keybase1.TeamData{
		Chain:           state.inner,
		PerTeamKeySeeds: nil,
		ReaderKeyMasks:  raw.ReaderKeyMasks,
	}

	seed, err := f.openBox(ctx, raw.Box, state)
	if err != nil {
		return nil, err
	}
	td.PerTeamKeySeeds = append(td.PerTeamKeySeeds, *seed)

	return &Team{
		TeamData: &td,
	}, nil
}

func (f *finder) rawTeam(ctx context.Context, name string) (*rawTeam, error) {
	arg := libkb.NewRetryAPIArg("team/get")
	arg.NetContext = ctx
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"name": libkb.S{Val: name},
	}
	var rt rawTeam
	if err := f.G().API.GetDecode(arg, &rt); err != nil {
		return nil, err
	}
	return &rt, nil
}

func (f *finder) chainLinks(ctx context.Context, rawTeam *rawTeam) ([]SCChainLink, error) {
	var links []SCChainLink
	for _, raw := range rawTeam.Chain {
		link, err := ParseTeamChainLink(string(raw))
		if err != nil {
			return nil, err
		}
		links = append(links, link)
	}
	return links, nil
}

func (f *finder) newPlayer(ctx context.Context, links []SCChainLink) (*TeamSigChainPlayer, error) {
	player := NewTeamSigChainPlayer(f.G(), f, NewUserVersion(f.G().Env.GetUsername().String(), 1), false)
	if err := player.AddChainLinks(ctx, links); err != nil {
		return nil, err
	}
	return player, nil
}

func (f *finder) openBox(ctx context.Context, box TeamBox, chain TeamSigChainState) (*keybase1.PerTeamKeySeedItem, error) {
	userEncKey, err := f.perUserEncryptionKeyForBox(ctx, box)
	if err != nil {
		return nil, err
	}

	secret, err := box.Open(userEncKey)
	if err != nil {
		return nil, err
	}

	signingKey, encryptionKey, err := generatePerTeamKeysFromSecret(secret)
	if err != nil {
		return nil, err
	}

	teamKey, err := chain.GetPerTeamKeyAtGeneration(box.Generation)
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

	seed, err := libkb.MakeByte32Soft(secret)
	if err != nil {
		return nil, fmt.Errorf("invalid seed: %v", err)
	}

	record := keybase1.PerTeamKeySeedItem{
		Seed:       seed,
		Generation: box.Generation,
		Seqno:      teamKey.Seqno,
	}

	return &record, nil
}

func (f *finder) perUserEncryptionKeyForBox(ctx context.Context, box TeamBox) (*libkb.NaclDHKeyPair, error) {
	kr, err := f.G().GetPerUserKeyring()
	if err != nil {
		return nil, err
	}
	// XXX this seems to be necessary:
	if err := kr.Sync(ctx); err != nil {
		return nil, err
	}
	encKey, err := kr.GetEncryptionKeyBySeqno(ctx, box.PerUserKeySeqno)
	if err != nil {
		return nil, err
	}

	return encKey, nil
}

func (f *finder) UsernameForUID(ctx context.Context, uid keybase1.UID) (string, error) {
	name, err := f.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", err
	}
	return name.String(), nil
}

type rawTeam struct {
	Status         libkb.AppStatus
	Chain          []json.RawMessage
	Box            TeamBox
	ReaderKeyMasks []keybase1.ReaderKeyMask `json:"reader_key_masks"`
}

func (r *rawTeam) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}
