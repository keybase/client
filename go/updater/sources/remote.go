// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
)

// RemoteUpdateSource finds releases/updates from custom url feed (used primarily for testing)
type RemoteUpdateSource struct {
	defaultURI string
	log        Log
}

// NewRemoteUpdateSource builds remote update source without defaults. The url used is passed
// via options instead.
func NewRemoteUpdateSource(defaultURI string, log Log) RemoteUpdateSource {
	return RemoteUpdateSource{
		defaultURI: defaultURI,
		log:        log,
	}
}

// Description returns update source description
func (r RemoteUpdateSource) Description() string {
	return "Remote"
}

func (r RemoteUpdateSource) sourceURL(options updater.UpdateOptions) string {
	params := util.JoinPredicate([]string{options.Platform, options.Env, options.Channel}, "-", func(s string) bool { return s != "" })
	url := options.URL
	if url == "" {
		url = r.defaultURI
	}
	if params == "" {
		return fmt.Sprintf("%s/update.json", url)
	}
	return fmt.Sprintf("%s/update-%s.json", url, params)
}

// FindUpdate returns update for options
func (r RemoteUpdateSource) FindUpdate(options updater.UpdateOptions) (*updater.Update, error) {
	sourceURL := r.sourceURL(options)
	req, err := http.NewRequest("GET", sourceURL, nil)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Timeout: time.Minute,
	}
	r.log.Infof("Request %#v", sourceURL)
	resp, err := client.Do(req)
	defer util.DiscardAndCloseBodyIgnoreError(resp)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Updater remote returned bad status %v", resp.Status)
		return nil, err
	}

	var reader io.Reader = resp.Body
	var update updater.Update
	if err = json.NewDecoder(reader).Decode(&update); err != nil {
		return nil, fmt.Errorf("Bad updater remote response %s", err)
	}

	r.log.Debugf("Received update response: %#v", update)
	return &update, nil
}
