// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type testAPIServer struct {
	server      *httptest.Server
	lastRequest *http.Request
}

func (t testAPIServer) shutdown() {
	t.server.Close()
}

func newTestAPIServer(t *testing.T, jsonString string) *testAPIServer {
	apiServer := &testAPIServer{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		apiServer.lastRequest = req

		buf := bytes.NewBuffer([]byte(jsonString))
		w.Header().Set("Content-Type", "application/json")
		_, err := io.Copy(w, buf)
		if err != nil {
			t.Errorf("failed to write test response: %v", err)
		}
	}))

	apiServer.server = server
	return apiServer
}

const updateJSONResponse = `{
		"version": "1.0.15-20160414190014+fdfce90",
		"name": "v1.0.15-20160414190014+fdfce90",
		"installId": "deadbeef",
		"description": "This is an update!",
		"type": 0,
		"publishedAt": 1460660414000,
		"asset": {
			"name": "Keybase-1.0.15-20160414190014+fdfce90.zip",
			"url": "https://prerelease.keybase.io/darwin-updates/Keybase-1.0.15-20160414190014%2Bfdfce90.zip",
			"digest": "65675b91d0a05f98fcfb44c260f1f6e2c5ba6d6c9d37c84f873c75b65be7d9c4",
			"signature": "BEGIN KEYBASE SALTPACK DETACHED SIGNATURE. kXR7VktZdyH7rvq v5wcIkPOwDJ1n11 M8RnkLKQGO2f3Bb fzCeMYz4S6oxLAy Cco4N255JFgnUxK yZ7SITOx8887cOR aeLbQGWBTMZWEQR hL6bhOCR8CqdXaQ 71lCQkT4WsnqAZe 7bbU2Xrsl50sLbJ BN19a9r6bQBYjce gfK0xY0064VY6CW 9. END KEYBASE SALTPACK DETACHED SIGNATURE.\n",
			"localPath": ""
		}
	}`

func TestUpdateSource(t *testing.T) {
	server := newServer(updateJSONResponse)
	defer server.Close()

	cfg, _ := testConfig(t)
	updateSource := newUpdateSource(cfg, server.URL, testLog)
	update, err := updateSource.FindUpdate(testOptions)
	require.NoError(t, err)
	require.NotNil(t, update)
	assert.Equal(t, "1.0.15-20160414190014+fdfce90", update.Version)
	assert.Equal(t, "v1.0.15-20160414190014+fdfce90", update.Name)
	assert.Equal(t, "deadbeef", update.InstallID)
	assert.Equal(t, "This is an update!", update.Description)
	assert.Equal(t, 1460660414000, update.PublishedAt)
	assert.Equal(t, "Keybase-1.0.15-20160414190014+fdfce90.zip", update.Asset.Name)
	assert.Equal(t, "https://prerelease.keybase.io/darwin-updates/Keybase-1.0.15-20160414190014%2Bfdfce90.zip", update.Asset.URL)
}

func TestUpdateSourceBadResponse(t *testing.T) {
	server := newServerForError(fmt.Errorf("Bad response"))
	defer server.Close()

	cfg, _ := testConfig(t)
	updateSource := newUpdateSource(cfg, server.URL, testLog)
	update, err := updateSource.FindUpdate(testOptions)
	require.EqualError(t, err, "Find update returned bad HTTP status 500 Internal Server Error")
	assert.Nil(t, update, "Shouldn't have update")
}

func TestUpdateSourceTimeout(t *testing.T) {
	server := newServerWithDelay(updateJSONResponse, 5*time.Millisecond)
	defer server.Close()

	cfg, _ := testConfig(t)
	updateSource := newUpdateSource(cfg, server.URL, testLog)
	update, err := updateSource.findUpdate(testOptions, 2*time.Millisecond)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded", err.Error())
	assert.Nil(t, update)
}

func TestUpdateSourceRequest(t *testing.T) {
	testAPIServer := newTestAPIServer(t, updateJSONResponse)
	defer testAPIServer.shutdown()

	cfg, _ := testConfig(t)
	updateSource := newUpdateSource(cfg, testAPIServer.server.URL, testLog)

	options := updater.UpdateOptions{
		Version:        "1.2.3-400+abcdef",
		Platform:       "platform",
		Channel:        "channel",
		Env:            "env",
		Arch:           "arch",
		Force:          true,
		OSVersion:      "100.1",
		UpdaterVersion: "200.2",
	}

	// Request update
	update, err := updateSource.FindUpdate(options)
	require.NoError(t, err)
	require.NotNil(t, testAPIServer.lastRequest)
	require.Equal(t, "/?arch=arch&auto_update=0&ignore_snooze=0&install_id=&os_version=100.1&platform=platform&run_mode=env&upd_version=200.2&version=1.2.3-400%2Babcdef", testAPIServer.lastRequest.RequestURI)

	// Change install ID and auto update
	require.Equal(t, "deadbeef", update.InstallID)
	err = cfg.SetInstallID(update.InstallID)
	require.NoError(t, err)
	err = cfg.SetUpdateAuto(true)
	require.NoError(t, err)

	// Request again and double check install ID and auto update param changed
	_, err = updateSource.FindUpdate(options)
	require.NoError(t, err)
	require.NotNil(t, testAPIServer.lastRequest)
	assert.Equal(t, "/?arch=arch&auto_update=1&ignore_snooze=0&install_id=deadbeef&os_version=100.1&platform=platform&run_mode=env&upd_version=200.2&version=1.2.3-400%2Babcdef", testAPIServer.lastRequest.RequestURI)
}
