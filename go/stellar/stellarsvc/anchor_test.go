package stellarsvc

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
	"github.com/stellar/go/build"
)

type anchorTest struct {
	Name                string
	Asset               stellar1.Asset
	DepositExternalURL  string
	WithdrawExternalURL string
	DepositMessage      string
	WithdrawMessage     string
	MockTransferGet     func(mctx libkb.MetaContext, url, authToken string) (int, []byte, error)
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
		Name: "requires auth but with different domain",
		Asset: stellar1.Asset{
			Type:           "credit_alphanum4",
			Code:           "EUR",
			Issuer:         "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain: "keybase.io",
			TransferServer: "https://transfer.keybase.io/transfer",
			AuthEndpoint:   "https://transfer.keycase.io/auth",
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
	{
		Name: "requires auth",
		Asset: stellar1.Asset{
			Type:               "credit_alphanum4",
			Code:               "EUR",
			Issuer:             "GAKBPBDMW6CTRDCXNAPSVJZ6QAN3OBNRG6CWI27FGDQT2ZJJEMDRXPKK",
			VerifiedDomain:     "keybase.io",
			TransferServer:     "https://transfer.keybase.io/transfer",
			AuthEndpoint:       "https://transfer.keybase.io/auth",
			ShowDepositButton:  true,
			ShowWithdrawButton: true,
		},
		MockTransferGet:     mockAuthGet,
		DepositExternalURL:  "https://keybase.io/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566",
		WithdrawExternalURL: "https://keybase.io/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI",
	},
}

func TestAnchorInteractor(t *testing.T) {
	tc := SetupTest(t, "AnchorInteractor", 1)
	for i, test := range errAnchorTests {
		accountID, seed := randomStellarKeypair()
		ai := newAnchorInteractor(accountID, &seed, test.Asset)
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
		accountID, seed := randomStellarKeypair()
		ai := newAnchorInteractor(accountID, &seed, test.Asset)
		ai.httpGetClient = test.MockTransferGet

		// our test tx auth challenges are on the public network:
		if test.Asset.AuthEndpoint != "" {
			stellarnet.SetNetwork(build.PublicNetwork)
			ai.httpPostClient = mockAuthPost
		} else {
			stellarnet.SetNetwork(build.TestNetwork)
		}

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
func mockKeybaseTransferGet(mctx libkb.MetaContext, url, authToken string) (int, []byte, error) {
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
func mockAnchorUSDTransferGet(mctx libkb.MetaContext, url, authToken string) (int, []byte, error) {
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
func mockNaoBTCTransferGet(mctx libkb.MetaContext, url, authToken string) (int, []byte, error) {
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

func mockWWTransferGet(mctx libkb.MetaContext, url, authToken string) (int, []byte, error) {
	parts := strings.Split(url, "?")
	switch parts[0] {
	case "https://thewwallet.com/ExtApi/deposit":
		return http.StatusUnauthorized, []byte("Status Code: 401; Unauthorized"), nil
	default:
		return 0, nil, errors.New("unknown mocked url")
	}
}

// mockKAuthGet is an httpGetClient func that returns a stored result
// for WEB_AUTH_ENDPOINT and TRANSFER_SERVER/deposit and TRANSFER_SERVER/withdraw.
func mockAuthGet(mctx libkb.MetaContext, url, authToken string) (int, []byte, error) {
	parts := strings.Split(url, "?")
	switch parts[0] {
	case "https://transfer.keybase.io/transfer/deposit":
		if authToken == "" {
			return 0, nil, errors.New("missing token")
		}
		return http.StatusForbidden, []byte(authDepositBody), nil
	case "https://transfer.keybase.io/transfer/withdraw":
		if authToken == "" {
			return 0, nil, errors.New("missing token")
		}
		return http.StatusForbidden, []byte(authWithdrawBody), nil
	case "https://transfer.keybase.io/auth":
		return http.StatusOK, []byte(authChallenge), nil
	default:
		return 0, nil, fmt.Errorf("unknown mocked url %q", url)
	}
}

func mockAuthPost(mctx libkb.MetaContext, url string, data url.Values) (int, []byte, error) {
	switch url {
	case "https://transfer.keybase.io/auth":
		return 200, []byte(authBody), nil
	default:
		return 0, nil, fmt.Errorf("unknown mocked url %q", url)
	}
}

const depositBody = `{"type":"interactive_customer_info_needed","url":"https://portal.anchorusd.com/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566","identifier":"b700518e7430513abdbdab96e7ead566","dimensions":{"width":800,"height":600}}`
const withdrawBody = `{ "type": "interactive_customer_info_needed", "url" : "https://portal.anchorusd.com/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI", "id": "82fhs729f63dh0v4" }`
const naobtcBody = `{"how": "19qPSWH6Cytp2zsn4Cntbzz2EMp1fadkRs", "eta": 1800, "extra_info": "3 confirmations needed. this is long term available address", "extra_info_cn": "充值需要三次网络确认。此地址长期有效"}`
const authDepositBody = `{"type":"interactive_customer_info_needed","url":"https://keybase.io/onboarding?account=GBZX4364PEPQTDICMIQDZ56K4T75QZCR4NBEYKO6PDRJAHZKGUOJPCXB&identifier=b700518e7430513abdbdab96e7ead566","identifier":"b700518e7430513abdbdab96e7ead566","dimensions":{"width":800,"height":600}}`
const authWithdrawBody = `{ "type": "interactive_customer_info_needed", "url" : "https://keybase.io/onboarding?account=GACW7NONV43MZIFHCOKCQJAKSJSISSICFVUJ2C6EZIW5773OU3HD64VI", "id": "82fhs729f63dh0v4" }`
const authChallenge = `{"transaction":"AAAAAANjzBWOC6YJo49wLshbTPMAmHnZ1I5AESV73e605u3DAAAnEAAAAAAAAAAAAAAAAQAAAABdRIV+AAAAAF1EhqoAAAAAAAAAAQAAAAEAAAAAc35v3HkfCY0CYiA898rk/9hkUeNCTCneeOKQHyo1HJcAAAAKAAAAEFN0ZWxsYXJwb3J0IGF1dGgAAAABAAAAQMCsw7hA+QQnW9t2MfAU92Sqa7eD1udjvaS5BSO9AJFXuELyBmzw+l+GhIry01cM6nz5HKleHf+wDn2jXYYlFKQAAAAAAAAAAbTm7cMAAABAnoRu4cp4cl9UEYqyRIfAIiLhoSU7h77vU9yV2S1RSNZfhc/YaXlMnlLkb9CAeLho1nVMOQnGNzQ55gWJzXXQDQ=="}`
const authBody = `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJHQTZVSVhYUEVXWUZJTE5VSVdBQzM3WTRRUEVaTVFWREpIREtWV0ZaSjJLQ1dVQklVNUlYWk5EQSIsImp0aSI6IjE0NGQzNjdiY2IwZTcyY2FiZmRiZGU2MGVhZTBhZDczM2NjNjVkMmE2NTg3MDgzZGFiM2Q2MTZmODg1MTkwMjQiLCJpc3MiOiJodHRwczovL2ZsYXBweS1iaXJkLWRhcHAuZmlyZWJhc2VhcHAuY29tLyIsImlhdCI6MTUzNDI1Nzk5NCwiZXhwIjoxNTM0MzQ0Mzk0fQ.8nbB83Z6vGBgC1X9r3N6oQCFTBzDiITAfCJasRft0z0"
}`
