package stellarsvc

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
)

type anchorTest struct {
	Name                string
	Asset               stellar1.Asset
	DepositExternalURL  string
	WithdrawExternalURL string
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
		Name: "endpoint not found",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybase.io/nope",
		},
	},
	{
		Name: "external url changes domain name",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybase.io/transfer",
		},
		DepositExternalURL:  "https://portal.anchorusd.com/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566",
		WithdrawExternalURL: "https://portal.anchorusd.com/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI",
	},
}

var validAnchorTests = []anchorTest{
	{
		Name: "valid",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "www.anchorusd.com",
			TransferServer: "https://api.anchorusd.com/transfer",
		},
		DepositExternalURL:  "https://portal.anchorusd.com/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566",
		WithdrawExternalURL: "https://portal.anchorusd.com/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI",
	},
}

func TestAnchorInteractor(t *testing.T) {
	tc := SetupTest(t, "AnchorInteractor", 1)
	for i, test := range errAnchorTests {
		accountID, _ := randomStellarKeypair()
		ai := newAnchorInteractor(accountID, test.Asset)
		ai.httpGetClient = mockKeybaseTransferGet
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
	}

	for i, test := range validAnchorTests {
		accountID, _ := randomStellarKeypair()
		ai := newAnchorInteractor(accountID, test.Asset)
		ai.httpGetClient = mockAnchorUSDTransferGet
		res, err := ai.Deposit(tc.MetaContext())
		if err != nil {
			t.Errorf("valid test %d [%s]: Deposit returned an error: %s", i, test.Name, err)
			continue
		}
		if res.ExternalUrl == nil && res.MessageFromAnchor == nil {
			t.Errorf("valid test %d [%s] deposit: result fields are all nil", i, test.Name)
			continue
		}
		if test.DepositExternalURL != "" && res.ExternalUrl == nil {
			t.Errorf("valid test %d [%s] deposit: result external url field is nil, expected %s", i, test.Name, test.DepositExternalURL)
			continue
		}
		if res.ExternalUrl != nil {
			if test.DepositExternalURL != *res.ExternalUrl {
				t.Errorf("valid test %d [%s] deposit: result external url field %s, expected %s", i, test.Name, *res.ExternalUrl, test.DepositExternalURL)

			}
		}

		res, err = ai.Withdraw(tc.MetaContext())
		if err != nil {
			t.Errorf("valid test %d [%s]: Withdraw returned an error: %s", i, test.Name, err)
			continue
		}
		if res.ExternalUrl == nil && res.MessageFromAnchor == nil {
			t.Errorf("valid test %d [%s] withdraw: result fields are all nil", i, test.Name)
			continue
		}
		if test.WithdrawExternalURL != "" && res.ExternalUrl == nil {
			t.Errorf("valid test %d [%s] withdraw: result external url field is nil, expected %s", i, test.Name, test.WithdrawExternalURL)
			continue
		}
		if res.ExternalUrl != nil {
			if test.WithdrawExternalURL != *res.ExternalUrl {
				t.Errorf("valid test %d [%s] withdraw: result external url field %s, expected %s", i, test.Name, *res.ExternalUrl, test.WithdrawExternalURL)

			}
		}
	}
}

// mockKeybaseTransferGet is an httpGetClient func that returns a stored result
// for TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw
func mockKeybaseTransferGet(mctx libkb.MetaContext, url string) (int, []byte, error) {
	parts := strings.Split(url, "?")
	switch parts[0] {
	case "https://transfer.keybase.io/transfer/deposit":
		return http.StatusForbidden, []byte(depositBody), nil
	case "https://transfer.keybase.io/transfer/withdraw":
		return http.StatusForbidden, []byte(withdrawBody), nil
	default:
		return 0, nil, errors.New("unknown mocked url")
	}

}

// mockAnchorUSDTransferGet is an httpGetClient func that returns a stored result
// for TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw
func mockAnchorUSDTransferGet(mctx libkb.MetaContext, url string) (int, []byte, error) {
	parts := strings.Split(url, "?")
	switch parts[0] {
	case "https://api.anchorusd.com/transfer/deposit":
		return http.StatusForbidden, []byte(depositBody), nil
	case "https://api.anchorusd.com/transfer/withdraw":
		return http.StatusForbidden, []byte(withdrawBody), nil
	default:
		return 0, nil, errors.New("unknown mocked url")
	}

}

const depositBody = `{"type":"interactive_customer_info_needed","url":"https://portal.anchorusd.com/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566","identifier":"b700518e7430513abdbdab96e7ead566","dimensions":{"width":800,"height":600}}`
const withdrawBody = `{ "type": "interactive_customer_info_needed", "url" : "https://portal.anchorusd.com/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI", "id": "82fhs729f63dh0v4" }`
