// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/keybase/clockwork"
	jsonw "github.com/keybase/go-jsonw"
)

const fakeResponse = `{
	"status": {
		"code": 0,
		"name": "OK"
	},
	"salt": "1a507c4a3c083e6a6e72d79f71ea99e8",
	"login_session": "lgHZIGRiYjE2NWI3ODc5ZmU3YjExNzRkZjczYmVkMGI5NTAwzlaYTrLNCWDAxCBqkB8LnhG44ndNkVgHvRUoVbDUn1FMaIRPMUC1LCROmw==",
	"pwh_version": 3,
	"csrf_token": "lgHZIDY3M2E3NDBjZDIwZmI0YmQzNDg3MzhiMTZkMjI4MjE5zlaYTmPOAAFRgMDEIITHl1hPEaTsnia433+727nztAC/Td62RJY8K8tBCoGZ"
}`

type FakeAPI struct{}

func (a *FakeAPI) Get(arg APIArg) (*APIRes, error) {

	decoder := json.NewDecoder(bytes.NewBufferString(fakeResponse))
	var obj interface{}
	decoder.UseNumber()
	err := decoder.Decode(&obj)
	if err != nil {
		err = fmt.Errorf("Error in parsing JSON reply from server: %s", err)
		return nil, err
	}

	jw := jsonw.NewWrapper(obj)

	status, err := jw.AtKey("status").ToDictionary()
	if err != nil {
		err = fmt.Errorf("Cannot parse server's 'status' field: %s", err)
		return nil, err
	}

	body := jw
	return &APIRes{status, body, 200, nil}, err

}

func (a *FakeAPI) GetDecode(arg APIArg, v APIResponseWrapper) error {
	return fmt.Errorf("GetDecode is phony")
}

func (a *FakeAPI) GetResp(APIArg) (*http.Response, error) {
	return nil, fmt.Errorf("GetResp is phony")
}

func (a *FakeAPI) Post(APIArg) (*APIRes, error) {
	return nil, fmt.Errorf("Post is phony")
}

func (a *FakeAPI) PostJSON(APIArg) (*APIRes, error) {
	return nil, fmt.Errorf("PostJSON is phony")
}

func (a *FakeAPI) PostRaw(APIArg, string, io.Reader) (*APIRes, error) {
	return nil, fmt.Errorf("PostRaw is phony")
}

func (a *FakeAPI) PostDecode(APIArg, APIResponseWrapper) error {
	return fmt.Errorf("GetDecode is phony")
}
func (a *FakeAPI) Delete(APIArg) (*APIRes, error) {
	return nil, fmt.Errorf("Delete is phony")
}

func TestLoginSessionTimeout(t *testing.T) {
	tc := SetupTest(t, "login_session_test", 1)
	tc.G.API = &FakeAPI{}
	c := clockwork.NewFakeClock()
	tc.G.SetClock(c)
	defer tc.Cleanup()

	sesh := NewLoginSession("logintest", tc.G)
	err := sesh.Load()
	if err != nil {
		t.Fatal(err)
	}
	if !sesh.NotExpired() {
		t.Fatal("Fresh LoginSession says expired")
	}
	c.Advance(LoginSessionMemoryTimeout + 1*time.Second)
	tc.G.SetClock(c) // ??
	if sesh.NotExpired() {
		t.Fatal("Stale LoginSession says not expired")
	}
}
