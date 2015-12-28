// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"time"
)

type UpdateChecker struct {
	updater Updater
	ticker  *time.Ticker
}

var UpdateCheckDuration = (24 * time.Hour)

func NewUpdateChecker(updater Updater) UpdateChecker {
	return UpdateChecker{
		updater: updater,
	}
}

func (u *UpdateChecker) Check(force bool, requested bool) error {
	ui, _ := u.updater.G().UIRouter.GetUpdateUI()
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
			u.updater.G().Log.Info("Checking for update (ticker)")
			u.Check(false, false)
		}
	}()
}

func (u *UpdateChecker) Stop() {
	u.ticker.Stop()
	u.ticker = nil
}
