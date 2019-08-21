package keybase

import (
	"encoding/hex"
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
	ID        int
	Kind      string // "Text" | "Reaction"
	Plaintext string
	From      *Person
	At        int64
}

type ChatNotification struct {
	Message   *Message
	ConvID    string
	TeamName  string
	TopicName string
	TlFName   string
	// e.g. "keybase#general, CoolTeam, Susannah,Jake"
	ConversationName    string
	IsGroupConversation bool
	IsPlaintext         bool
	SoundName           string
	BadgeCount          int
}

func HandlePostTextReply(strConvID, tlfName string, body string, replyTo int) (err error) {
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	kbCtx.ChatHelper.SendTextByIDNonblock(context.Background(), convID, tlfName, body, &outboxID, nil)
	return nil
}

func HandleBackgroundNotification(strConvID, body string, intMembersType int, displayPlaintext bool,
	intMessageID int, pushID string, badgeCount, unixTime int, soundName string, pusher PushNotifier) (err error) {
	if err := waitForInit(5 * time.Second); err != nil {
		return nil
	}
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := globals.ChatCtx(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))

	defer kbCtx.CTrace(ctx, fmt.Sprintf("HandleBackgroundNotification(%s,%v,%d,%d,%s,%d,%d)",
		strConvID, displayPlaintext, intMembersType, intMessageID, pushID, badgeCount, unixTime),
		func() error { return flattenError(err) })()

	// Unbox
	if !kbCtx.ActiveDevice.HaveKeys() {
		return libkb.LoginRequiredError{}
	}
	mp := chat.NewMobilePush(gc)
	uid := gregor1.UID(kbCtx.Env.GetUID().ToBytes())
	bConvID, err := hex.DecodeString(strConvID)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: invalid convID: %s msg: %s", strConvID, err)
		return err
	}
	convID := chat1.ConversationID(bConvID)
	membersType := chat1.ConversationMembersType(intMembersType)
	msgUnboxed, err := mp.UnboxPushNotification(ctx, uid, convID, membersType, body)

	if err != nil {
		kbCtx.Log.CDebugf(ctx, "unboxNotification: failed to unbox: %s", err)
		return err
	}

	conv, err := utils.GetVerifiedConv(ctx, gc, uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "Failed to get conversation info", err)
		return err
	}

	isBot := msgUnboxed.SenderIsBot()
	username := msgUnboxed.Valid().SenderUsername

	chatNotification := ChatNotification{
		IsPlaintext: displayPlaintext,
		Message: &Message{
			ID: intMessageID,
			From: &Person{
				KeybaseUsername: username,
				IsBot:           isBot,
			},
			At: int64(unixTime) * 1000,
		},
		ConvID:              strConvID,
		TopicName:           conv.Info.TopicName,
		TlFName:             conv.Info.TlfName,
		IsGroupConversation: len(conv.Info.Participants) > 2,
		ConversationName:    formatConversationName(conv.Info),
		SoundName:           soundName,
		BadgeCount:          badgeCount,
	}

	if displayPlaintext {
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
			chatNotification.Message.Plaintext = emoji.Sprintf("Reacted to your message with %v", reaction)
		default:
			kbCtx.Log.CDebugf(ctx, "unboxNotification: Unknown message type: %v", msgUnboxed.GetMessageType())
			return errors.New("invalid message type for plaintext")
		}
	}

	age := time.Since(time.Unix(int64(unixTime), 0))
	if age >= 2*time.Minute {
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: stale notification: %v", age)
		return errors.New("stale notification")
	}

	pusher.DisplayChatNotification(&chatNotification)
	mp.AckNotificationSuccess(ctx, []string{pushID})
	return nil
}
