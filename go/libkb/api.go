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
	"golang.org/x/net/context/ctxhttp"

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

type AppStatusEmbed struct {
	Status AppStatus `json:"status"`
}

func (s *AppStatusEmbed) GetAppStatus() *AppStatus {
	return &s.Status
}

// Internal and External APIs both implement these methods,
// allowing us to share the request-making code below in doRequest
type Requester interface {
	fixHeaders(m MetaContext, arg APIArg, req *http.Request, nist *NIST) error
	getCli(needSession bool) *Client
	consumeHeaders(m MetaContext, resp *http.Response, nist *NIST) error
	isExternal() bool
}

// NewInternalAPIEngine makes an API engine for internally querying the keybase
// API server
func NewInternalAPIEngine(g *GlobalContext) (*InternalAPIEngine, error) {
	cliConfig, err := genClientConfigForInternalAPI(g)
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
	scraperConfig, err := genClientConfigForScrapers(g.Env)
	if err != nil {
		return nil, nil, err
	}
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

func (api *BaseAPIEngine) PrepareGet(url1 url.URL, arg APIArg) (*http.Request, error) {
	url1.RawQuery = arg.getHTTPArgs().Encode()
	ruri := url1.String()
	return http.NewRequest("GET", ruri, nil)
}

func (api *BaseAPIEngine) PrepareMethodWithBody(method string, url1 url.URL, arg APIArg) (*http.Request, error) {
	ruri := url1.String()
	var body io.Reader

	useHTTPArgs := len(arg.getHTTPArgs()) > 0
	useJSON := len(arg.JSONPayload) > 0

	if useHTTPArgs && useJSON {
		panic("PrepareMethodWithBody: Malformed APIArg: Both HTTP args and JSONPayload set on request.")
	}

	if useJSON {
		jsonString, err := json.Marshal(arg.JSONPayload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(jsonString)
	} else {
		body = strings.NewReader(arg.getHTTPArgs().Encode())
	}

	req, err := http.NewRequest(method, ruri, body)
	if err != nil {
		return nil, err
	}

	var typ string
	if useJSON {
		typ = "application/json"
	} else {
		typ = "application/x-www-form-urlencoded; charset=utf-8"
	}

	req.Header.Set("Content-Type", typ)
	return req, nil
}

//
//============================================================================

type countingReader struct {
	r io.Reader
	n int
}

func newCountingReader(r io.Reader) *countingReader {
	return &countingReader{r: r}
}

func (c *countingReader) Read(p []byte) (n int, err error) {
	n, err = c.r.Read(p)
	c.n += n
	return n, err
}

func (c *countingReader) numRead() int {
	return c.n
}

//============================================================================
// Shared code
//

func noopFinisher() {}

func getNIST(m MetaContext, sessType APISessionType) *NIST {
	if sessType == APISessionTypeNONE {
		return nil
	}

	if !m.G().Env.GetTorMode().UseSession() {
		return nil
	}

	nist, err := m.ActiveDevice().NIST(m.Ctx())
	if nist == nil {
		m.CDebugf("active device couldn't generate a NIST")
		return nil
	}

	if err != nil {
		m.CDebugf("Error generating NIST: %s", err)
		return nil
	}
	return nist
}

// doRequestShared returns an http.Response, which is a live streaming object that
// escapes the function in which it was created.  It therefore also returns
// a `finisher func()` that *must always be called* after the response is no longer
// needed. This finisher is always non-nil (and just a noop in some cases),
// so therefore it's fine to call it without checking for nil-ness.
func doRequestShared(m MetaContext, api Requester, arg APIArg, req *http.Request, wantJSONRes bool) (_ *http.Response, finisher func(), jw *jsonw.Wrapper, err error) {
	if !m.G().Env.GetTorMode().UseSession() && arg.SessionType == APISessionTypeREQUIRED {
		err = TorSessionRequiredError{}
		return
	}

	m = m.EnsureCtx().WithLogTag("API")

	finisher = noopFinisher

	nist := getNIST(m, arg.SessionType)

	if err = api.fixHeaders(m, arg, req, nist); err != nil {
		m.CDebugf("- API %s %s: fixHeaders error: %s", req.Method, req.URL, err)
		return
	}
	needSession := false
	if arg.SessionType != APISessionTypeNONE {
		needSession = true
	}
	cli := api.getCli(needSession)

	// Actually send the request via Go's libraries
	timerType := TimerAPI
	if api.isExternal() {
		timerType = TimerXAPI
	}

	var jsonBytes int
	var status string
	defer func() {
		m.CDebugf("- API %s %s: err=%s, status=%q, jsonwBytes=%d", req.Method, req.URL, ErrToOk(err), status, jsonBytes)
	}()

	if m.G().Env.GetAPIDump() {
		jpStr, _ := json.MarshalIndent(arg.JSONPayload, "", "  ")
		argStr, _ := json.MarshalIndent(arg.getHTTPArgs(), "", "  ")
		m.CDebugf("| full request: json:%s querystring:%s", jpStr, argStr)
	}

	timer := m.G().Timers.Start(timerType)
	internalResp, canc, err := doRetry(m, arg, cli, req)

	finisher = func() {
		if internalResp != nil {
			DiscardAndCloseBody(internalResp)
			internalResp = nil
		}
		if canc != nil {
			canc()
			canc = nil
		}
	}

	defer func() {
		if err != nil {
			finisher()
			finisher = noopFinisher
		}
	}()

	timer.Report(req.Method + " " + arg.Endpoint)

	if err != nil {
		return nil, finisher, nil, APINetError{err: err}
	}
	status = internalResp.Status

	// The server sends "client version out of date" messages through the API
	// headers. If the client is *really* out of date, the request status will
	// be a 400 error, but these headers will still be present. So we need to
	// handle headers *before* we abort based on status below.
	err = api.consumeHeaders(m, internalResp, nist)
	if err != nil {
		return nil, finisher, nil, err
	}

	// Check for a code 200 or rather which codes were allowed in arg.HttpStatus
	err = checkHTTPStatus(arg, internalResp)
	if err != nil {
		return nil, finisher, nil, err
	}

	if wantJSONRes {
		reader := newCountingReader(internalResp.Body)
		decoder := json.NewDecoder(reader)
		var obj interface{}
		decoder.UseNumber()
		err = decoder.Decode(&obj)
		jsonBytes = reader.numRead()
		if err != nil {
			err = fmt.Errorf("Error in parsing JSON reply from server: %s", err)
			return nil, finisher, nil, err
		}

		jw = jsonw.NewWrapper(obj)
		if m.G().Env.GetAPIDump() {
			b, _ := json.MarshalIndent(obj, "", "  ")
			m.CDebugf("| full reply: %s", b)
		}
	}

	return internalResp, finisher, jw, nil
}

// doRetry will just call cli.cli.Do if arg.Timeout and arg.RetryCount aren't set.
// If they are set, it will cancel requests that last longer than arg.Timeout and
// retry them arg.RetryCount times. It returns 3 values: the HTTP response, if all goes
// well; a canceler function func() that the caller should call after all work is completed
// on this request; and an error. The canceler function is to clean up the timeout.
func doRetry(m MetaContext, arg APIArg, cli *Client, req *http.Request) (*http.Response, func(), error) {

	// This serves as a proxy for checking the status of the Gregor connection. If we are not
	// connected to Gregor, then it is likely the case we are totally offline, or on a very bad
	// connection. If that is the case, let's make these timeouts very aggressive, so we don't
	// block up everything trying to succeed when we probably will not.
	if ConnectivityMonitorNo == m.G().ConnectivityMonitor.IsConnected(m.Ctx()) {
		arg.InitialTimeout = HTTPFastTimeout
		arg.RetryCount = 0
	}

	if arg.InitialTimeout == 0 && arg.RetryCount == 0 {
		resp, err := ctxhttp.Do(m.Ctx(), cli.cli, req)
		return resp, nil, err
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
			m.CDebugf("retry attempt %d of %d for %s", i, retries, arg.Endpoint)
		}
		resp, canc, err := doTimeout(m, cli, req, timeout)
		if err == nil {
			return resp, canc, nil
		}
		lastErr = err
		timeout = time.Duration(float64(timeout) * multiplier)

		// If chat goes offline during this retry loop, then let's bail out early
		if ConnectivityMonitorNo == m.G().ConnectivityMonitor.IsConnected(m.Ctx()) {
			m.CDebugf("retry loop aborting since chat went offline")
			break
		}

		if req.GetBody != nil {
			// post request body consumed, need to get it back
			req.Body, err = req.GetBody()
			if err != nil {
				return nil, nil, err
			}
		}
	}

	return nil, nil, fmt.Errorf("doRetry failed, attempts: %d, timeout %s, last err: %s", retries, timeout, lastErr)

}

// doTimeout does the http request with a timeout. It returns the response from making the HTTP request,
// a canceler, and an error. The canceler ought to be called before the caller (or its caller) is done
// with this request.
func doTimeout(m MetaContext, cli *Client, req *http.Request, timeout time.Duration) (*http.Response, func(), error) {
	ctx, cancel := context.WithTimeout(m.Ctx(), timeout*CITimeMultiplier(m.G()))
	resp, err := ctxhttp.Do(ctx, cli.cli, req)
	return resp, cancel, err
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

func (a *InternalAPIEngine) sessionArgs(arg APIArg) (tok, csrf string, err error) {
	if arg.SessionR != nil {
		tok, csrf = arg.SessionR.APIArgs()
		return tok, csrf, nil
	}

	a.G().LoginState().Account(func(a *Account) {
		// since a session is required, try to load one:
		var in bool
		in, err = a.LoggedInLoad()
		if err != nil {
			return
		}
		if !in {
			err = LoginRequiredError{}
			return
		}
		tok, csrf = a.LocalSession().APIArgs()
	}, "sessionArgs")

	if err != nil {
		return "", "", err
	}

	return tok, csrf, nil
}

func (a *InternalAPIEngine) isExternal() bool { return false }

func computeCriticalClockSkew(g *GlobalContext, s string) time.Duration {
	var ret time.Duration
	if s == "" {
		return ret
	}
	serverNow, err := time.Parse(time.RFC1123, s)

	if err != nil {
		g.Log.Warning("Failed to parse server time: %s", err)
		return ret
	}
	ourNow := g.Clock().Now()
	diff := serverNow.Sub(ourNow)
	if diff > CriticalClockSkewLimit || diff < -1*CriticalClockSkewLimit {
		ret = diff
	}
	return ret
}

// If the local clock is within a reasonable offset of the server's
// clock, we'll get 0.  Otherwise, we set the skew accordingly. Safe
// to set this every time.
func (a *InternalAPIEngine) updateCriticalClockSkewWarning(resp *http.Response) {

	g := a.G()
	g.oodiMu.RLock()
	criticalClockSkew := int64(computeCriticalClockSkew(a.G(), resp.Header.Get("Date")))
	needUpdate := (criticalClockSkew != a.G().outOfDateInfo.CriticalClockSkew)
	g.oodiMu.RUnlock()

	if needUpdate {
		g.oodiMu.Lock()
		g.outOfDateInfo.CriticalClockSkew = criticalClockSkew
		g.oodiMu.Unlock()
	}
}

func (a *InternalAPIEngine) consumeHeaders(m MetaContext, resp *http.Response, nist *NIST) (err error) {
	upgradeTo := resp.Header.Get("X-Keybase-Client-Upgrade-To")
	upgradeURI := resp.Header.Get("X-Keybase-Upgrade-URI")
	customMessage := resp.Header.Get("X-Keybase-Upgrade-Message")
	if customMessage != "" {
		decoded, err := base64.StdEncoding.DecodeString(customMessage)
		if err == nil {
			customMessage = string(decoded)
		} else {
			// If base64-decode fails, just log the error and skip decoding.
			m.CErrorf("Failed to decode X-Keybase-Upgrade-Message header: %s", err)
		}
	}

	if nist != nil {
		nistReply := resp.Header.Get("X-Keybase-Auth-NIST")
		switch nistReply {
		case "":
		case "verified":
			nist.MarkSuccess()
		case "failed":
			nist.MarkFailure()
			m.CWarningf("NIST token failed to verify")
		default:
			m.CInfof("Unexpected 'X-Keybase-Auth-NIST' state: %s", nistReply)
		}
	}

	a.updateCriticalClockSkewWarning(resp)

	if len(upgradeTo) > 0 || len(customMessage) > 0 {
		now := time.Now()
		g := m.G()
		g.oodiMu.Lock()
		g.outOfDateInfo.UpgradeTo = upgradeTo
		g.outOfDateInfo.UpgradeURI = upgradeURI
		g.outOfDateInfo.CustomMessage = customMessage
		if g.lastUpgradeWarning.IsZero() || now.Sub(*g.lastUpgradeWarning) > 3*time.Minute {
			// Send the notification after we unlock
			defer g.NotifyRouter.HandleClientOutOfDate(upgradeTo, upgradeURI, customMessage)
			*g.lastUpgradeWarning = now
		}
		g.oodiMu.Unlock()
	} else {
		// We might be in a state where the server *used to* think we were out
		// of date, but now it doesn't. (Maybe a bad config got pushed and then
		// later fixed.) If so, we need to clear the global outOfDateInfo, so
		// that the client stops printing warnings.
		g := m.G()
		g.oodiMu.Lock()
		g.outOfDateInfo.UpgradeTo = ""
		g.outOfDateInfo.UpgradeURI = ""
		g.outOfDateInfo.CustomMessage = ""
		g.oodiMu.Unlock()
	}
	return
}

func (a *InternalAPIEngine) fixHeaders(m MetaContext, arg APIArg, req *http.Request, nist *NIST) error {

	if nist != nil {
		req.Header.Set("X-Keybase-Session", nist.Token().String())

	} else if arg.SessionType != APISessionTypeNONE {
		m.CDebugf("fixHeaders: falling back to legacy session management")
		tok, csrf, err := a.sessionArgs(arg)
		if err != nil {
			if arg.SessionType == APISessionTypeREQUIRED {
				m.CWarningf("fixHeaders: session required, but error getting sessionArgs: %s", err)
				return err
			}
			m.CDebugf("fixHeaders: session optional, error getting sessionArgs: %s", err)
		}

		if m.G().Env.GetTorMode().UseSession() {
			if len(tok) > 0 {
				req.Header.Set("X-Keybase-Session", tok)
			} else if arg.SessionType == APISessionTypeREQUIRED {
				m.CWarningf("fixHeaders: need session, but session token empty")
				return InternalError{Msg: "API request requires session, but session token empty"}
			}
		}
		if m.G().Env.GetTorMode().UseCSRF() {
			if len(csrf) > 0 {
				req.Header.Set("X-CSRF-Token", csrf)
			} else if arg.SessionType == APISessionTypeREQUIRED {
				m.CWarningf("fixHeaders: need session, but session csrf empty")
				return InternalError{Msg: "API request requires session, but session csrf empty"}
			}
		}
	}

	if m.G().Env.GetTorMode().UseHeaders() {
		req.Header.Set("User-Agent", UserAgent)
		identifyAs := GoClientID + " v" + VersionString() + " " + GetPlatformString()
		req.Header.Set("X-Keybase-Client", identifyAs)
		if m.G().Env.GetDeviceID().Exists() {
			req.Header.Set("X-Keybase-Device-ID", a.G().Env.GetDeviceID().String())
		}
		if i := m.G().Env.GetInstallID(); i.Exists() {
			req.Header.Set("X-Keybase-Install-ID", i.String())
		}
		if tags := LogTagsToString(m.Ctx()); tags != "" {
			req.Header.Set("X-Keybase-Log-Tags", tags)
		}
	}

	return nil
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

	// if SCBadSession comes back, but no session was provided, then the session isn't invalid,
	// the requesting code is broken.
	if arg.SessionType == APISessionTypeNONE {
		a.G().Log.CDebugf(arg.NetContext, "api request to %q was made with session type NONE, but api server responded with bad session", arg.Endpoint)
		return fmt.Errorf("api endpoint %q requires session, APIArg for this request had session type NONE", arg.Endpoint)
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
	a.G().Log.CDebugf(arg.NetContext, "local session -> is logged in, remote -> not logged in.  invalidating local session:")
	if arg.SessionR != nil {
		arg.SessionR.Invalidate()
	} else {
		a.G().LoginState().LocalSession(func(s *Session) { s.Invalidate() }, "api - checkSessionExpired")
	}

	// use ReloginRequiredError to signal that the session needs to be refreshed
	return ReloginRequiredError{}
}

func (a *InternalAPIEngine) Get(arg APIArg) (*APIRes, error) {
	url1 := a.getURL(arg)
	req, err := a.PrepareGet(url1, arg)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

// GetResp performs a GET request and returns the http response. The finisher
// second arg should be called whenever we're done with the response (if it's non-nil).
func (a *InternalAPIEngine) GetResp(arg APIArg) (*http.Response, func(), error) {
	m := arg.GetMetaContext(a.G())

	url1 := a.getURL(arg)
	req, err := a.PrepareGet(url1, arg)
	if err != nil {
		return nil, noopFinisher, err
	}

	resp, finisher, _, err := doRequestShared(m, a, arg, req, false)
	if err != nil {
		return nil, finisher, err
	}

	return resp, finisher, nil
}

// GetDecode performs a GET request and decodes the response via
// JSON into the value pointed to by v.
func (a *InternalAPIEngine) GetDecode(arg APIArg, v APIResponseWrapper) error {
	m := arg.GetMetaContext(a.G())
	reqErr := a.getDecode(m, arg, v)
	if reqErr == nil {
		return nil
	}

	if err := a.refreshSession(m, arg, reqErr); err != nil {
		return err
	}

	m.CDebugf("| API GetDecode %s session refreshed, trying again", arg.Endpoint)

	reqErr = a.getDecode(m, arg, v)
	if reqErr == nil {
		m.CDebugf("| API GetDecode %s success after refresh", arg.Endpoint)
		return nil
	}
	if _, relogin := reqErr.(ReloginRequiredError); relogin {
		m.CDebugf("| API GetDecode %s retry after refresh still asking for new session, bailing out", arg.Endpoint)
		return LoginRequiredError{Context: "your session has expired"}
	}

	m.CDebugf("| API GetDecode %s error after refresh: %s", arg.Endpoint, reqErr)
	return reqErr
}

func (a *InternalAPIEngine) getDecode(m MetaContext, arg APIArg, v APIResponseWrapper) error {
	arg.MetaContext = m
	resp, finisher, err := a.GetResp(arg)
	if err != nil {
		m.CDebugf("| API GetDecode, GetResp error: %s", err)
		return err
	}
	defer finisher()

	var reader io.Reader
	reader = resp.Body
	if a.G().Env.GetAPIDump() {
		body, err := ioutil.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		m.CDebugf("| response body: %s", string(body))
		reader = bytes.NewReader(body)
	}

	dec := json.NewDecoder(reader)
	if err = dec.Decode(&v); err != nil {
		m.CDebugf("| API GetDecode, Decode error: %s", err)
		return err
	}
	if err = a.checkAppStatus(arg, v.GetAppStatus()); err != nil {
		m.CDebugf("| API GetDecode, checkAppStatus error: %s", err)
		return err
	}

	return nil
}

func (a *InternalAPIEngine) Post(arg APIArg) (*APIRes, error) {
	url1 := a.getURL(arg)
	req, err := a.PrepareMethodWithBody("POST", url1, arg)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

// PostJSON does _not_ actually enforce the use of JSON.
// That is now determined by APIArg's fields.
func (a *InternalAPIEngine) PostJSON(arg APIArg) (*APIRes, error) {
	return a.Post(arg)
}

// postResp performs a POST request and returns the http response.
// The finisher() should be called after the response is no longer needed.
func (a *InternalAPIEngine) postResp(m MetaContext, arg APIArg) (*http.Response, func(), error) {
	url1 := a.getURL(arg)
	req, err := a.PrepareMethodWithBody("POST", url1, arg)
	if err != nil {
		return nil, nil, err
	}

	resp, finisher, _, err := doRequestShared(m, a, arg, req, false)
	if err != nil {
		return nil, finisher, err
	}

	return resp, finisher, nil
}

func (a *InternalAPIEngine) PostDecode(arg APIArg, v APIResponseWrapper) error {
	m := arg.GetMetaContext(a.G())
	reqErr := a.postDecode(m, arg, v)
	if reqErr == nil {
		return nil
	}

	if err := a.refreshSession(m, arg, reqErr); err != nil {
		return err
	}

	m.CDebugf("| API PostDecode %s session refreshed, trying again", arg.Endpoint)
	reqErr = a.postDecode(m, arg, v)
	if reqErr == nil {
		m.CDebugf("| API PostDecode %s success after refresh", arg.Endpoint)
		return nil
	}
	if _, relogin := reqErr.(ReloginRequiredError); relogin {
		m.CDebugf("| API PostDecode %s retry after refresh still asking for new session, bailing out", arg.Endpoint)
		return LoginRequiredError{Context: "your session has expired"}
	}

	m.CDebugf("| API PostDecode %s error after refresh: %s", arg.Endpoint, reqErr)
	return reqErr
}

func (a *InternalAPIEngine) postDecode(m MetaContext, arg APIArg, v APIResponseWrapper) error {
	resp, finisher, err := a.postResp(m, arg)
	if err != nil {
		return err
	}
	defer finisher()
	dec := json.NewDecoder(resp.Body)
	if err = dec.Decode(&v); err != nil {
		return err
	}
	return a.checkAppStatus(arg, v.GetAppStatus())
}

func (a *InternalAPIEngine) PostRaw(arg APIArg, ctype string, r io.Reader) (*APIRes, error) {
	url1 := a.getURL(arg)
	req, err := http.NewRequest("POST", url1.String(), r)
	if len(ctype) > 0 {
		req.Header.Set("Content-Type", ctype)
	}
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

func (a *InternalAPIEngine) Delete(arg APIArg) (*APIRes, error) {
	url1 := a.getURL(arg)
	req, err := a.PrepareMethodWithBody("DELETE", url1, arg)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

func (a *InternalAPIEngine) DoRequest(arg APIArg, req *http.Request) (*APIRes, error) {
	m := arg.GetMetaContext(a.G())
	res, reqErr := a.doRequest(m, arg, req)
	if reqErr == nil {
		return res, nil
	}

	if err := a.refreshSession(m, arg, reqErr); err != nil {
		return res, err
	}

	m.CDebugf("| API call %s session refreshed, trying again", arg.Endpoint)

	if req.GetBody != nil {
		// post request body consumed, need to get it back
		var err error
		req.Body, err = req.GetBody()
		if err != nil {
			return res, err
		}
	}

	res, err := a.doRequest(m, arg, req)
	if err == nil {
		m.CDebugf("| API call %s success after refresh", arg.Endpoint)
		return res, nil
	}

	if _, relogin := err.(ReloginRequiredError); relogin {
		m.CDebugf("| API call %s retry after refresh still asking for new session, bailing out", arg.Endpoint)
		return res, LoginRequiredError{Context: "your session has expired"}
	}

	m.CDebugf("| API call %s error after refresh: %s", arg.Endpoint, err)

	return res, err
}

func (a *InternalAPIEngine) refreshSession(m MetaContext, arg APIArg, reqErr error) error {
	_, relogin := reqErr.(ReloginRequiredError)
	if !relogin {
		return reqErr
	}

	m.CDebugf("| API call %s session expired, trying to refresh", arg.Endpoint)

	if arg.SessionR != nil {
		// can't re-login with a SessionR
		return LoginRequiredError{Context: "your session has expired"}
	}

	username := m.G().Env.GetUsername()
	if err := m.G().LoginState().LoginWithStoredSecret(m, username.String(), nil); err != nil {
		m.CDebugf("| API call %s session refresh error: %s", arg.Endpoint, err)
		return LoginRequiredError{Context: "your session has expired"}

	}

	m.CDebugf("| API call %s session refreshed", arg.Endpoint)
	return nil

}

func (a *InternalAPIEngine) doRequest(m MetaContext, arg APIArg, req *http.Request) (*APIRes, error) {
	resp, finisher, jw, err := doRequestShared(m, a, arg, req, true)
	if err != nil {
		return nil, err
	}
	defer finisher()

	status, err := jw.AtKey("status").ToDictionary()
	if err != nil {
		err = fmt.Errorf("Cannot parse server's 'status' field: %s", err)
		return nil, err
	}

	// Check for an "OK" or whichever app-level replies were allowed by
	// http.AppStatus
	appStatus, err := a.checkAppStatusFromJSONWrapper(arg, status)
	if err != nil {
		m.CDebugf("- API call %s error: %s", arg.Endpoint, err)
		return nil, err
	}

	body := jw
	m.CDebugf("- API call %s success", arg.Endpoint)
	return &APIRes{status, body, resp.StatusCode, appStatus}, err
}

// InternalApiEngine
//===========================================================================

//===========================================================================
// ExternalApiEngine

type XAPIResType int

const (
	XAPIResJSON XAPIResType = iota
	XAPIResHTML
	XAPIResText
)

func (api *ExternalAPIEngine) fixHeaders(m MetaContext, arg APIArg, req *http.Request, nist *NIST) error {
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
	} else {
		// For non-reddit sites we don't want to be served mobile HTML.
		if runtime.GOOS == "android" {
			userAgent = strings.Replace(userAgent, "android", "linux", 1)
		}
	}
	if m.G().Env.GetTorMode().UseHeaders() {
		req.Header.Set("User-Agent", userAgent)
	}

	return nil
}

func isReddit(req *http.Request) bool {
	host := req.URL.Host
	return host == "reddit.com" || strings.HasSuffix(host, ".reddit.com")
}

func (api *ExternalAPIEngine) consumeHeaders(m MetaContext, resp *http.Response, nist *NIST) error {
	return nil
}

func (api *ExternalAPIEngine) isExternal() bool { return true }

func (api *ExternalAPIEngine) DoRequest(
	arg APIArg, req *http.Request, restype XAPIResType) (
	ar *ExternalAPIRes, hr *ExternalHTMLRes, tr *ExternalTextRes, err error) {

	m := arg.GetMetaContext(api.G())

	var resp *http.Response
	var jw *jsonw.Wrapper
	var finisher func()

	resp, finisher, jw, err = doRequestShared(m, api, arg, req, (restype == XAPIResJSON))
	if err != nil {
		return
	}
	defer finisher()

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

func (api *ExternalAPIEngine) getCommon(arg APIArg, restype XAPIResType) (
	ar *ExternalAPIRes, hr *ExternalHTMLRes, tr *ExternalTextRes, err error) {

	var url1 *url.URL
	var req *http.Request
	url1, err = url.Parse(arg.Endpoint)

	if err != nil {
		return
	}
	req, err = api.PrepareGet(*url1, arg)
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

func (api *ExternalAPIEngine) postCommon(arg APIArg, restype XAPIResType) (
	ar *ExternalAPIRes, hr *ExternalHTMLRes, err error) {

	var url1 *url.URL
	var req *http.Request
	url1, err = url1.Parse(arg.Endpoint)

	if err != nil {
		return
	}
	req, err = api.PrepareMethodWithBody("POST", *url1, arg)
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
