package wallet

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/stellar1"
)

func TestStellarDecorate(t *testing.T) {
	res := DecorateWithPayments(context.TODO(), "+1xlm other text", []chat1.TextPayment{
		chat1.TextPayment{
			Username:    "mikem",
			PaymentText: "+1XLM",
			Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
		},
	})
	t.Logf(res)
}
