// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type getObj struct {
	id    ConnectionID
	retCh chan<- keybase1.NotificationChannels
}

type setObj struct {
	id  ConnectionID
	val keybase1.NotificationChannels
}

// NotifyListener provides hooks for listening for when
// notifications are called.  It is intended to simplify
// testing notifications.
type NotifyListener interface {
	Logout()
	Login(username string)
	ClientOutOfDate(to, uri, msg string)
	UserChanged(uid keybase1.UID)
	TrackingChanged(uid keybase1.UID, username NormalizedUsername)
	FSActivity(activity keybase1.FSNotification)
	FSEditListResponse(arg keybase1.FSEditListArg)
	FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)
	FSSyncEvent(arg keybase1.FSPathSyncStatus)
	FSEditListRequest(arg keybase1.FSEditListRequest)
	FavoritesChanged(uid keybase1.UID)
	PaperKeyCached(uid keybase1.UID, encKID keybase1.KID, sigKID keybase1.KID)
	KeyfamilyChanged(uid keybase1.UID)
	NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity)
	ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks)
	ChatTLFFinalize(uid keybase1.UID, convID chat1.ConversationID,
		finalizeInfo chat1.ConversationFinalizeInfo)
	ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID,
		resolveInfo chat1.ConversationResolveInfo)
	ChatInboxStale(uid keybase1.UID)
	ChatThreadsStale(uid keybase1.UID, cids []chat1.ConversationID)
	PGPKeyInSecretStoreFile()
	BadgeState(badgeState keybase1.BadgeState)
	ReachabilityChanged(r keybase1.Reachability)
}

// NotifyRouter routes notifications to the various active RPC
// connections. It's careful only to route to those who are interested
type NotifyRouter struct {
	Contextified
	cm         *ConnectionManager
	state      map[ConnectionID]keybase1.NotificationChannels
	setCh      chan setObj
	getCh      chan getObj
	shutdownCh chan struct{}
	listener   NotifyListener
}

// NewNotifyRouter makes a new notification router; we should only
// make one of these per process.
func NewNotifyRouter(g *GlobalContext) *NotifyRouter {
	ret := &NotifyRouter{
		Contextified: NewContextified(g),
		cm:           g.ConnectionManager,
		state:        make(map[ConnectionID]keybase1.NotificationChannels),
		setCh:        make(chan setObj),
		getCh:        make(chan getObj),
		shutdownCh:   make(chan struct{}),
	}
	go ret.run()
	return ret
}

func (n *NotifyRouter) SetListener(listener NotifyListener) {
	n.listener = listener
}

func (n *NotifyRouter) Shutdown() {
	n.shutdownCh <- struct{}{}
}

func (n *NotifyRouter) setNotificationChannels(id ConnectionID, val keybase1.NotificationChannels) {
	n.setCh <- setObj{id, val}
}

func (n *NotifyRouter) getNotificationChannels(id ConnectionID) keybase1.NotificationChannels {
	retCh := make(chan keybase1.NotificationChannels)
	n.getCh <- getObj{id, retCh}
	return <-retCh
}

func (n *NotifyRouter) run() {
	for {
		select {
		case <-n.shutdownCh:
			return
		case o := <-n.setCh:
			n.state[o.id] = o.val
		case o := <-n.getCh:
			o.retCh <- n.state[o.id]
		}
	}
}

// AddConnection should be called every time there's a new RPC connection
// established for this server.  The caller should pass in the Transporter
// and also the channel that will get messages when the channel closes.
func (n *NotifyRouter) AddConnection(xp rpc.Transporter, ch chan error) ConnectionID {
	if n == nil {
		return 0
	}
	id := n.cm.AddConnection(xp, ch)
	n.setNotificationChannels(id, keybase1.NotificationChannels{})
	return id
}

// SetChannels sets which notification channels are interested for the connection
// with the given connection ID.
func (n *NotifyRouter) SetChannels(i ConnectionID, nc keybase1.NotificationChannels) {
	n.setNotificationChannels(i, nc)
}

// HandleLogout is called whenever the current user logged out. It will broadcast
// the message to all connections who care about such a mesasge.
func (n *NotifyRouter) HandleLogout() {
	if n == nil {
		return
	}
	n.G().Log.Debug("+ Sending logout notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Session` notification type
		if n.getNotificationChannels(id).Session {
			// In the background do...
			go func() {
				// A send of a `LoggedOut` RPC
				(keybase1.NotifySessionClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).LoggedOut(context.Background())
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.Logout()
	}
	n.G().Log.Debug("- Logout notification sent")
}

// HandleLogin is called whenever a user logs in. It will broadcast
// the message to all connections who care about such a mesasge.
func (n *NotifyRouter) HandleLogin(u string) {
	if n == nil {
		return
	}
	n.G().Log.Debug("+ Sending login notification, as user %q", u)
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Session` notification type
		if n.getNotificationChannels(id).Session {
			// In the background do...
			go func() {
				// A send of a `LoggedIn` RPC
				(keybase1.NotifySessionClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).LoggedIn(context.Background(), u)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.Login(u)
	}
	n.G().Log.Debug("- Login notification sent")
}

// ClientOutOfDate is called whenever the API server tells us our client is out
// of date. (This is done by adding special headers to every API response that
// an out-of-date client makes.)
func (n *NotifyRouter) HandleClientOutOfDate(upgradeTo, upgradeURI, upgradeMsg string) {
	if n == nil {
		return
	}
	n.G().Log.Debug("+ Sending client-out-of-date notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Session` notification type
		if n.getNotificationChannels(id).Session {
			// In the background do...
			go func() {
				// A send of a `ClientOutOfDate` RPC
				(keybase1.NotifySessionClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ClientOutOfDate(context.Background(), keybase1.ClientOutOfDateArg{
					UpgradeTo:  upgradeTo,
					UpgradeURI: upgradeURI,
					UpgradeMsg: upgradeMsg,
				})
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.ClientOutOfDate(upgradeTo, upgradeURI, upgradeMsg)
	}
	n.G().Log.Debug("- client-out-of-date notification sent")
}

// HandleUserChanged is called whenever we know that a given user has
// changed (and must be cache-busted). It will broadcast the messages
// to all curious listeners.
func (n *NotifyRouter) HandleUserChanged(uid keybase1.UID) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Users` notification type
		if n.getNotificationChannels(id).Users {
			// In the background do...
			go func() {
				// A send of a `UserChanged` RPC with the user's UID
				(keybase1.NotifyUsersClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).UserChanged(context.Background(), uid)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.UserChanged(uid)
	}
}

// HandleTrackingChanged is called whenever we have a new tracking or
// untracking chain link related to a given user. It will broadcast the
// messages to all curious listeners.
// isTracking is set to true if current user is tracking uid.
func (n *NotifyRouter) HandleTrackingChanged(uid keybase1.UID, username NormalizedUsername, isTracking bool) {
	if n == nil {
		return
	}
	arg := keybase1.TrackingChangedArg{
		Uid:        uid,
		Username:   username.String(),
		IsTracking: isTracking,
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Tracking` notification type
		if n.getNotificationChannels(id).Tracking {
			// In the background do...
			go func() {
				// A send of a `TrackingChanged` RPC with the user's UID
				(keybase1.NotifyTrackingClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).TrackingChanged(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.TrackingChanged(uid, username)
	}
}

// HandleBadgeState is called whenever the badge state changes
// It will broadcast the messages to all curious listeners.
func (n *NotifyRouter) HandleBadgeState(badgeState keybase1.BadgeState) {
	if n == nil {
		return
	}
	n.G().Log.Debug("Sending BadgeState notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Badges` notification type
		if n.getNotificationChannels(id).Badges {
			// In the background do...
			go func() {
				// A send of a `BadgeState` RPC with the badge state
				(keybase1.NotifyBadgesClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).BadgeState(context.Background(), badgeState)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.BadgeState(badgeState)
	}
}

// HandleFSActivity is called for any KBFS notification. It will broadcast the messages
// to all curious listeners.
func (n *NotifyRouter) HandleFSActivity(activity keybase1.FSNotification) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfs` notification type
		if n.getNotificationChannels(id).Kbfs {
			// In the background do...
			go func() {
				// A send of a `FSActivity` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).FSActivity(context.Background(), activity)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.FSActivity(activity)
	}
}

// HandleFSEditListResponse is called for KBFS edit list response notifications.
func (n *NotifyRouter) HandleFSEditListResponse(ctx context.Context, arg keybase1.FSEditListArg) {
	if n == nil {
		return
	}

	// We have to make sure the context survives until all subsequent
	// RPCs launched in this method are done.  So we wait until
	// the last completes before returning.
	var wg sync.WaitGroup

	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfs` notification type
		if n.getNotificationChannels(id).Kbfs {
			// In the background do...
			wg.Add(1)
			go func() {
				// A send of a `FSEditListResponse` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).FSEditListResponse(ctx, keybase1.FSEditListResponseArg{
					Edits:     arg.Edits,
					RequestID: arg.RequestID,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.FSEditListResponse(arg)
	}
}

// HandleFSEditListRequest is called for KBFS edit list request notifications.
func (n *NotifyRouter) HandleFSEditListRequest(ctx context.Context, arg keybase1.FSEditListRequest) {
	if n == nil {
		return
	}

	// See above
	var wg sync.WaitGroup

	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfsrequest` notification type
		if n.getNotificationChannels(id).Kbfsrequest {
			wg.Add(1)
			// In the background do...
			go func() {
				// A send of a `FSEditListRequest` RPC with the notification
				(keybase1.NotifyFSRequestClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).FSEditListRequest(ctx, arg)
				wg.Done()
			}()
		}
		return true
	})

	wg.Wait()

	if n.listener != nil {
		n.listener.FSEditListRequest(arg)
	}
}

// HandleFSSyncStatus is called for KBFS sync status notifications.
func (n *NotifyRouter) HandleFSSyncStatus(ctx context.Context, arg keybase1.FSSyncStatusArg) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfs` notification type
		if n.getNotificationChannels(id).Kbfs {
			// In the background do...
			go func() {
				// A send of a `FSSyncStatusResponse` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).FSSyncStatusResponse(ctx, keybase1.FSSyncStatusResponseArg{Status: arg.Status, RequestID: arg.RequestID})
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.FSSyncStatusResponse(arg)
	}
}

// HandleFSSyncEvent is called for KBFS sync event notifications.
func (n *NotifyRouter) HandleFSSyncEvent(ctx context.Context, arg keybase1.FSPathSyncStatus) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfs` notification type
		if n.getNotificationChannels(id).Kbfs {
			// In the background do...
			go func() {
				// A send of a `FSSyncActivity` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).FSSyncActivity(ctx, arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.FSSyncEvent(arg)
	}
}

// HandleFavoritesChanged is called whenever the kbfs favorites change
// for a user (and caches should be invalidated). It will broadcast the
// messages to all curious listeners.
func (n *NotifyRouter) HandleFavoritesChanged(uid keybase1.UID) {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending favorites changed notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Favorites` notification type
		if n.getNotificationChannels(id).Favorites {
			// In the background do...
			go func() {
				// A send of a `FavoritesChanged` RPC with the user's UID
				(keybase1.NotifyFavoritesClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).FavoritesChanged(context.Background(), uid)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.FavoritesChanged(uid)
	}
	n.G().Log.Debug("- Sent favorites changed notification")
}

func (n *NotifyRouter) HandleNewChatActivity(ctx context.Context, uid keybase1.UID, activity *chat1.ChatActivity) {
	if n == nil {
		return
	}

	var wg sync.WaitGroup

	n.G().Log.CDebugf(ctx, "+ Sending NewChatActivity notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Chat` notification type
		if n.getNotificationChannels(id).Chat {

			wg.Add(1)
			// In the background do...
			go func() {
				// A send of a `NewChatActivity` RPC with the user's UID
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).NewChatActivity(context.Background(), chat1.NewChatActivityArg{
					Uid:      uid,
					Activity: *activity,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.NewChatActivity(uid, *activity)
	}
	n.G().Log.CDebugf(ctx, "- Sent NewChatActivity notification")
}

func (n *NotifyRouter) HandleChatIdentifyUpdate(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatIdentifyUpdate notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chat {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ChatIdentifyUpdate(context.Background(), update)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatIdentifyUpdate(update)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatIdentifyUpdate notification")
}

func (n *NotifyRouter) HandleChatTLFFinalize(ctx context.Context, uid keybase1.UID, convID chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo, conv *chat1.ConversationLocal) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatTLFFinalize notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chat {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ChatTLFFinalize(context.Background(), chat1.ChatTLFFinalizeArg{
					Uid:          uid,
					ConvID:       convID,
					FinalizeInfo: finalizeInfo,
					Conv:         conv,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatTLFFinalize(uid, convID, finalizeInfo)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatTLFFinalize notification")
}

func (n *NotifyRouter) HandleChatTLFResolve(ctx context.Context, uid keybase1.UID, convID chat1.ConversationID, resolveInfo chat1.ConversationResolveInfo) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatTLFResolve notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chat {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ChatTLFResolve(context.Background(), chat1.ChatTLFResolveArg{
					Uid:         uid,
					ConvID:      convID,
					ResolveInfo: resolveInfo,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatTLFResolve(uid, convID, resolveInfo)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatTLFResolve notification")
}

func (n *NotifyRouter) HandleChatInboxStale(ctx context.Context, uid keybase1.UID) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatInboxStale notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chat {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ChatInboxStale(context.Background(), uid)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatInboxStale(uid)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatInboxStale notification")
}

func (n *NotifyRouter) HandleChatThreadsStale(ctx context.Context, uid keybase1.UID,
	threads []chat1.ConversationID) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatThreadsStale notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chat {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ChatThreadsStale(context.Background(), chat1.ChatThreadsStaleArg{
					Uid:     uid,
					ConvIDs: threads,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatThreadsStale(uid, threads)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatThreadsStale notification")
}

// HandlePaperKeyCached is called whenever a paper key is cached
// in response to a rekey harassment.
func (n *NotifyRouter) HandlePaperKeyCached(uid keybase1.UID, encKID keybase1.KID, sigKID keybase1.KID) {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending paperkey cached notification")
	arg := keybase1.PaperKeyCachedArg{
		Uid:    uid,
		EncKID: encKID,
		SigKID: sigKID,
	}
	var wg sync.WaitGroup

	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Favorites` notification type
		if n.getNotificationChannels(id).Paperkeys {
			wg.Add(1)
			// In the background do...
			go func() {
				(keybase1.NotifyPaperKeyClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).PaperKeyCached(context.Background(), arg)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.PaperKeyCached(uid, encKID, sigKID)
	}
	n.G().Log.Debug("- Sent paperkey cached notification")
}

// HandleKeyfamilyChanged is called whenever a user's keyfamily changes.
func (n *NotifyRouter) HandleKeyfamilyChanged(uid keybase1.UID) {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending keyfamily changed notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Favorites` notification type
		if n.getNotificationChannels(id).Keyfamily {
			// In the background do...
			go func() {
				(keybase1.NotifyKeyfamilyClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).KeyfamilyChanged(context.Background(), uid)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.KeyfamilyChanged(uid)
	}
	n.G().Log.Debug("- Sent keyfamily changed notification")
}

// HandleServiceShutdown is called whenever the service shuts down.
func (n *NotifyRouter) HandleServiceShutdown() {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending service shutdown notification")

	var wg sync.WaitGroup

	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Service` notification type
		if n.getNotificationChannels(id).Service {
			// In the background do...
			wg.Add(1)
			go func() {
				(keybase1.NotifyServiceClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).Shutdown(context.Background())
				wg.Done()
			}()
		}
		return true
	})

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	// timeout after 4s (launchd will SIGKILL after 5s)
	select {
	case <-done:
	case <-time.After(4 * time.Second):
		n.G().Log.Warning("Timed out sending service shutdown notifications, proceeding to shutdown")
	}

	n.G().Log.Debug("- Sent service shutdown notification")
}

// HandleAppExit is called whenever an app exit command is issued
func (n *NotifyRouter) HandleAppExit() {
	if n == nil {
		return
	}
	n.G().Log.Debug("+ Sending app exit notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).App {
			go func() {
				(keybase1.NotifyAppClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).Exit(context.Background())
			}()
		}
		return true
	})
	n.G().Log.Debug("- Sent app exit notification")
}

// HandlePGPKeyInSecretStoreFile is called to notify a user that they have a PGP
// key that is unlockable by a secret stored in a file in their home directory.
func (n *NotifyRouter) HandlePGPKeyInSecretStoreFile() {
	n.G().Log.Debug("+ Sending pgpKeyInSecretStoreFile notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).PGP {
			go func() {
				(keybase1.NotifyPGPClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).PGPKeyInSecretStoreFile(context.Background())
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.PGPKeyInSecretStoreFile()
	}
	n.G().Log.Debug("- Sent pgpKeyInSecretStoreFile notification")
}

func (n *NotifyRouter) HandleReachability(r keybase1.Reachability) {
	n.G().Log.Debug("+ Sending reachability")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Reachability {
			go func() {
				(keybase1.ReachabilityClient{
					Cli: rpc.NewClient(xp, ErrorUnwrapper{}, nil),
				}).ReachabilityChanged(context.Background(), r)
			}()
		}
		return true
	})
	n.G().Log.Debug("- Sent reachability")
}
