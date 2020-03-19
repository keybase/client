package chat

import (
	"context"
	"fmt"
	"sync"
	"time"

	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

const typingTimeout = 10 * time.Second
const maxExtensions = 50

type typingControlChans struct {
	typer chat1.TyperInfo

	stopCh   chan struct{}
	extendCh chan struct{}
}

func newTypingControlChans(typer chat1.TyperInfo) *typingControlChans {
	return &typingControlChans{
		typer: typer,
		// Might not need these buffers, but we really don't want to deadlock
		stopCh:   make(chan struct{}, 5),
		extendCh: make(chan struct{}, 5),
	}
}

type TypingMonitor struct {
	globals.Contextified
	sync.Mutex
	utils.DebugLabeler

	timeout time.Duration
	clock   clockwork.Clock
	typers  map[string]*typingControlChans

	// Testing
	extendCh *chan struct{}
}

func NewTypingMonitor(g *globals.Context) *TypingMonitor {
	return &TypingMonitor{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "TypingMonitor", false),
		typers:       make(map[string]*typingControlChans),
		clock:        clockwork.NewRealClock(),
		timeout:      typingTimeout,
	}
}

func (t *TypingMonitor) SetClock(clock clockwork.Clock) {
	t.clock = clock
}

func (t *TypingMonitor) SetTimeout(timeout time.Duration) {
	t.timeout = timeout
}

func (t *TypingMonitor) key(typer chat1.TyperInfo, convID chat1.ConversationID) string {
	return fmt.Sprintf("%s:%s:%s", typer.Uid, typer.DeviceID, convID)
}

func (t *TypingMonitor) convKey(key string, convID chat1.ConversationID) bool {
	toks := strings.Split(key, ":")
	if len(toks) != 3 {
		return false
	}
	return toks[2] == convID.String()
}

func (t *TypingMonitor) notifyConvUpdateLocked(ctx context.Context, convID chat1.ConversationID) {
	var typers []chat1.TyperInfo
	for k, v := range t.typers {
		if t.convKey(k, convID) {
			typers = append(typers, v.typer)
		}
	}

	update := chat1.ConvTypingUpdate{
		ConvID: convID,
		Typers: typers,
	}
	t.G().ActivityNotifier.TypingUpdate(ctx, []chat1.ConvTypingUpdate{update})
}

func (t *TypingMonitor) Update(ctx context.Context, typer chat1.TyperInfo, convID chat1.ConversationID,
	teamType chat1.TeamType, typing bool) {

	// If this is about ourselves, then don't bother
	cuid := t.G().Env.GetUID()
	cdid := t.G().Env.GetDeviceID()
	if cuid.Equal(typer.Uid) && cdid.Eq(typer.DeviceID) {
		return
	}

	// If the update is for a big team we are not currently viewing, don't bother sending it
	if teamType == chat1.TeamType_COMPLEX && !convID.Eq(t.G().Syncer.GetSelectedConversation()) {
		return
	}

	// Process the update
	t.Lock()
	key := t.key(typer, convID)
	chans, alreadyTyping := t.typers[key]
	t.Unlock()
	if typing {
		if alreadyTyping {
			// If this key is already typing, let's extend it
			select {
			case chans.extendCh <- struct{}{}:
			default:
				// This should never happen, but be safe
				t.Debug(ctx, "Update: overflowed extend channel, dropping update: %s convID: %s", typer,
					convID)
			}
		} else {
			// Not typing yet, just add it in and spawn waiter
			chans := newTypingControlChans(typer)
			t.insertIntoTypers(ctx, key, chans, convID)
			t.waitOnTyper(ctx, chans, convID)
		}
	} else if alreadyTyping {
		// If they are typing, then stop it
		select {
		case chans.stopCh <- struct{}{}:
		default:
			// This should never happen, but be safe
			t.Debug(ctx, "Update: overflowed stop channel, dropping update: %s convID: %s", typer,
				convID)
		}
	}
}

func (t *TypingMonitor) insertIntoTypers(ctx context.Context, key string, chans *typingControlChans,
	convID chat1.ConversationID) {
	t.Lock()
	defer t.Unlock()
	t.typers[key] = chans
	t.notifyConvUpdateLocked(ctx, convID)
}

func (t *TypingMonitor) removeFromTypers(ctx context.Context, key string, convID chat1.ConversationID) {
	t.Lock()
	defer t.Unlock()
	delete(t.typers, key)
	t.notifyConvUpdateLocked(ctx, convID)
}

func (t *TypingMonitor) waitOnTyper(ctx context.Context, chans *typingControlChans,
	convID chat1.ConversationID) {
	key := t.key(chans.typer, convID)
	ctx = globals.BackgroundChatCtx(ctx, t.G())
	deadline := t.clock.Now().Add(t.timeout)
	go func() {
		extends := 0
		for {
			select {
			case <-t.clock.AfterTime(deadline):
				// Send notifications and bail
				t.removeFromTypers(ctx, key, convID)
				return
			case <-chans.extendCh:
				// Loop around to restart timer
				extends++
				if extends > maxExtensions {
					t.Debug(ctx, "waitOnTyper: max extensions reached: uid: %s convID: %s", chans.typer.Uid, convID)
					t.removeFromTypers(ctx, key, convID)
					return
				}
				deadline = t.clock.Now().Add(t.timeout)
				if t.extendCh != nil {
					// Alerts tests we extended time
					*t.extendCh <- struct{}{}
				}
				continue
			case <-chans.stopCh:
				// Stopped typing, just end it and remove entry in typers
				t.removeFromTypers(ctx, key, convID)
				return
			}
		}
	}()
}

type notificationSettingsCache struct {
	UID      gregor1.UID
	Settings chat1.GlobalAppNotificationSettings
}

type TypingUpdater struct {
	sync.Mutex
	globals.Contextified
	utils.DebugLabeler

	cache *notificationSettingsCache
}

func NewTypingUpdater(g *globals.Context) *TypingUpdater {
	return &TypingUpdater{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "TypingUpdater", false),
	}
}

func (u *TypingUpdater) ClearCache(ctx context.Context, uid gregor1.UID) {
	defer u.Trace(ctx, func() error { return nil }, "ClearCache")()
	u.Lock()
	defer u.Unlock()
	u.cache = nil
}

func (u *TypingUpdater) typingEnabled(ctx context.Context, uid gregor1.UID, ri func() chat1.RemoteInterface) bool {
	u.Lock()
	defer u.Unlock()
	if u.cache == nil || !u.cache.UID.Eq(uid) {
		settings, err := getGlobalAppNotificationSettings(ctx, u.G(), ri)
		if err != nil {
			u.Debug(ctx, "typingEnabled: unable to get notification settings: %s", err)
			return false
		}
		u.updateCacheLocked(ctx, uid, settings)
	}
	return !u.cache.Settings.Settings[chat1.GlobalAppNotificationSetting_DISABLETYPING]
}

func (u *TypingUpdater) UpdateCache(ctx context.Context, uid gregor1.UID, settings chat1.GlobalAppNotificationSettings) {
	defer u.Trace(ctx, func() error { return nil }, "UpdateCache")()
	u.Lock()
	defer u.Unlock()
	u.updateCacheLocked(ctx, uid, settings)
}

func (u *TypingUpdater) updateCacheLocked(ctx context.Context, uid gregor1.UID, settings chat1.GlobalAppNotificationSettings) {
	cache := notificationSettingsCache{
		UID:      uid,
		Settings: settings,
	}
	u.cache = &cache
}

func (u *TypingUpdater) UpdateTyping(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID, typing bool, ri func() chat1.RemoteInterface) error {
	// Just bail out if we are offline
	if !u.G().Syncer.IsConnected(ctx) {
		return nil
	}
	// user has typing disabled, bail.
	if !u.typingEnabled(ctx, uid, ri) {
		return nil
	}
	deviceID := make([]byte, libkb.DeviceIDLen)
	if err := u.G().Env.GetDeviceID().ToBytes(deviceID); err != nil {
		u.Debug(ctx, "UpdateTyping: failed to get device: %s", err)
		return nil
	}
	err := ri().UpdateTypingRemote(ctx, chat1.UpdateTypingRemoteArg{
		Uid:      uid,
		DeviceID: deviceID,
		ConvID:   convID,
		Typing:   typing,
	})

	switch err.(type) {
	case nil:
	case libkb.ChatTypingDisabledError:
		u.ClearCache(ctx, uid)
	default:
		u.Debug(ctx, "UpdateTyping: failed to hit the server: %s", err)
	}
	return nil
}
