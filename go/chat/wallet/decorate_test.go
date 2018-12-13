package wallet

import (
	"context"
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

type decorateTest struct {
	body     string
	payments []chat1.TextPayment
	result   string
}

func TestStellarDecorate(t *testing.T) {
	cases := []decorateTest{
		decorateTest{
			body: "+1xlm other test",
			payments: []chat1.TextPayment{
				chat1.TextPayment{
					Username:    "mikem",
					PaymentText: "+1XLM",
					Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
				},
			},
			result: "$>kb${\"username\":\"mikem\",\"paymentText\":\"+1XLM\",\"result\":{\"resultTyp\":0,\"sent\":\"stellarid\"}}$<kb$ other test",
		},
		decorateTest{
			body: "`+1xlm` +1xlm other test",
			payments: []chat1.TextPayment{
				chat1.TextPayment{
					Username:    "mikem",
					PaymentText: "+1XLM",
					Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
				},
			},
			result: "`+1xlm` $>kb${\"username\":\"mikem\",\"paymentText\":\"+1XLM\",\"result\":{\"resultTyp\":0,\"sent\":\"stellarid\"}}$<kb$ other test",
		},
	}
	for _, c := range cases {
		res := DecorateWithPayments(context.TODO(), c.body, c.payments)
		require.Equal(t, c.result, res)
	}
}
