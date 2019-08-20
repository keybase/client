// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
)

var ContactSyncBackgroundSettings = BackgroundTaskSettings{
	Start:        2 * time.Minute,
	StartStagger: 2 * time.Minute,
	WakeUp:       1 * time.Minute,
	Interval:     8 * time.Hour,
	Limit:        3 * time.Minute,
}

type ContactSyncBackground struct {
	libkb.Contextified
	sync.Mutex

	task *BackgroundTask
}

func NewContactSyncBackground(g *libkb.GlobalContext) *ContactSyncBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "ContactSyncBackground",
		F:        ContactSyncBackgroundRound,
		Settings: ContactSyncBackgroundSettings,
	})
	return &ContactSyncBackground{
		Contextified: libkb.NewContextified(g),
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

func (e *ContactSyncBackground) Name() string {
	return "ContactSyncBackground"
}

func (e *ContactSyncBackground) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *ContactSyncBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *ContactSyncBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *ContactSyncBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *ContactSyncBackground) Shutdown() {
	e.task.Shutdown()
}

func ContactSyncBackgroundRound(mctx libkb.MetaContext) error {
	g := mctx.G()
	if !g.ActiveDevice.Valid() {
		mctx.Debug("ContactSyncBackgroundRound; not logged in")
		return nil
	}

	if mctx.G().IsMobileAppType() {
		netState := mctx.G().MobileNetState.State()
		if netState.IsLimited() {
			mctx.Debug("ContactSyncBackgroundRound: not running; network state: %v", netState)
			return nil
		}
	}

	ui, err := mctx.G().UIRouter.GetChatUI()
	if err != nil || ui == nil {
		mctx.Debug("ContactSyncBackgroundRound: no chat UI found; err: %s", err)
		return nil
	}

	return ui.TriggerContactSync(mctx.Ctx())
}
