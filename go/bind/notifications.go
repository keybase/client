package keybase

import (
	"errors"
	"fmt"
	"runtime"
	"time"

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
	context "golang.org/x/net/context"
)

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
}

func HandlePostTextReply(strConvID, tlfName string, intMessageID int, body string) (err error) {
	ctx := context.Background()
	defer kbCtx.CTrace(ctx, "HandlePostTextReply", &err)()
	defer func() { err = flattenError(err) }()
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	_, err = kbCtx.ChatHelper.SendTextByIDNonblock(context.Background(), convID, tlfName, body, &outboxID, nil)

	kbCtx.Log.CDebugf(ctx, "Marking as read from QuickReply: convID: %s", strConvID)
	gc := globals.NewContext(kbCtx, kbChatCtx)
	uid, err := utils.AssertLoggedInUID(ctx, gc)
	if err != nil {
		return err
	}

	msgID := chat1.MessageID(intMessageID)
	if err = kbChatCtx.InboxSource.MarkAsRead(context.Background(), convID, uid, &msgID, false /* forceUnread */); err != nil {
		kbCtx.Log.CDebugf(ctx, "Failed to mark as read from QuickReply: convID: %s. Err: %s", strConvID, err)
		// We don't want to fail this method call just because we couldn't mark it as aread
		err = nil
	}

	return nil
}

func HandleBackgroundNotification(strConvID, body, serverMessageBody, sender string, intMembersType int,
	displayPlaintext bool, intMessageID int, pushID string, badgeCount, unixTime int, soundName string,
	pusher PushNotifier, showIfStale bool) (err error) {
	if err := waitForInit(10 * time.Second); err != nil {
		return err
	}
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := globals.ChatCtx(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))

	defer kbCtx.CTrace(ctx, fmt.Sprintf("HandleBackgroundNotification(%s,%s,%v,%d,%d,%s,%d,%d)",
		strConvID, sender, displayPlaintext, intMembersType, intMessageID, pushID, badgeCount, unixTime), &err)()
	defer func() { err = flattenError(err) }()

	// Unbox
	if !kbCtx.ActiveDevice.HaveKeys() {
		return libkb.LoginRequiredError{}
	}
	mp := chat.NewMobilePush(gc)
	uid := gregor1.UID(kbCtx.Env.GetUID().ToBytes())
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: invalid convID: %s msg: %s", strConvID, err)
		return err
	}
	membersType := chat1.ConversationMembersType(intMembersType)
	conv, err := utils.GetVerifiedConv(ctx, gc, uid, convID, types.InboxSourceDataSourceLocalOnly)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "Failed to get conversation info", err)
		return err
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
		ConversationName:    utils.FormatConversationName(conv.Info, string(kbCtx.Env.GetUsername())),
		SoundName:           soundName,
		BadgeCount:          badgeCount,
	}

	msgUnboxed, err := mp.UnboxPushNotification(ctx, uid, convID, membersType, body)
	if err == nil && msgUnboxed.IsValid() {
		chatNotification.Message.From.IsBot = msgUnboxed.SenderIsBot()
		username := msgUnboxed.Valid().SenderUsername
		chatNotification.Message.From.KeybaseUsername = username

		if displayPlaintext && !msgUnboxed.Valid().IsEphemeral() {
			// We show avatars on Android
			if runtime.GOOS == "android" {
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
				chatNotification.Message.Plaintext = msgUnboxed.Valid().MessageBody.Text().Body
			case chat1.MessageType_REACTION:
				chatNotification.Message.Kind = "Reaction"
				reaction, err := utils.GetReaction(msgUnboxed)
				if err != nil {
					return err
				}
				chatNotification.Message.Plaintext =
					emoji.Sprintf("Reacted to your message with %v", reaction)
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
		pusher.DisplayChatNotification(&chatNotification)
		if len(pushID) > 0 {
			mp.AckNotificationSuccess(ctx, []string{pushID})
		}
	}
	return nil
}
