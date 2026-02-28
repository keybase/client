// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package sources

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/util"
)

// LocalUpdateSource finds releases/updates from a path (used primarily for testing)
type LocalUpdateSource struct {
	path     string
	jsonPath string
	log      Log
}

// NewLocalUpdateSource returns local update source
func NewLocalUpdateSource(path string, jsonPath string, log Log) LocalUpdateSource {
	return LocalUpdateSource{
		path:     path,
		jsonPath: jsonPath,
		log:      log,
	}
}

// Description is local update source description
func (k LocalUpdateSource) Description() string {
	return "Local"
}

// FindUpdate returns update for options
func (k LocalUpdateSource) FindUpdate(_ updater.UpdateOptions) (*updater.Update, error) {
	jsonFile, err := os.Open(k.jsonPath)
	defer util.Close(jsonFile)
	if err != nil {
		return nil, err
	}

	var update updater.Update
	if err := json.NewDecoder(jsonFile).Decode(&update); err != nil {
		return nil, fmt.Errorf("Invalid update JSON: %s", err)
	}

	update.Asset.URL = fmt.Sprintf("file://%s", k.path)
	// TODO: Only do if version is newer or forced (this source is used for testing, so ok to hardcode NeedUpdate)
	update.NeedUpdate = true
	k.log.Debugf("Returning update: %#v", update)
	return &update, nil
}
