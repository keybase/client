package stellarsvc

import (
	"context"
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/stellar"
	"github.com/stretchr/testify/require"
)

type specTest struct {
	payments []libkb.MiniChatPayment
	summary  libkb.MiniChatPaymentSummary
}

var specTests = []specTest{
	{
		// check the nil response
		payments: nil,
		summary:  libkb.MiniChatPaymentSummary{XLMTotal: "0 XLM", DisplayTotal: "$0.00 USD"},
	},
	{
		// check one payment, no currency
		payments: []libkb.MiniChatPayment{
			{Username: libkb.NewNormalizedUsername("alice"), Amount: "1"},
		},
		summary: libkb.MiniChatPaymentSummary{
			Specs: []libkb.MiniChatPaymentSpec{
				{Username: libkb.NewNormalizedUsername("alice"), XLMAmount: "1 XLM"},
			},
			XLMTotal:     "1 XLM",
			DisplayTotal: "$0.32 USD",
		},
	},
	{
		// check one payment, XLM currency
		payments: []libkb.MiniChatPayment{
			{Username: libkb.NewNormalizedUsername("alice"), Amount: "1", Currency: "XLM"},
		},
		summary: libkb.MiniChatPaymentSummary{
			Specs: []libkb.MiniChatPaymentSpec{
				{Username: libkb.NewNormalizedUsername("alice"), XLMAmount: "1 XLM"},
			},
			XLMTotal:     "1 XLM",
			DisplayTotal: "$0.32 USD",
		},
	},
	{
		// check one payment, USD currency
		payments: []libkb.MiniChatPayment{
			{Username: libkb.NewNormalizedUsername("alice"), Amount: "1", Currency: "USD"},
		},
		summary: libkb.MiniChatPaymentSummary{
			Specs: []libkb.MiniChatPaymentSpec{
				{
					Username:      libkb.NewNormalizedUsername("alice"),
					XLMAmount:     "3.1414139 XLM",
					DisplayAmount: "$1.00 USD",
				},
			},
			XLMTotal:     "3.1414139 XLM",
			DisplayTotal: "$1.00 USD",
		},
	},
	{
		// check multiple payments
		payments: []libkb.MiniChatPayment{
			{Username: libkb.NewNormalizedUsername("alice"), Amount: "1", Currency: "USD"},
			{Username: libkb.NewNormalizedUsername("bob"), Amount: "9.12", Currency: "XLM"},
		},
		summary: libkb.MiniChatPaymentSummary{
			Specs: []libkb.MiniChatPaymentSpec{
				{
					Username:      libkb.NewNormalizedUsername("alice"),
					XLMAmount:     "3.1414139 XLM",
					DisplayAmount: "$1.00 USD",
				},
				{
					Username:  libkb.NewNormalizedUsername("bob"),
					XLMAmount: "9.1200000 XLM",
				},
			},
			XLMTotal:     "12.2614139 XLM",
			DisplayTotal: "$3.90 USD",
		},
	},
	{
		// check that the order of the results is the order of the payments argument
		payments: []libkb.MiniChatPayment{
			{Username: libkb.NewNormalizedUsername("bob"), Amount: "9.12", Currency: "XLM"},
			{Username: libkb.NewNormalizedUsername("alice"), Amount: "1", Currency: "USD"},
		},
		summary: libkb.MiniChatPaymentSummary{
			Specs: []libkb.MiniChatPaymentSpec{
				{
					Username:  libkb.NewNormalizedUsername("bob"),
					XLMAmount: "9.1200000 XLM",
				},
				{
					Username:      libkb.NewNormalizedUsername("alice"),
					XLMAmount:     "3.1414139 XLM",
					DisplayAmount: "$1.00 USD",
				},
			},
			XLMTotal:     "12.2614139 XLM",
			DisplayTotal: "$3.90 USD",
		},
	},
	{
		// check that an invalid currency returns an error in the spec
		payments: []libkb.MiniChatPayment{
			{Username: libkb.NewNormalizedUsername("alice"), Amount: "1", Currency: "USD"},
			{Username: libkb.NewNormalizedUsername("bob"), Amount: "1", Currency: "XXX"},
		},
		summary: libkb.MiniChatPaymentSummary{
			Specs: []libkb.MiniChatPaymentSpec{
				{
					Username:      libkb.NewNormalizedUsername("alice"),
					XLMAmount:     "3.1414139 XLM",
					DisplayAmount: "$1.00 USD",
				},
				{
					Username: libkb.NewNormalizedUsername("bob"),
					Error:    errors.New("FormatCurrency error: cannot find curency code \"XXX\""),
				},
			},
			XLMTotal:     "3.1414139 XLM",
			DisplayTotal: "$1.00 USD",
		},
	},
}

func TestSpecMiniChatPayments(t *testing.T) {
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	mctx := libkb.NewMetaContext(context.Background(), tc.G)

	acceptDisclaimer(tc)

	for i, st := range specTests {
		out, err := stellar.SpecMiniChatPayments(mctx, tc.Srv.walletState, st.payments)
		if err != nil {
			t.Errorf("test %d: unexpected error: %s", i, err)
			continue
		}
		require.NotNil(t, out)
		require.Equal(t, st.summary, *out)
	}
}
