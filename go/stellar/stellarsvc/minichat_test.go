package stellarsvc

import (
	"context"
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
	{payments: nil, summary: libkb.MiniChatPaymentSummary{XLMTotal: "0.0000000", DisplayTotal: "$0.00 USD"}},
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
