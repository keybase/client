// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoteUpdateSource(t *testing.T) {
	_, filename, _, _ := runtime.Caller(0)
	jsonPath := filepath.Join(filepath.Dir(filename), "../test/update.json")
	data, err := util.ReadFile(jsonPath)
	require.NoError(t, err)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, string(data))
	}))

	local := NewRemoteUpdateSource(server.URL, log)
	assert.Equal(t, local.Description(), "Remote")

	update, err := local.FindUpdate(updater.UpdateOptions{})
	require.NoError(t, err)
	require.NotNil(t, update)
}
