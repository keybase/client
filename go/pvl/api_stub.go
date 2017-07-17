// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production

package pvl

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
)

type stubAPIEngine struct {
	expectations map[string]stubAPIEngineExpectation
	calls        []stubAPIEngineCallRecord
}

type stubAPIEngineExpectation struct {
	JSON *libkb.ExternalAPIRes
	HTML *libkb.ExternalHTMLRes
	Text *libkb.ExternalTextRes
}

type stubAPIEngineCallRecord struct {
	kind     libkb.XAPIResType
	endpoint string
}

func newStubAPIEngine() *stubAPIEngine {
	return &stubAPIEngine{
		expectations: make(map[string]stubAPIEngineExpectation),
		calls:        make([]stubAPIEngineCallRecord, 0),
	}
}

func (e *stubAPIEngine) Get(arg libkb.APIArg) (*libkb.ExternalAPIRes, error) {
	res, _, _, err := e.getMock(arg, libkb.XAPIResJSON)
	if err != nil {
		return nil, err
	}
	return res, nil

}

func (e *stubAPIEngine) GetHTML(arg libkb.APIArg) (*libkb.ExternalHTMLRes, error) {
	_, res, _, err := e.getMock(arg, libkb.XAPIResHTML)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (e *stubAPIEngine) GetText(arg libkb.APIArg) (*libkb.ExternalTextRes, error) {
	_, _, res, err := e.getMock(arg, libkb.XAPIResText)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func (e *stubAPIEngine) Post(arg libkb.APIArg) (*libkb.ExternalAPIRes, error) {
	return nil, fmt.Errorf("unsupported operation Post for stub api")
}

func (e *stubAPIEngine) PostHTML(arg libkb.APIArg) (*libkb.ExternalHTMLRes, error) {
	return nil, fmt.Errorf("unsupported operation Post for stub api")
}

func (e *stubAPIEngine) Set(endpoint string, canned *libkb.ExternalAPIRes) {
	e.setCommon(endpoint, canned, nil, nil)
}

func (e *stubAPIEngine) SetHTML(endpoint string, canned *libkb.ExternalHTMLRes) {
	e.setCommon(endpoint, nil, canned, nil)
}

func (e *stubAPIEngine) SetText(endpoint string, canned *libkb.ExternalTextRes) {
	e.setCommon(endpoint, nil, nil, canned)
}

func (e *stubAPIEngine) setCommon(endpoint string, e1 *libkb.ExternalAPIRes, e2 *libkb.ExternalHTMLRes, e3 *libkb.ExternalTextRes) {
	entry := e.expectations[endpoint]
	if e1 != nil {
		entry.JSON = e1
	}
	if e2 != nil {
		entry.HTML = e2
	}
	if e3 != nil {
		entry.Text = e3
	}
	e.expectations[endpoint] = entry
}

func (e *stubAPIEngine) ResetCalls() {
	e.calls = make([]stubAPIEngineCallRecord, 0)
}

func (e *stubAPIEngine) AssertCalledOnceWith(kind libkb.XAPIResType, endpoint string) error {
	if len(e.calls) == 0 {
		return fmt.Errorf("stub api not called")
	}
	if len(e.calls) > 1 {
		return fmt.Errorf("stub api called more than once")
	}
	call := e.calls[0]
	expected := stubAPIEngineCallRecord{kind, endpoint}
	if call != expected {
		return fmt.Errorf("stub api called with wrong arguments\n  expected:  %v %v\ngot: %v %v",
			expected.kind, expected.endpoint, call.kind, call.endpoint)
	}
	return nil
}

func (e *stubAPIEngine) AssertCalledWith(kind libkb.XAPIResType, endpoint string) error {
	if len(e.calls) == 0 {
		return fmt.Errorf("stub api not called")
	}
	ok := false
	for _, call := range e.calls {
		expected := stubAPIEngineCallRecord{kind, endpoint}
		if call == expected {
			ok = true
		}
	}
	if ok {
		return nil
	}
	return fmt.Errorf("stub api never called with arguments: %v %v",
		kind, endpoint)
}

func (e *stubAPIEngine) getMock(arg libkb.APIArg, restype libkb.XAPIResType) (
	*libkb.ExternalAPIRes, *libkb.ExternalHTMLRes, *libkb.ExternalTextRes, error) {
	e.calls = append(e.calls, stubAPIEngineCallRecord{
		kind:     restype,
		endpoint: arg.Endpoint,
	})

	entry := e.expectations[arg.Endpoint]
	okjson := entry.JSON != nil
	okhtml := entry.HTML != nil
	oktext := entry.Text != nil

	ok := (okjson || (restype != libkb.XAPIResJSON)) &&
		(okhtml || (restype != libkb.XAPIResHTML)) &&
		(oktext || (restype != libkb.XAPIResText))
	if !ok {
		return nil, nil, nil, fmt.Errorf("unexpected api call: %v %v", restype, arg.Endpoint)
	}

	return entry.JSON, entry.HTML, entry.Text, nil
}
