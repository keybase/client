package wallet

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type candidateTestCase struct {
	in  string
	out []ChatTxCandidate
}

func TestFindCandidates(t *testing.T) {
	alfa := "alfa"
	bravo := "bravo"
	charlie := "charlie"
	alfaTx := ChatTxCandidate{Amount: "124.005", CurrencyCode: "XLM", Username: &alfa}
	bravoTx := ChatTxCandidate{Amount: ".005", CurrencyCode: "USD", Username: &bravo}
	charlieTx := ChatTxCandidate{Amount: "5.", CurrencyCode: "HKD", Username: &charlie}
	anonTx := ChatTxCandidate{Amount: "25", CurrencyCode: "eur", Username: nil}
	testCases := []candidateTestCase{
		candidateTestCase{"+124.005XLM@alfa", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"   +124.005XLM@alfa   ", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"   +124.005XLM@alfa", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"+124.005XLM@alfa      ", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"   `+124.`005XLM@alfa   ", []ChatTxCandidate{}},
		candidateTestCase{"   `+124.005XLM@alfa`   ", []ChatTxCandidate{}},
		candidateTestCase{"   ```   `+124.005XLM@alfa```   ", []ChatTxCandidate{}},
		candidateTestCase{"   ```   `+124.005XLM@alfa``   ", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"   ```   `+124.005XLM@alfa``   ", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"  +124.005XLM@alfa\n+.005USD@bravo   \n+5.HKD@charlie", []ChatTxCandidate{alfaTx, bravoTx, charlieTx}},
		candidateTestCase{"  +124.005XLM@alfa\n-.005USD@bravo   \n 5.HKD@charlie", []ChatTxCandidate{alfaTx}},
		candidateTestCase{"  +124.005X@alfa   ", []ChatTxCandidate{}},
		candidateTestCase{"  +124.005XLM@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa   ", []ChatTxCandidate{}},
		candidateTestCase{"  +.XLM@alfa   ", []ChatTxCandidate{}},
		candidateTestCase{"  +XLM@alfa   ", []ChatTxCandidate{}},
		candidateTestCase{"  +XLM+XLM@alfa   ", []ChatTxCandidate{}},
		candidateTestCase{"  +124.005XLM@alfa+.005USD@bravo   ", []ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"  +124.005XLM@alfa +.005USD@bravo   ", []ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"+124.005XLM@alfa +.005USD@bravo", []ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa, +.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa,+.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa$+.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa@+.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},

		// direct message txs
		candidateTestCase{"thanks friend, +25eur!", []ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend, +25eur for you!", []ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur for you!", []ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur@ for you!", []ChatTxCandidate{}},
		candidateTestCase{"thanks friend,+25eur", []ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur\nnewline", []ChatTxCandidate{anonTx}},
		candidateTestCase{"thanks friend,+25eur\ttabbed", []ChatTxCandidate{anonTx}},
	}

	for _, testCase := range testCases {
		ret := findChatTxCandidates(testCase.in)
		require.Equal(t, testCase.out, ret, testCase.in)
	}

	require.True(t, true)
}
