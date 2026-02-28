// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package updater

import "time"

const DefaultTickDuration = time.Hour

// UpdateChecker runs updates checks every check duration
type UpdateChecker struct {
	updater      *Updater
	ctx          Context
	ticker       *time.Ticker
	log          Log
	tickDuration time.Duration // tickDuration is the ticker delay
	count        int           // count is number of times we've checked
}

// NewUpdateChecker creates an update checker
func NewUpdateChecker(updater *Updater, ctx Context, tickDuration time.Duration, log Log) UpdateChecker {
	return UpdateChecker{
		updater:      updater,
		ctx:          ctx,
		log:          log,
		tickDuration: tickDuration,
	}
}

func (u *UpdateChecker) check() error {
	u.count++
	update, err := u.updater.Update(u.ctx)
	u.ctx.AfterUpdateCheck(update)
	return err
}

// Check checks for an update.
func (u *UpdateChecker) Check() {
	u.updater.config.SetLastUpdateCheckTime()
	if err := u.check(); err != nil {
		u.log.Errorf("Error in update: %s", err)
	}
}

// Start starts the update checker. Returns false if we are already running.
func (u *UpdateChecker) Start() bool {
	if u.ticker != nil {
		return false
	}
	u.ticker = time.NewTicker(u.tickDuration)
	go func() {
		// If we haven't done an update recently, check now.
		// If there is an error getting the last update time, we don't trigger a
		// check and let the ticker below trigger it.
		if !u.updater.config.IsLastUpdateCheckTimeRecent(u.tickDuration) {
			u.Check()
		}

		u.log.Debugf("Starting (ticker %s)", u.tickDuration)
		for range u.ticker.C {
			u.log.Debugf("%s", "Checking for update (ticker)")
			u.Check()
		}
	}()
	return true
}

// Stop stops the update checker
func (u *UpdateChecker) Stop() {
	if u.ticker != nil {
		u.ticker.Stop()
		u.ticker = nil
	}
}

// Count is number of times the check has been called
func (u UpdateChecker) Count() int {
	return u.count
}
