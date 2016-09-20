package client

import (
	"fmt"
	"strconv"
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
		cli.BoolFlag{
			Name:  "public",
			Usage: `Only select public conversations. Exclusive to --private`,
		},
		cli.BoolFlag{
			Name:  "private",
			Usage: `Only select private conversations. Exclusive to --public`,
		},
	}...))
}

type conversationResolver struct {
	TlfName    string
	TopicName  string
	TopicType  chat1.TopicType
	Visibility chat1.TLFVisibility
}

func (r *conversationResolver) Resolve(ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (conversationInfo *chat1.ConversationInfoLocal, err error) {
	if len(r.TlfName) > 0 {
		cname, err := tlfClient.CompleteAndCanonicalizeTlfName(ctx, r.TlfName)
		if err != nil {
			return nil, fmt.Errorf("completing TLF name error: %v", err)
		}
		r.TlfName = string(cname)
	}

	conversations, err := chatClient.ResolveConversationLocal(ctx, chat1.ConversationInfoLocal{
		TlfName:    r.TlfName,
		TopicName:  r.TopicName,
		TopicType:  r.TopicType,
		Visibility: r.Visibility,
	})
	if err != nil {
		return nil, err
	}

	switch len(conversations) {
	case 0:
		return nil, nil
	case 1:
		return &conversations[0], nil
	default:
		g.UI.GetTerminalUI().Printf(
			"There are %d conversations. Please choose one:\n", len(conversations))
		conversationInfoListView(conversations).show(g)
		var num int
		for num = -1; num < 1 || num > len(conversations); {
			input, err := g.UI.GetTerminalUI().Prompt(PromptDescriptorChooseConversation,
				fmt.Sprintf("Please enter a number [1-%d]: ", len(conversations)))
			if err != nil {
				return nil, err
			}
			if num, err = strconv.Atoi(input); err != nil {
				return nil, err
			}
		}
		return &conversations[num-1], nil
	}
}

type messageFetcher struct {
	selector chat1.MessageSelector
	resolver conversationResolver

	chatClient chat1.LocalInterface // for testing only
}

func parseConversationTopicType(ctx *cli.Context) (topicType chat1.TopicType, err error) {
	switch t := strings.ToLower(ctx.String("topic-type")); t {
	case "chat":
		topicType = chat1.TopicType_CHAT
	case "dev":
		topicType = chat1.TopicType_DEV
	default:
		err = fmt.Errorf("invalid topic-type %s. Has to be one of %v", t, []string{"chat", "dev"})
	}
	return topicType, err
}

func parseConversationResolver(ctx *cli.Context, tlfName string) (resolver conversationResolver, err error) {
	resolver.TopicName = ctx.String("topic-name")
	resolver.TlfName = tlfName
	if resolver.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return resolver, err
	}
	if ctx.Bool("private") {
		resolver.Visibility = chat1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		resolver.Visibility = chat1.TLFVisibility_PUBLIC
	} else {
		resolver.Visibility = chat1.TLFVisibility_ANY
	}
	return resolver, nil
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

func (f messageFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations []chat1.ConversationLocal, err error) {
	chatClient := f.chatClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(g)
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	tlfClient, err := GetTlfClient(g)
	if err != nil {
		return nil, err
	}

	conversationInfo, err := f.resolver.Resolve(ctx, g, chatClient, tlfClient)
	if err != nil {
		return nil, fmt.Errorf("resolving conversation error: %v\n", err)
	}
	g.UI.GetTerminalUI().Printf("fetching conversation %s ...\n", conversationInfo.TlfName)
	f.selector.Conversations = append(f.selector.Conversations, conversationInfo.Id)

	conversations, err = chatClient.GetMessagesLocal(ctx, f.selector)
	if err != nil {
		return nil, fmt.Errorf("GetMessagesLocal error: %s", err)
	}

	return conversations, nil
}

type inboxFetcher struct {
	topicType  chat1.TopicType
	limit      int
	since      string
	visibility chat1.TLFVisibility

	chatClient chat1.LocalInterface // for testing only
}

func makeInboxFetcherFromCli(ctx *cli.Context) (fetcher inboxFetcher, err error) {
	if fetcher.topicType, err = parseConversationTopicType(ctx); err != nil {
		return fetcher, err
	}

	fetcher.limit = ctx.Int("number")
	fetcher.since = ctx.String("time")

	if ctx.Bool("all") {
		fetcher.limit = 0
	}

	if ctx.Bool("private") {
		fetcher.visibility = chat1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		fetcher.visibility = chat1.TLFVisibility_PUBLIC
	} else {
		fetcher.visibility = chat1.TLFVisibility_ANY
	}

	return fetcher, err
}

func (f inboxFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations []chat1.ConversationLocal, more []chat1.ConversationLocal, moreTotal int, err error) {
	chatClient := f.chatClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(g)
		if err != nil {
			return nil, nil, moreTotal, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	res, err := chatClient.GetInboxSummaryLocal(ctx, chat1.GetInboxSummaryLocalArg{
		TopicType:  f.topicType,
		After:      f.since,
		Limit:      f.limit,
		Visibility: f.visibility,
	})
	if err != nil {
		return nil, nil, moreTotal, err
	}

	return res.Conversations, res.More, res.MoreTotal, nil
}
