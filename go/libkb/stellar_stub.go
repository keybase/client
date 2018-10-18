package libkb

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/gregor"
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
)

type nullStellar struct {
	Contextified
}

var _ Stellar = (*nullStellar)(nil)

func newNullStellar(g *GlobalContext) *nullStellar {
	return &nullStellar{NewContextified(g)}
}

func (n *nullStellar) OnLogout() {}

func (n *nullStellar) CreateWalletSoft(ctx context.Context) {
	n.G().Log.CErrorf(ctx, "null stellar impl")
}

func (n *nullStellar) Upkeep(ctx context.Context) error {
	return fmt.Errorf("null stellar impl")
}

func (n *nullStellar) GetServerDefinitions(ctx context.Context) (ret stellar1.StellarServerDefinitions, err error) {
	return ret, fmt.Errorf("null stellar impl")
}

func (n *nullStellar) KickAutoClaimRunner(MetaContext, gregor.MsgID) {}

func (n *nullStellar) UpdateUnreadCount(context.Context, stellar1.AccountID, int) error {
	return errors.New("nullStellar UpdateUnreadCount")
}
