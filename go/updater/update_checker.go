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
	updater       *Updater
	ctx           Context
	ticker        *time.Ticker
	log           logger.Logger
	tickDuration  time.Duration // tickDuration is the ticker delay
	checkDuration time.Duration // checkDuration is how ofter to check for updates
	count         int           // count is number of time we've checked
}

// NewUpdateChecker creates an update checker
func NewUpdateChecker(updater *Updater, ctx Context, log logger.Logger) UpdateChecker {
	return newUpdateChecker(updater, ctx, log, DefaultTickDuration(), DefaultCheckDuration())
}

func newUpdateChecker(updater *Updater, ctx Context, log logger.Logger, tickDuration time.Duration, checkDuration time.Duration) UpdateChecker {
	return UpdateChecker{
		updater:       updater,
		ctx:           ctx,
		log:           log,
		tickDuration:  tickDuration,
		checkDuration: checkDuration,
	}
}

// Check checks for an update. If not requested (by user) and not forced it will
// exit early if check has already been applied within checkDuration().
func (u *UpdateChecker) Check(force bool, requested bool) error {
	if !requested && !force {
		if lastCheckedPTime := u.updater.config.GetUpdateLastChecked(); lastCheckedPTime > 0 {
			lastChecked := keybase1.FromTime(lastCheckedPTime)
			if time.Now().Before(lastChecked.Add(u.checkDuration)) {
				u.log.Debug("Already checked: %s", lastChecked)
				return nil
			}
		}
	}

	checkTime := time.Now()
	u.count++
	_, err := u.updater.Update(u.ctx, force, requested)
	if err != nil {
		return err
	}

	u.log.Debug("Saving updater last checked: %s", checkTime)
	u.updater.config.SetUpdateLastChecked(keybase1.ToTime(checkTime))
	return nil
}

// Start starts the update checker
func (u *UpdateChecker) Start() {
	if u.ticker != nil {
		return
	}
	u.ticker = time.NewTicker(u.tickDuration)
	go func() {
		for _ = range u.ticker.C {
			go func() {
				u.log.Debug("Checking for update (ticker)")
				err := u.Check(false, false)
				if err != nil {
					u.log.Errorf("Error in update: %s", err)
				}
			}()
		}
	}()
}

// Stop stops the update checker
func (u *UpdateChecker) Stop() {
	u.ticker.Stop()
	u.ticker = nil
}

// Count is number of times the check has been called
func (u UpdateChecker) Count() int {
	return u.count
}

// DefaultCheckDuration is default for how often to check for updates (e.g. daily)
func DefaultCheckDuration() time.Duration {
	if sources.IsPrerelease {
		return time.Hour
	}
	return 24 * time.Hour
}

// DefaultTickDuration is how often to call check (should be less than checkDuration or snooze min)
func DefaultTickDuration() time.Duration {
	if sources.IsPrerelease {
		return 15 * time.Minute
	}
	return time.Hour
}
