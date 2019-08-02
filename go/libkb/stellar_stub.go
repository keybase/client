package libkb

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/protocol/chat1"
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
)

type nullStellar struct {
	Contextified
}

var _ Stellar = (*nullStellar)(nil)

func newNullStellar(g *GlobalContext) *nullStellar {
	return &nullStellar{NewContextified(g)}
}

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

func (n *nullStellar) SendMiniChatPayments(mctx MetaContext, convID chat1.ConversationID, payments []MiniChatPayment) ([]MiniChatPaymentResult, error) {
	return nil, errors.New("nullStellar SendMiniChatPayments")
}

func (n *nullStellar) SpecMiniChatPayments(mctx MetaContext, payments []MiniChatPayment) (*MiniChatPaymentSummary, error) {
	return nil, errors.New("nullStellar SpecMiniChatPayments")
}

func (n *nullStellar) HandleOobm(context.Context, gregor.OutOfBandMessage) (bool, error) {
	return false, errors.New("nullStellar HandleOobm")
}

func (n *nullStellar) RemovePendingTx(MetaContext, stellar1.AccountID, stellar1.TransactionID) error {
	return errors.New("nullStellar RemovePendingTx")
}

func (n *nullStellar) KnownCurrencyCodeInstant(context.Context, string) (bool, bool) {
	return false, false
}

func (n *nullStellar) InformBundle(MetaContext, stellar1.BundleRevision, []stellar1.BundleEntry) {}

func (n *nullStellar) InformDefaultCurrencyChange(MetaContext) {}
