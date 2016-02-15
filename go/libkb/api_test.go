// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"net/http"
	"testing"
)

func TestIsReddit(t *testing.T) {
	// Test both with and without a subdomain.
	req, _ := http.NewRequest("GET", "http://reddit.com", nil)
	if !isReddit(req) {
		t.Fatal("should be a reddit URL")
	}
	req, _ = http.NewRequest("GET", "http://www.reddit.com", nil)
	if !isReddit(req) {
		t.Fatal("should be a reddit URL")
	}
	// Test a non-reddit URL.
	req, _ = http.NewRequest("GET", "http://github.com", nil)
	if isReddit(req) {
		t.Fatal("should NOT be a reddit URL")
	}
}
