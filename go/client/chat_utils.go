package client

import (
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type uidUsernameMapper map[keybase1.UID]string

func (m uidUsernameMapper) getUsername(ctx context.Context, g *libkb.GlobalContext, uid keybase1.UID) (string, error) {
	if m == nil {
		m = make(uidUsernameMapper)
	}

	if username, ok := m[uid]; ok {
		return username, nil
	}

	userClient, err := GetUserClient(g)
	if err != nil {
		return "", err
	}
	var ret keybase1.User
	if ret, err = userClient.LoadUser(ctx, keybase1.LoadUserArg{
		Uid: uid,
	}); err != nil {
		return "", err
	}

	m[uid] = ret.Username
	return ret.Username, err
}

func makeChatInboxAndReadFlags(extras []cli.Flag) []cli.Flag {
	return append(extras, []cli.Flag{
		cli.BoolFlag{
			Name:  "a,all",
			Usage: `Do not limit number of messages shown. This has same effect as "--number 0"`,
		},
		cli.IntFlag{
			Name:  "n,number",
			Usage: `Limit the number of messages shown. Only effective when > 0.`,
			Value: 5,
		},
		cli.StringFlag{
			Name:  "time,since",
			Usage: `Only show messages after certain time.`,
		},
		cli.StringFlag{
			Name:  "topic-name",
			Usage: `Specify topic name of the conversation.`,
		},
		cli.StringFlag{
			Name:  "topic-type",
			Value: "chat",
			Usage: `Specify topic name of the conversation. Has to be chat or dev`,
		},
	}...)
}

type conversationResolver struct {
	TlfName   string
	TopicName string
	TopicType chat1.TopicType
}

func (r conversationResolver) Resolve(ctx context.Context, chatClient keybase1.ChatLocalInterface) (ids []chat1.ConversationID, err error) {
	ids, err = chatClient.ResolveConversationLocal(ctx, keybase1.ResolveConversationLocalArg{
		TlfName:   r.TlfName,
		TopicName: r.TopicName,
		TopicType: r.TopicType,
	})
	return ids, err
}

type messageFetcher struct {
	selector keybase1.MessageSelector
	resolver conversationResolver

	chatClient keybase1.ChatLocalInterface // for testing only
}

func makeMessageFetcherFromCliCtx(ctx *cli.Context, tlfName string, markAsRead bool) (fetcher messageFetcher, err error) {
	fetcher.selector.MessageTypes = []chat1.MessageType{chat1.MessageType_TEXT, chat1.MessageType_ATTACHMENT}
	fetcher.selector.Limit = ctx.Int("number")

	if timeStr := ctx.String("time"); len(timeStr) > 0 {
		fetcher.selector.Since = &timeStr
	}

	if ctx.Bool("all") {
		fetcher.selector.Limit = 0
	}

	fetcher.resolver.TopicName = ctx.String("topic-name")
	switch t := strings.ToLower(ctx.String("topic-type")); t {
	case "chat":
		fetcher.resolver.TopicType = chat1.TopicType_CHAT
	case "dev":
		fetcher.resolver.TopicType = chat1.TopicType_DEV
	default:
		err = fmt.Errorf("invalid topic-type %s. Has to be one of %v", t, []string{"chat", "dev"})
		return fetcher, err
	}

	fetcher.selector.MarkAsRead = markAsRead
	fetcher.resolver.TlfName = tlfName

	return fetcher, nil
}

func (f messageFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (messages cliChatMessages, err error) {
	chatClient := f.chatClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(g)
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	conversationIDs, err := f.resolver.Resolve(ctx, chatClient)
	if err != nil {
		return nil, err
	}
	// TODO: prompt user to choose conversation(s)
	f.selector.Conversations = conversationIDs

	var mapper uidUsernameMapper
	conversations, err := chatClient.GetMessagesLocal(ctx, f.selector)
	if err != nil {
		return nil, fmt.Errorf("GetMessagesLocal error: %s", err)
	}

	for _, conv := range conversations {
		if len(conv.Messages) == 0 {
			continue
		}
		m := conv.Messages[0]
		var body string
		switch t := m.MessagePlaintext.MessageBodies[0].Type; t {
		case chat1.MessageType_TEXT:
			body = formatChatText(m.MessagePlaintext.MessageBodies[0].Text)
		case chat1.MessageType_ATTACHMENT:
			body = formatChatAttachment(m.MessagePlaintext.MessageBodies[0].Attachment)
		default:
			g.Log.Debug("unsurported MessageType: %s", t)
			continue
		}

		username, err := mapper.getUsername(ctx, g, keybase1.UID(m.MessagePlaintext.ClientHeader.Sender.String()))
		if err != nil {
			username = "<getting username error>" // TODO: return error here when/if we have integrated tests
		}

		messages = append(messages, cliChatMessage{
			isNew:         m.IsNew,
			with:          strings.Split(m.MessagePlaintext.ClientHeader.TlfName, ","),
			topic:         hex.EncodeToString([]byte(m.MessagePlaintext.ClientHeader.Conv.TopicID)[:4]), // TODO: populate this properly after we implement topic names
			author:        string(username),
			timestamp:     gregor1.FromTime(m.ServerHeader.Ctime),
			formattedBody: body,
		})
	}

	return messages, nil
}
