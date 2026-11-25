// Copyright 2026 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
)

// importContactsPath is the GUI config key for username's contact import
// setting; its shape must match the key libkb's config migration writes. It
// fails unless username is the logged-in user, so a request made for one
// account is never applied to the account that replaced it.
func importContactsPath(mctx libkb.MetaContext, username string) (*libkb.JSONFile, string, error) {
	active := mctx.ActiveDevice().Username(mctx)
	if active.IsNil() {
		return nil, "", libkb.LoginRequiredError{}
	}
	requested := libkb.NewNormalizedUsername(username)
	if !active.Eq(requested) {
		return nil, "", libkb.LoginRequiredError{Context: fmt.Sprintf("%q is not the logged-in user", username)}
	}
	guiConfig := mctx.G().Env.GetGUIConfig()
	if guiConfig == nil {
		return nil, "", errors.New("GUI config is not loaded")
	}
	return guiConfig, fmt.Sprintf("ui.importContacts.%s", requested), nil
}

func ImportContactsEnabled(mctx libkb.MetaContext, username string) (bool, error) {
	guiConfig, path, err := importContactsPath(mctx, username)
	if err != nil {
		return false, err
	}
	enabled, _ := guiConfig.GetBoolAtPath(path)
	return enabled, nil
}

func SetImportContactsEnabled(mctx libkb.MetaContext, username string, enabled bool) error {
	guiConfig, path, err := importContactsPath(mctx, username)
	if err != nil {
		return err
	}
	return guiConfig.SetBoolAtPath(path, enabled)
}
