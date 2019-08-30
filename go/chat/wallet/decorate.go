package wallet

import (
	"context"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
)

func DecorateWithPayments(ctx context.Context, body string, payments []chat1.TextPayment) string {
	var added int
	seen := make(map[string]struct{})
	paymentMap := make(map[string]chat1.TextPayment)
	for _, p := range payments {
		paymentMap[p.PaymentText] = p
	}
	offset := 0
	parsed := FindChatTxCandidates(body)
	for _, p := range parsed {
		payment, ok := paymentMap[p.Full]
		if !ok {
			continue
		}
		if _, ok := seen[p.Full]; ok {
			continue
		}
		seen[p.Full] = struct{}{}
		body, added = utils.DecorateBody(ctx, body, p.Position[0]+offset, p.Position[1]-p.Position[0],
			chat1.NewUITextDecorationWithPayment(payment))
		offset += added
	}
	return body
}
