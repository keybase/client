// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
)

type updateResponse struct {
	Status libkb.AppStatus `json:"status"`
	Update keybase1.Update `codec:"update" json:"update"`
}

func (k *updateResponse) GetAppStatus() *libkb.AppStatus {
	return &k.Status
}

// KeybaseUpdateSource finds releases/updates from custom url (used primarily for testing)
type KeybaseUpdateSource struct {
	log            logger.Logger
	api            libkb.API
	runMode        libkb.RunMode
	defaultChannel string
	legacyID       string
}

func NewKeybaseUpdateSource(log logger.Logger, api libkb.API, runMode libkb.RunMode, defaultChannel string) KeybaseUpdateSource {
	legacyID, _ := libkb.RandString("", 20)
	return KeybaseUpdateSource{
		log:            log,
		api:            api,
		runMode:        runMode,
		defaultChannel: defaultChannel,
		legacyID:       legacyID,
	}
}

func (k KeybaseUpdateSource) Description() string {
	return "Keybase"
}

func (k KeybaseUpdateSource) FindUpdate(options keybase1.UpdateOptions) (*keybase1.Update, error) {
	channel := k.defaultChannel
	if options.Channel != "" {
		channel = options.Channel
	}

	u, err := url.Parse("https://keybase.io/_/api/1.0/pkg/update_legacy.json")
	if err != nil {
		return nil, err
	}

	urlValues := url.Values{}
	urlValues.Add("legacy_id", k.legacyID)
	urlValues.Add("version", options.Version)
	urlValues.Add("platform", options.Platform)
	urlValues.Add("run_mode", string(k.runMode))
	urlValues.Add("channel", channel)
	u.RawQuery = urlValues.Encode()
	urlString := u.String()

	req, err := http.NewRequest("GET", urlString, nil)
	if err != nil {
		return nil, err
	}
	client := http.Client{
		Timeout: time.Minute,
	}
	k.log.Info("Request %#v", urlString)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer libkb.DiscardAndCloseBody(resp)

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Find update returned bad HTTP status %v", resp.Status)
	}

	var reader io.Reader = resp.Body
	var update keybase1.Update
	if err = json.NewDecoder(reader).Decode(&update); err != nil {
		return nil, fmt.Errorf("Invalid API response %s", err)
	}

	k.log.Debug("Received update response: %#v", update)

	return &update, nil
}
