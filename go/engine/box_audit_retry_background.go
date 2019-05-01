// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var BoxAuditRetryBackgroundSettings = BackgroundTaskSettings{
	Start:        2 * time.Minute,
	StartStagger: 1 * time.Minute,
	WakeUp:       1 * time.Minute,
	Interval:     7 * time.Hour,
	Limit:        15 * time.Minute,
}

type BoxAuditRetryBackground struct {
	libkb.Contextified
	sync.Mutex

	task *BackgroundTask
}

func NewBoxAuditRetryBackground(g *libkb.GlobalContext) *BoxAuditRetryBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "BoxAuditRetryBackground",
		F:        BoxAuditRetryBackgroundRound,
		Settings: BoxAuditRetryBackgroundSettings,
	})
	return &BoxAuditRetryBackground{
		Contextified: libkb.NewContextified(g),
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

func (e *BoxAuditRetryBackground) Name() string {
	return "BoxAuditRetryBackground"
}

func (e *BoxAuditRetryBackground) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *BoxAuditRetryBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *BoxAuditRetryBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *BoxAuditRetryBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *BoxAuditRetryBackground) Shutdown() {
	e.task.Shutdown()
}

func BoxAuditRetryBackgroundRound(mctx libkb.MetaContext) error {
	g := mctx.G()
	if !g.ActiveDevice.Valid() {
		mctx.Debug("BoxAuditRetryBackgroundRound; not logged in")
		return nil
	}

	_, err := g.GetTeamBoxAuditor().RetryNextBoxAudit(mctx)
	return err
}
