// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/PuerkitoBio/goquery"
	jsonw "github.com/keybase/go-jsonw"
)

// Shared code across Internal and External APIs
type BaseAPIEngine struct {
	Contextified
	config    *ClientConfig
	clientsMu sync.Mutex
	clients   map[int]*Client
}

type InternalAPIEngine struct {
	BaseAPIEngine
}

type ExternalAPIEngine struct {
	BaseAPIEngine
}

// Internal and External APIs both implement these methods,
// allowing us to share the request-making code below in doRequest
type Requester interface {
	fixHeaders(arg APIArg, req *http.Request)
	getCli(needSession bool) *Client
	consumeHeaders(resp *http.Response) error
	isExternal() bool
}

// NewInternalAPIEngine makes an API engine for internally querying the keybase
// API server
func NewInternalAPIEngine(g *GlobalContext) (*InternalAPIEngine, error) {
	cliConfig, err := g.Env.GenClientConfigForInternalAPI()
	if err != nil {
		return nil, err
	}

	i := &InternalAPIEngine{
		BaseAPIEngine{
			config:       cliConfig,
			clients:      make(map[int]*Client),
			Contextified: NewContextified(g),
		},
	}
	return i, nil
}

// Make a new InternalApiEngine and a new ExternalApiEngine, which share the
// same network config (i.e., TOR and Proxy parameters)
func NewAPIEngines(g *GlobalContext) (*InternalAPIEngine, *ExternalAPIEngine, error) {
	i, err := NewInternalAPIEngine(g)
	if err != nil {
		return nil, nil, err
	}
	scraperConfig, err := g.Env.GenClientConfigForScrapers()
	x := &ExternalAPIEngine{
		BaseAPIEngine{
			config:       scraperConfig,
			clients:      make(map[int]*Client),
			Contextified: NewContextified(g),
		},
	}
	return i, x, nil
}

type APIStatus struct {
	Code int    `json:"code"`
	Name string `json:"name"`
}

//============================================================================
// Errors

type APIError struct {
	Msg  string
	Code int
}

func NewAPIErrorFromHTTPResponse(r *http.Response) *APIError {
	return &APIError{r.Status, r.StatusCode}
}

func (a *APIError) Error() string {
	if len(a.Msg) > 0 {
		return a.Msg
	} else if a.Code > 0 {
		return fmt.Sprintf("Error HTTP status %d", a.Code)
	} else {
		return "Generic API error"
	}
}

// Errors
//============================================================================

//============================================================================
// BaseApiEngine

func (api *BaseAPIEngine) getCli(cookied bool) (ret *Client) {
	key := 0
	if cookied {
		key |= 1
	}
	api.clientsMu.Lock()
	client, found := api.clients[key]
	if !found {
		api.G().Log.Debug("| Cli wasn't found; remaking for cookied=%v", cookied)
		client = NewClient(api.G().Env, api.config, cookied)
		api.clients[key] = client
	}
	api.clientsMu.Unlock()
	return client
}

func (api *BaseAPIEngine) PrepareGet(url url.URL, arg APIArg) (*http.Request, error) {
	url.RawQuery = arg.getHTTPArgs().Encode()
	ruri := url.String()
	api.G().Log.Debug("+ API GET request to %s", ruri)
	return http.NewRequest("GET", ruri, nil)
}

func (api *BaseAPIEngine) PreparePost(url url.URL, arg APIArg, sendJSON bool) (*http.Request, error) {
	ruri := url.String()
	api.G().Log.Debug(fmt.Sprintf("+ API Post request to %s", ruri))

	var body io.Reader

	if sendJSON {
		if len(arg.getHTTPArgs()) > 0 {
			panic("PreparePost: sending JSON, but http args exist and they will be ignored. Fix your APIArg.")
		}
		jsonString, err := json.Marshal(arg.JSONPayload)
		if err != nil {
			return nil, err
		}
		body = ioutil.NopCloser(strings.NewReader(string(jsonString)))
	} else {
		body = ioutil.NopCloser(strings.NewReader(arg.getHTTPArgs().Encode()))
	}

	req, err := http.NewRequest("POST", ruri, body)
	if err != nil {
		return nil, err
	}

	var typ string
	if sendJSON {
		typ = "application/json"
	} else {
		typ = "application/x-www-form-urlencoded; charset=utf-8"
	}

	req.Header.Add("Content-Type", typ)
	return req, nil
}

//
//============================================================================

//============================================================================
// Shared code
//

// The returned response, if non-nil, should have
// DiscardAndCloseBody() called on it.
func doRequestShared(api Requester, arg APIArg, req *http.Request, wantJSONRes bool) (
	_ *http.Response, jw *jsonw.Wrapper, err error) {
	if !arg.G().Env.GetTorMode().UseSession() && arg.NeedSession {
		err = TorSessionRequiredError{}
		return
	}

	dbg := func(s string) {
		arg.G().Log.Debug(fmt.Sprintf("| doRequestShared(%s) for %s", s, arg.Endpoint))
	}

	dbg("fixHeaders")
	api.fixHeaders(arg, req)
	dbg("getCli")
	cli := api.getCli(arg.NeedSession)

	// Actually send the request via Go's libraries
	timerType := TimerAPI
	if api.isExternal() {
		timerType = TimerXAPI
	}

	if arg.G().Env.GetAPIDump() {
		jpStr, _ := json.MarshalIndent(arg.JSONPayload, "", "  ")
		argStr, _ := json.MarshalIndent(arg.getHTTPArgs(), "", "  ")
		arg.G().Log.Debug(fmt.Sprintf("| full request: json:%s querystring:%s", jpStr, argStr))
	}

	timer := arg.G().Timers.Start(timerType)
	dbg("Do")

	internalResp, err := doRetry(arg, cli, req)

	dbg("Done")
	defer func() {
		if internalResp != nil && err != nil {
			DiscardAndCloseBody(internalResp)
		}
	}()

	timer.Report(req.Method + " " + arg.Endpoint)

	if err != nil {
		return nil, nil, APINetError{err: err}
	}
	arg.G().Log.Debug(fmt.Sprintf("| Result is: %s", internalResp.Status))

	// The server sends "client version out of date" messages through the API
	// headers. If the client is *really* out of date, the request status will
	// be a 400 error, but these headers will still be present. So we need to
	// handle headers *before* we abort based on status below.
	err = api.consumeHeaders(internalResp)
	if err != nil {
		return nil, nil, err
	}

	// Check for a code 200 or rather which codes were allowed in arg.HttpStatus
	err = checkHTTPStatus(arg, internalResp)
	if err != nil {
		return nil, nil, err
	}

	if wantJSONRes {
		decoder := json.NewDecoder(internalResp.Body)
		var obj interface{}
		decoder.UseNumber()
		err = decoder.Decode(&obj)
		if err != nil {
			err = fmt.Errorf("Error in parsing JSON reply from server: %s", err)
			return nil, nil, err
		}

		jw = jsonw.NewWrapper(obj)
		if arg.G().Env.GetAPIDump() {
			b, _ := json.MarshalIndent(obj, "", "  ")
			arg.G().Log.Debug(fmt.Sprintf("| full reply: %s", b))
		}
	}

	return internalResp, jw, nil
}

// doRetry will just call cli.cli.Do if arg.Timeout and arg.RetryCount aren't set.
// If they are set, it will cancel requests that last longer than arg.Timeout and
// retry them arg.RetryCount times.
func doRetry(arg APIArg, cli *Client, req *http.Request) (*http.Response, error) {
	if arg.InitialTimeout == 0 && arg.RetryCount == 0 {
		return cli.cli.Do(req)
	}

	timeout := cli.cli.Timeout
	if arg.InitialTimeout != 0 {
		timeout = arg.InitialTimeout
	}

	retries := 1
	if arg.RetryCount > 1 {
		retries = arg.RetryCount
	}

	multiplier := 1.0
	if arg.RetryMultiplier != 0.0 {
		multiplier = arg.RetryMultiplier
	}

	var lastErr error
	for i := 0; i < retries; i++ {
		if i > 0 {
			arg.G().Log.Debug("retry attempt %d of %d for %s", i, retries, arg.Endpoint)
		}
		resp, err := doTimeout(cli, req, timeout)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		timeout = time.Duration(float64(timeout) * multiplier)
	}

	return nil, fmt.Errorf("doRetry failed, attempts: %d, timeout %s, last err: %s", retries, timeout, lastErr)

}

// adapted from https://blog.golang.org/context httpDo func
func doTimeout(cli *Client, req *http.Request, timeout time.Duration) (*http.Response, error) {
	// TODO: could pass in a context from further up the chain
	// and use that instead of context.Background()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	// new way to cancel requests
	reqCancel := make(chan struct{})
	req.Cancel = reqCancel

	type response struct {
		resp *http.Response
		err  error
	}
	c := make(chan response, 1)
	go func() {
		var r response
		r.resp, r.err = cli.cli.Do(req)
		c <- r
	}()

	select {
	case <-ctx.Done():
		// request ctx timed out.  Cancel the request by closing req.Cancel channel:
		close(reqCancel)
		// wait for request to finish
		<-c
		return nil, ctx.Err()
	case r := <-c:
		// request successful
		return r.resp, r.err
	}

}

func checkHTTPStatus(arg APIArg, resp *http.Response) error {
	var set []int
	if arg.HTTPStatus == nil || len(arg.HTTPStatus) == 0 {
		set = []int{200}
	} else {
		set = arg.HTTPStatus
	}
	for _, status := range set {
		if resp.StatusCode == status {
			return nil
		}
	}
	return NewAPIErrorFromHTTPResponse(resp)
}

func (arg APIArg) getHTTPArgs() url.Values {
	if arg.Args != nil {
		return arg.Args.ToValues()
	}
	return arg.uArgs
}

func (arg APIArg) flattenHTTPArgs(args url.Values) map[string]string {
	// HTTPArgs currently is a map of string -> [string] (with only one value). This is a helper to flatten this out
	flatArgs := make(map[string]string)

	for k, v := range args {
		flatArgs[k] = v[0]
	}

	return flatArgs
}

// End shared code
//============================================================================

//============================================================================
// InternalApiEngine

func (a *InternalAPIEngine) getURL(arg APIArg) url.URL {
	u := *a.config.URL
	var path string
	if len(a.config.Prefix) > 0 {
		path = a.config.Prefix
	} else {
		path = APIURIPathPrefix
	}
	u.Path = path + "/" + arg.Endpoint + ".json"
	return u
}

func (a *InternalAPIEngine) sessionArgs(arg APIArg) (tok, csrf string) {
	if arg.SessionR != nil {
		return arg.SessionR.APIArgs()
	}
	a.G().LoginState().LocalSession(func(s *Session) {
		tok, csrf = s.APIArgs()
	}, "sessionArgs")
	return
}

func (a *InternalAPIEngine) isExternal() bool { return false }

var lastUpgradeWarningMu sync.Mutex
var lastUpgradeWarning *time.Time

func (a *InternalAPIEngine) consumeHeaders(resp *http.Response) (err error) {
	upgradeTo := resp.Header.Get("X-Keybase-Client-Upgrade-To")
	upgradeURI := resp.Header.Get("X-Keybase-Upgrade-URI")
	customMessage := resp.Header.Get("X-Keybase-Upgrade-Message")
	if customMessage != "" {
		decoded, err := base64.StdEncoding.DecodeString(customMessage)
		if err == nil {
			customMessage = string(decoded)
		} else {
			// If base64-decode fails, just log the error and skip decoding.
			a.G().Log.Errorf("Failed to decode X-Keybase-Upgrade-Message header: %s", err)
		}
	}
	if len(upgradeTo) > 0 || len(customMessage) > 0 {
		now := time.Now()
		lastUpgradeWarningMu.Lock()
		a.G().OutOfDateInfo.UpgradeTo = upgradeTo
		a.G().OutOfDateInfo.UpgradeURI = upgradeURI
		a.G().OutOfDateInfo.CustomMessage = customMessage
		if lastUpgradeWarning == nil || now.Sub(*lastUpgradeWarning) > 3*time.Minute {
			// Send the notification after we unlock
			defer a.G().NotifyRouter.HandleClientOutOfDate(upgradeTo, upgradeURI, customMessage)
			lastUpgradeWarning = &now
		}
		lastUpgradeWarningMu.Unlock()
	}
	return
}

func (a *InternalAPIEngine) fixHeaders(arg APIArg, req *http.Request) {
	if arg.NeedSession {
		tok, csrf := a.sessionArgs(arg)
		if len(tok) > 0 && a.G().Env.GetTorMode().UseSession() {
			req.Header.Add("X-Keybase-Session", tok)
		} else {
			a.G().Log.Warning("fixHeaders: need session, but session token empty")
		}
		if len(csrf) > 0 && a.G().Env.GetTorMode().UseCSRF() {
			req.Header.Add("X-CSRF-Token", csrf)
		} else {
			a.G().Log.Warning("fixHeaders: need session, but session csrf empty")
		}
	}
	if a.G().Env.GetTorMode().UseHeaders() {
		req.Header.Set("User-Agent", UserAgent)
		identifyAs := GoClientID + " v" + VersionString() + " " + runtime.GOOS
		req.Header.Set("X-Keybase-Client", identifyAs)
		if a.G().Env.GetDeviceID().Exists() {
			req.Header.Set("X-Keybase-Device-ID", a.G().Env.GetDeviceID().String())
		}
		if i := a.G().Env.GetInstallID(); i.Exists() {
			req.Header.Set("X-Keybase-Install-ID", i.String())
		}
	}
}

func (a *InternalAPIEngine) checkAppStatusFromJSONWrapper(arg APIArg, jw *jsonw.Wrapper) (*AppStatus, error) {
	var ast AppStatus
	if err := jw.UnmarshalAgain(&ast); err != nil {
		return nil, err
	}
	return &ast, a.checkAppStatus(arg, &ast)
}

func (a *InternalAPIEngine) checkAppStatus(arg APIArg, ast *AppStatus) error {
	set := arg.AppStatusCodes

	if len(set) == 0 {
		set = []int{SCOk}
	}

	for _, status := range set {
		if ast.Code == status {
			return nil
		}
	}

	// check if there was a bad session error:
	if err := a.checkSessionExpired(arg, ast); err != nil {
		return err
	}

	return NewAppStatusError(ast)
}

func (a *InternalAPIEngine) checkSessionExpired(arg APIArg, ast *AppStatus) error {
	if ast.Code != SCBadSession {
		return nil
	}
	var loggedIn bool
	if arg.SessionR != nil {
		loggedIn = arg.SessionR.IsLoggedIn()
	} else {
		loggedIn = a.G().LoginState().LoggedIn()
	}
	if !loggedIn {
		return nil
	}
	a.G().Log.Debug("local session -> is logged in, remote -> not logged in.  invalidating local session:")
	if arg.SessionR != nil {
		arg.SessionR.Invalidate()
	} else {
		a.G().LoginState().LocalSession(func(s *Session) { s.Invalidate() }, "api - checkSessionExpired")
	}
	return LoginRequiredError{Context: "your session has expired."}
}

func (a *InternalAPIEngine) Get(arg APIArg) (*APIRes, error) {
	url := a.getURL(arg)
	req, err := a.PrepareGet(url, arg)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

// GetResp performs a GET request and returns the http response.  The
// returned response, if non-nil, should have DiscardAndCloseBody()
// called on it.
func (a *InternalAPIEngine) GetResp(arg APIArg) (*http.Response, error) {
	url := a.getURL(arg)
	req, err := a.PrepareGet(url, arg)
	if err != nil {
		return nil, err
	}

	resp, _, err := doRequestShared(a, arg, req, false)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// GetDecode performs a GET request and decodes the response via
// JSON into the value pointed to by v.
func (a *InternalAPIEngine) GetDecode(arg APIArg, v APIResponseWrapper) error {
	resp, err := a.GetResp(arg)
	if err != nil {
		return err
	}
	defer DiscardAndCloseBody(resp)
	dec := json.NewDecoder(resp.Body)
	if err = dec.Decode(&v); err != nil {
		return err
	}
	return a.checkAppStatus(arg, v.GetAppStatus())
}

func (a *InternalAPIEngine) Post(arg APIArg) (*APIRes, error) {
	url := a.getURL(arg)
	req, err := a.PreparePost(url, arg, false)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

func (a *InternalAPIEngine) PostJSON(arg APIArg) (*APIRes, error) {
	url := a.getURL(arg)
	req, err := a.PreparePost(url, arg, true)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

// PostResp performs a POST request and returns the http response.
// The returned response, if non-nil, should have
// DiscardAndCloseBody() called on it.
func (a *InternalAPIEngine) PostResp(arg APIArg) (*http.Response, error) {
	url := a.getURL(arg)
	req, err := a.PreparePost(url, arg, false)
	if err != nil {
		return nil, err
	}

	resp, _, err := doRequestShared(a, arg, req, false)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (a *InternalAPIEngine) PostDecode(arg APIArg, v APIResponseWrapper) error {
	resp, err := a.PostResp(arg)
	if err != nil {
		return err
	}
	defer DiscardAndCloseBody(resp)
	dec := json.NewDecoder(resp.Body)
	if err = dec.Decode(&v); err != nil {
		return err
	}
	return a.checkAppStatus(arg, v.GetAppStatus())
}

func (a *InternalAPIEngine) PostRaw(arg APIArg, ctype string, r io.Reader) (*APIRes, error) {
	url := a.getURL(arg)
	req, err := http.NewRequest("POST", url.String(), r)
	if len(ctype) > 0 {
		req.Header.Set("Content-Type", ctype)
	}
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

func (a *InternalAPIEngine) DoRequest(arg APIArg, req *http.Request) (*APIRes, error) {
	resp, jw, err := doRequestShared(a, arg, req, true)
	if err != nil {
		return nil, err
	}
	defer DiscardAndCloseBody(resp)

	status, err := jw.AtKey("status").ToDictionary()
	if err != nil {
		err = fmt.Errorf("Cannot parse server's 'status' field: %s", err)
		return nil, err
	}

	// Check for an "OK" or whichever app-level replies were allowed by
	// http.AppStatus
	appStatus, err := a.checkAppStatusFromJSONWrapper(arg, status)
	if err != nil {
		a.G().Log.Debug("- API call %s error: %s", arg.Endpoint, err)
		return nil, err
	}

	body := jw
	a.G().Log.Debug("- API call %s success", arg.Endpoint)
	return &APIRes{status, body, resp.StatusCode, appStatus}, err
}

// InternalApiEngine
//===========================================================================

//===========================================================================
// ExternalApiEngine

const (
	XAPIResJSON = iota
	XAPIResHTML
	XAPIResText
)

func (api *ExternalAPIEngine) fixHeaders(arg APIArg, req *http.Request) {
	// TODO (here and in the internal API engine implementation): If we don't
	// set the User-Agent, it will default to http.defaultUserAgent
	// ("Go-http-client/1.1"). We should think about whether that's what we
	// want in Tor mode. Clients that are actually using Tor will always be
	// distinguishable from the rest, insofar as their originating IP will be a
	// Tor exit node, but there may be other use cases where this matters more?
	userAgent := UserAgent
	// Awful hack to make reddit as happy as possible.
	if isReddit(req) {
		userAgent += " (by /u/oconnor663)"
	}
	if api.G().Env.GetTorMode().UseHeaders() {
		req.Header.Set("User-Agent", userAgent)
	}
}

func isReddit(req *http.Request) bool {
	host := req.URL.Host
	return host == "reddit.com" || strings.HasSuffix(host, ".reddit.com")
}

func (api *ExternalAPIEngine) consumeHeaders(resp *http.Response) error {
	return nil
}

func (api *ExternalAPIEngine) isExternal() bool { return true }

func (api *ExternalAPIEngine) DoRequest(
	arg APIArg, req *http.Request, restype int) (
	ar *ExternalAPIRes, hr *ExternalHTMLRes, tr *ExternalTextRes, err error) {

	var resp *http.Response
	var jw *jsonw.Wrapper

	resp, jw, err = doRequestShared(api, arg, req, (restype == XAPIResJSON))
	if err != nil {
		return
	}
	defer DiscardAndCloseBody(resp)

	switch restype {
	case XAPIResJSON:
		ar = &ExternalAPIRes{resp.StatusCode, jw}
	case XAPIResHTML:
		var goq *goquery.Document
		goq, err = goquery.NewDocumentFromResponse(resp)
		if err == nil {
			hr = &ExternalHTMLRes{resp.StatusCode, goq}
		}
	case XAPIResText:
		var buf bytes.Buffer
		_, err = buf.ReadFrom(resp.Body)
		if err == nil {
			tr = &ExternalTextRes{resp.StatusCode, string(buf.Bytes())}
		}
	default:
		err = fmt.Errorf("unknown restype to DoRequest")
	}
	return
}

func (api *ExternalAPIEngine) getCommon(arg APIArg, restype int) (
	ar *ExternalAPIRes, hr *ExternalHTMLRes, tr *ExternalTextRes, err error) {

	var url *url.URL
	var req *http.Request
	url, err = url.Parse(arg.Endpoint)

	if err != nil {
		return
	}
	req, err = api.PrepareGet(*url, arg)
	if err != nil {
		return
	}

	ar, hr, tr, err = api.DoRequest(arg, req, restype)
	return
}

func (api *ExternalAPIEngine) Get(arg APIArg) (res *ExternalAPIRes, err error) {
	res, _, _, err = api.getCommon(arg, XAPIResJSON)
	return
}

func (api *ExternalAPIEngine) GetHTML(arg APIArg) (res *ExternalHTMLRes, err error) {
	_, res, _, err = api.getCommon(arg, XAPIResHTML)
	return
}

func (api *ExternalAPIEngine) GetText(arg APIArg) (res *ExternalTextRes, err error) {
	_, _, res, err = api.getCommon(arg, XAPIResText)
	return
}

func (api *ExternalAPIEngine) postCommon(arg APIArg, restype int) (
	ar *ExternalAPIRes, hr *ExternalHTMLRes, err error) {

	var url *url.URL
	var req *http.Request
	url, err = url.Parse(arg.Endpoint)

	if err != nil {
		return
	}
	req, err = api.PreparePost(*url, arg, false)
	if err != nil {
		return
	}

	ar, hr, _, err = api.DoRequest(arg, req, restype)
	return
}

func (api *ExternalAPIEngine) Post(arg APIArg) (res *ExternalAPIRes, err error) {
	res, _, err = api.postCommon(arg, XAPIResJSON)
	return
}

func (api *ExternalAPIEngine) PostHTML(arg APIArg) (res *ExternalHTMLRes, err error) {
	_, res, err = api.postCommon(arg, XAPIResHTML)
	return
}

// ExternalApiEngine
//===========================================================================
