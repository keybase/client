// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/updater/sources"
)

type UpdateChecker struct {
	updater *Updater
	ui      UI
	ticker  *time.Ticker
	log     logger.Logger
}

type UI interface {
	GetUpdateUI() (libkb.UpdateUI, error)
}

func NewUpdateChecker(updater *Updater, ui UI, log logger.Logger) UpdateChecker {
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

	if !requested && !force {
		if lastCheckedPTime := u.updater.config.GetUpdateLastChecked(); lastCheckedPTime > 0 {
			lastChecked := keybase1.FromTime(lastCheckedPTime)
			if time.Now().Before(lastChecked.Add(checkDuration())) {
				u.log.Debug("Already checked: %s", lastChecked)
				return nil
			}
		}
	}

	_, err := u.updater.Update(ui, force, requested)
	if err != nil {
		return err
	}
	u.log.Debug("Updater checked")
	u.updater.config.SetUpdateLastChecked(keybase1.ToTime(time.Now()))
	return nil
}

func (u *UpdateChecker) Start() {
	if u.ticker != nil {
		return
	}
	u.ticker = time.NewTicker(tickDuration())
	go func() {
		for _ = range u.ticker.C {
			u.log.Debug("Checking for update (ticker)")
			u.Check(false, false)
		}
	}()
}

func (u *UpdateChecker) Stop() {
	u.ticker.Stop()
	u.ticker = nil
}

// checkDuration is how often to check for updates
func checkDuration() time.Duration {
	if sources.IsPrerelease {
		return time.Hour
	}
	return 24 * time.Hour
}

// tickDuration is how often to call check (should be less than checkDuration or snooze min)
func tickDuration() time.Duration {
	if sources.IsPrerelease {
		return 15 * time.Minute
	}
	return time.Hour
}
