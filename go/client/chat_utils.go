package client

import (
	"fmt"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func makeChatFlags(extras []cli.Flag) []cli.Flag {
	return append(extras, []cli.Flag{
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

func makeChatListAndReadFlags(extras []cli.Flag) []cli.Flag {
	return makeChatFlags(append(extras, []cli.Flag{
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
	}...))
}

type conversationResolver struct {
	TlfName   string
	TopicName string
	TopicType chat1.TopicType
}

func (r conversationResolver) Resolve(ctx context.Context, chatClient keybase1.ChatLocalInterface) (conversations []keybase1.ConversationInfoLocal, err error) {
	if len(r.TlfName) > 0 {
		cname, err := chatClient.CompleteAndCanonicalizeTlfName(ctx, r.TlfName)
		if err != nil {
			return nil, fmt.Errorf("completing TLF name error: %v", err)
		}
		r.TlfName = string(cname)
	}
	conversations, err = chatClient.ResolveConversationLocal(ctx, keybase1.ConversationInfoLocal{
		TlfName:   r.TlfName,
		TopicName: r.TopicName,
		TopicType: r.TopicType,
	})
	return conversations, err
}

type messageFetcher struct {
	selector keybase1.MessageSelector
	resolver conversationResolver

	chatClient keybase1.ChatLocalInterface // for testing only
}

func parseConversationResolver(ctx *cli.Context, tlfName string) (resolver conversationResolver, err error) {
	resolver.TopicName = ctx.String("topic-name")
	switch t := strings.ToLower(ctx.String("topic-type")); t {
	case "chat":
		resolver.TopicType = chat1.TopicType_CHAT
	case "dev":
		resolver.TopicType = chat1.TopicType_DEV
	default:
		err = fmt.Errorf("invalid topic-type %s. Has to be one of %v", t, []string{"chat", "dev"})
		return resolver, err
	}
	resolver.TlfName = tlfName

	return resolver, err
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
	fetcher.selector.MarkAsRead = markAsRead

	if fetcher.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
		return fetcher, err
	}

	return fetcher, nil
}

func (f messageFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations []keybase1.ConversationLocal, err error) {
	chatClient := f.chatClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(g)
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	conversationInfos, err := f.resolver.Resolve(ctx, chatClient)
	if err != nil {
		return nil, fmt.Errorf("resolving conversation error: %v\n", err)
	}
	// TODO: prompt user to choose conversation(s) if called by `keybase chat read` (rather than `keybase chat list`)
	for _, conv := range conversationInfos {
		f.selector.Conversations = append(f.selector.Conversations, conv.Id)
	}

	if len(f.selector.Conversations) == 0 {
		return conversations, nil
	}

	conversations, err = chatClient.GetMessagesLocal(ctx, f.selector)
	if err != nil {
		return nil, fmt.Errorf("GetMessagesLocal error: %s", err)
	}

	return conversations, nil
}
