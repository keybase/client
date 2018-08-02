package federation

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strings"

	"github.com/stellar/go/address"
	proto "github.com/stellar/go/protocols/federation"
	"github.com/stellar/go/support/errors"
)

// LookupByAddress performs a federated lookup following to the stellar
// federation protocol using the "name" type request.  The provided address is
// used to resolve what server the request should be made against.  NOTE: the
// "name" type is a legacy holdover from the legacy stellar network's federation
// protocol. It is unfortunate.
func (c *Client) LookupByAddress(addy string) (*proto.NameResponse, error) {
	_, domain, err := address.Split(addy)
	if err != nil {
		return nil, errors.Wrap(err, "parse address failed")
	}

	fserv, err := c.getFederationServer(domain)
	if err != nil {
		return nil, errors.Wrap(err, "lookup federation server failed")
	}

	qstr := url.Values{}
	qstr.Add("type", "name")
	qstr.Add("q", addy)
	url := c.url(fserv, qstr)

	var resp proto.NameResponse
	err = c.getJSON(url, &resp)
	if err != nil {
		return nil, errors.Wrap(err, "get federation failed")
	}

	if resp.MemoType != "" && resp.Memo.String() == "" {
		return nil, errors.New("Invalid federation response (memo)")
	}

	return &resp, nil
}

// LookupByAccountID performs a federated lookup following to the stellar
// federation protocol using the "id" type request.  The provided strkey-encoded
// account id is used to resolve what server the request should be made against.
func (c *Client) LookupByAccountID(aid string) (*proto.IDResponse, error) {

	domain, err := c.Horizon.HomeDomainForAccount(aid)
	if err != nil {
		return nil, errors.Wrap(err, "get homedomain failed")
	}

	if domain == "" {
		return nil, errors.New("homedomain not set")
	}

	fserv, err := c.getFederationServer(domain)
	if err != nil {
		return nil, errors.Wrap(err, "lookup federation server failed")
	}

	qstr := url.Values{}
	qstr.Add("type", "id")
	qstr.Add("q", aid)
	url := c.url(fserv, qstr)

	var resp proto.IDResponse
	err = c.getJSON(url, &resp)
	if err != nil {
		return nil, errors.Wrap(err, "get federation failed")
	}

	return &resp, nil
}

// ForwardRequest performs a federated lookup following to the stellar
// federation protocol using the "forward" type request.
func (c *Client) ForwardRequest(domain string, fields url.Values) (*proto.NameResponse, error) {
	fserv, err := c.getFederationServer(domain)
	if err != nil {
		return nil, errors.Wrap(err, "lookup federation server failed")
	}

	fields.Add("type", "forward")
	url := c.url(fserv, fields)

	var resp proto.NameResponse
	err = c.getJSON(url, &resp)
	if err != nil {
		return nil, errors.Wrap(err, "get federation failed")
	}

	if resp.MemoType != "" && resp.Memo.String() == "" {
		return nil, errors.New("Invalid federation response (memo)")
	}

	return &resp, nil
}

func (c *Client) getFederationServer(domain string) (string, error) {
	stoml, err := c.StellarTOML.GetStellarToml(domain)
	if err != nil {
		return "", errors.Wrap(err, "get stellar.toml failed")
	}

	if stoml.FederationServer == "" {
		return "", errors.New("stellar.toml is missing federation server info")
	}

	if !c.AllowHTTP && !strings.HasPrefix(stoml.FederationServer, "https://") {
		return "", errors.New("non-https federation server disallowed")
	}

	return stoml.FederationServer, nil
}

// getJSON populates `dest` with the contents at `url`, provided the request
// succeeds and the json can be successfully decoded.
func (c *Client) getJSON(url string, dest interface{}) error {
	hresp, err := c.HTTP.Get(url)
	if err != nil {
		return errors.Wrap(err, "http get errored")
	}

	defer hresp.Body.Close()

	if !(hresp.StatusCode >= 200 && hresp.StatusCode < 300) {
		return errors.Errorf("http get failed with (%d) status code", hresp.StatusCode)
	}

	limitReader := io.LimitReader(hresp.Body, FederationResponseMaxSize)

	err = json.NewDecoder(limitReader).Decode(dest)
	if err == io.ErrUnexpectedEOF && limitReader.(*io.LimitedReader).N == 0 {
		return errors.Errorf("federation response exceeds %d bytes limit", FederationResponseMaxSize)
	}

	if err != nil {
		return errors.Wrap(err, "json decode errored")
	}

	return nil
}

func (c *Client) url(endpoint string, qstr url.Values) string {
	return fmt.Sprintf("%s?%s", endpoint, qstr.Encode())
}
