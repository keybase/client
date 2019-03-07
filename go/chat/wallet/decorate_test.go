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
			// {"typ":0,"payment":{"username":"mikem","paymentText":"+1XLM","result":{"resultTyp":0,"sent":"stellarid"}}}
			result: "$>kb$eyJ0eXAiOjAsInBheW1lbnQiOnsidXNlcm5hbWUiOiJtaWtlbSIsInBheW1lbnRUZXh0IjoiKzFYTE0iLCJyZXN1bHQiOnsicmVzdWx0VHlwIjowLCJzZW50Ijoic3RlbGxhcmlkIn19fQ==$<kb$ other test",
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
			// {"typ":0,"payment":{"username":"mikem","paymentText":"+1XLM","result":{"resultTyp":0,"sent":"stellarid"}}}
			result: "`+1xlm` $>kb$eyJ0eXAiOjAsInBheW1lbnQiOnsidXNlcm5hbWUiOiJtaWtlbSIsInBheW1lbnRUZXh0IjoiKzFYTE0iLCJyZXN1bHQiOnsicmVzdWx0VHlwIjowLCJzZW50Ijoic3RlbGxhcmlkIn19fQ==$<kb$ other test",
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
			// {"typ":0,"payment":{"username":"patrick","paymentText":"+5XLM@patrick","result":{"resultTyp":0,"sent":"stellarid"}}}
			// {"typ":0,"payment":{"username":"mikem","paymentText":"+1XLM","result":{"resultTyp":0,"sent":"stellarid"}}}
			result: "HIHIH ```+5xlm@patrick``` $>kb$eyJ0eXAiOjAsInBheW1lbnQiOnsidXNlcm5hbWUiOiJwYXRyaWNrIiwicGF5bWVudFRleHQiOiIrNVhMTUBwYXRyaWNrIiwicmVzdWx0Ijp7InJlc3VsdFR5cCI6MCwic2VudCI6InN0ZWxsYXJpZCJ9fX0=$<kb$ `+1xlm` $>kb$eyJ0eXAiOjAsInBheW1lbnQiOnsidXNlcm5hbWUiOiJtaWtlbSIsInBheW1lbnRUZXh0IjoiKzFYTE0iLCJyZXN1bHQiOnsicmVzdWx0VHlwIjowLCJzZW50Ijoic3RlbGxhcmlkIn19fQ==$<kb$ other test",
		},
		decorateTest{
			body: "   ```   `+124.004XLM@max```  my life to yours, my breath become yours  ```   ` +124.005XLM@mikem ``    ",
			payments: []chat1.TextPayment{
				chat1.TextPayment{
					Username:    "mikem",
					PaymentText: "+124.005XLM@mikem",
					Result:      chat1.NewTextPaymentResultWithSent(stellar1.PaymentID("stellarid")),
				},
			},
			// {"typ":0,"payment":{"username":"mikem","paymentText":"+124.005XLM@mikem","result":{"resultTyp":0,"sent":"stellarid"}}}
			result: "   ```   `+124.004XLM@max```  my life to yours, my breath become yours  ```   ` $>kb$eyJ0eXAiOjAsInBheW1lbnQiOnsidXNlcm5hbWUiOiJtaWtlbSIsInBheW1lbnRUZXh0IjoiKzEyNC4wMDVYTE1AbWlrZW0iLCJyZXN1bHQiOnsicmVzdWx0VHlwIjowLCJzZW50Ijoic3RlbGxhcmlkIn19fQ==$<kb$ ``    ",
		},
	}
	for i, c := range cases {
		res := DecorateWithPayments(context.TODO(), c.body, c.payments)
		require.Equal(t, c.result, res, "unit %v", i)
	}
}
