// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"sync"
	"time"

	"github.com/keybase/client/go/invitefriends"
	"github.com/keybase/client/go/libkb"
)

var InviteFriendsPollBackgroundSettings = BackgroundTaskSettings{
	Start:                         5 * time.Second,
	MobileForegroundStartAddition: 30 * time.Second,
	StartStagger:                  5 * time.Second,
	WakeUp:                        15 * time.Second,
	Interval:                      1 * time.Hour,
	Limit:                         5 * time.Minute,
}

type InviteFriendsPollBackground struct {
	libkb.Contextified
	sync.Mutex

	task *BackgroundTask
}

func NewInviteFriendsPollBackground(g *libkb.GlobalContext) *InviteFriendsPollBackground {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "InviteFriendsPollBackground",
		F:        InviteFriendsPollBackgroundRound,
		Settings: InviteFriendsPollBackgroundSettings,
	})
	return &InviteFriendsPollBackground{
		Contextified: libkb.NewContextified(g),
		// Install the task early so that Shutdown can be called before RunEngine.
		task: task,
	}
}

func (e *InviteFriendsPollBackground) Name() string {
	return "InviteFriendsPollBackground"
}

func (e *InviteFriendsPollBackground) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *InviteFriendsPollBackground) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

func (e *InviteFriendsPollBackground) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *InviteFriendsPollBackground) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *InviteFriendsPollBackground) Shutdown() {
	e.task.Shutdown()
}

func InviteFriendsPollBackgroundRound(mctx libkb.MetaContext) error {
	counts, err := invitefriends.GetCounts(mctx)
	if err != nil {
		return err
	}
	mctx.G().NotifyRouter.HandleUpdateInviteCounts(mctx.Ctx(), counts)
	return nil
}
