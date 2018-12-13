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
		decorateTest{
			body: "HIHIH ```+5xlm@patrick``` +5xlm@patrick `+1xlm` +1xlm other test",
			payments: []chat1.TextPayment{
				chat1.TextPayment{
					Username:    "patrick",
					PaymentText: "+5XLM@patrick",
					Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
				},
				chat1.TextPayment{
					Username:    "mikem",
					PaymentText: "+1XLM",
					Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
				},
			},
			result: "HIHIH ```+5xlm@patrick``` $>kb${\"username\":\"patrick\",\"paymentText\":\"+5XLM@patrick\",\"result\":{\"resultTyp\":0,\"sent\":\"stellarid\"}}$<kb$ `+1xlm` $>kb${\"username\":\"mikem\",\"paymentText\":\"+1XLM\",\"result\":{\"resultTyp\":0,\"sent\":\"stellarid\"}}$<kb$ other test",
		},
		decorateTest{
			body: "   ```   `+124.005XLM@max```  my life to yours, my breath become yours  ```   `+124.005XLM@mikem``    ",
			payments: []chat1.TextPayment{
				chat1.TextPayment{
					Username:    "mikem",
					PaymentText: "+124.005XLM@mikem",
					Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
				},
			},
			result: "   ```   `+124.005XLM@max```  my life to yours, my breath become yours  ```   `$>kb${\"username\":\"mikem\",\"paymentText\":\"+124.005XLM@mikem\",\"result\":{\"resultTyp\":0,\"sent\":\"stellarid\"}}$<kb$``    ",
		},
	}
	for _, c := range cases {
		res := DecorateWithPayments(context.TODO(), c.body, c.payments)
		require.Equal(t, c.result, res)
	}
}
