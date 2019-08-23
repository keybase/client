package keybase

import (
	"encoding/hex"
	"errors"
	"fmt"
	"runtime"
	"strings"
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

func HandlePostTextReply(strConvID, tlfName string, body string) (err error) {
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return err
	}
	convID, err := chat1.MakeConvID(strConvID)
	if err != nil {
		return err
	}
	_, err = kbCtx.ChatHelper.SendTextByIDNonblock(context.Background(), convID, tlfName, body, &outboxID, nil)
	return err
}

func HandleBackgroundNotification(strConvID, body, serverMessageBody string, intMembersType int, displayPlaintext bool,
	intMessageID int, pushID string, badgeCount, unixTime int, soundName string, pusher PushNotifier) (err error) {
	if err := waitForInit(5 * time.Second); err != nil {
		return nil
	}
	gc := globals.NewContext(kbCtx, kbChatCtx)
	ctx := globals.ChatCtx(context.Background(), gc,
		keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, chat.NewCachingIdentifyNotifier(gc))

	defer kbCtx.CTraceTimed(ctx, fmt.Sprintf("HandleBackgroundNotification(%s,%v,%d,%d,%s,%d,%d)",
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
	conv, err := utils.GetVerifiedConv(ctx, gc, uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		kbCtx.Log.CDebugf(ctx, "Failed to get conversation info", err)
		return err
	}

	chatNotification := ChatNotification{
		IsPlaintext: displayPlaintext,
		Message: &Message{
			ID:            intMessageID,
			ServerMessage: serverMessageBody,
			From: &Person{
				KeybaseUsername: "",
				IsBot:           false,
			},
			At: int64(unixTime) * 1000,
		},
		ConvID:              strConvID,
		TopicName:           conv.Info.TopicName,
		TlfName:             conv.Info.TlfName,
		IsGroupConversation: len(conv.Info.Participants) > 2,
		ConversationName:    formatConversationName(conv.Info),
		SoundName:           soundName,
		BadgeCount:          badgeCount,
	}

	msgUnboxed, err := mp.UnboxPushNotification(ctx, uid, convID, membersType, body)
	if err == nil {
		chatNotification.Message.From.IsBot = msgUnboxed.SenderIsBot()
		username := msgUnboxed.Valid().SenderUsername
		chatNotification.Message.From.KeybaseUsername = username

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
	} else {
		kbCtx.Log.CDebugf(ctx, "unboxNotification: failed to unbox: %s", err)
		// Guess the username? We need this for android
		split := strings.Split(serverMessageBody, " ")
		if len(split) > 1 {
			chatNotification.Message.From.KeybaseUsername = split[0]
		}
	}

	age := time.Since(time.Unix(int64(unixTime), 0))
	if age >= 2*time.Minute {
		kbCtx.Log.CDebugf(ctx, "HandleBackgroundNotification: stale notification: %v", age)
		return errors.New("stale notification")
	}

	pusher.DisplayChatNotification(&chatNotification)
	if len(pushID) != 0 {
		mp.AckNotificationSuccess(ctx, []string{pushID})
	}
	return nil
}
