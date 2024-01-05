// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/keybase/go-logging"
)

var testLog = &logging.Logger{Module: "test"}

func newServer(updateJSON string) *httptest.Server {
	return newServerWithDelay(updateJSON, 0)
}

func newServerWithDelay(updateJSON string, delay time.Duration) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if delay > 0 {
			time.Sleep(delay)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, updateJSON)
	}))
}

func newServerForError(err error) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, err.Error(), 500)
	}))
}
