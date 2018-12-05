package wallet

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
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

func (s *Sender) getUsername(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res string, err error) {
	inbox, _, err := s.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking, true, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
	if err != nil {
		return res, err
	}
	if len(inbox.Convs) != 1 {
		return res, errors.New("no conv found")
	}
	conv := inbox.Convs[0]
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		return res, errors.New("must specify username in team chat")
	default:
		// let everything else through
	}
	if len(conv.Info.Participants) != 2 {
		return res, fmt.Errorf("must specify username with more than two people: %d tlfname: %s",
			len(conv.Info.Participants), conv.Info.TLFNameExpanded())
	}
	username, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(uid.String()))
	if err != nil {
		return res, err
	}
	if username.String() == conv.Info.Participants[0].Username {
		return conv.Info.Participants[1].Username, nil
	}
	return conv.Info.Participants[0].Username, nil
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
			if username, err = s.getUsername(ctx, uid, convID); err != nil {
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
	paymentRes, err := s.G().GetStellar().SendMiniChatPayments(s.G().MetaContext(ctx), minis)
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
