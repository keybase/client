// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// importContactsPath is the GUI config key for the logged-in user's contact
// import setting. The key predates these helpers; libkb's config migration
// writes the same shape.
func importContactsPath(mctx libkb.MetaContext) (*libkb.JSONFile, string, error) {
	username := mctx.ActiveDevice().Username(mctx)
	if username.IsNil() {
		return nil, "", libkb.LoginRequiredError{}
	}
	guiConfig := mctx.G().Env.GetGUIConfig()
	if guiConfig == nil {
		return nil, "", errors.New("GUI config is not loaded")
	}
	return guiConfig, fmt.Sprintf("ui.importContacts.%s", username), nil
}

func ImportContactsEnabled(mctx libkb.MetaContext) (bool, error) {
	guiConfig, path, err := importContactsPath(mctx)
	if err != nil {
		return false, err
	}
	enabled, _ := guiConfig.GetBoolAtPath(path)
	return enabled, nil
}

func SetImportContactsEnabled(mctx libkb.MetaContext, enabled bool) error {
	guiConfig, path, err := importContactsPath(mctx)
	if err != nil {
		return err
	}
	return guiConfig.SetBoolAtPath(path, enabled)
}
