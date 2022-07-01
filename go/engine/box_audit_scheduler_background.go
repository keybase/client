// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var BoxAuditSchedulerBackgroundSettings = BackgroundTaskSettings{
	Start:        2 * time.Minute,
	StartStagger: 2 * time.Minute,
	WakeUp:       1 * time.Minute,
	Interval:     27 * time.Hour,
	Limit:        15 * time.Minute,
}

type BoxAuditSchedulerBackground struct {
	libkb.Contextified
	sync.Mutex

	task *BackgroundTask
}

func NewBoxAuditSchedulerBackground(g *libkb.GlobalContext) *BoxAuditSchedulerBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "BoxAuditSchedulerBackground",
		F:        BoxAuditSchedulerBackgroundRound,
		Settings: BoxAuditSchedulerBackgroundSettings,
	})
	return &BoxAuditSchedulerBackground{
		Contextified: libkb.NewContextified(g),
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

func (e *BoxAuditSchedulerBackground) Name() string {
	return "BoxAuditSchedulerBackground"
}

func (e *BoxAuditSchedulerBackground) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *BoxAuditSchedulerBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *BoxAuditSchedulerBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *BoxAuditSchedulerBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *BoxAuditSchedulerBackground) Shutdown() {
	e.task.Shutdown()
}

func BoxAuditSchedulerBackgroundRound(mctx libkb.MetaContext) error {
	g := mctx.G()
	if !g.ActiveDevice.Valid() {
		mctx.Debug("BoxAuditSchedulerBackgroundRound; not logged in")
		return nil
	}

	_, err := g.GetTeamBoxAuditor().BoxAuditRandomTeam(mctx)
	return err
}
