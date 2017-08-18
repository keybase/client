// Copyright 2017 Keybase. Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvl

import (
	"fmt"
)

type stubDNSEngine struct {
	canned cannedDNS
	ok     bool
}

// Map from domain to list of records.
// A string "ERROR" will cause an error to be returned.
type cannedDNS map[string]([]string)

func newStubDNSEngine(canned cannedDNS) *stubDNSEngine {
	return &stubDNSEngine{
		canned: canned,
		ok:     true,
	}
}

func (e *stubDNSEngine) LookupTXT(domain string) ([]string, error) {
	defaultres := []string{}
	txts, ok := e.canned[domain]
	if !ok {
		e.ok = false
		return defaultres, nil
	}
	if len(txts) == 1 && txts[0] == "ERROR" {
		return defaultres, fmt.Errorf("fake dns error")
	}
	return txts, nil
}

func (e *stubDNSEngine) IsOk() bool {
	return e.ok
}
