// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type CmdChatAPIListen struct {
	libkb.Contextified

	// Print exploding messages? false by default. We want API consumer to make
	// a concious choice that they want to process exploding messages, which
	// depending on their use case might require extra care to keep secrecy
	// of chat participants.
	showExploding bool

	showLocal bool
}

func newCmdChatAPIListen(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name: "api-listen",
		// No "Usage" field makes it hidden in command list.
		Description: "Listen and print incoming chat actions in JSON format",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&CmdChatAPIListen{
				Contextified: libkb.NewContextified(g),
			}, "api-listen", c)
			cl.SetNoStandalone()
		},
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "exploding",
				Usage: "Show exploding messages (skipped by default)",
			},
			cli.BoolFlag{
				Name:  "local",
				Usage: "Show local messages (skipped by default)",
			},
		},
	}
}

func (c *CmdChatAPIListen) ParseArgv(ctx *cli.Context) error {
	c.showExploding = ctx.Bool("exploding")
	c.showLocal = ctx.Bool("local")
	return nil
}

func NewCmdChatAPIListenRunner(g *libkb.GlobalContext) *CmdChatAPIListen {
	return &CmdChatAPIListen{
		Contextified: libkb.NewContextified(g),
	}
}

func (c *CmdChatAPIListen) Run() error {
	display := &chatNotificationDisplay{
		Contextified: libkb.NewContextified(c.G()),
		cmd:          c,
	}
	protocols := []rpc.Protocol{
		chat1.NotifyChatProtocol(display),
	}
	channels := keybase1.NotificationChannels{
		Chat: true,
	}

	if err := RegisterProtocolsWithContext(protocols, c.G()); err != nil {
		return err
	}
	cli, err := GetNotifyCtlClient(c.G())
	if err != nil {
		return err
	}
	if err := cli.SetNotifications(context.TODO(), channels); err != nil {
		return err
	}

	display.errorf("Listening for chat notifications...\n")
	for {
		time.Sleep(time.Second)
	}
}

func (c *CmdChatAPIListen) GetUsage() libkb.Usage {
	return libkb.Usage{}
}

type chatNotificationDisplay struct {
	libkb.Contextified
	cmd *CmdChatAPIListen
	svc chatServiceHandler
}

func (d *chatNotificationDisplay) printf(fmt string, args ...interface{}) error {
	_, err := d.G().UI.GetTerminalUI().Printf(fmt, args...)
	return err
}

func (d *chatNotificationDisplay) errorf(format string, args ...interface{}) error {
	_, err := d.G().UI.GetTerminalUI().ErrorWriter().Write([]byte(fmt.Sprintf(format, args...)))
	return err
}

type msgNotification struct {
	Source     string              `json:"source,omitempty"`
	Msg        *MsgSummary         `json:"msg,omitempty"`
	Error      *string             `json:"error,omitempty"`
	Pagination *chat1.UIPagination `json:"pagination,omitempty"`
}

func (d *chatNotificationDisplay) formatMessage(inMsg chat1.IncomingMessage) *Message {
	if inMsg.Message.IsValid() {
		mv := inMsg.Message.Valid()
		summary := &MsgSummary{
			ID: mv.MessageID,
			Channel: ChatChannel{
				Name:        inMsg.Conv.Name,
				MembersType: strings.ToLower(inMsg.Conv.MembersType.String()),
				TopicType:   strings.ToLower(inMsg.Conv.TopicType.String()),
				TopicName:   inMsg.Conv.Channel,
				Public:      inMsg.Conv.Visibility == keybase1.TLFVisibility_PUBLIC,
			},
			Sender: MsgSender{
				Username:   mv.SenderUsername,
				DeviceName: mv.SenderDeviceName,
			},
			SentAt:              mv.Ctime.UnixSeconds(),
			SentAtMs:            mv.Ctime.UnixMilliseconds(),
			RevokedDevice:       mv.SenderDeviceRevokedAt != nil,
			IsEphemeral:         mv.IsEphemeral,
			IsEphemeralExpired:  mv.IsEphemeralExpired,
			ETime:               mv.Etime,
			HasPairwiseMacs:     mv.HasPairwiseMacs,
			Content:             d.svc.convertMsgBody(mv.MessageBody),
			AtMentionUsernames:  mv.AtMentions,
			ChannelMention:      strings.ToLower(mv.ChannelMention.String()),
			ChannelNameMentions: mv.ChannelNameMentions,
		}
		if mv.Reactions.Reactions != nil {
			summary.Reactions = &mv.Reactions
		}
		return &Message{Msg: summary}
	}

	state, err := inMsg.Message.State()
	switch {
	case err != nil:
		errStr := err.Error()
		return &Message{Error: &errStr}
	case state == chat1.MessageUnboxedState_ERROR:
		errStr := inMsg.Message.Error().ErrMsg
		return &Message{Error: &errStr}
	default:
		return nil
	}
}

func (d *chatNotificationDisplay) NewChatActivity(ctx context.Context, arg chat1.NewChatActivityArg) error {
	if !d.cmd.showLocal && arg.Source == chat1.ChatActivitySource_LOCAL {
		// Skip local message
		return nil
	}

	activity := arg.Activity
	typ, err := activity.ActivityType()
	if err == nil {
		switch typ {
		case chat1.ChatActivityType_INCOMING_MESSAGE:
			inMsg := activity.IncomingMessage()
			if inMsg.Message.IsValid() {
				mv := inMsg.Message.Valid()
				if !d.cmd.showExploding && !mv.Etime.IsZero() {
					// Skip exploding message
					return nil
				}
			}
			msg := d.formatMessage(inMsg)
			if msg == nil {
				return nil
			}
			notif := msgNotification{
				Source:     strings.ToLower(arg.Source.String()),
				Msg:        msg.Msg,
				Error:      msg.Error,
				Pagination: inMsg.Pagination,
			}
			if jsonStr, err := json.Marshal(notif); err == nil {
				d.printf("%s\n", string(jsonStr))
			} else {
				d.errorf("Error while marshaling JSON: %s\n", err)
			}
		}
	}
	return nil
}

func (d *chatNotificationDisplay) ChatIdentifyUpdate(context.Context, keybase1.CanonicalTLFNameAndIDWithBreaks) error {
	return nil
}
func (d *chatNotificationDisplay) ChatTLFFinalize(context.Context, chat1.ChatTLFFinalizeArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatTLFResolve(context.Context, chat1.ChatTLFResolveArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatInboxStale(context.Context, keybase1.UID) error { return nil }
func (d *chatNotificationDisplay) ChatThreadsStale(context.Context, chat1.ChatThreadsStaleArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatTypingUpdate(context.Context, []chat1.ConvTypingUpdate) error {
	return nil
}
func (d *chatNotificationDisplay) ChatJoinedConversation(context.Context, chat1.ChatJoinedConversationArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatLeftConversation(context.Context, chat1.ChatLeftConversationArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatResetConversation(context.Context, chat1.ChatResetConversationArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatInboxSyncStarted(context.Context, keybase1.UID) error {
	return nil
}
func (d *chatNotificationDisplay) ChatInboxSynced(context.Context, chat1.ChatInboxSyncedArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSetConvRetention(context.Context, chat1.ChatSetConvRetentionArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSetTeamRetention(context.Context, chat1.ChatSetTeamRetentionArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSetConvSettings(context.Context, chat1.ChatSetConvSettingsArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatSubteamRename(context.Context, chat1.ChatSubteamRenameArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatKBFSToImpteamUpgrade(context.Context, chat1.ChatKBFSToImpteamUpgradeArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatAttachmentUploadStart(context.Context, chat1.ChatAttachmentUploadStartArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatAttachmentUploadProgress(context.Context, chat1.ChatAttachmentUploadProgressArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatPaymentInfo(context.Context, chat1.ChatPaymentInfoArg) error {
	return nil
}
func (d *chatNotificationDisplay) ChatRequestInfo(context.Context, chat1.ChatRequestInfoArg) error {
	return nil
}
