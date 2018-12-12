package wallet

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
)

func DecorateWithPayments(ctx context.Context, body string, payments []chat1.TextPayment) string {
	return ""
}
