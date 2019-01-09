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
	alfaTx := ChatTxCandidate{Amount: "124.005", CurrencyCode: "XLM", Username: &alfa, Full: "+124.005XLM@alfa"}
	bravoTx := ChatTxCandidate{Amount: ".005", CurrencyCode: "USD", Username: &bravo, Full: "+.005USD@bravo"}
	charlieTx := ChatTxCandidate{Amount: "5.", CurrencyCode: "HKD", Username: &charlie, Full: "+5.HKD@charlie"}
	anonTx := ChatTxCandidate{Amount: "25", CurrencyCode: "EUR", Username: nil, Full: "+25EUR"}
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

		// some extra checks
		candidateTestCase{"+0.05XLM", []ChatTxCandidate{{Amount: "0.05", CurrencyCode: "XLM", Username: nil, Full: "+0.05XLM"}}},
		candidateTestCase{"+.05XLM", []ChatTxCandidate{{Amount: ".05", CurrencyCode: "XLM", Username: nil, Full: "+.05XLM"}}},
		candidateTestCase{"+0.5xlm", []ChatTxCandidate{{Amount: "0.5", CurrencyCode: "XLM", Username: nil, Full: "+0.5XLM"}}},
		candidateTestCase{"+0xlm", []ChatTxCandidate{}},
		candidateTestCase{"hello `in my code +0.5XLM blah` ok?", []ChatTxCandidate{}},
		candidateTestCase{"hello ```in my code +0.5XLM blah``` ok?", []ChatTxCandidate{}},
		candidateTestCase{"> quoted pay me +0.5XLM ok?", []ChatTxCandidate{}},
	}

	for _, testCase := range testCases {
		ret := FindChatTxCandidates(testCase.in)
		// blow away positions, we test them in decorate tests
		filtered := []ChatTxCandidate{}
		for _, r := range ret {
			r.Position = nil
			filtered = append(filtered, r)
		}
		require.Equal(t, testCase.out, filtered, testCase.in)
	}

	require.True(t, true)
}
