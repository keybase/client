// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package keybase

import "github.com/keybase/client/go/libkb"

type ui struct {
	ctx *libkb.GlobalContext
}

func newUI(kbCtx *libkb.GlobalContext) *ui {
	return &ui{ctx: kbCtx}
}

func (u ui) secretUI(sessionID int) libkb.SecretUI {
	secretUI, err := u.ctx.UIRouter.GetSecretUI(sessionID)
	if err != nil {
		u.ctx.Log.Errorf("Error getting secret UI: %s", err)
	}
	return secretUI
}

func (u ui) identifyUI() libkb.IdentifyUI {
	identifyUI, err := u.ctx.UIRouter.GetIdentifyUI()
	if err != nil {
		u.ctx.Log.Errorf("Error getting identify UI: %s", err)
	}
	if identifyUI == nil {
		u.ctx.Log.Error("No identify UI, using auto confirming one for debugging")
		// Only used for debugging until we implement identify in React-Native
		return autoIdentifyUI{}
	}
	return identifyUI
}

func (u ui) logUI() libkb.LogUI {
	if u.ctx.UI == nil {
		u.ctx.Log.Error("No log UI")
		return nil
	}
	return u.ctx.UI.GetLogUI()
}
