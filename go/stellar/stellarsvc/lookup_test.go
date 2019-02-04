package stellarsvc

import (
	"fmt"
	"net/url"
	"testing"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar"
	"github.com/keybase/client/go/stellar/stellarcommon"
	"github.com/stellar/go/address"
	proto "github.com/stellar/go/protocols/federation"
	stellarErrors "github.com/stellar/go/support/errors"
	"github.com/stretchr/testify/require"
)

type FederationTestClient struct {
	lookupAddr    func(addy string) (*proto.NameResponse, error)
	validServers  map[string]bool
	testResponses map[string]*proto.NameResponse
}

func (c *FederationTestClient) LookupByAddress(addy string) (*proto.NameResponse, error) {
	if c.lookupAddr != nil {
		return c.lookupAddr(addy)
	}

	_, domain, err := address.Split(addy)
	if err != nil {
		return nil, stellarErrors.Wrap(err, "parse address failed")
	}

	if _, ok := c.validServers[domain]; !ok {
		return nil, fmt.Errorf("lookup federation server failed")
	}

	resp, ok := c.testResponses[addy]
	if !ok {
		return nil, fmt.Errorf("get federation failed")
	}

	return resp, nil
}

func (c *FederationTestClient) LookupByAccountID(aid string) (*proto.IDResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (c *FederationTestClient) ForwardRequest(domain string, fields url.Values) (*proto.NameResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func TestLookupRecipientFederation(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	acceptDisclaimer(tcs[0])
	fAccounts := tcs[0].Backend.ImportAccountsForUser(tcs[0])

	randomPub, _ := randomStellarKeypair()

	testClient := &FederationTestClient{
		validServers:  make(map[string]bool),
		testResponses: make(map[string]*proto.NameResponse),
	}

	testClient.validServers["stellar.org"] = true
	testClient.testResponses["j*stellar.org"] = &proto.NameResponse{
		AccountID: randomPub.String(),
	}
	tcsAtStellar := fmt.Sprintf("%s*stellar.org", tcs[0].Fu.Username)
	testClient.testResponses[tcsAtStellar] = &proto.NameResponse{
		AccountID: fAccounts[0].accountID.String(),
	}

	tcs[0].G.GetStellar().(*stellar.Stellar).SetFederationClientForTest(testClient)
	mctx := tcs[0].MetaContext()

	// Test if we are correctly rewriting stellar-org errors. Instead
	// of "error (404)" we'd rather see "record not found".
	_, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput("m*example.com"), false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "example.com")
	require.Contains(t, err.Error(), "does not respond to federation requests")

	_, err = stellar.LookupRecipient(mctx, stellarcommon.RecipientInput("test1*stellar.org"), false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "stellar.org")
	require.Contains(t, err.Error(), "test1")
	require.Contains(t, err.Error(), "did not find record")

	res, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput("j*stellar.org"), false)
	require.NoError(t, err)
	require.Nil(t, res.User)
	require.Nil(t, res.Assertion)
	require.NotNil(t, res.AccountID)
	require.EqualValues(t, randomPub, *res.AccountID)

	// We ask external server about federation address, we get account id back
	// That account ID is the primary of a keybase user.
	// LookupRecipient doesn't tell us that, but LookupUserByAccountID does.
	res, err = stellar.LookupRecipient(mctx, stellarcommon.RecipientInput(tcsAtStellar), false)
	require.NoError(t, err)
	require.NotNil(t, res.AccountID)
	require.EqualValues(t, fAccounts[0].accountID, *res.AccountID)
	require.Nil(t, res.User)
	uv, username, err := stellar.LookupUserByAccountID(mctx, stellar1.AccountID(res.AccountID.String()))
	require.NoError(t, err)
	require.EqualValues(t, tcs[0].Fu.Username, username)
	require.Equal(t, tcs[0].Fu.GetUserVersion(), uv)
}

func TestLookupRecipientKeybaseFederation(t *testing.T) {
	tcs, cleanup := setupNTests(t, 1)
	defer cleanup()

	testClient := &FederationTestClient{
		lookupAddr: func(addy string) (*proto.NameResponse, error) {
			const unexpected = "unexpected federation client call"
			require.Fail(t, unexpected)
			return nil, fmt.Errorf(unexpected)
		},
	}

	tcs[0].G.GetStellar().(*stellar.Stellar).SetFederationClientForTest(testClient)
	mctx := tcs[0].MetaContext()

	// *keybase.io lookups should go directly to Keybase username
	// lookups, because that's what our federation server does anyway,
	// with the exception of federation server being server trust. So
	// we skip fed lookup entirely and go with Keybase identify.
	fedAddr := fmt.Sprintf("%s*keybase.io", tcs[0].Fu.Username)
	res, err := stellar.LookupRecipient(mctx, stellarcommon.RecipientInput(fedAddr), false)
	require.NoError(t, err)
	require.NotNil(t, res.User)
	require.EqualValues(t, tcs[0].Fu.Username, res.User.Username)
	require.Equal(t, tcs[0].Fu.GetUserVersion(), res.User.UV)
}
