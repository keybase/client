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

	"github.com/PuerkitoBio/goquery"
	jsonw "github.com/keybase/go-jsonw"
)

// Shared code across Internal and External APIs
type BaseApiEngine struct {
	config    *ClientConfig
	clientsMu sync.RWMutex
	clients   map[int]*Client
}

type InternalApiEngine struct {
	BaseApiEngine
}

type ExternalApiEngine struct {
	BaseApiEngine
}

// Internal and External APIs both implement these methods,
// allowing us to share the request-making code below in doRequest
type Requester interface {
	fixHeaders(arg ApiArg, req *http.Request)
	getCli(needSession bool) *Client
}

// Make a new InternalApiEngine and a new ExternalApiEngine, which share the
// same network config (i.e., TOR and Proxy parameters)
func NewApiEngines(e *Env) (*InternalApiEngine, *ExternalApiEngine, error) {
	config, err := e.GenClientConfig()
	if err != nil {
		return nil, nil, err
	}

	i := &InternalApiEngine{BaseApiEngine{config: config, clients: make(map[int]*Client)}}
	x := &ExternalApiEngine{BaseApiEngine{clients: make(map[int]*Client)}}
	return i, x, nil
}

type ApiStatus struct {
	Code int    `json:"code"`
	Name string `json:"name"`
}

//============================================================================
// Errors

type ApiError struct {
	Msg  string
	Code int
}

func NewApiErrorFromError(err error) ApiError {
	return ApiError{err.Error(), 0}
}

func NewApiErrorFromHttpResponse(r *http.Response) *ApiError {
	return &ApiError{r.Status, r.StatusCode}
}

func (a *ApiError) Error() string {
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

func (api *BaseApiEngine) getCli(cookied bool) (ret *Client) {
	key := 0
	if cookied {
		key |= 1
	}
	api.clientsMu.RLock()
	client, found := api.clients[key]
	api.clientsMu.RUnlock()
	if !found {
		G.Log.Debug("| Cli wasn't found; remaking for cookied=%v", cookied)
		client = NewClient(api.config, cookied)
		api.clientsMu.Lock()
		api.clients[key] = client
		api.clientsMu.Unlock()
	}
	return client
}

func (base *BaseApiEngine) PrepareGet(url url.URL, arg ApiArg) (*http.Request, error) {
	url.RawQuery = arg.getHttpArgs().Encode()
	ruri := url.String()
	G.Log.Debug(fmt.Sprintf("+ API GET request to %s", ruri))
	return http.NewRequest("GET", ruri, nil)
}

func (base *BaseApiEngine) PreparePost(url url.URL, arg ApiArg) (*http.Request, error) {
	ruri := url.String()
	G.Log.Debug(fmt.Sprintf("+ API Post request to %s", ruri))
	body := ioutil.NopCloser(strings.NewReader(arg.getHttpArgs().Encode()))
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
func doRequestShared(api Requester, arg ApiArg, req *http.Request, wantJsonRes bool) (
	resp *http.Response, jw *jsonw.Wrapper, err error) {

	api.fixHeaders(arg, req)
	cli := api.getCli(arg.NeedSession)

	// Actually send the request via Go's libraries
	resp, err = cli.cli.Do(req)
	if err != nil {
		return nil, nil, err
	}
	G.Log.Debug(fmt.Sprintf("| Result is: %s", resp.Status))

	// Check for a code 200 or rather which codes were allowed in arg.HttpStatus
	err = checkHttpStatus(arg, resp)
	if err != nil {
		return nil, nil, err
	}

	if wantJsonRes {

		decoder := json.NewDecoder(resp.Body)
		var obj interface{}
		decoder.UseNumber()
		err = decoder.Decode(&obj)
		resp.Body.Close()
		if err != nil {
			err = fmt.Errorf("Error in parsing JSON reply from server: %s", err.Error())
			return nil, nil, err
		}

		jw = jsonw.NewWrapper(obj)
		if G.Env.GetApiDump() {
			G.Log.Debug(fmt.Sprintf("| full reply: %v", obj))
		}
	}

	return resp, jw, nil
}

func checkHttpStatus(arg ApiArg, resp *http.Response) error {
	var set []int
	if arg.HttpStatus == nil || len(arg.HttpStatus) == 0 {
		set = []int{200}
	} else {
		set = arg.HttpStatus
	}
	for _, status := range set {
		if resp.StatusCode == status {
			return nil
		}
	}
	return NewApiErrorFromHttpResponse(resp)
}

func (arg ApiArg) getHttpArgs() url.Values {
	if arg.Args != nil {
		return arg.Args.ToValues()
	}
	return arg.uArgs
}

// End shared code
//============================================================================

//============================================================================
// InternalApiEngine

func (a *InternalApiEngine) getUrl(arg ApiArg) url.URL {
	u := *a.config.Url
	var path string
	if len(a.config.Prefix) > 0 {
		path = a.config.Prefix
	} else {
		path = API_URI_PATH_PREFIX
	}
	u.Path = path + "/" + arg.Endpoint + ".json"
	return u
}

func (a *InternalApiEngine) fixHeaders(arg ApiArg, req *http.Request) {
	if arg.NeedSession {
		tok, csrf := G.LoginState().SessionArgs()
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
	req.Header.Set("User-Agent", USER_AGENT)
	req.Header.Set("X-Keybase-Client", IDENTIFY_AS)
}

func checkAppStatus(arg ApiArg, jw *jsonw.Wrapper) (string, error) {
	var set []string

	res_name, err := jw.AtKey("name").GetString()
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
		if res_name == status {
			return res_name, nil
		}
	}
	return "", NewAppStatusError(jw)
}

func (api *InternalApiEngine) Get(arg ApiArg) (*ApiRes, error) {
	url := api.getUrl(arg)
	req, err := api.PrepareGet(url, arg)
	if err != nil {
		return nil, err
	}
	return api.DoRequest(arg, req)
}

// GetResp performs a GET request and returns the http response.
func (api *InternalApiEngine) GetResp(arg ApiArg) (*http.Response, error) {
	url := api.getUrl(arg)
	req, err := api.PrepareGet(url, arg)
	if err != nil {
		return nil, err
	}

	resp, _, err := doRequestShared(api, arg, req, false)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// GetDecode performs a GET request and decodes the response via
// JSON into the value pointed to by v.
func (api *InternalApiEngine) GetDecode(arg ApiArg, v interface{}) error {
	resp, err := api.GetResp(arg)
	if err != nil {
		return err
	}
	dec := json.NewDecoder(resp.Body)
	defer resp.Body.Close()
	return dec.Decode(&v)
}

func (api *InternalApiEngine) Post(arg ApiArg) (*ApiRes, error) {
	url := api.getUrl(arg)
	req, err := api.PreparePost(url, arg)
	if err != nil {
		return nil, err
	}
	return api.DoRequest(arg, req)
}

// PostResp performs a POST request and returns the http response.
func (api *InternalApiEngine) PostResp(arg ApiArg) (*http.Response, error) {
	url := api.getUrl(arg)
	req, err := api.PreparePost(url, arg)
	if err != nil {
		return nil, err
	}

	resp, _, err := doRequestShared(api, arg, req, false)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (api *InternalApiEngine) PostDecode(arg ApiArg, v interface{}) error {
	resp, err := api.PostResp(arg)
	if err != nil {
		return err
	}
	//	b, _ := ioutil.ReadAll(resp.Body)
	// G.Log.Info(string(b))
	dec := json.NewDecoder(resp.Body)
	defer resp.Body.Close()
	return dec.Decode(&v)
}

func (api *InternalApiEngine) DoRequest(
	arg ApiArg, req *http.Request) (*ApiRes, error) {

	resp, jw, err := doRequestShared(api, arg, req, true)
	if err != nil {
		return nil, err
	}

	status, err := jw.AtKey("status").ToDictionary()
	if err != nil {
		err = fmt.Errorf("Cannot parse server's 'status' field: %s", err.Error())
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
	return &ApiRes{status, body, resp.StatusCode, appStatus}, err
}

// InternalApiEngine
//===========================================================================

//===========================================================================
// ExternalApiEngine

const (
	XAPI_RES_JSON = iota
	XAPI_RES_HTML = iota
	XAPI_RES_TEXT = iota
)

func (a *ExternalApiEngine) fixHeaders(arg ApiArg, req *http.Request) {
	// noop for now
}

func (api *ExternalApiEngine) DoRequest(
	arg ApiArg, req *http.Request, restype int) (
	ar *ExternalApiRes, hr *ExternalHtmlRes, tr *ExternalTextRes, err error) {

	var resp *http.Response
	var jw *jsonw.Wrapper

	resp, jw, err = doRequestShared(api, arg, req, (restype == XAPI_RES_JSON))
	if err != nil {
		return
	}

	switch restype {
	case XAPI_RES_JSON:
		ar = &ExternalApiRes{resp.StatusCode, jw}
	case XAPI_RES_HTML:
		var goq *goquery.Document
		goq, err = goquery.NewDocumentFromResponse(resp)
		if err == nil {
			hr = &ExternalHtmlRes{resp.StatusCode, goq}
		}
	case XAPI_RES_TEXT:
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

func (api *ExternalApiEngine) getCommon(arg ApiArg, restype int) (
	ar *ExternalApiRes, hr *ExternalHtmlRes, tr *ExternalTextRes, err error) {

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

func (api *ExternalApiEngine) Get(arg ApiArg) (res *ExternalApiRes, err error) {
	res, _, _, err = api.getCommon(arg, XAPI_RES_JSON)
	return
}

func (api *ExternalApiEngine) GetHtml(arg ApiArg) (res *ExternalHtmlRes, err error) {
	_, res, _, err = api.getCommon(arg, XAPI_RES_HTML)
	return
}

func (api *ExternalApiEngine) GetText(arg ApiArg) (res *ExternalTextRes, err error) {
	_, _, res, err = api.getCommon(arg, XAPI_RES_TEXT)
	return
}

func (api *ExternalApiEngine) postCommon(arg ApiArg, restype int) (
	ar *ExternalApiRes, hr *ExternalHtmlRes, err error) {

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

func (api *ExternalApiEngine) Post(arg ApiArg) (res *ExternalApiRes, err error) {
	res, _, err = api.postCommon(arg, XAPI_RES_JSON)
	return
}

func (api *ExternalApiEngine) PostHtml(arg ApiArg) (res *ExternalHtmlRes, err error) {
	_, res, err = api.postCommon(arg, XAPI_RES_HTML)
	return
}

// ExternalApiEngine
//===========================================================================
