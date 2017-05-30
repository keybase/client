package teams

import (
	"encoding/json"

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

	// XXX
	// fmt.Printf("raw: %+v\n", raw)

	team := NewTeam(g, name)
	team.Box = raw.Box

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

	team.Chain = &state

	return team, nil
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

func (f *finder) UsernameForUID(ctx context.Context, uid keybase1.UID) (string, error) {
	name, err := f.G().GetUPAKLoader().LookupUsername(ctx, uid)
	if err != nil {
		return "", err
	}
	return name.String(), nil
}

type rawTeam struct {
	Status libkb.AppStatus
	Chain  []json.RawMessage
	Box    TeamBox
}

func (r *rawTeam) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}
