package libkb

import (
	"context"
	"fmt"
)

type nullStellar struct {
	Contextified
}

var _ Stellar = (*nullStellar)(nil)

func newNullStellar(g *GlobalContext) *nullStellar {
	return &nullStellar{NewContextified(g)}
}

func (n *nullStellar) CreateWalletGated(ctx context.Context) (bool, error) {
	return false, fmt.Errorf("null stellar impl")
}

func (n *nullStellar) CreateWalletSoft(ctx context.Context) {
	n.G().Log.CErrorf(ctx, "null stellar impl")
}

func (n *nullStellar) Upkeep(ctx context.Context) error {
	return fmt.Errorf("null stellar impl")
}

func (n *nullStellar) OnLogout() {}
