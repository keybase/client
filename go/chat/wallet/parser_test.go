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
		{"+124.005XLM@alfa", []ChatTxCandidate{alfaTx}},
		{"   +124.005XLM@alfa   ", []ChatTxCandidate{alfaTx}},
		{"   +124.005XLM@alfa", []ChatTxCandidate{alfaTx}},
		{"+124.005XLM@alfa      ", []ChatTxCandidate{alfaTx}},
		{"   `+124.`005XLM@alfa   ", []ChatTxCandidate{}},
		{"   `+124.005XLM@alfa`   ", []ChatTxCandidate{}},
		{"   ```   `+124.005XLM@alfa```   ", []ChatTxCandidate{}},
		{"   ```   `+124.005XLM@alfa``   ", []ChatTxCandidate{}},
		{"   ```   ` +124.005XLM@alfa``   ", []ChatTxCandidate{}},
		{"   ```   `+124.005XLM@alfa``   ", []ChatTxCandidate{}},
		{"   ```   ` +124.005XLM@alfa``   ", []ChatTxCandidate{}},
		{"  +124.005XLM@alfa\n+.005USD@bravo   \n+5.HKD@charlie", []ChatTxCandidate{alfaTx, bravoTx, charlieTx}},
		{"  +124.005XLM@alfa\n-.005USD@bravo   \n 5.HKD@charlie", []ChatTxCandidate{alfaTx}},
		{"  +124.005X@alfa   ", []ChatTxCandidate{}},
		{"  +124.005XLM@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa   ", []ChatTxCandidate{}},
		{"  +.XLM@alfa   ", []ChatTxCandidate{}},
		{"  +XLM@alfa   ", []ChatTxCandidate{}},
		{"  +XLM+XLM@alfa   ", []ChatTxCandidate{}},
		{"  +124.005XLM@alfa+.005USD@bravo   ", []ChatTxCandidate{}},
		{"  +124.005XLM@alfa +.005USD@bravo   ", []ChatTxCandidate{alfaTx, bravoTx}},
		{"  +124.005XLM@alfa +.005USD@bravo   ", []ChatTxCandidate{alfaTx, bravoTx}},
		{"+124.005XLM@alfa +.005USD@bravo", []ChatTxCandidate{alfaTx, bravoTx}},
		{"(+124.005XLM@alfa, +.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		{"(+124.005XLM@alfa,+.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		{"(+124.005XLM@alfa$+.005USD@bravo)", []ChatTxCandidate{}},
		{"(+124.005XLM@alfa@+.005USD@bravo)", []ChatTxCandidate{}},
		{"\t(+124.005XLM@alfa, +.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		{"\t(+124.005XLM@alfa,+.005USD@bravo)", []ChatTxCandidate{alfaTx, bravoTx}},
		{"\t(+124.005XLM@alfa$+.005USD@bravo)", []ChatTxCandidate{}},
		{"\t(+124.005XLM@alfa@+.005USD@bravo)", []ChatTxCandidate{}},
		{"{+124.005XLM@alfa,+.005USD@bravo}", []ChatTxCandidate{alfaTx, bravoTx}},
		{" {+124.005XLM@alfa,+.005USD@bravo}", []ChatTxCandidate{alfaTx, bravoTx}},
		{"[+124.005XLM@alfa,+.005USD@bravo]", []ChatTxCandidate{alfaTx, bravoTx}},
		{" [+124.005XLM@alfa,+.005USD@bravo]", []ChatTxCandidate{alfaTx, bravoTx}},
		{"+124.005XLM@alfa +124.005XLM@alfa", []ChatTxCandidate{alfaTx, alfaTx}},
		{"+124.005XLM@alfa +124.005XLM@alfa +124.005XLM@alfa", []ChatTxCandidate{alfaTx, alfaTx, alfaTx}},
		{"+1xlm@patrick+1xlm@mikem", []ChatTxCandidate{}},

		// direct message txs
		{"thanks friend, +25eur!", []ChatTxCandidate{anonTx}},
		{"thanks friend, +25eur for you!", []ChatTxCandidate{anonTx}},
		{"thanks friend,+25eur for you!", []ChatTxCandidate{anonTx}},
		{"thanks friend,+25eur@ for you!", []ChatTxCandidate{}},
		{"thanks friend,+25eur", []ChatTxCandidate{anonTx}},
		{"thanks friend,+25eur\nnewline", []ChatTxCandidate{anonTx}},
		{"thanks friend,+25eur\ttabbed", []ChatTxCandidate{anonTx}},
		{"thanks friend (+25eur)\ttabbed", []ChatTxCandidate{anonTx}},
		{"+25eur", []ChatTxCandidate{anonTx}},
		{"+25eur  +25eur 1", []ChatTxCandidate{anonTx, anonTx}},
		{"+25eur +25eur 2", []ChatTxCandidate{anonTx, anonTx}},
		{"+25eur +25eur +25eur", []ChatTxCandidate{anonTx, anonTx, anonTx}},
		{"+25eur +25eur +25eur +25eur", []ChatTxCandidate{anonTx, anonTx, anonTx, anonTx}},
		{"+25eur +25eur +25eur +25eur +25eur", []ChatTxCandidate{anonTx, anonTx, anonTx, anonTx, anonTx}},
		{"+1xlm+1xlm", []ChatTxCandidate{}},

		// some extra checks
		{"+0.05XLM", []ChatTxCandidate{{Amount: "0.05", CurrencyCode: "XLM", Username: nil, Full: "+0.05XLM"}}},
		{"+.05XLM", []ChatTxCandidate{{Amount: ".05", CurrencyCode: "XLM", Username: nil, Full: "+.05XLM"}}},
		{"+0.5xlm", []ChatTxCandidate{{Amount: "0.5", CurrencyCode: "XLM", Username: nil, Full: "+0.5XLM"}}},
		{"+0xlm", []ChatTxCandidate{}},

		// misc rejected
		{"hello `in my code +0.5XLM blah` ok?", []ChatTxCandidate{}},
		{"hello ```in my code +0.5XLM blah``` ok?", []ChatTxCandidate{}},
		{"> quoted pay me +0.5XLM ok?", []ChatTxCandidate{}},
		{"", []ChatTxCandidate{}},
		{"+..1XLM", []ChatTxCandidate{}},
		{"02y8fasjof+10XLMsireu1-39ijqeri", []ChatTxCandidate{}},
		{`BPJ+5lV/+2d`, []ChatTxCandidate{}},
		{`BPJ+5LV/+2d`, []ChatTxCandidate{}},
		{`BPJ+5lv/+2d`, []ChatTxCandidate{}},
		{`BPJ+5lvl/+2d`, []ChatTxCandidate{}},
		{`BPJ+5LVL@bob/+2d`, []ChatTxCandidate{}},
		{` _+5LVL-+4LVL/+3LVL-+2LVL#+1LVL\\+6LVL`, []ChatTxCandidate{}},
		{`g+10ish`, []ChatTxCandidate{}},
	}

	for i, testCase := range testCases {
		ret := FindChatTxCandidates(testCase.in)
		// blow away positions, we test them in decorate tests
		filtered := []ChatTxCandidate{}
		for _, r := range ret {
			r.Position = nil
			filtered = append(filtered, r)
		}
		require.Equal(t, testCase.out, filtered, "unit %v %q", i, testCase.in)
	}

	require.True(t, true)
}
