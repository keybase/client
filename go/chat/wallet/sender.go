package wallet

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
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

func (s *Sender) getConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res chat1.ConversationLocal, err error) {
	// slow path just in case (still should be fast)
	inbox, _, err := s.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil,
		&chat1.GetInboxLocalQuery{
			ConvIDs: []chat1.ConversationID{convID},
		}, nil)
	if err != nil {
		return res, err
	}
	if len(inbox.Convs) != 1 {
		return res, errors.New("too many/little convs")
	}
	return inbox.Convs[0], nil
}

func (s *Sender) getConvParseInfo(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (parts []string, membersType chat1.ConversationMembersType, err error) {
	localConv, err := storage.NewInbox(s.G()).GetConversation(ctx, uid, convID)
	if err == nil && localConv.LocalMetadata != nil && len(localConv.LocalMetadata.WriterNames) > 0 {
		// fast path (should always get hit)
		membersType = localConv.Conv.GetMembersType()
		parts = localConv.LocalMetadata.WriterNames
	} else {
		conv, err := s.getConv(ctx, uid, convID)
		if err != nil {
			return parts, membersType, err
		}
		membersType = conv.GetMembersType()
		parts = make([]string, len(conv.Info.Participants))
		for index, p := range conv.Info.Participants {
			parts[index] = p.Username
		}
	}
	return parts, membersType, nil
}

func (s *Sender) getConvFullnames(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res map[string]string, err error) {
	res = make(map[string]string)
	conv, err := s.getConv(ctx, uid, convID)
	if err != nil {
		return res, err
	}
	for _, p := range conv.Info.Participants {
		if p.Fullname != nil {
			res[p.Username] = *p.Fullname
		}
	}
	return res, nil
}

func (s *Sender) getRecipientUsername(ctx context.Context, uid gregor1.UID, parts []string,
	membersType chat1.ConversationMembersType) (res string, err error) {
	switch membersType {
	case chat1.ConversationMembersType_TEAM:
		return res, errors.New("must specify username in team chat")
	default:
	}
	if len(parts) != 2 {
		return res, fmt.Errorf("must specify username with more than two people: %d", len(parts))
	}
	username, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(uid.String()))
	if err != nil {
		return res, err
	}
	if username.String() == parts[0] {
		return parts[1], nil
	}
	return parts[0], nil
}

func (s *Sender) validConvUsername(ctx context.Context, username string, parts []string) bool {
	for _, p := range parts {
		s.Debug(ctx, "part: %s", p)
		if username == p {
			return true
		}
	}
	return false
}

func (s *Sender) ParsePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	body string) (res []types.ParsedStellarPayment) {
	defer s.Trace(ctx, func() error { return nil }, "ParsePayments")()
	parsed := FindChatTxCandidates(body)
	if len(parsed) == 0 {
		return nil
	}

	parts, membersType, err := s.getConvParseInfo(ctx, uid, convID)
	if err != nil {
		s.Debug(ctx, "ParsePayments: failed to getConvParseInfo %v", err)
		return nil
	}
	for _, p := range parsed {
		var username string
		// The currency might be legit but `KnownCurrencyCodeInstant` may not have data yet.
		// In that case (false, false) comes back and the entry is _not_ skipped.
		if known, ok := s.G().GetStellar().KnownCurrencyCodeInstant(ctx, p.CurrencyCode); ok && !known {
			continue
		}
		if p.Username == nil {
			if username, err = s.getRecipientUsername(ctx, uid, parts, membersType); err != nil {
				s.Debug(ctx, "ParsePayments: failed to get username, skipping: %s", err)
				continue
			}
		} else if s.validConvUsername(ctx, *p.Username, parts) {
			username = *p.Username
		} else {
			s.Debug(ctx, "ParsePayments: skipping mention for not being in conv")
			continue
		}
		res = append(res, types.ParsedStellarPayment{
			Username: libkb.NewNormalizedUsername(username),
			Amount:   p.Amount,
			Currency: p.CurrencyCode,
			Full:     p.Full,
		})
	}
	return res
}

func (s *Sender) paymentsToMinis(payments []types.ParsedStellarPayment) (minis []libkb.MiniChatPayment) {
	for _, p := range payments {
		minis = append(minis, p.ToMini())
	}
	return minis
}

func (s *Sender) DescribePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	payments []types.ParsedStellarPayment) (res chat1.UIChatPaymentSummary, toSend []types.ParsedStellarPayment, err error) {
	defer s.Trace(ctx, func() error { return err }, "DescribePayments")()
	specs, err := s.G().GetStellar().SpecMiniChatPayments(s.G().MetaContext(ctx), s.paymentsToMinis(payments))
	if err != nil {
		return res, toSend, err
	}
	fullnames, err := s.getConvFullnames(ctx, uid, convID)
	if err != nil {
		return res, toSend, err
	}
	res.XlmTotal = specs.XLMTotal
	res.DisplayTotal = specs.DisplayTotal
	for index, s := range specs.Specs {
		var displayAmount *string
		var errorMsg *string
		if len(s.DisplayAmount) > 0 {
			displayAmount = new(string)
			*displayAmount = s.DisplayAmount
		}
		if s.Error != nil {
			errorMsg = new(string)
			*errorMsg = s.Error.Error()
		} else {
			toSend = append(toSend, payments[index])
		}
		res.Payments = append(res.Payments, chat1.UIChatPayment{
			Username:      s.Username.String(),
			FullName:      fullnames[s.Username.String()],
			XlmAmount:     s.XLMAmount,
			DisplayAmount: displayAmount,
			Error:         errorMsg,
		})
	}
	return res, toSend, nil
}

func (s *Sender) SendPayments(ctx context.Context, convID chat1.ConversationID, payments []types.ParsedStellarPayment) (res []chat1.TextPayment, err error) {
	defer s.Trace(ctx, func() error { return err }, "SendPayments")()
	usernameToFull := make(map[string]string)
	var minis []libkb.MiniChatPayment
	for _, p := range payments {
		minis = append(minis, p.ToMini())
		usernameToFull[p.Username.String()] = p.Full
	}
	paymentRes, err := s.G().GetStellar().SendMiniChatPayments(s.G().MetaContext(ctx), convID, minis)
	if err != nil {
		return res, err
	}
	for _, p := range paymentRes {
		tp := chat1.TextPayment{
			Username:    p.Username.String(),
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

func (s *Sender) DecorateWithPayments(ctx context.Context, body string, payments []chat1.TextPayment) string {
	return DecorateWithPayments(ctx, body, payments)
}
