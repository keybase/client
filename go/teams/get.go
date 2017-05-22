package teams

import (
	"context"
	"encoding/json"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func Get(ctx context.Context, g *libkb.GlobalContext, name string) (*TeamSigChainState, error) {
	f := newFinder(g)
	return f.find(ctx, name)
}

type finder struct {
	libkb.Contextified
}

func newFinder(g *libkb.GlobalContext) *finder {
	return &finder{
		Contextified: libkb.NewContextified(g),
	}
}

func (f *finder) find(ctx context.Context, name string) (*TeamSigChainState, error) {
	links, err := f.chainLinks(name)
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

	return &state, nil
}

func (f *finder) chainLinks(name string) ([]SCChainLink, error) {
	arg := libkb.NewRetryAPIArg("team/get")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"name": libkb.S{Val: name},
	}
	var chain rawChain
	if err := f.G().API.GetDecode(arg, &chain); err != nil {
		return nil, err
	}
	var links []SCChainLink
	for _, raw := range chain.Chain {
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

func (f *finder) UsernameForUID(ctx context.Context, uid keybase1.UID) (string, error) {
	name, err := f.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", err
	}
	return name.String(), nil
}

type rawChain struct {
	Status libkb.AppStatus
	Chain  []json.RawMessage
}

func (r *rawChain) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}
