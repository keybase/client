package wallet

import (
	"testing"

	"github.com/stretchr/testify/require"

	chat1 "github.com/keybase/client/go/protocol/chat1"
)

func TestReplaceString(t *testing.T) {
	testCases := [][]string{
		// basic
		[]string{"", ""},
		[]string{"a", "a"},
		[]string{"ab", "ab"},
		[]string{"a b", "a b"},
		[]string{" ", " "},
		[]string{"a ", "a "},
		[]string{" a", " a"},

		// codelines
		[]string{"`foo`", "$"},
		[]string{" `foo`", " $"},
		[]string{"`foo` ", "$ "},
		[]string{"  `foo`", "  $"},
		[]string{"`foo`  ", "$  "},
		[]string{" `foo` ", " $ "},
		[]string{"The code is: `foo` and `bar`.", "The code is: $ and $."},
		[]string{"The code is: ``foo`.", "The code is: $foo`."},
		[]string{"The code is: ```foo`.", "The code is: $$."},
		[]string{"The code is: ` ``foo`.", "The code is: $$."},
		[]string{"The code is: ` ` `foo`.", "The code is: $ $."},
		[]string{"The code is: `foo\nbar`.", "The code is: `foo\nbar`."},
		[]string{"The code is: `foo \n bar`.", "The code is: `foo \n bar`."},

		// codeblocks
		[]string{"The codeblock is: ```foo```.", "The codeblock is: $."},
		[]string{"The codeblock is: ```foo bar```.", "The codeblock is: $."},
		[]string{"The codeblock is: ```foo\nbar```.", "The codeblock is: $."},
		[]string{"The codeblock is: ```foo\nbar```", "The codeblock is: $"},
		[]string{"```foo\nbar```", "$"},
		[]string{"```foo\nbar``` ", "$ "},
		[]string{" ```foo\nbar```", " $"},
		[]string{"The codeblock is: ```f\noo\n\n\nba\nr```.", "The codeblock is: $."},
		[]string{"The codeblock is: ```f\no`o`\n`\n\n`ba\nr```.", "The codeblock is: $."},

		// tricky
		[]string{"```\n`", "$`\n`"},
		[]string{"```hello\n`", "$`hello\n`"},
		[]string{"``` helloworld `` `", "$$$"},

		// quotes
		[]string{">hello", ""},
		[]string{">hello\n>world", ""},
		[]string{"           >  hello", ""},
		[]string{">`hello`", ""},
		[]string{"a > b", "a > b"},
		[]string{"`a > b", "`a > b"},
		[]string{"`a > b`", "$"},
		[]string{"```a > b```", "$"},

		// quoted codeblocks
		// Note that text on the same line as the end of the codeblock is not
		// output, even though it shows up as a different line in Keybase's
		// markdown parser (this is an idiosyncrasy on our end).
		[]string{" > The code he wrote was ```\nfoo\n \n\n `hello ` ``bar``` on the same line\n and that was the code.", " and that was the code."},
	}

	for _, testCase := range testCases {
		ret := replaceQuotedSubstrings(testCase[0], "$")
		require.Equal(t, testCase[1], ret, testCase[0])
	}
}

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
	testCases := []candidateTestCase{
		candidateTestCase{"+124.005XLM@alfa", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"   +124.005XLM@alfa   ", []chat1.ChatTxCandidate{alfaTx}},
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
		candidateTestCase{"  +124.005XLM@alfa+.005USD@bravo   ", []chat1.ChatTxCandidate{alfaTx}},
		candidateTestCase{"  +124.005XLM@alfa +.005USD@bravo   ", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"+124.005XLM@alfa +.005USD@bravo", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa, +.005USD@bravo)", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
		candidateTestCase{"(+124.005XLM@alfa,+.005USD@bravo)", []chat1.ChatTxCandidate{alfaTx, bravoTx}},
	}

	for _, testCase := range testCases {
		ret := findChatTxCandidates(testCase.in)
		require.Equal(t, testCase.out, ret, "wrong candidate list")
	}

	require.True(t, true)
}
