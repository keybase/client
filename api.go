
package libkb

import (
	"github.com/okcupid/jsonw"
	"net/url"
	"net/http"
	"fmt"
	"encoding/json"
)

type ApiArgs map[string]string

type ApiArg struct {
	Endpoint string
	Args url.Values
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
	u.Path = path + arg.Endpoint + ".json"
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

func (api *ApiAccess) Get(arg ApiArg) (*ApiRes, error) {
	cli := api.getCli(arg.NeedSession)
	url := api.getUrl(arg)
	url.RawQuery = arg.Args.Encode()
	req, err := http.NewRequest("GET", url.RequestURI(), nil)
	api.fixHeaders(req, arg)
	if err != nil { return nil, err }
	resp, err := cli.cli.Do(req)
	if err != nil { return nil, err }
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

	// It's OK to not have a body. Some RPCs just return a status
	body, _ := jw.AtKey("body").ToDictionary()

	return &ApiRes {status, body, resp.StatusCode, appStatus } , err
}