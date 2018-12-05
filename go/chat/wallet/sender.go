package wallet

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Sender struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewSender(g *globals.Context) *Sender {
	return &Sender{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Wallet.Sender", false),
	}
}

func (s *Sender) getUsername(ctx context.Context, convID chat1.ConversationID) (string, error) {
	return "", errors.New("not impl")
}

func (s *Sender) ParseAndSendPayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	body string) (res []chat1.TextPayment, err error) {
	defer s.Trace(ctx, func() error { return err }, "ParseAndSendPayments")()
	parsed := FindChatTxCandidates(body)
	if len(parsed) == 0 {
		return nil, nil
	}
	minis := make([]libkb.MiniChatPayment, len(parsed))
	usernameToFull := make(map[string]string)
	for i, p := range parsed {
		var username string
		if p.Username == nil {
			if username, err = s.getUsername(ctx, convID); err != nil {
				s.Debug(ctx, "ParseAndSendPayments: failed to get username, skipping: %s", err)
				continue
			}
		} else {
			username = *p.Username
		}
		usernameToFull[username] = p.Full
		mini := libkb.MiniChatPayment{
			Username: libkb.NewNormalizedUsername(username),
			Amount:   p.Amount,
			Currency: p.CurrencyCode,
		}
		minis[i] = mini
	}
	mctx := libkb.NewMetaContext(ctx, s.G().ExternalG())
	paymentRes, err := s.G().GetStellar().SendMiniChatPayments(mctx, minis)
	if err != nil {
		return res, err
	}
	for _, p := range paymentRes {
		tp := chat1.TextPayment{
			PaymentText: usernameToFull[p.Username.String()],
		}
		if p.Error != nil {
			tp.Result = chat1.NewTextPaymentResultWithError(p.Error.Error())
		} else {
			tp.Result = chat1.NewTextPaymentResultWithSent(p.PaymentID)
		}
		res = append(res, tp)
	}
	return res, nil
}
