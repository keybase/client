package stellarsvc

import (
	"context"
	"errors"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/stellarnet"
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
					Error:    errors.New("FormatCurrencyWithCodeSuffix error: cannot find curency code \"XXX\""),
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

// TestPrepareMiniChatRelays checks that PrepareMiniChatPayments
// (which is called by SendMiniChatPayments)
// with a destination username that is a valid user but someone who
// doesn't have a wallet will succeed and create a relay payment.
func TestPrepareMiniChatRelays(t *testing.T) {
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	require.NotNil(t, tc.Srv.walletState)

	tcw, cleanupw := setupDesktopTest(t)
	defer cleanupw()

	mctx := libkb.NewMetaContext(context.Background(), tc.G)

	acceptDisclaimer(tc)
	acceptDisclaimer(tcw)
	payments := []libkb.MiniChatPayment{
		{Username: libkb.NewNormalizedUsername("t_rebecca"), Amount: "1", Currency: "USD"},
		{Username: libkb.NewNormalizedUsername(tcw.Fu.Username), Amount: "2", Currency: "XLM"},
	}

	_, senderAccountBundle, err := stellar.LookupSenderPrimary(mctx)
	require.NoError(t, err)
	senderSeed, err := stellarnet.NewSeedStr(senderAccountBundle.Signers[0].SecureNoLogString())
	require.NoError(t, err)

	prepared, unlock, err := stellar.PrepareMiniChatPayments(mctx, tc.Srv.walletState, senderSeed, nil, payments)
	defer unlock()
	require.NoError(t, err)
	require.Len(t, prepared, 2)
	for i, p := range prepared {
		t.Logf("result %d: %+v", i, p)

		switch p.Username.String() {
		case "t_rebecca":
			require.Nil(t, p.Direct)
			require.NotNil(t, p.Relay)
			require.Equal(t, "1", p.Relay.DisplayAmount)
			require.Equal(t, "USD", p.Relay.DisplayCurrency)
			require.True(t, p.Relay.QuickReturn)
		case tcw.Fu.Username:
			require.NotNil(t, p.Direct)
			require.Nil(t, p.Relay)
			require.True(t, p.Direct.QuickReturn)
		default:
			t.Fatalf("unknown username in result: %s", p.Username)
		}
	}
}

// TestPrepareMiniChatLowAmounts checks that PrepareMiniChatPayments
// finds low amount errors early (and doesn't consume seqnos).
func TestPrepareMiniChatLowAmounts(t *testing.T) {
	tc, cleanup := setupDesktopTest(t)
	defer cleanup()
	require.NotNil(t, tc.Srv.walletState)

	tcw, cleanupw := setupDesktopTest(t)
	defer cleanupw()

	mctx := libkb.NewMetaContext(context.Background(), tc.G)

	acceptDisclaimer(tc)
	acceptDisclaimer(tcw)
	payments := []libkb.MiniChatPayment{
		{Username: libkb.NewNormalizedUsername("t_rebecca"), Amount: "0.01", Currency: "USD"},
		{Username: libkb.NewNormalizedUsername(tcw.Fu.Username), Amount: "0.5", Currency: "XLM"},
	}

	_, senderAccountBundle, err := stellar.LookupSenderPrimary(mctx)
	require.NoError(t, err)
	senderSeed, err := stellarnet.NewSeedStr(senderAccountBundle.Signers[0].SecureNoLogString())
	require.NoError(t, err)

	prepared, unlock, err := stellar.PrepareMiniChatPayments(mctx, tc.Srv.walletState, senderSeed, nil, payments)
	defer unlock()
	require.NoError(t, err)
	require.Len(t, prepared, 2)
	for i, p := range prepared {
		t.Logf("result %d: %+v", i, p)

		switch p.Username.String() {
		case "t_rebecca":
			require.Nil(t, p.Direct)
			require.Nil(t, p.Relay)
			require.Error(t, p.Error)
			require.Empty(t, p.Seqno)
			require.Empty(t, p.TxID)
		case tcw.Fu.Username:
			require.NotNil(t, p.Direct)
			require.Nil(t, p.Relay)
			require.Error(t, p.Error)
			require.Empty(t, p.Seqno)
			require.Empty(t, p.TxID)
		default:
			t.Fatalf("unknown username in result: %s", p.Username)
		}
	}
}
