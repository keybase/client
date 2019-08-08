// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbhttp

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/keybase/client/go/logger"
	"github.com/stretchr/testify/require"
)

func TestSrv(t *testing.T) {
	test := func(s ListenerSource) {
		log := logger.NewTestLogger(t)
		srv := NewSrv(log, s)
		require.NoError(t, srv.Start())
		srv.HandleFunc("/test", func(resp http.ResponseWriter, req *http.Request) {
			fmt.Fprintf(resp, "success")
		})
		addr, err := srv.Addr()
		require.NoError(t, err)
		url := fmt.Sprintf("http://%s/test", addr)
		t.Logf("url: %s", url)
		resp, err := http.Get(url)
		require.NoError(t, err)
		out, err := ioutil.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, "success", string(out))
		<-srv.Stop()
	}
	test(NewAutoPortListenerSource())
	test(NewPortRangeListenerSource(7000, 8000))
	test(NewRandomPortRangeListenerSource(7000, 8000))
}
