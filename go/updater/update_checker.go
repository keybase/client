// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import (
	"time"

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

func NewUpdateChecker(updater *Updater, ui UI, log logger.Logger) UpdateChecker {
	return UpdateChecker{
		updater: updater,
		ui:      ui,
		log:     log,
	}
}

func (u *UpdateChecker) check(force bool, requested bool) error {
	updateStart := time.Now()
	_, err := u.updater.Update(u.ui, force, requested)
	updateEnd := time.Now()
	if err != nil {
		return err
	}

	// Because updates might have been single-flighted, an update could have been
	// made available while the update prompt was showing. For example, if the
	// update prompt showed at 3am on Saturday morning and the person came back
	// Monday, they could have missed an update that happened in the meantime.
	// A quick fix for this situation is to run the updater check again if the
	// update took along time.
	if updateEnd.Sub(updateStart) > time.Minute*15 {
		u.log.Info("Update took a long time to run, so let's check again")
		return u.check(force, requested)
	}
	return nil
}

// Check checks for an update. If not requested (by user) or forced it will
// exit early if check has already been applied within checkDuration().
func (u *UpdateChecker) Check(force bool, requested bool) error {
	if !requested && !force {
		if lastCheckedPTime := u.updater.config.GetUpdateLastChecked(); lastCheckedPTime > 0 {
			lastChecked := keybase1.FromTime(lastCheckedPTime)
			if time.Now().Before(lastChecked.Add(checkDuration())) {
				u.log.Debug("Already checked: %s", lastChecked)
				return nil
			}
		}
	}

	checkTime := time.Now()
	// This may block awhile if the updater prompt is left shown for a long time
	err := u.check(force, requested)
	if err != nil {
		return err
	}

	u.log.Debug("Saving updater last checked: %s", checkTime)
	u.updater.config.SetUpdateLastChecked(keybase1.ToTime(checkTime))
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
			err := u.Check(false, false)
			if err != nil {
				u.log.Errorf("Error in update: %s", err)
			}
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
