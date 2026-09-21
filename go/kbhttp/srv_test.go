// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package kbhttp

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
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
		resp, err := http.Get(url) //nolint:gosec // G107: Test code making request to own test server
		require.NoError(t, err)
		defer resp.Body.Close()
		out, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.Equal(t, "success", string(out))
		<-srv.Stop()
	}
	test(NewAutoPortListenerSource())
	test(NewPortRangeListenerSource(7000, 8000))
	test(NewRandomPortRangeListenerSource(7000, 8000))
}

type capturingListenerSource struct {
	sync.Mutex
	listener net.Listener
}

func (c *capturingListenerSource) GetListener() (net.Listener, string, error) {
	listener, address, err := NewAutoPortListenerSource().GetListener()
	c.Lock()
	defer c.Unlock()
	c.listener = listener
	return listener, address, err
}

func (c *capturingListenerSource) kill() {
	c.Lock()
	defer c.Unlock()
	_ = c.listener.Close()
}

// A server whose listener died underneath it still counts as running, so the
// manager rebinds it with Stop and then Start.
func TestSrvStopStartAfterListenerDies(t *testing.T) {
	source := &capturingListenerSource{}
	srv := NewSrv(logger.NewTestLogger(t), source)
	client := &http.Client{Transport: &http.Transport{DisableKeepAlives: true}}
	get := func() error {
		addr, err := srv.Addr()
		if err != nil {
			return err
		}
		resp, err := client.Get(fmt.Sprintf("http://%s/test", addr))
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		out, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		if string(out) != "success" {
			return fmt.Errorf("unexpected body %q", out)
		}
		return nil
	}
	register := func(mux *http.ServeMux) {
		mux.HandleFunc("/test", func(resp http.ResponseWriter, req *http.Request) {
			fmt.Fprintf(resp, "success")
		})
	}

	require.NoError(t, srv.StartWithHandlers(register))
	require.NoError(t, get())

	source.kill()
	require.Error(t, get())
	<-srv.Stop()
	require.NoError(t, srv.StartWithHandlers(register))
	require.NoError(t, get())
	<-srv.Stop()
	require.False(t, srv.Active())
}
