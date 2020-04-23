// Copyright 2019 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type onlineStatusTracker struct {
	cancel   func()
	config   Config
	onChange func()
	vlog     *libkb.VDebugLog

	lock          sync.RWMutex
	currentStatus keybase1.KbfsOnlineStatus
	userIsLooking map[string]bool

	userIn  chan struct{}
	userOut chan struct{}

	wg *sync.WaitGroup
}

const ostTryingStateTimeout = 4 * time.Second

type ostState int

const (
	_ ostState = iota
	// We are connected to the mdserver, and user is looking at the Fs tab.
	ostOnlineUserIn
	// We are connected to the mdserver, and user is not looking at the Fs tab.
	ostOnlineUserOut
	// User is looking at the Fs tab. We are not connected to the mdserver, but
	// we are showing a "trying" state in GUI. This usually lasts for
	// ostTryingStateTimeout.
	ostTryingUserIn
	// User is not looking at the Fs tab. We are not connected to the mdserver,
	// but we are telling GUI a "trying" state.
	ostTryingUserOut
	// User is looking at the Fs tab. We are disconnected from the mdserver and
	// are telling GUI so.
	ostOfflineUserIn
	// User is not looking at the Fs tab. We are disconnected from the mdserver
	// and are telling GUI so.
	//
	// Note that we can only go to ostOfflineUserOut from ostOfflineUserIn, but
	// not from any other state. This is because when user is out we don't fast
	// forward. Even if user has got good connection, we might still show as
	// offline until user navigates into the Fs tab which triggers a fast
	// forward and get us connected. If we were to show this state, user would
	// see an offline screen flash for a second before actually getting
	// connected every time they come back to the Fs tab with a previous bad
	// (or lack of) connection, or even from backgrounded app.  So instead, in
	// this case we just use the trying state which shows a slim (less
	// invasive) banner saying we are trying to reconnect.  On the other hand,
	// if user has seen the transition into offline, and user has remained
	// disconnected, it'd be weird for them to see a "trying" state every time
	// they switch away and back into the Fs tab. So in this case just keep the
	// offline state, which is what ostOfflineUserOut is for.
	ostOfflineUserOut
)

func (s ostState) String() string {
	switch s {
	case ostOnlineUserIn:
		return "online-userIn"
	case ostOnlineUserOut:
		return "online-userOut"
	case ostTryingUserIn:
		return "trying-userIn"
	case ostTryingUserOut:
		return "trying-userOut"
	case ostOfflineUserIn:
		return "offline-userIn"
	case ostOfflineUserOut:
		return "offline-userOut"
	default:
		panic("unknown state")
	}
}

func (s ostState) getOnlineStatus() keybase1.KbfsOnlineStatus {
	switch s {
	case ostOnlineUserIn:
		return keybase1.KbfsOnlineStatus_ONLINE
	case ostOnlineUserOut:
		return keybase1.KbfsOnlineStatus_ONLINE
	case ostTryingUserIn:
		return keybase1.KbfsOnlineStatus_TRYING
	case ostTryingUserOut:
		return keybase1.KbfsOnlineStatus_TRYING
	case ostOfflineUserIn:
		return keybase1.KbfsOnlineStatus_OFFLINE
	case ostOfflineUserOut:
		return keybase1.KbfsOnlineStatus_OFFLINE
	default:
		panic("unknown state")
	}
}

// ostSideEffect is a type for side effects that happens as a result of
// transitions happening inside the FSM. These side effects describe what
// should happen, but the FSM doesn't directly do them. The caller of outFsm
// should make sure those actions are carried out.
type ostSideEffect int

const (
	// ostResetTimer describes a side effect where the timer for transitioning
	// from a "trying" state into a "offline" state should be reset and
	// started.
	ostResetTimer ostSideEffect = iota
	// ostStopTimer describes a side effect where the timer for transitioning
	// from a "trying" state into a "offline" state should be stopped.
	ostStopTimer
	// ostFastForward describes a side effect where we should fast forward the
	// reconnecting backoff timer and attempt to connect to the mdserver right
	// away.
	ostFastForward
)

func ostFsm(
	ctx context.Context,
	wg *sync.WaitGroup,
	vlog *libkb.VDebugLog,
	initialState ostState,
	// sideEffects carries events about side effects caused by the FSM
	// transitions. Caller should handle these effects and make things actually
	// happen.
	sideEffects chan<- ostSideEffect,
	// onlineStatusUpdates carries a special side effect for the caller to know
	// when the onlineStatus changes.
	onlineStatusUpdates chan<- keybase1.KbfsOnlineStatus,
	// userIn is used to signify the FSM that user has just started looking at
	// the Fs tab.
	userIn <-chan struct{},
	// userOut is used to signify the FSM that user has just switched away from
	// the Fs tab.
	userOut <-chan struct{},
	// tryingTimerUp is used to signify the FSM that the timer for
	// transitioning from a "trying" state to "offline" state is up.
	tryingTimerUp <-chan struct{},
	// connected is used to signify the FSM that we've just connected to the
	// mdserver.
	connected <-chan struct{},
	// disconnected is used to signify the FSM that we've just lost connection to
	// the mdserver.
	disconnected <-chan struct{},
) {
	defer wg.Done()

	select {
	case <-ctx.Done():
		return
	default:
	}
	vlog.CLogf(ctx, libkb.VLog1, "ostFsm initialState=%s", initialState)

	state := initialState
	for {
		previousState := state

		switch state {
		case ostOnlineUserIn:
			select {
			case <-userIn:
			case <-userOut:
				state = ostOnlineUserOut
			case <-tryingTimerUp:
			case <-connected:
			case <-disconnected:
				state = ostTryingUserIn
				sideEffects <- ostFastForward
				sideEffects <- ostResetTimer

			case <-ctx.Done():
				return
			}
		case ostOnlineUserOut:
			select {
			case <-userIn:
				state = ostOnlineUserIn
			case <-userOut:
			case <-tryingTimerUp:
			case <-connected:
			case <-disconnected:
				state = ostTryingUserOut
				// Don't start a timer as we don't want to transition into
				// offline from trying when user is out. See comment for
				// ostOfflineUserOut above.

			case <-ctx.Done():
				return
			}
		case ostTryingUserIn:
			select {
			case <-userIn:
			case <-userOut:
				state = ostTryingUserOut
				// Stop the timer as we don't transition into offline when
				// user is not looking.
				sideEffects <- ostStopTimer
			case <-tryingTimerUp:
				state = ostOfflineUserIn
			case <-connected:
				state = ostOnlineUserIn
			case <-disconnected:

			case <-ctx.Done():
				return
			}
		case ostTryingUserOut:
			select {
			case <-userIn:
				state = ostTryingUserIn
				sideEffects <- ostFastForward
				sideEffects <- ostResetTimer
			case <-userOut:
			case <-tryingTimerUp:
				// Don't transition into ostOfflineUserOut. See comment for
				// offlienUserOut above.
			case <-connected:
				state = ostOnlineUserOut
			case <-disconnected:

			case <-ctx.Done():
				return
			}
		case ostOfflineUserIn:
			select {
			case <-userIn:
			case <-userOut:
				state = ostOfflineUserOut
			case <-tryingTimerUp:
			case <-connected:
				state = ostOnlineUserIn
			case <-disconnected:

			case <-ctx.Done():
				return
			}
		case ostOfflineUserOut:
			select {
			case <-userIn:
				state = ostOfflineUserIn
				// Trigger fast forward but don't transition into "trying", to
				// avoid flip-flopping.
				sideEffects <- ostFastForward
			case <-userOut:
			case <-tryingTimerUp:
			case <-connected:
				state = ostOnlineUserOut
			case <-disconnected:

			case <-ctx.Done():
				return
			}

		}

		if previousState != state {
			vlog.CLogf(ctx, libkb.VLog1, "ostFsm state=%s", state)
			onlineStatus := state.getOnlineStatus()
			if previousState.getOnlineStatus() != onlineStatus {
				select {
				case onlineStatusUpdates <- onlineStatus:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

func (ost *onlineStatusTracker) updateOnlineStatus(onlineStatus keybase1.KbfsOnlineStatus) {
	ost.lock.Lock()
	ost.currentStatus = onlineStatus
	ost.lock.Unlock()
	ost.onChange()
}

func (ost *onlineStatusTracker) run(ctx context.Context) {
	defer ost.wg.Done()

	for ost.config.KBFSOps() == nil {
		time.Sleep(100 * time.Millisecond)
	}

	tryingStateTimer := time.NewTimer(time.Hour)
	tryingStateTimer.Stop()

	sideEffects := make(chan ostSideEffect)
	onlineStatusUpdates := make(chan keybase1.KbfsOnlineStatus)
	tryingTimerUp := make(chan struct{})
	connected := make(chan struct{})
	disconnected := make(chan struct{})

	serviceErrors, invalidateChan := ost.config.KBFSOps().
		StatusOfServices()

	initialState := ostOfflineUserOut
	if serviceErrors[MDServiceName] == nil {
		initialState = ostOnlineUserOut
	}

	ost.wg.Add(1)
	go ostFsm(ctx, ost.wg, ost.vlog,
		initialState, sideEffects, onlineStatusUpdates,
		ost.userIn, ost.userOut, tryingTimerUp, connected, disconnected)

	ost.wg.Add(1)
	// mdserver connection status watch routine
	go func() {
		defer ost.wg.Done()
		invalidateChan := invalidateChan
		var serviceErrors map[string]error
		for {
			select {
			case <-invalidateChan:
				serviceErrors, invalidateChan = ost.config.KBFSOps().
					StatusOfServices()
				if serviceErrors[MDServiceName] == nil {
					connected <- struct{}{}
				} else {
					disconnected <- struct{}{}
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	for {
		select {
		case <-tryingStateTimer.C:
			tryingTimerUp <- struct{}{}
		case sideEffect := <-sideEffects:
			switch sideEffect {
			case ostResetTimer:
				if !tryingStateTimer.Stop() {
					select {
					case <-tryingStateTimer.C:
					default:
					}
				}
				tryingStateTimer.Reset(ostTryingStateTimeout)
			case ostStopTimer:
				if !tryingStateTimer.Stop() {
					<-tryingStateTimer.C
					select {
					case <-tryingStateTimer.C:
					default:
					}
				}
			case ostFastForward:
				// This requires holding a lock and may block sometimes.
				go ost.config.MDServer().FastForwardBackoff()
			default:
				panic(fmt.Sprintf("unknown side effect %d", sideEffect))
			}
		case onlineStatus := <-onlineStatusUpdates:
			ost.updateOnlineStatus(onlineStatus)
			ost.vlog.CLogf(ctx, libkb.VLog1, "ost onlineStatus=%d", onlineStatus)
		case <-ctx.Done():
			return
		}
	}
}

// TODO: we now have clientID in the subscriptionManager so it's not necessary
// anymore for onlineStatusTracker to track it.

func (ost *onlineStatusTracker) userInOut(clientID string, clientIsIn bool) {
	ost.lock.Lock()
	wasIn := len(ost.userIsLooking) != 0
	if clientIsIn {
		ost.userIsLooking[clientID] = true
	} else {
		delete(ost.userIsLooking, clientID)
	}
	isIn := len(ost.userIsLooking) != 0
	ost.lock.Unlock()

	if wasIn && !isIn {
		ost.userOut <- struct{}{}
	}

	if !wasIn && isIn {
		ost.userIn <- struct{}{}
	}
}

// UserIn tells the onlineStatusTracker that user is looking at the Fs tab in
// GUI. When user is looking at the Fs tab, the underlying RPC fast forwards
// any backoff timer for reconnecting to the mdserver.
func (ost *onlineStatusTracker) UserIn(ctx context.Context, clientID string) {
	ost.userInOut(clientID, true)
	ost.vlog.CLogf(ctx, libkb.VLog1, "UserIn clientID=%s", clientID)
}

// UserOut tells the onlineStatusTracker that user is not looking at the Fs
// tab in GUI anymore.  GUI.
func (ost *onlineStatusTracker) UserOut(ctx context.Context, clientID string) {
	ost.userInOut(clientID, false)
	ost.vlog.CLogf(ctx, libkb.VLog1, "UserOut clientID=%s", clientID)
}

// GetOnlineStatus implements the OnlineStatusTracker interface.
func (ost *onlineStatusTracker) GetOnlineStatus() keybase1.KbfsOnlineStatus {
	ost.lock.RLock()
	defer ost.lock.RUnlock()
	return ost.currentStatus
}

func newOnlineStatusTracker(
	config Config, onChange func()) *onlineStatusTracker {
	ctx, cancel := context.WithCancel(context.Background())
	log := config.MakeLogger("onlineStatusTracker")
	ost := &onlineStatusTracker{
		cancel:        cancel,
		config:        config,
		onChange:      onChange,
		currentStatus: keybase1.KbfsOnlineStatus_ONLINE,
		vlog:          config.MakeVLogger(log),
		userIsLooking: make(map[string]bool),
		userIn:        make(chan struct{}),
		userOut:       make(chan struct{}),
		wg:            &sync.WaitGroup{},
	}

	ost.wg.Add(1)
	go ost.run(ctx)

	return ost
}

func (ost *onlineStatusTracker) shutdown() {
	ost.cancel()
	ost.wg.Wait()
}
