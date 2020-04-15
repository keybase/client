package wallet

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

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
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "Wallet.Sender", false),
	}
}

func (s *Sender) getConvParseInfo(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (parts []string, membersType chat1.ConversationMembersType, err error) {
	conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return parts, membersType, err
	}
	allParts, err := utils.GetConvParticipantUsernames(ctx, s.G(), uid, convID)
	if err != nil {
		return parts, membersType, err
	}
	switch conv.GetMembersType() {
	case chat1.ConversationMembersType_TEAM:
		return allParts, conv.GetMembersType(), nil
	default:
		nameParts := strings.Split(utils.GetRemoteConvTLFName(conv), ",")
		nameMap := make(map[string]bool, len(nameParts))
		for _, namePart := range nameParts {
			nameMap[namePart] = true
		}
		for _, part := range allParts {
			if nameMap[part] {
				parts = append(parts, part)
			}
		}
	}
	return parts, conv.GetMembersType(), nil
}

func (s *Sender) getConvFullnames(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res map[string]string, err error) {
	uids, err := s.G().ParticipantsSource.Get(ctx, uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		return res, err
	}
	kuids := make([]keybase1.UID, 0, len(uids))
	for _, uid := range uids {
		kuids = append(kuids, keybase1.UID(uid.String()))
	}
	rows, err := s.G().UIDMapper.MapUIDsToUsernamePackages(ctx, s.G(), kuids, time.Hour*24,
		time.Minute, true)
	if err != nil {
		return res, err
	}
	res = make(map[string]string)
	for _, row := range rows {
		if row.FullName != nil {
			res[row.NormalizedUsername.String()] = row.FullName.FullName.String()
		}
	}
	return res, nil
}

func (s *Sender) getRecipientUsername(ctx context.Context, uid gregor1.UID, parts []string,
	membersType chat1.ConversationMembersType, replyToUID gregor1.UID) (res string, err error) {
	// If this message is a reply, infer the recipient as the original sender
	if !(replyToUID.IsNil() || uid.Eq(replyToUID)) {
		username, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(replyToUID.String()))
		if err != nil {
			return res, err
		}
		return username.String(), nil
	}

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
		if username == p {
			return true
		}
	}
	return false
}

func (s *Sender) ParsePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	body string, replyTo *chat1.MessageID) (res []types.ParsedStellarPayment) {
	defer s.Trace(ctx, nil, "ParsePayments")()
	parsed := FindChatTxCandidates(body)
	if len(parsed) == 0 {
		return nil
	}

	parts, membersType, err := s.getConvParseInfo(ctx, uid, convID)
	if err != nil {
		s.Debug(ctx, "ParsePayments: failed to getConvParseInfo %v", err)
		return nil
	}
	replyToUID, err := s.handleReplyTo(ctx, uid, convID, replyTo)
	if err != nil {
		s.Debug(ctx, "ParsePayments: failed to handleReplyTo: %v", err)
		return nil
	}
	seen := make(map[string]struct{})
	for _, p := range parsed {
		var username string
		// The currency might be legit but `KnownCurrencyCodeInstant` may not have data yet.
		// In that case (false, false) comes back and the entry is _not_ skipped.
		if known, ok := s.G().GetStellar().KnownCurrencyCodeInstant(ctx, p.CurrencyCode); ok && !known {
			continue
		}
		if p.Username == nil {
			if username, err = s.getRecipientUsername(ctx, uid, parts, membersType, replyToUID); err != nil {
				s.Debug(ctx, "ParsePayments: failed to get username, skipping: %s", err)
				continue
			}
		} else if s.validConvUsername(ctx, *p.Username, parts) {
			username = *p.Username
		} else {
			s.Debug(ctx, "ParsePayments: skipping mention for not being in conv")
			continue
		}
		if _, ok := seen[p.Full]; ok {
			continue
		}
		seen[p.Full] = struct{}{}
		normalizedUn := libkb.NewNormalizedUsername(username)
		if _, ok := seen[normalizedUn.String()]; ok {
			continue
		}
		seen[normalizedUn.String()] = struct{}{}
		res = append(res, types.ParsedStellarPayment{
			Username: normalizedUn,
			Amount:   p.Amount,
			Currency: p.CurrencyCode,
			Full:     p.Full,
		})
	}
	return res
}

func (s *Sender) handleReplyTo(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, replyTo *chat1.MessageID) (gregor1.UID, error) {
	if replyTo == nil {
		return nil, nil
	}
	reply, err := s.G().ChatHelper.GetMessage(ctx, uid, convID, *replyTo, false, nil)
	if err != nil {
		s.Debug(ctx, "handleReplyTo: failed to get reply message: %s", err)
		return nil, err
	}
	if !reply.IsValid() {
		s.Debug(ctx, "handleReplyTo: reply message invalid: %v %v", replyTo, err)
		return nil, nil
	}
	return reply.Valid().ClientHeader.Sender, nil
}

func (s *Sender) paymentsToMinis(payments []types.ParsedStellarPayment) (minis []libkb.MiniChatPayment) {
	for _, p := range payments {
		minis = append(minis, p.ToMini())
	}
	return minis
}

func (s *Sender) DescribePayments(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	payments []types.ParsedStellarPayment) (res chat1.UIChatPaymentSummary, toSend []types.ParsedStellarPayment, err error) {
	defer s.Trace(ctx, &err, "DescribePayments")()
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
	defer s.Trace(ctx, &err, "SendPayments")()
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
