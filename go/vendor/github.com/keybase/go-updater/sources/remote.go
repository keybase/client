// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

// RemoteUpdateSource finds releases/updates from custom url feed (used primarily for testing)
type RemoteUpdateSource struct {
	log             logger.Logger
	defaultURI      string
	defaultPlatform string
	defaultEnv      string
	defaultChannel  string
}

// NewRemoteUpdateSource builds remote update source without defaults. The url used is passed
// via options instead.
func NewRemoteUpdateSource(log logger.Logger) RemoteUpdateSource {
	return RemoteUpdateSource{
		log: log,
	}
}

// NewRemoteUpdateSourceForOptions builds a remote update source that looks like
//   {defaultURI}/update-{defaultPlatform}-{defaultEnv}-{defaultChannel}.json
//
// For example, for OS X production releases, it might look like
//   https://s3.amazonaws.com/prerelease.keybase.io/update-darwin-prod.json
// Test channel:
//   https://s3.amazonaws.com/prerelease.keybase.io/update-darwin-prod-test.json
func NewRemoteUpdateSourceForOptions(log logger.Logger, defaultURI string, defaultPlatform string, defaultEnv string, defaultChannel string) RemoteUpdateSource {
	return RemoteUpdateSource{
		log:             log,
		defaultURI:      defaultURI,
		defaultPlatform: defaultPlatform,
		defaultEnv:      defaultEnv,
		defaultChannel:  defaultChannel,
	}
}

func (r RemoteUpdateSource) Description() string {
	if r.defaultURI != "" {
		return fmt.Sprintf("Remote (%s)", r.defaultURI)
	}
	return "Remote"
}

func (r RemoteUpdateSource) defaultSourceURL(options keybase1.UpdateOptions) string {
	platform := r.defaultPlatform
	if options.Platform != "" {
		platform = options.Platform
	}

	params := libkb.JoinPredicate([]string{platform, r.defaultEnv, r.defaultChannel}, "-", func(s string) bool { return s != "" })
	return fmt.Sprintf("%s/update-%s.json", r.defaultURI, params)
}

func (r RemoteUpdateSource) FindUpdate(options keybase1.UpdateOptions) (update *keybase1.Update, err error) {
	sourceURL := ""
	if options.URL != "" {
		sourceURL = options.URL
	} else if r.defaultURI != "" {
		sourceURL = r.defaultSourceURL(options)
	}
	if sourceURL == "" {
		err = fmt.Errorf("No source URL for remote")
		return
	}
	req, err := http.NewRequest("GET", sourceURL, nil)
	client := &http.Client{}
	r.log.Info("Request %#v", sourceURL)
	resp, err := client.Do(req)
	if resp != nil {
		defer libkb.DiscardAndCloseBody(resp)
	}
	if err != nil {
		return
	}

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Updater remote returned bad status %v", resp.Status)
		return
	}

	var reader io.Reader = resp.Body
	var obj keybase1.Update
	if err = json.NewDecoder(reader).Decode(&obj); err != nil {
		err = fmt.Errorf("Bad updater remote response %s", err)
		return
	}
	update = &obj

	r.log.Debug("Received update %#v", update)

	return
}
