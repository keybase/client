package libkb

import (
	"encoding/json"
	"fmt"
	"github.com/PuerkitoBio/goquery"
	"github.com/keybase/go-jsonw"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
)

// Shared code across Internal and External APIs
type BaseApiEngine struct {
	config  *ClientConfig
	clients map[int]*Client
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
func NewApiEngines(e Env) (*InternalApiEngine, *ExternalApiEngine, error) {
	config, err := e.GenClientConfig()
	if err != nil {
		return nil, nil, err
	}

	i := &InternalApiEngine{BaseApiEngine{config, make(map[int]*Client)}}
	x := &ExternalApiEngine{BaseApiEngine{nil, make(map[int]*Client)}}
	return i, x, nil
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
	client, found := api.clients[key]
	if !found {
		client = NewClient(api.config, cookied)
		api.clients[key] = client
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
	} else {
		return arg.uArgs
	}
}

// End shared code
//============================================================================

//============================================================================
// InternalApiEngine

func (a InternalApiEngine) getUrl(arg ApiArg) url.URL {
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

func (a InternalApiEngine) fixHeaders(arg ApiArg, req *http.Request) {
	if arg.NeedSession && G.Session != nil {
		if tok := G.Session.token; len(tok) > 0 {
			req.Header.Add("X-Keybase-Session", tok)
		}
		if csrf := G.Session.csrf; len(csrf) > 0 {
			req.Header.Add("X-CSRF-Token", csrf)
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
	desc, _ := jw.AtKey("desc").GetString()
	code, _ := jw.AtKey("code").GetInt64()
	return "", fmt.Errorf("%s (error %d)", desc, int(code))
}

func (api *InternalApiEngine) Get(arg ApiArg) (*ApiRes, error) {
	url := api.getUrl(arg)
	req, err := api.PrepareGet(url, arg)
	if err != nil {
		return nil, err
	}
	return api.DoRequest(arg, req)
}

func (api *InternalApiEngine) Post(arg ApiArg) (*ApiRes, error) {
	url := api.getUrl(arg)
	req, err := api.PreparePost(url, arg)
	if err != nil {
		return nil, err
	}
	return api.DoRequest(arg, req)
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
		err = fmt.Errorf("Got failure from Keybase server: %s", err.Error())
		return nil, err
	}

	body := jw
	G.Log.Debug(fmt.Sprintf("- succesful API call"))
	return &ApiRes{status, body, resp.StatusCode, appStatus}, err
}

// InternalApiEngine
//===========================================================================

//===========================================================================
// ExternalApiEngine

func (a ExternalApiEngine) fixHeaders(arg ApiArg, req *http.Request) {
	// noop for now
}

func (api *ExternalApiEngine) DoRequest(
	arg ApiArg, req *http.Request, wantJsonRes bool) (
	ar *ExternalApiRes, hr *ExternalHtmlRes, err error) {

	var resp *http.Response
	var jw *jsonw.Wrapper

	resp, jw, err = doRequestShared(api, arg, req, wantJsonRes)
	if err != nil {
		return
	}

	if wantJsonRes {
		ar = &ExternalApiRes{resp.StatusCode, jw}
	} else {
		var goq *goquery.Document
		goq, err = goquery.NewDocumentFromResponse(resp)
		if err == nil {
			hr = &ExternalHtmlRes{resp.StatusCode, goq}
		}
	}
	return
}

func (api *ExternalApiEngine) getCommon(arg ApiArg, wantJsonRes bool) (
	ar *ExternalApiRes, hr *ExternalHtmlRes, err error) {

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

	ar, hr, err = api.DoRequest(arg, req, wantJsonRes)
	return
}

func (api *ExternalApiEngine) Get(arg ApiArg) (res *ExternalApiRes, err error) {
	res, _, err = api.getCommon(arg, true)
	return
}

func (api *ExternalApiEngine) GetHtml(arg ApiArg) (res *ExternalHtmlRes, err error) {
	_, res, err = api.getCommon(arg, false)
	return
}

func (api *ExternalApiEngine) postCommon(arg ApiArg, wantJsonRes bool) (
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

	ar, hr, err = api.DoRequest(arg, req, wantJsonRes)
	return
}

func (api *ExternalApiEngine) Post(arg ApiArg) (res *ExternalApiRes, err error) {
	res, _, err = api.postCommon(arg, true)
	return
}

func (api *ExternalApiEngine) PostHtml(arg ApiArg) (res *ExternalHtmlRes, err error) {
	_, res, err = api.postCommon(arg, false)
	return
}

// ExternalApiEngine
//===========================================================================
