// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
)

type UpdateChecker struct {
	updater Updater
	ui      UI
	ticker  *time.Ticker
	log     logger.Logger
}

type UI interface {
	GetUpdateUI() (libkb.UpdateUI, error)
}

var UpdateCheckDuration = (24 * time.Hour)

func NewUpdateChecker(updater Updater, ui UI, log logger.Logger) UpdateChecker {
	return UpdateChecker{
		updater: updater,
		ui:      ui,
		log:     log,
	}
}

func (u *UpdateChecker) Check(force bool, requested bool) error {
	ui, _ := u.ui.GetUpdateUI()
	if ui == nil && !force {
		return fmt.Errorf("No UI for update check")
	}
	_, err := u.updater.Update(ui, force, requested)
	if err != nil {
		return err
	}
	return nil
}

func (u *UpdateChecker) Start() {
	if u.ticker != nil {
		return
	}
	u.ticker = time.NewTicker(UpdateCheckDuration)
	go func() {
		for _ = range u.ticker.C {
			u.log.Info("Checking for update (ticker)")
			u.Check(false, false)
		}
	}()
}

func (u *UpdateChecker) Stop() {
	u.ticker.Stop()
	u.ticker = nil
}
