package teams

import (
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
	s, err := Get(ctx, g, teamname)
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

	_ = s
	// perTeamKey, err := s.GetLatestPerTeamKey()
	_ = nameSeq
	// teamSec := libkb.TeamSection{ID: s.ID}
	// teamSec.Members.Writer = []libkb.NameWithEldestSeqno{nameSeq}

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
