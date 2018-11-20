package wallet

import (
	"testing"

	"github.com/stretchr/testify/require"

	chat1 "github.com/keybase/client/go/protocol/chat1"
)

type candidateTestCase struct {
	in  string
	out []chat1.ChatTxCandidate
}

func TestFindCandidates(t *testing.T) {
	alfa := "alfa"
	bravo := "bravo"
	charlie := "charlie"
	alfaTx := chat1.ChatTxCandidate{Amount: "124.005", CurrencyCode: "XLM", Username: &alfa}
	bravoTx := chat1.ChatTxCandidate{Amount: ".005", CurrencyCode: "USD", Username: &bravo}
	charlieTx := chat1.ChatTxCandidate{Amount: "5.", CurrencyCode: "HKD", Username: &charlie}
	anonTx := chat1.ChatTxCandidate{Amount: "25", CurrencyCode: "eur", Username: nil}
	testCases := []candidateTestCase{
		candidateTestCase{"+124.005XLM@alfa", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"   +124.005XLM@alfa   ", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"   +124.005XLM@alfa", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"+124.005XLM@alfa      ", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"   `+124.`005XLM@alfa   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"   `+124.005XLM@alfa`   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"   ```   `+124.005XLM@alfa```   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"   ```   `+124.005XLM@alfa``   ", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"   ```   `+124.005XLM@alfa``   ", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"  +124.005XLM@alfa\n+.005USD@bravo   \n+5.HKD@charlie", []chat1.ChatTxCandidate{alfaTx, bravoTx, charlieTx}},
		candidateTestCase{"  +124.005XLM@alfa\n-.005USD@bravo   \n 5.HKD@charlie", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"  +124.005X@alfa   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"  +124.005XLM@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"  +.XLM@alfa   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"  +XLM@alfa   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"  +XLM+XLM@alfa   ", []chat1.ChatTxCandidate{}},
		candidateTestCase{"  +124.005XLM@alfa+.005USD@bravo   ", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"  +124.005XLM@alfa +.005USD@bravo   ", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"+124.005XLM@alfa +.005USD@bravo", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa, +.005USD@bravo)", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa,+.005USD@bravo)", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa$+.005USD@bravo)", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa@+.005USD@bravo)", []chat1.ChatTxCandidate{alfaTx, bravoTx}},

		// direct message txs
		candidateTestCase{"thanks friend, +25eur!", []chat1.ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend, +25eur for you!", []chat1.ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur for you!", []chat1.ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur@ for you!", []chat1.ChatTxCandidate{}},
		candidateTestCase{"thanks friend,+25eur", []chat1.ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur\nnewline", []chat1.ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur\ttabbed", []chat1.ChatTxCandidate{anonTx}},
	}

	for _, testCase := range testCases {
		ret := findChatTxCandidates(testCase.in)
		require.Equal(t, testCase.out, ret, testCase.in)
	}

	require.True(t, true)
}
