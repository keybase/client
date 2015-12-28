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
	log        logger.Logger
	runMode    libkb.RunMode
	defaultURI string
}

func NewRemoteUpdateSource(log logger.Logger, runMode libkb.RunMode, defaultURI string) RemoteUpdateSource {
	return RemoteUpdateSource{
		log:        log,
		runMode:    runMode,
		defaultURI: defaultURI,
	}
}

func (k RemoteUpdateSource) Description() string {
	return fmt.Sprintf("Remote (%s)", k.defaultURI)
}

func (k RemoteUpdateSource) FindUpdate(options keybase1.UpdateOptions) (update *keybase1.Update, err error) {
	sourceURL := ""
	if options.URL != "" {
		sourceURL = options.URL
	} else if k.defaultURI != "" {
		sourceURL = fmt.Sprintf("%s/update-%s-%s.json", k.defaultURI, options.Platform, string(k.runMode))
	}
	if sourceURL == "" {
		err = fmt.Errorf("No source URL for remote")
		return
	}
	req, err := http.NewRequest("GET", sourceURL, nil)
	client := &http.Client{}
	k.log.Info("Request %#v", sourceURL)
	resp, err := client.Do(req)
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		return
	}

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("Updater remote returned bad status %v", resp.Status)
		return
	}

	var r io.Reader = resp.Body
	var obj keybase1.Update
	if err = json.NewDecoder(r).Decode(&obj); err != nil {
		err = fmt.Errorf("Bad updater remote response %s", err)
		return
	}
	update = &obj

	k.log.Debug("Received update %#v", update)

	return
}
