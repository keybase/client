
package libkb

import (
	"github.com/okcupid/jsonw"
	"net/url"
	"net/http"
	"fmt"
	"encoding/json"
	"io/ioutil"
	"strings"
)

type ApiArg struct {
	Endpoint string
	uArgs url.Values
	Args HttpArgs
	NeedSession bool
	HttpStatus []int
	AppStatus []string
}

type ApiRes struct {
	Status *jsonw.Wrapper
	Body *jsonw.Wrapper
	HttpStatus int
	AppStatus string
}

type ApiAccess struct {
	config *ClientConfig
	cookied, notCookied *Client
}

func NewApiAccess(e Env) (*ApiAccess, error) {
	config, err := e.GenClientConfig()
	if err != nil {
		return nil, err
	}
	return &ApiAccess{ config, nil, nil }, nil
}

func (api *ApiAccess) getCli(cookied bool) (ret *Client) {
	if cookied {
		if api.cookied == nil {
			api.cookied = NewClient(api.config, true)
		}
		ret = api.cookied
	} else {
		if api.notCookied == nil {
			api.notCookied = NewClient(api.config, false)
		}
		ret = api.notCookied
	}
	return ret
}

func (a ApiAccess) getUrl(arg ApiArg) url.URL {
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

func (a ApiAccess) fixHeaders(req *http.Request, arg ApiArg) {
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
		set = []string { "OK" }
	} else {
		set = arg.AppStatus
	}
	for _, status := range(set) {
		if res_name == status {
			return res_name, nil
		}
	}
	desc, _ := jw.AtKey("desc").GetString()
	code, _ := jw.AtKey("code").GetInt64()
	return "", fmt.Errorf("%s (error %d)", desc, int(code))
}

func checkHttpStatus(arg ApiArg, resp *http.Response) error {
	var set []int
	if arg.HttpStatus == nil || len(arg.HttpStatus) == 0 {
		set = []int { 200 }
	} else {
		set = arg.HttpStatus
	}
	for _, status := range(set) {
		if resp.StatusCode == status {
			return nil
		}	
	}
	return fmt.Errorf("Bad HTTP response code: %s", resp.Status)
}

func (arg ApiArg) getHttpArgs() url.Values {
	if arg.Args != nil { 
		return arg.Args.ToValues()
	} else {
		return arg.uArgs
	}
}

func (api *ApiAccess) Get(arg ApiArg) (*ApiRes, error) {
	url := api.getUrl(arg)
	url.RawQuery = arg.getHttpArgs().Encode()
	ruri := url.String()
	G.Log.Debug(fmt.Sprintf("+ API GET request to %s", ruri))
	req, err := http.NewRequest("GET", ruri, nil)
	if err != nil { return nil, err }
	return api.DoRequest(arg, req)
}

func (api *ApiAccess) Post(arg ApiArg) (*ApiRes, error) {
	url := api.getUrl(arg)
	ruri := url.String()
	G.Log.Debug(fmt.Sprintf("+ API Post request to %s", ruri))
	body := ioutil.NopCloser(strings.NewReader(arg.getHttpArgs().Encode()))
	req, err := http.NewRequest("POST", ruri, body)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded; charset=utf-8")
	if err != nil { return nil, err }
	return api.DoRequest(arg, req)
}


func (api *ApiAccess) DoRequest(arg ApiArg, req *http.Request) (*ApiRes, error) {

	api.fixHeaders(req, arg)
	cli := api.getCli(arg.NeedSession)

	// Actually send the request via Go's libraries
	resp, err := cli.cli.Do(req)
	if err != nil { return nil, err }
	G.Log.Debug(fmt.Sprintf("| Result is: %s", resp.Status))

	err = checkHttpStatus(arg, resp)
	if err != nil { return nil, err }

	decoder := json.NewDecoder(resp.Body)
	obj := make(map[string]interface{})
	err = decoder.Decode(&obj)
	resp.Body.Close()
	if err != nil {
		err = fmt.Errorf("Error in parsing JSON reply from server: %s", err.Error())
		return nil, err
	}	

	jw := jsonw.NewWrapper(obj)
	G.Log.Debug(fmt.Sprintf("| full reply: %v", obj))
	status, err := jw.AtKey("status").ToDictionary()
	if err != nil {
		err = fmt.Errorf("Cannot parse server's 'status' field: %s", err.Error())
		return nil, err
	}

	appStatus, err := checkAppStatus(arg, status)
	if err != nil {
		err = fmt.Errorf("Got failure from Keybase server: %s", err.Error())
		return nil, err
	}

	body := jw
	G.Log.Debug(fmt.Sprintf("- succesful API call"))
	return &ApiRes {status, body, resp.StatusCode, appStatus } , err
}