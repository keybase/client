package stellar

import (
	"context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
)

func ServiceInit(g *libkb.GlobalContext) {
	g.SetStellar(NewStellar(g))
}

type Stellar struct {
	libkb.Contextified

	cachedServerConf stellar1.StellarServerDefinitions
}

var _ libkb.Stellar = (*Stellar)(nil)

func NewStellar(g *libkb.GlobalContext) *Stellar {
	return &Stellar{
		Contextified: libkb.NewContextified(g),
	}
}

func (s *Stellar) CreateWalletGated(ctx context.Context) (bool, error) {
	return CreateWalletGated(ctx, s.G())
}

func (s *Stellar) CreateWalletSoft(ctx context.Context) {
	CreateWalletSoft(ctx, s.G())
}

func (s *Stellar) Upkeep(ctx context.Context) error {
	return Upkeep(ctx, s.G())
}

func (s *Stellar) OnLogout() {}

func (s *Stellar) SetServerDefinitions(ctx context.Context, def stellar1.StellarServerDefinitions) error {
	s.cachedServerConf = def
	return nil
}

func (s *Stellar) GetServerDefinitions(ctx context.Context) (ret stellar1.StellarServerDefinitions, err error) {
	if s.cachedServerConf.Revision == 0 {
		if _, err = remote.RefreshServerConfig(ctx, s.G()); err != nil {
			return ret, err
		}
	}

	return s.cachedServerConf, nil
}
