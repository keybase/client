package libkb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	jsonw "github.com/keybase/go-jsonw"
)

// Shared code across Internal and External APIs
type BaseAPIEngine struct {
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

// Make a new InternalApiEngine and a new ExternalApiEngine, which share the
// same network config (i.e., TOR and Proxy parameters)
func NewAPIEngines(e *Env) (*InternalAPIEngine, *ExternalAPIEngine, error) {
	config, err := e.GenClientConfig()
	if err != nil {
		return nil, nil, err
	}

	i := &InternalAPIEngine{BaseAPIEngine{config: config, clients: make(map[int]*Client)}}
	x := &ExternalAPIEngine{BaseAPIEngine{clients: make(map[int]*Client)}}
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
		G.Log.Debug("| Cli wasn't found; remaking for cookied=%v", cookied)
		client = NewClient(api.config, cookied)
		api.clients[key] = client
	}
	api.clientsMu.Unlock()
	return client
}

func (api *BaseAPIEngine) PrepareGet(url url.URL, arg APIArg) (*http.Request, error) {
	url.RawQuery = arg.getHTTPArgs().Encode()
	ruri := url.String()
	G.Log.Debug(fmt.Sprintf("+ API GET request to %s", ruri))
	return http.NewRequest("GET", ruri, nil)
}

func (api *BaseAPIEngine) PreparePost(url url.URL, arg APIArg) (*http.Request, error) {
	ruri := url.String()
	G.Log.Debug(fmt.Sprintf("+ API Post request to %s", ruri))
	body := ioutil.NopCloser(strings.NewReader(arg.getHTTPArgs().Encode()))
	req, err := http.NewRequest("POST", ruri, body)
	if err != nil {
		return nil, err
	}
	typ := "application/x-www-form-urlencoded; charset=utf-8"
	req.Header.Add("Content-Type", typ)
	return req, nil
}

//
//============================================================================

//============================================================================
// Shared code
//
func doRequestShared(api Requester, arg APIArg, req *http.Request, wantJSONRes bool) (
	resp *http.Response, jw *jsonw.Wrapper, err error) {

	api.fixHeaders(arg, req)
	cli := api.getCli(arg.NeedSession)

	// Actually send the request via Go's libraries
	timerType := TimerAPI
	if api.isExternal() {
		timerType = TimerXAPI
	}

	if G.Env.GetAPIDump() {
		b, _ := json.MarshalIndent(arg.getHTTPArgs(), "", "  ")
		G.Log.Debug(fmt.Sprintf("| full request: %s", b))
	}

	timer := G.Timers.Start(timerType)
	resp, err = cli.cli.Do(req)
	timer.Report(req.Method + " " + arg.Endpoint)

	if err != nil {
		return nil, nil, APINetError{err: err}
	}
	G.Log.Debug(fmt.Sprintf("| Result is: %s", resp.Status))

	// Check for a code 200 or rather which codes were allowed in arg.HttpStatus
	err = checkHTTPStatus(arg, resp)
	if err != nil {
		return nil, nil, err
	}

	err = api.consumeHeaders(resp)
	if err != nil {
		return nil, nil, err
	}

	if wantJSONRes {

		decoder := json.NewDecoder(resp.Body)
		var obj interface{}
		decoder.UseNumber()
		err = decoder.Decode(&obj)
		resp.Body.Close()
		if err != nil {
			err = fmt.Errorf("Error in parsing JSON reply from server: %s", err)
			return nil, nil, err
		}

		jw = jsonw.NewWrapper(obj)
		if G.Env.GetAPIDump() {
			b, _ := json.MarshalIndent(obj, "", "  ")
			G.Log.Debug(fmt.Sprintf("| full reply: %s", b))
		}
	}

	return resp, jw, nil
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
	arg.G().LoginState().LocalSession(func(s *Session) {
		tok, csrf = s.APIArgs()
	}, "sessionArgs")
	return
}

func (a *InternalAPIEngine) isExternal() bool { return false }

var lastUpgradeWarningMu sync.Mutex
var lastUpgradeWarning *time.Time

func (a *InternalAPIEngine) consumeHeaders(resp *http.Response) error {
	u := resp.Header.Get("X-Keybase-Client-Upgrade-To")
	if len(u) > 0 {
		now := time.Now()
		lastUpgradeWarningMu.Lock()
		if lastUpgradeWarning == nil || now.Sub(*lastUpgradeWarning) > 3*time.Minute {
			G.Log.Warning("Upgrade recommended to client version %s or above (you have v%s)",
				u, Version)
			lastUpgradeWarning = &now
		}
		lastUpgradeWarningMu.Unlock()
	}
	return nil
}

func (a *InternalAPIEngine) fixHeaders(arg APIArg, req *http.Request) {
	if arg.NeedSession {
		tok, csrf := a.sessionArgs(arg)
		if len(tok) > 0 {
			req.Header.Add("X-Keybase-Session", tok)
		} else {
			G.Log.Warning("fixHeaders:  need session, but session token empty")
		}
		if len(csrf) > 0 {
			req.Header.Add("X-CSRF-Token", csrf)
		} else {
			G.Log.Warning("fixHeaders:  need session, but session csrf empty")
		}
	}
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("X-Keybase-Client", IdentifyAs)
}

func checkAppStatus(arg APIArg, jw *jsonw.Wrapper) (string, error) {
	var set []string

	resName, err := jw.AtKey("name").GetString()
	if err != nil {
		err = fmt.Errorf("Cannot find status name in reply")
		return "", err
	}

	if arg.AppStatus == nil || len(arg.AppStatus) == 0 {
		set = []string{"OK"}
	} else {
		set = arg.AppStatus
	}
	for _, status := range set {
		if resName == status {
			return resName, nil
		}
	}
	return "", NewAppStatusError(jw)
}

func (a *InternalAPIEngine) Get(arg APIArg) (*APIRes, error) {
	url := a.getURL(arg)
	req, err := a.PrepareGet(url, arg)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

// GetResp performs a GET request and returns the http response.
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
func (a *InternalAPIEngine) GetDecode(arg APIArg, v interface{}) error {
	resp, err := a.GetResp(arg)
	if err != nil {
		return err
	}
	dec := json.NewDecoder(resp.Body)
	defer resp.Body.Close()
	return dec.Decode(&v)
}

func (a *InternalAPIEngine) Post(arg APIArg) (*APIRes, error) {
	url := a.getURL(arg)
	req, err := a.PreparePost(url, arg)
	if err != nil {
		return nil, err
	}
	return a.DoRequest(arg, req)
}

// PostResp performs a POST request and returns the http response.
func (a *InternalAPIEngine) PostResp(arg APIArg) (*http.Response, error) {
	url := a.getURL(arg)
	req, err := a.PreparePost(url, arg)
	if err != nil {
		return nil, err
	}

	resp, _, err := doRequestShared(a, arg, req, false)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (a *InternalAPIEngine) PostDecode(arg APIArg, v interface{}) error {
	resp, err := a.PostResp(arg)
	if err != nil {
		return err
	}
	dec := json.NewDecoder(resp.Body)
	defer resp.Body.Close()
	return dec.Decode(&v)
}

func (a *InternalAPIEngine) DoRequest(arg APIArg, req *http.Request) (*APIRes, error) {
	resp, jw, err := doRequestShared(a, arg, req, true)
	if err != nil {
		return nil, err
	}

	status, err := jw.AtKey("status").ToDictionary()
	if err != nil {
		err = fmt.Errorf("Cannot parse server's 'status' field: %s", err)
		return nil, err
	}

	// Check for an "OK" or whichever app-level replies were allowed by
	// http.AppStatus
	appStatus, err := checkAppStatus(arg, status)
	if err != nil {
		return nil, err
	}

	body := jw
	G.Log.Debug(fmt.Sprintf("- successful API call"))
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
	// noop for now
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
		_, err := buf.ReadFrom(resp.Body)
		if err == nil {
			resp.Body.Close()
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
	req, err = api.PreparePost(*url, arg)
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
