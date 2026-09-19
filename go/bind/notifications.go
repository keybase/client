package keybase

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"runtime"
	"strconv"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/kyokomi/emoji"
)

const seenNotificationsCacheSize = 100

var (
	seenNotificationsMtx  sync.Mutex
	seenNotifications     *lru.Cache
	seenNotificationsOnce sync.Once

	multipleAccountsMtx    sync.Mutex
	multipleAccountsCached *bool
)

var errAndroidNotificationForOtherAccount = errors.New("android notification for different account")

func clearMultipleAccountsCache() {
	multipleAccountsMtx.Lock()
	multipleAccountsCached = nil
	multipleAccountsMtx.Unlock()
}

// accountCacheHook clears the cached result of hasMultipleLoggedInAccounts
// whenever login/logout changes the available stored-secret accounts.
type accountCacheHook struct{}

func (accountCacheHook) OnLogin(_ libkb.MetaContext) error {
	clearMultipleAccountsCache()
	return nil
}

func (accountCacheHook) OnLogout(_ libkb.MetaContext) error {
	clearMultipleAccountsCache()
	return nil
}

func hasMultipleLoggedInAccounts(ctx context.Context) bool {
	multipleAccountsMtx.Lock()
	defer multipleAccountsMtx.Unlock()
	if multipleAccountsCached != nil {
		return *multipleAccountsCached
	}
	users, err := kbCtx.GetUsersWithStoredSecrets(ctx)
	if err != nil {
		// Don't cache on error; retry next time.
		return false
	}
	result := len(users) > 1
	multipleAccountsCached = &result
	return result
}

func getSeenNotificationsCache() *lru.Cache {
	seenNotificationsOnce.Do(func() {
		seenNotifications, _ = lru.New(seenNotificationsCacheSize)
	})
	return seenNotifications
}

type Person struct {
	KeybaseUsername string
	KeybaseAvatar   string
	IsBot           bool
}

type Message struct {
	ID            int
	Kind          string // "Text" | "Reaction"
	Plaintext     string
	ServerMessage string // This is the server's suggested display message for the notification
	From          *Person
	At            int64
}

type ChatNotification struct {
	Message   *Message
	ConvID    string
	TeamName  string
	TopicName string
	TlfName   string
	// e.g. "keybase#general, CoolTeam, Susannah,Jake"
	ConversationName    string
	IsGroupConversation bool
	IsPlaintext         bool
	SoundName           string
	BadgeCount          int
	// Title is the notification title, e.g. "username@keybase"
	Title string
	// Uid is the UID of the account this notification belongs to.
	// Included in the local notification's userInfo so that a notification
	// tap can switch to the correct account if a different one is active.
	Uid string
}

// HandlePostTextReply sends a notification quick reply, in the foreground too.
// pusher warns about the reply if it won't send.
func HandlePostTextReply(strConvID, tlfName string, intMessageID int, body string, pusher PushNotifier) (err error) {
	ctx := context.Background()
	defer kbCtx.CTrace(ctx, "HandlePostTextReply", &err)()
	defer func() { err = flattenError(err) }()
	return inPushWindow(pusher, func(bool) error {
		return postTextReply(ctx, globals.NewContext(kbCtx, kbChatCtx), strConvID, tlfName, intMessageID, body)
	})
}

// postTextReply sends a notification quick reply and marks the conversation
// read. The send is nonblocking: an error means the message couldn't be
// queued, not that delivery failed.
func postTextReply(ctx context.Context, gc *globals.Context, strConvID, tlfName string, intMessageID int,
	body string,
) error {
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	if intMessageID < 0 {
		return fmt.Errorf("invalid message ID: %d", intMessageID)
	}
	uid, err := utils.AssertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	if _, err := gc.ChatHelper.SendTextByIDNonblock(ctx, convID, tlfName, body, &outboxID, nil); err != nil {
		return err
	}

	gc.Log.CDebugf(ctx, "Marking as read from QuickReply: convID: %s", strConvID)
	msgID := chat1.MessageID(intMessageID)
	if err := gc.InboxSource.MarkAsRead(ctx, convID, uid, &msgID, false /* forceUnread */); err != nil {
		// The reply went out; failing to mark it read doesn't fail the reply.
		gc.Log.CDebugf(ctx, "Failed to mark as read from QuickReply: convID: %s. Err: %s", strConvID, err)
	}
	return nil
}

var spoileRegexp = regexp.MustCompile(`!>(.*?)<!`)

// HandleBackgroundNotification unboxes a chat push, displays it through
// pusher and acks it. A nil pusher displays nothing. While the UI is active it
// acks without displaying, since the app already shows the message.
// taskPusher warns about messages that won't send if the push window hands
// over to a background task.
func HandleBackgroundNotification(strConvID, body, serverMessageBody, sender string, intMembersType int,
	displayPlaintext bool, intMessageID int, pushID string, badgeCount, unixTime int, soundName string,
	pusher PushNotifier, showIfStale bool, targetUID string, taskPusher PushNotifier,
) error {
	// iOS gives roughly 30 seconds of background time for a remote
	// notification; leave enough of that budget for unboxing and acking.
	start := time.Now()
	if err := waitForInit(15 * time.Second); err != nil {
		return err
	}
	initDuration := time.Since(start)
	return inPushWindow(taskPusher, func(uiActive bool) error {
		return handleBackgroundNotification(strConvID, body, serverMessageBody, sender, intMembersType,
			displayPlaintext, intMessageID, pushID, badgeCount, unixTime, soundName, pusher, showIfStale,
			targetUID, uiActive, initDuration)
	})
}

func handleBackgroundNotification(strConvID, body, serverMessageBody, sender string, intMembersType int,
	displayPlaintext bool, intMessageID int, pushID string, badgeCount, unixTime int, soundName string,
	pusher PushNotifier, showIfStale bool, targetUID string, uiActive bool, initDuration time.Duration,
) (err error) {
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := globals.ChatCtx(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))

	defer kbCtx.CTrace(ctx, fmt.Sprintf("HandleBackgroundNotification(%s,%s,%v,%d,%d,%s,%d,%d,%v)",
		strConvID, sender, displayPlaintext, intMembersType, intMessageID, pushID, badgeCount, unixTime, uiActive), &err)()
	defer func() { err = flattenError(err) }()
	kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: waitForInit took %v", initDuration)

	// Unbox
	if !kbCtx.ActiveDevice.HaveKeys() {
		return libkb.LoginRequiredError{}
	}
	// If the push includes a target UID, verify it matches the currently active account
	// before doing any work or updating any state (including badge count).
	if targetUID != "" {
		activeUID := string(kbCtx.Env.GetUID())
		if activeUID != targetUID {
			kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: push targetUID %s != active uid %s, ignoring", targetUID, activeUID)
			// On Android, return an error so the caller can suppress badge updates for
			// silent pushes and fall back to a visible notification for loud pushes.
			// On iOS the system-delivered alert remains available, so returning nil
			// avoids noisy background-processing failures.
			if runtime.GOOS == "android" {
				return errAndroidNotificationForOtherAccount
			}
			return nil
		}
	}
	mp := chat.NewMobilePush(gc)
	// Dedupe by convID||msgID
	dupKey := strConvID + "||" + strconv.Itoa(intMessageID)
	// Optimistic early-exit: check under the mutex so that if another goroutine
	// is currently in the display+add critical section below, we wait for it to
	// finish and then see the cache entry rather than proceeding with redundant work.
	seenNotificationsMtx.Lock()
	_, isDup := getSeenNotificationsCache().Get(dupKey)
	seenNotificationsMtx.Unlock()
	if isDup {
		// Cancel any duplicate visible notifications
		if len(pushID) > 0 {
			ack := chat.NewPushAck(ctx, gc)
			defer ack.Shutdown()
			ack.Ack(ctx, []string{pushID})
		}
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: duplicate notification convID=%s msgID=%d", strConvID, intMessageID)
		// Return nil (not an error) so Android does not treat this as failure and show a fallback notification.
		return nil
	}
	uid := gregor1.UID(kbCtx.Env.GetUID().ToBytes())
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: invalid convID: %s msg: %s", strConvID, err)
		return err
	}
	// Pre-dial the gregor connection used to ack this push: the connection
	// starts its TLS/auth handshake at construction, so it connects in
	// parallel with the conversation fetch and unbox below. The ack races the
	// server's fallback timeout, after which it delivers the generic
	// notification.
	var ack *chat.PushAck
	if len(pushID) > 0 {
		ack = chat.NewPushAck(ctx, gc)
		defer ack.Shutdown()
	}
	membersType := chat1.ConversationMembersType(intMembersType)
	conv, err := utils.GetVerifiedConv(ctx, gc, uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "Failed to get conversation info", err)
		return err
	}

	currentUsername := string(kbCtx.Env.GetUsername())
	title := "Keybase"
	if hasMultipleLoggedInAccounts(ctx) {
		title = fmt.Sprintf("%s@keybase", currentUsername)
	}
	chatNotification := ChatNotification{
		IsPlaintext: displayPlaintext,
		Message: &Message{
			ID:            intMessageID,
			ServerMessage: serverMessageBody,
			From:          &Person{},
			At:            int64(unixTime) * 1000,
		},
		ConvID:              strConvID,
		TopicName:           conv.Info.TopicName,
		TlfName:             conv.Info.TlfName,
		IsGroupConversation: len(conv.Info.Participants) > 2,
		ConversationName:    utils.FormatConversationName(conv.Info, currentUsername),
		SoundName:           soundName,
		BadgeCount:          badgeCount,
		Title:               title,
		Uid:                 uid.String(),
	}
	kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: title=%s", chatNotification.Title)

	msgUnboxed, err := mp.UnboxPushNotification(ctx, uid, convID, membersType, body)
	if err == nil && msgUnboxed.IsValid() {
		chatNotification.Message.From.IsBot = msgUnboxed.SenderIsBot()
		username := msgUnboxed.Valid().SenderUsername
		chatNotification.Message.From.KeybaseUsername = username

		if displayPlaintext && !msgUnboxed.Valid().IsEphemeral() {
			// We show avatars on Android
			if runtime.GOOS == "android" && !uiActive {
				avatar, err := kbSvc.GetUserAvatar(username)

				if err != nil {
					kbCtx.Log.CDebugf(ctx, "Push Notif: Err in getting user avatar %v", err)
				} else {
					chatNotification.Message.From.KeybaseAvatar = avatar
				}
			}

			switch msgUnboxed.GetMessageType() {
			case chat1.MessageType_TEXT:
				chatNotification.Message.Kind = "Text"
				chatNotification.Message.Plaintext = spoileRegexp.ReplaceAllString(msgUnboxed.Valid().MessageBody.Text().Body, "•••")
			case chat1.MessageType_REACTION:
				chatNotification.Message.Kind = "Reaction"
				reaction, err := utils.GetReaction(msgUnboxed)
				if err != nil {
					return err
				}
				chatNotification.Message.Plaintext = emoji.Sprintf("Reacted to your message with %v", reaction)
			default:
				kbCtx.Log.CDebugf(ctx, "unboxNotification: Unknown message type: %v",
					msgUnboxed.GetMessageType())
				return errors.New("invalid message type for plaintext")
			}
		}
	} else {
		kbCtx.Log.CDebugf(ctx, "unboxNotification: failed to unbox: %s", err)
		chatNotification.Message.From.KeybaseUsername = sender
		// just bail out of here at this point since we won't be displaying anything useful,
		// and we don't want to accidentally ack the plaintext notification when we didn't really
		// display it.
		if len(serverMessageBody) == 0 {
			return errors.New("Unbox failed; nothing to display")
		}
	}

	age := time.Since(time.Unix(int64(unixTime), 0))

	// On iOS we don't want to show stale notifications. Nonsilent notifications
	// can come later and cause duplicate notifications. On Android, both silent
	// and non-silent notifications go through this function; and Java checks if we
	// have already seen a notification. We don't need this stale logic.
	if !showIfStale && age >= 2*time.Minute {
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: stale notification: %v", age)
		return errors.New("stale notification")
	}

	// only display and ack this notification if we actually have something to display
	if pusher != nil && (len(chatNotification.Message.Plaintext) > 0 || len(chatNotification.Message.ServerMessage) > 0) {
		ackPush := func() {
			if ack != nil {
				ack.Ack(ctx, []string{pushID})
			}
		}
		if displayOnce(dupKey, &chatNotification, pusher, uiActive, ackPush) {
			kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: duplicate notification convID=%s msgID=%d", strConvID, intMessageID)
		}
	}
	return nil
}

// displayOnce displays n unless its push was already handled, then acks the
// push. While the UI is active it only acks: the app already shows the
// message. It reports whether the push was a duplicate.
func displayOnce(dupKey string, n *ChatNotification, pusher PushNotifier, uiActive bool, ack func()) (dup bool) {
	seenNotificationsMtx.Lock()
	defer seenNotificationsMtx.Unlock()
	if _, ok := getSeenNotificationsCache().Get(dupKey); ok {
		// Cancel any duplicate visible notifications
		ack()
		return true
	}
	// Add to cache before displaying so that any concurrent goroutine that
	// reaches the check while DisplayChatNotification is running sees the
	// entry and bails out rather than displaying a duplicate.
	getSeenNotificationsCache().Add(dupKey, struct{}{})
	if !uiActive {
		pusher.DisplayChatNotification(n)
	}
	ack()
	return false
}
