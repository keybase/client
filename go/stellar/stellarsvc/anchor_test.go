package stellarsvc

import (
	"errors"
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

type anchorTest struct {
	Name  string
	Asset stellar1.Asset
}

var errAnchorTests = []anchorTest{
	{
		Name: "not verified",
		Asset: stellar1.Asset{
			Type:   "credit_alphanum4",
			Code:   "EUR",
			Issuer: "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
		},
	},
	{
		Name: "no transfer server",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
		},
	},
	{
		Name: "requires auth",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybase.io/transfer",
			AuthEndpoint:   "https://transfer.keybase.io/auth",
		},
	},
	{
		Name: "invalid url",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: ":transfer.keybase.io/transfer",
		},
	},
	{
		Name: "different host",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybays.io/transfer",
		},
	},
	{
		Name: "http not https",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "http://transfer.keybase.io/transfer",
		},
	},
	{
		Name: "ftp not https",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "ftp://transfer.keybase.io/transfer",
		},
	},
	{
		Name: "has a query",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybase.io/transfer?x=123",
		},
	},
	{
		Name: "legit for now",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybase.io/transfer",
		},
	},
}

func TestAnchorInteractor(t *testing.T) {
	tc := SetupTest(t, "AnchorInteractor", 1)
	for i, test := range errAnchorTests {
		accountID, _ := randomStellarKeypair()
		ai := newAnchorInteractor(accountID, test.Asset)
		ai.httpGetClient = mockTransferGet
		_, err := ai.Deposit(tc.MetaContext())
		if err == nil {
			t.Errorf("err test %d [%s]: Deposit returned no error, but expected one", i, test.Name)
			continue
		}
		_, err = ai.Withdraw(tc.MetaContext())
		if err == nil {
			t.Errorf("err test %d [%s]: Withdraw returned no error, but expected one", i, test.Name)
			continue
		}
		fmt.Printf("%d %s: %s\n", i, test.Name, err)
	}
}

// mockTransferGet is an httpGetClient func that returns a stored result
// for TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw
func mockTransferGet(mctx libkb.MetaContext, url string) ([]byte, error) {
	switch url {
	case "https://transfer.keybase.io/transfer/deposit":
		return []byte(depositBody), nil
	case "https://transfer.keybase.io/transfer/withdraw":
		return []byte(withdrawBody), nil
	default:
		return nil, errors.New("not found")
	}

}

const depositBody = `nothing`
const withdrawBody = `nothing`
