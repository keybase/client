package stellar

import (
	"context"

	"github.com/keybase/client/go/libkb"
)

func ServiceInit(g *libkb.GlobalContext) {
	g.SetStellar(NewStellar(g))
}

type Stellar struct {
	libkb.Contextified
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
