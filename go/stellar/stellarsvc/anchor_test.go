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
	DepositMessage      string
	WithdrawMessage     string
	MockTransferGet     func(mctx libkb.MetaContext, url string) (int, []byte, error)
}

var errAnchorTests = []anchorTest{
	{
		Name: "not verified",
		Asset: stellar1.Asset{
			Type:   "credit_alphanum4",
			Code:   "EUR",
			Issuer: "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
		},
		MockTransferGet: mockKeybaseTransferGet,
	},
	{
		Name: "no transfer server",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
		},
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet: mockKeybaseTransferGet,
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
		MockTransferGet:     mockKeybaseTransferGet,
	},
	{
		Name: "wwallet unauthorized",
		Asset: stellar1.Asset{
			Type:              "credit_alphanum4",
			Code:              "USD",
			Issuer:            "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain:    "www.thewwallet.com",
			TransferServer:    "https://thewwallet.com/ExtApi",
			ShowDepositButton: true,
		},
		MockTransferGet: mockWWTransferGet,
	},
}

var validAnchorTests = []anchorTest{
	{
		Name: "valid",
		Asset: stellar1.Asset{
			Type:               "credit_alphanum4",
			Code:               "EUR",
			Issuer:             "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain:     "www.anchorusd.com",
			TransferServer:     "https://api.anchorusd.com/transfer",
			WithdrawType:       "bank_account",
			ShowWithdrawButton: true,
			ShowDepositButton:  true,
		},
		DepositExternalURL:  "https://portal.anchorusd.com/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566",
		WithdrawExternalURL: "https://portal.anchorusd.com/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI",
		MockTransferGet:     mockAnchorUSDTransferGet,
	},
	{
		Name: "naobtc",
		Asset: stellar1.Asset{
			Type:              "credit_alphanum4",
			Code:              "BTC",
			Issuer:            "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain:    "www.naobtc.com",
			TransferServer:    "https://www.naobtc.com",
			WithdrawType:      "crypto",
			ShowDepositButton: true,
		},
		DepositMessage:  "Deposit request approved by anchor.  19qPSWH6Cytp2zsn4Cntbzz2EMp1fadkRs: 3 confirmations needed. this is long term available address",
		MockTransferGet: mockNaoBTCTransferGet,
	},
}

func TestAnchorInteractor(t *testing.T) {
	tc := SetupTest(t, "AnchorInteractor", 1)
	for i, test := range errAnchorTests {
		accountID, _ := randomStellarKeypair()
		ai := newAnchorInteractor(accountID, test.Asset)
		ai.httpGetClient = test.MockTransferGet
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
		ai.httpGetClient = test.MockTransferGet
		if test.Asset.ShowDepositButton {
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
			if res.MessageFromAnchor != nil {
				if test.DepositMessage != *res.MessageFromAnchor {
					t.Errorf("valid test %d [%s] deposit: result messge %q, expected %q", i, test.Name, *res.MessageFromAnchor, test.DepositMessage)
				}
			}
		}

		if test.Asset.ShowWithdrawButton {
			res, err := ai.Withdraw(tc.MetaContext())
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
			if res.MessageFromAnchor != nil {
				if test.WithdrawMessage != *res.MessageFromAnchor {
					t.Errorf("valid test %d [%s] withdraw: result messge %q, expected %q", i, test.Name, *res.MessageFromAnchor, test.WithdrawMessage)
				}
			}
		}
	}
}

// mockKeybaseTransferGet is an httpGetClient func that returns a stored result
// for TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw.
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
// for TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw.
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

// mockNaoBTCTransferGet is an httpGetClient func that returns a stored result
// for TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw.
func mockNaoBTCTransferGet(mctx libkb.MetaContext, url string) (int, []byte, error) {
	parts := strings.Split(url, "?")
	switch parts[0] {
	case "https://www.naobtc.com/deposit":
		return http.StatusOK, []byte(naobtcBody), nil
	case "https://www.naobtc.com/withdraw":
		return http.StatusForbidden, []byte(withdrawBody), nil
	default:
		return 0, nil, errors.New("unknown mocked url")
	}

}

func mockWWTransferGet(mctx libkb.MetaContext, url string) (int, []byte, error) {
	parts := strings.Split(url, "?")
	switch parts[0] {
	case "https://thewwallet.com/ExtApi/deposit":
		return http.StatusUnauthorized, []byte("Status Code: 401; Unauthorized"), nil
	default:
		return 0, nil, errors.New("unknown mocked url")
	}
}

const depositBody = `{"type":"interactive_customer_info_needed","url":"https://portal.anchorusd.com/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566","identifier":"b700518e7430513abdbdab96e7ead566","dimensions":{"width":800,"height":600}}`
const withdrawBody = `{ "type": "interactive_customer_info_needed", "url" : "https://portal.anchorusd.com/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI", "id": "82fhs729f63dh0v4" }`
const naobtcBody = `{"how": "19qPSWH6Cytp2zsn4Cntbzz2EMp1fadkRs", "eta": 1800, "extra_info": "3 confirmations needed. this is long term available address", "extra_info_cn": "充值需要三次网络确认。此地址长期有效"}`
