// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"sync"
	"time"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	stellar1 "github.com/keybase/client/go/protocol/stellar1"
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
	FSPathUpdated(path string)
	FSEditListResponse(arg keybase1.FSEditListArg)
	FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)
	FSSyncEvent(arg keybase1.FSPathSyncStatus)
	FSEditListRequest(arg keybase1.FSEditListRequest)
	FavoritesChanged(uid keybase1.UID)
	PaperKeyCached(uid keybase1.UID, encKID keybase1.KID, sigKID keybase1.KID)
	KeyfamilyChanged(uid keybase1.UID)
	NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity, source chat1.ChatActivitySource)
	NewChatKBFSFileEditActivity(uid keybase1.UID, activity chat1.ChatActivity)
	ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks)
	ChatTLFFinalize(uid keybase1.UID, convID chat1.ConversationID,
		finalizeInfo chat1.ConversationFinalizeInfo)
	ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID,
		resolveInfo chat1.ConversationResolveInfo)
	ChatInboxStale(uid keybase1.UID)
	ChatThreadsStale(uid keybase1.UID, updates []chat1.ConversationStaleUpdate)
	ChatInboxSynced(uid keybase1.UID, topicType chat1.TopicType, syncRes chat1.ChatSyncResult)
	ChatInboxSyncStarted(uid keybase1.UID)
	ChatTypingUpdate([]chat1.ConvTypingUpdate)
	ChatJoinedConversation(uid keybase1.UID, convID chat1.ConversationID, conv *chat1.InboxUIItem)
	ChatLeftConversation(uid keybase1.UID, convID chat1.ConversationID)
	ChatResetConversation(uid keybase1.UID, convID chat1.ConversationID)
	ChatSetConvRetention(uid keybase1.UID, convID chat1.ConversationID)
	ChatSetTeamRetention(uid keybase1.UID, teamID keybase1.TeamID)
	ChatSetConvSettings(uid keybase1.UID, convID chat1.ConversationID)
	ChatSubteamRename(uid keybase1.UID, convIDs []chat1.ConversationID)
	ChatKBFSToImpteamUpgrade(uid keybase1.UID, convID chat1.ConversationID)
	ChatAttachmentUploadStart(uid keybase1.UID, convID chat1.ConversationID, outboxID chat1.OutboxID)
	ChatAttachmentUploadProgress(uid keybase1.UID, convID chat1.ConversationID, outboxID chat1.OutboxID,
		bytesComplete, bytesTotal int64)
	ChatPaymentInfo(uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, info chat1.UIPaymentInfo)
	ChatRequestInfo(uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, info chat1.UIRequestInfo)
	ChatPromptUnfurl(uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, domain string)
	PGPKeyInSecretStoreFile()
	BadgeState(badgeState keybase1.BadgeState)
	ReachabilityChanged(r keybase1.Reachability)
	TeamChangedByID(teamID keybase1.TeamID, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet)
	TeamChangedByName(teamName string, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet)
	TeamDeleted(teamID keybase1.TeamID)
	TeamExit(teamID keybase1.TeamID)
	NewlyAddedToTeam(teamID keybase1.TeamID)
	NewTeamEK(teamID keybase1.TeamID, generation keybase1.EkGeneration)
	AvatarUpdated(name string, formats []keybase1.AvatarFormat)
	DeviceCloneCountChanged(newClones int)
	WalletPaymentNotification(accountID stellar1.AccountID, paymentID stellar1.PaymentID)
	WalletPaymentStatusNotification(accountID stellar1.AccountID, paymentID stellar1.PaymentID)
	WalletRequestStatusNotification(reqID stellar1.KeybaseRequestID)
	WalletAccountDetailsUpdate(accountID stellar1.AccountID, account stellar1.WalletAccountLocal)
	WalletPendingPaymentsUpdate(accountID stellar1.AccountID, pending []stellar1.PaymentOrErrorLocal)
	WalletRecentPaymentsUpdate(accountID stellar1.AccountID, firstPage stellar1.PaymentsPageLocal)
	TeamListUnverifiedChanged(teamName string)
	CanUserPerformChanged(teamName string)
	PhoneNumberAdded(phoneNumber keybase1.PhoneNumber)
	PhoneNumberVerified(phoneNumber keybase1.PhoneNumber)
	PhoneNumberSuperseded(phoneNumber keybase1.PhoneNumber)
}

type NoopNotifyListener struct{}

var _ NotifyListener = (*NoopNotifyListener)(nil)

func (n *NoopNotifyListener) Logout()                                                       {}
func (n *NoopNotifyListener) Login(username string)                                         {}
func (n *NoopNotifyListener) ClientOutOfDate(to, uri, msg string)                           {}
func (n *NoopNotifyListener) UserChanged(uid keybase1.UID)                                  {}
func (n *NoopNotifyListener) TrackingChanged(uid keybase1.UID, username NormalizedUsername) {}
func (n *NoopNotifyListener) FSActivity(activity keybase1.FSNotification)                   {}
func (n *NoopNotifyListener) FSPathUpdated(path string)                                     {}
func (n *NoopNotifyListener) FSEditListResponse(arg keybase1.FSEditListArg)                 {}
func (n *NoopNotifyListener) FSSyncStatusResponse(arg keybase1.FSSyncStatusArg)             {}
func (n *NoopNotifyListener) FSSyncEvent(arg keybase1.FSPathSyncStatus)                     {}
func (n *NoopNotifyListener) FSEditListRequest(arg keybase1.FSEditListRequest)              {}
func (n *NoopNotifyListener) FavoritesChanged(uid keybase1.UID)                             {}
func (n *NoopNotifyListener) PaperKeyCached(uid keybase1.UID, encKID keybase1.KID, sigKID keybase1.KID) {
}
func (n *NoopNotifyListener) KeyfamilyChanged(uid keybase1.UID) {}
func (n *NoopNotifyListener) NewChatActivity(uid keybase1.UID, activity chat1.ChatActivity,
	source chat1.ChatActivitySource) {
}
func (n *NoopNotifyListener) NewChatKBFSFileEditActivity(uid keybase1.UID, activity chat1.ChatActivity) {
}
func (n *NoopNotifyListener) ChatIdentifyUpdate(update keybase1.CanonicalTLFNameAndIDWithBreaks) {}
func (n *NoopNotifyListener) ChatTLFFinalize(uid keybase1.UID, convID chat1.ConversationID,
	finalizeInfo chat1.ConversationFinalizeInfo) {
}
func (n *NoopNotifyListener) ChatTLFResolve(uid keybase1.UID, convID chat1.ConversationID,
	resolveInfo chat1.ConversationResolveInfo) {
}
func (n *NoopNotifyListener) ChatInboxStale(uid keybase1.UID) {}
func (n *NoopNotifyListener) ChatThreadsStale(uid keybase1.UID, updates []chat1.ConversationStaleUpdate) {
}
func (n *NoopNotifyListener) ChatInboxSynced(uid keybase1.UID, topicType chat1.TopicType,
	syncRes chat1.ChatSyncResult) {
}
func (n *NoopNotifyListener) ChatInboxSyncStarted(uid keybase1.UID)     {}
func (n *NoopNotifyListener) ChatTypingUpdate([]chat1.ConvTypingUpdate) {}
func (n *NoopNotifyListener) ChatJoinedConversation(uid keybase1.UID, convID chat1.ConversationID,
	conv *chat1.InboxUIItem) {
}
func (n *NoopNotifyListener) ChatLeftConversation(uid keybase1.UID, convID chat1.ConversationID)     {}
func (n *NoopNotifyListener) ChatResetConversation(uid keybase1.UID, convID chat1.ConversationID)    {}
func (n *NoopNotifyListener) Chat(uid keybase1.UID, convID chat1.ConversationID)                     {}
func (n *NoopNotifyListener) ChatSetConvRetention(uid keybase1.UID, convID chat1.ConversationID)     {}
func (n *NoopNotifyListener) ChatSetTeamRetention(uid keybase1.UID, teamID keybase1.TeamID)          {}
func (n *NoopNotifyListener) ChatSetConvSettings(uid keybase1.UID, convID chat1.ConversationID)      {}
func (n *NoopNotifyListener) ChatSubteamRename(uid keybase1.UID, convIDs []chat1.ConversationID)     {}
func (n *NoopNotifyListener) ChatKBFSToImpteamUpgrade(uid keybase1.UID, convID chat1.ConversationID) {}
func (n *NoopNotifyListener) ChatAttachmentUploadStart(uid keybase1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID) {
}
func (n *NoopNotifyListener) ChatAttachmentUploadProgress(uid keybase1.UID, convID chat1.ConversationID,
	outboxID chat1.OutboxID, bytesComplete, bytesTotal int64) {
}
func (n *NoopNotifyListener) ChatPaymentInfo(uid keybase1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, info chat1.UIPaymentInfo) {
}
func (n *NoopNotifyListener) ChatRequestInfo(uid keybase1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, info chat1.UIRequestInfo) {
}
func (n *NoopNotifyListener) ChatPromptUnfurl(uid keybase1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, domain string) {
}
func (n *NoopNotifyListener) PGPKeyInSecretStoreFile()                    {}
func (n *NoopNotifyListener) BadgeState(badgeState keybase1.BadgeState)   {}
func (n *NoopNotifyListener) ReachabilityChanged(r keybase1.Reachability) {}
func (n *NoopNotifyListener) TeamChangedByID(teamID keybase1.TeamID, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {
}
func (n *NoopNotifyListener) TeamChangedByName(teamName string, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {
}
func (n *NoopNotifyListener) TeamDeleted(teamID keybase1.TeamID)                                 {}
func (n *NoopNotifyListener) TeamExit(teamID keybase1.TeamID)                                    {}
func (n *NoopNotifyListener) NewTeamEK(teamID keybase1.TeamID, generation keybase1.EkGeneration) {}
func (n *NoopNotifyListener) NewlyAddedToTeam(teamID keybase1.TeamID)                            {}
func (n *NoopNotifyListener) AvatarUpdated(name string, formats []keybase1.AvatarFormat)         {}
func (n *NoopNotifyListener) DeviceCloneCountChanged(newClones int)                              {}
func (n *NoopNotifyListener) WalletPaymentNotification(accountID stellar1.AccountID, paymentID stellar1.PaymentID) {
}
func (n *NoopNotifyListener) WalletPaymentStatusNotification(accountID stellar1.AccountID, paymentID stellar1.PaymentID) {
}
func (n *NoopNotifyListener) WalletRequestStatusNotification(reqID stellar1.KeybaseRequestID) {}
func (n *NoopNotifyListener) WalletAccountDetailsUpdate(accountID stellar1.AccountID, account stellar1.WalletAccountLocal) {
}
func (n *NoopNotifyListener) WalletPendingPaymentsUpdate(accountID stellar1.AccountID, pending []stellar1.PaymentOrErrorLocal) {
}
func (n *NoopNotifyListener) WalletRecentPaymentsUpdate(accountID stellar1.AccountID, firstPage stellar1.PaymentsPageLocal) {
}
func (n *NoopNotifyListener) TeamListUnverifiedChanged(teamName string)              {}
func (n *NoopNotifyListener) CanUserPerformChanged(teamName string)                  {}
func (n *NoopNotifyListener) PhoneNumberAdded(phoneNumber keybase1.PhoneNumber)      {}
func (n *NoopNotifyListener) PhoneNumberVerified(phoneNumber keybase1.PhoneNumber)   {}
func (n *NoopNotifyListener) PhoneNumberSuperseded(phoneNumber keybase1.PhoneNumber) {}

// NotifyRouter routes notifications to the various active RPC
// connections. It's careful only to route to those who are interested
type NotifyRouter struct {
	sync.Mutex
	Contextified
	cm       *ConnectionManager
	state    map[ConnectionID]keybase1.NotificationChannels
	listener NotifyListener
}

// NewNotifyRouter makes a new notification router; we should only
// make one of these per process.
func NewNotifyRouter(g *GlobalContext) *NotifyRouter {
	return &NotifyRouter{
		Contextified: NewContextified(g),
		cm:           g.ConnectionManager,
		state:        make(map[ConnectionID]keybase1.NotificationChannels),
	}
}

func (n *NotifyRouter) SetListener(listener NotifyListener) {
	n.listener = listener
}

func (n *NotifyRouter) Shutdown() {}

func (n *NotifyRouter) setNotificationChannels(id ConnectionID, val keybase1.NotificationChannels) {
	n.Lock()
	defer n.Unlock()
	n.state[id] = val
}

func (n *NotifyRouter) getNotificationChannels(id ConnectionID) keybase1.NotificationChannels {
	n.Lock()
	defer n.Unlock()
	return n.state[id]
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
// the message to all connections who care about such a message.
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
// the message to all connections who care about such a message.
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
		// If the connection wants the `Kbfsdesktop` notification type
		if n.getNotificationChannels(id).Kbfsdesktop {
			// In the background do...
			go func() {
				// A send of a `FSActivity` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).FSActivity(context.Background(), activity)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.FSActivity(activity)
	}
}

// HandleFSPathUpdated is called for any path update notification. It
// will broadcast the messages to all curious listeners.
func (n *NotifyRouter) HandleFSPathUpdated(path string) {
	if n == nil {
		return
	}
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Kbfs` notification type
		if n.getNotificationChannels(id).Kbfs {
			// In the background do...
			go func() {
				// A send of a `FSPathUpdated` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).FSPathUpdated(context.Background(), path)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.FSPathUpdated(path)
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
		// If the connection wants the `Kbfslegacy` notification type
		if n.getNotificationChannels(id).Kbfslegacy {
			// In the background do...
			wg.Add(1)
			go func() {
				// A send of a `FSEditListResponse` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).FSEditListResponse(context.Background(), keybase1.FSEditListResponseArg{
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
		// If the connection wants the `Kbfslegacy` notification type
		if n.getNotificationChannels(id).Kbfslegacy {
			wg.Add(1)
			// In the background do...
			go func() {
				// A send of a `FSEditListRequest` RPC with the notification
				(keybase1.NotifyFSRequestClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).FSEditListRequest(context.Background(), arg)
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
		// If the connection wants the `Kbfslegacy` notification type
		if n.getNotificationChannels(id).Kbfslegacy {
			// In the background do...
			go func() {
				// A send of a `FSSyncStatusResponse` RPC with the notification
				(keybase1.NotifyFSClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).FSSyncStatusResponse(context.Background(), keybase1.FSSyncStatusResponseArg{Status: arg.Status, RequestID: arg.RequestID})
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).FSSyncActivity(context.Background(), arg)
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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

// HandleDeviceCloneNotification is called when a run of the device clone status update
// finds a newly-added, possible clone. It will broadcast the messages to all curious listeners.
func (n *NotifyRouter) HandleDeviceCloneNotification(newClones int) {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending device clone notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Deviceclone` notification type
		if n.getNotificationChannels(id).Deviceclone {
			// In the background do...
			go func() {
				// A send of a `DeviceCloneCountChanged` RPC with the number of newly discovered clones
				(keybase1.NotifyDeviceCloneClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).DeviceCloneCountChanged(context.Background(), newClones)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.DeviceCloneCountChanged(newClones)
	}
	n.G().Log.Debug("- Sent device clone notification")
}

func (n *NotifyRouter) shouldSendChatNotification(id ConnectionID, topicType chat1.TopicType) bool {
	switch topicType {
	case chat1.TopicType_CHAT:
		return n.getNotificationChannels(id).Chat
	case chat1.TopicType_DEV:
		return n.getNotificationChannels(id).Chatdev
	case chat1.TopicType_KBFSFILEEDIT:
		return n.getNotificationChannels(id).Chatkbfsedits
	case chat1.TopicType_NONE:
		return n.getNotificationChannels(id).Chat ||
			n.getNotificationChannels(id).Chatdev ||
			n.getNotificationChannels(id).Chatkbfsedits
	}
	return false
}

func (n *NotifyRouter) HandleNewChatActivity(ctx context.Context, uid keybase1.UID,
	topicType chat1.TopicType, activity *chat1.ChatActivity, source chat1.ChatActivitySource) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending NewChatActivity notification")
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Chat` notification type
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			// In the background do...
			go func() {
				// A send of a `NewChatActivity` RPC with the user's UID
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).NewChatActivity(context.Background(), chat1.NewChatActivityArg{
					Uid:      uid,
					Activity: *activity,
					Source:   source,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.NewChatActivity(uid, *activity, source)
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
		if n.shouldSendChatNotification(id, chat1.TopicType_CHAT) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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

func (n *NotifyRouter) HandleChatTLFFinalize(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, finalizeInfo chat1.ConversationFinalizeInfo,
	conv *chat1.InboxUIItem) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatTLFFinalize notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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

func (n *NotifyRouter) HandleChatTLFResolve(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, resolveInfo chat1.ConversationResolveInfo) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatTLFResolve notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
		if n.shouldSendChatNotification(id, chat1.TopicType_NONE) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
	updates []chat1.ConversationStaleUpdate) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatThreadsStale notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, chat1.TopicType_NONE) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatThreadsStale(context.Background(), chat1.ChatThreadsStaleArg{
					Uid:     uid,
					Updates: updates,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatThreadsStale(uid, updates)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatThreadsStale notification")
}

func (n *NotifyRouter) HandleChatInboxSynced(ctx context.Context, uid keybase1.UID,
	topicType chat1.TopicType, syncRes chat1.ChatSyncResult) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	typ, _ := syncRes.SyncType()
	n.G().Log.CDebugf(ctx, "+ Sending ChatInboxSynced notification: syncTyp: %v topicType: %v", typ, topicType)
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatInboxSynced(context.Background(), chat1.ChatInboxSyncedArg{
					Uid:     uid,
					SyncRes: syncRes,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatInboxSynced(uid, topicType, syncRes)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatInboxSynced notification")
}

func (n *NotifyRouter) HandleChatInboxSyncStarted(ctx context.Context, uid keybase1.UID) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatInboxSyncStarted notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, chat1.TopicType_NONE) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatInboxSyncStarted(context.Background(), uid)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatInboxSyncStarted(uid)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatInboxSyncStarted notification")
}

func (n *NotifyRouter) HandleChatTypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatTypingUpdate notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, chat1.TopicType_CHAT) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatTypingUpdate(context.Background(), updates)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatTypingUpdate(updates)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatTypingUpdate notification")
}

func (n *NotifyRouter) HandleChatJoinedConversation(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatJoinedConversation notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatJoinedConversation(context.Background(), chat1.ChatJoinedConversationArg{
					Uid:    uid,
					ConvID: convID,
					Conv:   conv,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatJoinedConversation(uid, convID, conv)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatJoinedConversation notification")
}

func (n *NotifyRouter) HandleChatLeftConversation(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatLeftConversation notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatLeftConversation(context.Background(), chat1.ChatLeftConversationArg{
					Uid:    uid,
					ConvID: convID,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatLeftConversation(uid, convID)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatLeftConversation notification")
}

func (n *NotifyRouter) HandleChatResetConversation(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatResetConversation notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatResetConversation(context.Background(), chat1.ChatResetConversationArg{
					Uid:    uid,
					ConvID: convID,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatResetConversation(uid, convID)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatResetConversation notification")
}

func (n *NotifyRouter) HandleChatKBFSToImpteamUpgrade(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatKBFSToImpteamUpgrade notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatKBFSToImpteamUpgrade(context.Background(), chat1.ChatKBFSToImpteamUpgradeArg{
					Uid:    uid,
					ConvID: convID,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatKBFSToImpteamUpgrade(uid, convID)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatKBFSToImpteamUpgrade notification")
}

func (n *NotifyRouter) HandleChatAttachmentUploadStart(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, outboxID chat1.OutboxID) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatAttachmentUploadStart notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chatattachments {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatAttachmentUploadStart(context.Background(), chat1.ChatAttachmentUploadStartArg{
					Uid:      uid,
					ConvID:   convID,
					OutboxID: outboxID,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatAttachmentUploadStart(uid, convID, outboxID)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatAttachmentUploadStart notification")
}

func (n *NotifyRouter) HandleChatAttachmentUploadProgress(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, outboxID chat1.OutboxID, bytesComplete, bytesTotal int64) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatAttachmentUploadProgress notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Chatattachments {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatAttachmentUploadProgress(context.Background(), chat1.ChatAttachmentUploadProgressArg{
					Uid:           uid,
					ConvID:        convID,
					OutboxID:      outboxID,
					BytesComplete: bytesComplete,
					BytesTotal:    bytesTotal,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatAttachmentUploadProgress(uid, convID, outboxID, bytesComplete, bytesTotal)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatAttachmentUploadProgress notification")
}

func (n *NotifyRouter) HandleChatSetConvRetention(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	n.notifyChatCommon(ctx, "ChatSetConvRetention", topicType,
		func(ctx context.Context, cli *chat1.NotifyChatClient) {
			cli.ChatSetConvRetention(ctx, chat1.ChatSetConvRetentionArg{
				Uid:    uid,
				ConvID: convID,
				Conv:   conv,
			})
		}, func(ctx context.Context, listener NotifyListener) {
			listener.ChatSetConvRetention(uid, convID)
		})
}

func (n *NotifyRouter) HandleChatSetTeamRetention(ctx context.Context, uid keybase1.UID,
	teamID keybase1.TeamID, topicType chat1.TopicType, convs []chat1.InboxUIItem) {
	n.notifyChatCommon(ctx, "ChatSetTeamRetention", topicType,
		func(ctx context.Context, cli *chat1.NotifyChatClient) {
			cli.ChatSetTeamRetention(ctx, chat1.ChatSetTeamRetentionArg{
				Uid:    uid,
				TeamID: teamID,
				Convs:  convs,
			})
		}, func(ctx context.Context, listener NotifyListener) {
			listener.ChatSetTeamRetention(uid, teamID)
		})
}

func (n *NotifyRouter) HandleChatSetConvSettings(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, topicType chat1.TopicType, conv *chat1.InboxUIItem) {
	n.notifyChatCommon(ctx, "ChatSetConvSettings", topicType,
		func(ctx context.Context, cli *chat1.NotifyChatClient) {
			cli.ChatSetConvSettings(ctx, chat1.ChatSetConvSettingsArg{
				Uid:    uid,
				ConvID: convID,
				Conv:   conv,
			})
		}, func(ctx context.Context, listener NotifyListener) {
			listener.ChatSetConvSettings(uid, convID)
		})
}

func (n *NotifyRouter) HandleChatSubteamRename(ctx context.Context, uid keybase1.UID,
	convIDs []chat1.ConversationID, topicType chat1.TopicType, convs []chat1.InboxUIItem) {
	n.notifyChatCommon(ctx, "ChatSubteamRename", topicType,
		func(ctx context.Context, cli *chat1.NotifyChatClient) {
			cli.ChatSubteamRename(ctx, chat1.ChatSubteamRenameArg{
				Uid:   uid,
				Convs: convs,
			})
		}, func(ctx context.Context, listener NotifyListener) {
			listener.ChatSubteamRename(uid, convIDs)
		})
}

func (n *NotifyRouter) HandleChatPromptUnfurl(ctx context.Context, uid keybase1.UID,
	convID chat1.ConversationID, msgID chat1.MessageID, domain string) {
	n.notifyChatCommon(ctx, "ChatPromptUnfurl", chat1.TopicType_CHAT,
		func(ctx context.Context, cli *chat1.NotifyChatClient) {
			cli.ChatPromptUnfurl(ctx, chat1.ChatPromptUnfurlArg{
				Uid:    uid,
				ConvID: convID,
				MsgID:  msgID,
				Domain: domain,
			})
		}, func(ctx context.Context, listener NotifyListener) {
			listener.ChatPromptUnfurl(uid, convID, msgID, domain)
		})
}

type notifyChatFn1 func(context.Context, *chat1.NotifyChatClient)
type notifyChatFn2 func(context.Context, NotifyListener)

func (n *NotifyRouter) notifyChatCommon(ctx context.Context, debugLabel string, topicType chat1.TopicType,
	fn1 notifyChatFn1, fn2 notifyChatFn2) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending %v notification", debugLabel)
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, topicType) {
			wg.Add(1)
			go func() {
				cli := &chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}
				fn1(context.Background(), cli)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		fn2(ctx, n.listener)
	}
	n.G().Log.CDebugf(ctx, "- Sent %v notification", debugLabel)
}

func (n *NotifyRouter) HandleWalletPaymentNotification(ctx context.Context, accountID stellar1.AccountID, paymentID stellar1.PaymentID) {
	if n == nil {
		return
	}
	n.G().Log.CDebugf(ctx, "+ Sending wallet PaymentNotification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Wallet` notification type
		if n.getNotificationChannels(id).Wallet {
			// In the background do...
			go func() {
				arg := stellar1.PaymentNotificationArg{
					AccountID: accountID,
					PaymentID: paymentID,
				}
				(stellar1.NotifyClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).PaymentNotification(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.WalletPaymentNotification(accountID, paymentID)
	}
	n.G().Log.CDebugf(ctx, "- Sent wallet PaymentNotification")
}

func (n *NotifyRouter) HandleWalletPaymentStatusNotification(ctx context.Context, accountID stellar1.AccountID, paymentID stellar1.PaymentID) {
	if n == nil {
		return
	}
	n.G().Log.CDebugf(ctx, "+ Sending wallet PaymentStatusNotification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Wallet` notification type
		if n.getNotificationChannels(id).Wallet {
			// In the background do...
			go func() {
				arg := stellar1.PaymentStatusNotificationArg{
					AccountID: accountID,
					PaymentID: paymentID,
				}
				(stellar1.NotifyClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).PaymentStatusNotification(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.WalletPaymentStatusNotification(accountID, paymentID)
	}
	n.G().Log.CDebugf(ctx, "- Sent wallet PaymentStatusNotification")
}

func (n *NotifyRouter) HandleWalletRequestStatusNotification(ctx context.Context, reqID stellar1.KeybaseRequestID) {
	if n == nil {
		return
	}
	n.G().Log.CDebugf(ctx, "+ Sending wallet RequestStatusNotification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Wallet` notification type
		if n.getNotificationChannels(id).Wallet {
			// In the background do...
			go func() {
				(stellar1.NotifyClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).RequestStatusNotification(context.Background(), reqID)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.WalletRequestStatusNotification(reqID)
	}
	n.G().Log.CDebugf(ctx, "- Sent wallet RequestStatusNotification")
}

func (n *NotifyRouter) HandleWalletAccountDetailsUpdate(ctx context.Context, accountID stellar1.AccountID, account stellar1.WalletAccountLocal) {
	if n == nil {
		return
	}
	n.G().Log.CDebugf(ctx, "+ Sending wallet AccountDetailsUpdate")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Wallet` notification type
		if n.getNotificationChannels(id).Wallet {
			// In the background do...
			go func() {
				arg := stellar1.AccountDetailsUpdateArg{
					AccountID: accountID,
					Account:   account,
				}
				(stellar1.NotifyClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).AccountDetailsUpdate(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.WalletAccountDetailsUpdate(accountID, account)
	}
	n.G().Log.CDebugf(ctx, "- Sent wallet AccountDetailsUpdate")
}

func (n *NotifyRouter) HandleWalletPendingPaymentsUpdate(ctx context.Context, accountID stellar1.AccountID, pending []stellar1.PaymentOrErrorLocal) {
	if n == nil {
		return
	}
	n.G().Log.CDebugf(ctx, "+ Sending wallet PendingPaymentsUpdate")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Wallet` notification type
		if n.getNotificationChannels(id).Wallet {
			// In the background do...
			go func() {
				arg := stellar1.PendingPaymentsUpdateArg{
					AccountID: accountID,
					Pending:   pending,
				}
				(stellar1.NotifyClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).PendingPaymentsUpdate(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.WalletPendingPaymentsUpdate(accountID, pending)
	}
	n.G().Log.CDebugf(ctx, "- Sent wallet PendingPaymentsUpdate")
}

func (n *NotifyRouter) HandleWalletRecentPaymentsUpdate(ctx context.Context, accountID stellar1.AccountID, firstPage stellar1.PaymentsPageLocal) {
	if n == nil {
		return
	}
	n.G().Log.CDebugf(ctx, "+ Sending wallet RecentPaymentsUpdate")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Wallet` notification type
		if n.getNotificationChannels(id).Wallet {
			// In the background do...
			go func() {
				arg := stellar1.RecentPaymentsUpdateArg{
					AccountID: accountID,
					FirstPage: firstPage,
				}
				(stellar1.NotifyClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).RecentPaymentsUpdate(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.WalletRecentPaymentsUpdate(accountID, firstPage)
	}
	n.G().Log.CDebugf(ctx, "- Sent wallet RecentPaymentsUpdate")
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).Shutdown(context.Background(), int(n.G().ExitCode))
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
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
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ReachabilityChanged(context.Background(), r)
			}()
		}
		return true
	})
	n.G().Log.Debug("- Sent reachability")
}

// teamID and teamName are not necessarily the same team
func (n *NotifyRouter) HandleTeamChangedByBothKeys(ctx context.Context,
	teamID keybase1.TeamID, teamName string, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {

	n.HandleTeamChangedByID(ctx, teamID, latestSeqno, implicitTeam, changes)
	n.HandleTeamChangedByName(ctx, teamName, latestSeqno, implicitTeam, changes)
}

func (n *NotifyRouter) HandleTeamChangedByID(ctx context.Context,
	teamID keybase1.TeamID, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {

	if n == nil {
		return
	}

	arg := keybase1.TeamChangedByIDArg{
		TeamID:       teamID,
		LatestSeqno:  latestSeqno,
		ImplicitTeam: implicitTeam,
		Changes:      changes,
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending TeamChangedByID notification (team:%v, seqno:%v, implicit:%v)",
		teamID, latestSeqno, implicitTeam)
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			wg.Add(1)
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).TeamChangedByID(context.Background(), arg)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.TeamChangedByID(teamID, latestSeqno, implicitTeam, changes)
	}
	n.G().Log.CDebugf(ctx, "- Sent TeamChangedByID notification")
}

func (n *NotifyRouter) HandleTeamChangedByName(ctx context.Context,
	teamName string, latestSeqno keybase1.Seqno, implicitTeam bool, changes keybase1.TeamChangeSet) {

	if n == nil {
		return
	}

	arg := keybase1.TeamChangedByNameArg{
		TeamName:     teamName,
		LatestSeqno:  latestSeqno,
		ImplicitTeam: implicitTeam,
		Changes:      changes,
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending TeamChangedByName notification (team:%v, seqno:%v, implicit:%v)",
		teamName, latestSeqno, implicitTeam)
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			wg.Add(1)
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).TeamChangedByName(context.Background(), arg)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.TeamChangedByName(teamName, latestSeqno, implicitTeam, changes)
	}
	n.G().Log.CDebugf(ctx, "- Sent TeamChanged notification")
}

// HandleTeamListUnverifiedChanged is called when a notification is received from gregor that
// we think might be of interest to the UI, specifically the parts of the UI that update using
// the TeamListUnverified rpc.
func (n *NotifyRouter) HandleTeamListUnverifiedChanged(ctx context.Context, teamName string) {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending TeamListUnverifiedChanged notification (team:%v)", teamName)
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Team` notifications
		if n.getNotificationChannels(id).Team {
			// In the background do...
			go func() {
				// A send of a `TeamListUnverifiedChanged` RPC
				(keybase1.NotifyUnverifiedTeamListClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).TeamListUnverifiedChanged(context.Background(), teamName)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.TeamListUnverifiedChanged(teamName)
	}
	n.G().Log.Debug("- Sent TeamListUnverifiedChanged notification (team:%v)", teamName)
}

// HandleCanUserPerformChanged is called when a notification is received from gregor that
// we think might be of interest to the UI, specifically the parts of the UI that update
// permissions for a user in a team.
func (n *NotifyRouter) HandleCanUserPerformChanged(ctx context.Context, teamName string) {
	if n == nil {
		return
	}

	n.G().Log.Debug("+ Sending CanUserPerformChanged notification (team:%v)", teamName)
	// For all connections we currently have open...
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		// If the connection wants the `Team` notification type
		if n.getNotificationChannels(id).Team {
			// In the background do...
			go func() {
				// A send of a `CanUserPerformChanged` RPC
				(keybase1.NotifyCanUserPerformClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).CanUserPerformChanged(context.Background(), teamName)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.CanUserPerformChanged(teamName)
	}
	n.G().Log.Debug("- Sent CanUserPerformChanged notification (team:%v)", teamName)
}

func (n *NotifyRouter) HandleTeamDeleted(ctx context.Context, teamID keybase1.TeamID) {
	if n == nil {
		return
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending TeamDeleted notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			wg.Add(1)
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).TeamDeleted(context.Background(), teamID)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.TeamDeleted(teamID)
	}
	n.G().Log.CDebugf(ctx, "- Sent TeamDeleted notification")
}

func (n *NotifyRouter) HandleTeamExit(ctx context.Context, teamID keybase1.TeamID) {
	if n == nil {
		return
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending TeamExit notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			wg.Add(1)
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).TeamExit(context.Background(), teamID)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.TeamExit(teamID)
	}
	n.G().Log.CDebugf(ctx, "- Sent TeamExit notification")
}

func (n *NotifyRouter) HandleTeamAbandoned(ctx context.Context, teamID keybase1.TeamID) {
	if n == nil {
		return
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending TeamAbandoned notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			wg.Add(1)
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).TeamAbandoned(context.Background(), teamID)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.TeamExit(teamID)
	}
	n.G().Log.CDebugf(ctx, "- Sent TeamAbandoned notification")
}

func (n *NotifyRouter) HandleNewlyAddedToTeam(ctx context.Context, teamID keybase1.TeamID) {
	if n == nil {
		return
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending NewlyAddedToTeam notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			wg.Add(1)
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).NewlyAddedToTeam(context.Background(), teamID)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.NewlyAddedToTeam(teamID)
	}
	n.G().Log.CDebugf(ctx, "- Sent NewlyAddedToTeam notification")
}

func (n *NotifyRouter) HandleNewTeamEK(ctx context.Context, teamID keybase1.TeamID, generation keybase1.EkGeneration) {
	if n == nil {
		return
	}

	arg := keybase1.NewTeamEkArg{
		Id:         teamID,
		Generation: generation,
	}

	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending NewTeamEK notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Ephemeral {
			wg.Add(1)
			go func() {
				(keybase1.NotifyEphemeralClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).NewTeamEk(context.Background(), arg)
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.NewTeamEK(teamID, generation)
	}
	n.G().Log.CDebugf(ctx, "- Sent NewTeamEK notification")
}

func (n *NotifyRouter) HandleAvatarUpdated(ctx context.Context, name string, formats []keybase1.AvatarFormat,
	typ keybase1.AvatarUpdateType) {
	if n == nil {
		return
	}
	arg := keybase1.AvatarUpdatedArg{
		Name:    name,
		Formats: formats,
		Typ:     typ,
	}
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			go func() {
				(keybase1.NotifyTeamClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).AvatarUpdated(context.Background(), arg)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.AvatarUpdated(name, formats)
	}
}

func (n *NotifyRouter) HandlePhoneNumberAdded(ctx context.Context, phoneNumber keybase1.PhoneNumber) {
	if n == nil {
		return
	}
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			go func() {
				(keybase1.NotifyPhoneNumberClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).PhoneNumberAdded(context.Background(), phoneNumber)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.PhoneNumberAdded(phoneNumber)
	}
}

func (n *NotifyRouter) HandlePhoneNumberVerified(ctx context.Context, phoneNumber keybase1.PhoneNumber) {
	if n == nil {
		return
	}
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			go func() {
				(keybase1.NotifyPhoneNumberClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).PhoneNumberVerified(context.Background(), phoneNumber)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.PhoneNumberVerified(phoneNumber)
	}
}

func (n *NotifyRouter) HandlePhoneNumberSuperseded(ctx context.Context, phoneNumber keybase1.PhoneNumber) {
	if n == nil {
		return
	}
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.getNotificationChannels(id).Team {
			go func() {
				(keybase1.NotifyPhoneNumberClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).PhoneNumberSuperseded(context.Background(), phoneNumber)
			}()
		}
		return true
	})
	if n.listener != nil {
		n.listener.PhoneNumberSuperseded(phoneNumber)
	}
}

func (n *NotifyRouter) HandleChatPaymentInfo(ctx context.Context, uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, info chat1.UIPaymentInfo) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatPaymentInfo notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, chat1.TopicType_NONE) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatPaymentInfo(context.Background(), chat1.ChatPaymentInfoArg{
					Uid:    uid,
					ConvID: convID,
					MsgID:  msgID,
					Info:   info,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatPaymentInfo(uid, convID, msgID, info)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatPaymentInfo notification")
}

func (n *NotifyRouter) HandleChatRequestInfo(ctx context.Context, uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, info chat1.UIRequestInfo) {
	if n == nil {
		return
	}
	var wg sync.WaitGroup
	n.G().Log.CDebugf(ctx, "+ Sending ChatRequestInfo notification")
	n.cm.ApplyAll(func(id ConnectionID, xp rpc.Transporter) bool {
		if n.shouldSendChatNotification(id, chat1.TopicType_NONE) {
			wg.Add(1)
			go func() {
				(chat1.NotifyChatClient{
					Cli: rpc.NewClient(xp, NewContextifiedErrorUnwrapper(n.G()), nil),
				}).ChatRequestInfo(context.Background(), chat1.ChatRequestInfoArg{
					Uid:    uid,
					ConvID: convID,
					MsgID:  msgID,
					Info:   info,
				})
				wg.Done()
			}()
		}
		return true
	})
	wg.Wait()
	if n.listener != nil {
		n.listener.ChatRequestInfo(uid, convID, msgID, info)
	}
	n.G().Log.CDebugf(ctx, "- Sent ChatRequestInfo notification")
}
