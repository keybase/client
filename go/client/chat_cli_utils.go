package client

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

var chatFlags = map[string]cli.Flag{
	"topic-type": cli.StringFlag{
		Name:  "topic-type",
		Value: "chat",
		Usage: `Specify topic name of the conversation. Has to be chat or dev`,
	},
	"topic-name": cli.StringFlag{
		Name:  "topic-name",
		Usage: `Specify topic name of the conversation.`,
	},
	"set-topic-name": cli.StringFlag{
		Name:  "set-topic-name",
		Usage: `Set topic name for the conversation`,
	},
	"stdin": cli.BoolFlag{
		Name:  "stdin",
		Usage: "Use STDIN for message content. [conversation] is required and [message] is ignored.",
	},
	"at-most": cli.IntFlag{
		Name:  "at-most",
		Usage: `Show at most this number of items. Only effective when > 0. "keybase chat" tries to show n+2 items, where n is # of unread items. --at-most caps the total number of items possibly shown in case there are too many unread items.`,
		Value: 100,
	},
	"at-least": cli.IntFlag{
		Name:  "at-least",
		Usage: `Show at least this number of items, assuming they exist. Only effective when > 0. "keybase chat" tries to show n+2 items, where n is # of unread items. --at-least floors the total number of items possibly shown in case there are too few unread items.`,
		Value: 5,
	},
	"number": cli.IntFlag{
		Name:  "number,n",
		Usage: `Limit number of items`,
		Value: 5,
	},
	"unread-first": cli.IntFlag{
		Name:  "unread-first",
		Usage: `Show unread items first. When --unread-first is set, --at-most and --at-least are effective. Otherwise, --number is effective.`,
	},
	"since": cli.StringFlag{
		Name:  "time,since",
		Usage: `Only show updates after certain time.`,
	},
	"public": cli.BoolFlag{
		Name:  "public",
		Usage: `Only select public conversations. Exclusive to --private`,
	},
	"private": cli.BoolFlag{
		Name:  "private",
		Usage: `Only select private conversations. Exclusive to --public. If both --public and --private are present, --private takes priority.`,
	},
	"show-device-name": cli.BoolFlag{
		Name:  "show-device-name",
		Usage: `Show device name next to author username`,
	},
}

func mustGetChatFlags(keys ...string) (flags []cli.Flag) {
	for _, key := range keys {
		f, ok := chatFlags[key]
		if !ok {
			panic(fmt.Sprintf("chat flag with key=%s not found", key))
		}
		flags = append(flags, f)
	}
	return flags
}

func getConversationResolverFlags() []cli.Flag {
	return mustGetChatFlags("topic-type", "topic-name", "public", "private")
}

func getMessageFetcherFlags() []cli.Flag {
	return append(mustGetChatFlags("at-least", "at-most", "since", "show-device-name"), getConversationResolverFlags()...)
}

func getInboxFetcherUnreadFirstFlags() []cli.Flag {
	return append(mustGetChatFlags("at-least", "at-most", "since", "show-device-name"), getConversationResolverFlags()...)
}

func getInboxFetcherActivitySortedFlags() []cli.Flag {
	return append(mustGetChatFlags("number", "since"), getConversationResolverFlags()...)
}

type conversationResolver struct {
	TlfName    string
	TopicName  string
	TopicType  chat1.TopicType
	Visibility chat1.TLFVisibility
}

func (r *conversationResolver) Resolve(ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	if len(r.TlfName) > 0 {
		cname, err := tlfClient.CompleteAndCanonicalizeTlfName(ctx, r.TlfName)
		if err != nil {
			return nil, false, fmt.Errorf("completing TLF name error: %v", err)
		}
		r.TlfName = string(cname)
	}

	rcres, err := chatClient.ResolveConversationLocal(ctx, chat1.ConversationInfoLocal{
		TlfName:    r.TlfName,
		TopicName:  r.TopicName,
		TopicType:  r.TopicType,
		Visibility: r.Visibility,
	})
	if err != nil {
		return nil, false, err
	}

	conversations := rcres.Convs
	switch len(conversations) {
	case 0:
		return nil, false, nil
	case 1:
		return &conversations[0], false, nil
	default:
		g.UI.GetTerminalUI().Printf(
			"There are %d conversations. Please choose one:\n", len(conversations))
		conversationInfoListView(conversations).show(g)
		var num int
		for num = -1; num < 1 || num > len(conversations); {
			input, err := g.UI.GetTerminalUI().Prompt(PromptDescriptorChooseConversation,
				fmt.Sprintf("Please enter a number [1-%d]: ", len(conversations)))
			if err != nil {
				return nil, false, err
			}
			if num, err = strconv.Atoi(input); err != nil {
				g.UI.GetTerminalUI().Printf("Error converting input to number: %v\n", err)
				continue
			}
		}
		return &conversations[num-1], true, nil
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
		return conversationResolver{}, err
	}
	if resolver.TopicType == chat1.TopicType_CHAT && len(resolver.TopicName) != 0 {
		return conversationResolver{}, errors.New("multiple topics are not yet supported")
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
	fetcher.selector.Limit = chat1.UnreadFirstNumLimit{
		NumRead: 2,
		AtLeast: ctx.Int("at-least"),
		AtMost:  ctx.Int("at-most"),
	}

	if timeStr := ctx.String("since"); len(timeStr) > 0 {
		fetcher.selector.Since = &timeStr
	}

	fetcher.selector.MarkAsRead = markAsRead

	if fetcher.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
		return messageFetcher{}, err
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

	conversationInfo, _, err := f.resolver.Resolve(ctx, g, chatClient, tlfClient)
	if err != nil {
		return nil, fmt.Errorf("resolving conversation error: %v\n", err)
	}
	if conversationInfo == nil {
		return nil, nil
	}
	g.UI.GetTerminalUI().Printf("fetching conversation %s ...\n", conversationInfo.TlfName)
	f.selector.Conversations = append(f.selector.Conversations, conversationInfo.Id)

	gmres, err := chatClient.GetMessagesLocal(ctx, f.selector)
	if err != nil {
		return nil, fmt.Errorf("GetMessagesLocal error: %s", err)
	}

	return gmres.Msgs, nil
}

type inboxFetcher struct {
	query chat1.GetInboxSummaryLocalQuery

	chatClient chat1.LocalInterface // for testing only
}

func makeInboxFetcherActivitySortedFromCli(ctx *cli.Context) (fetcher inboxFetcher, err error) {
	if fetcher.query.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return inboxFetcher{}, err
	}

	fetcher.query.UnreadFirst = false
	fetcher.query.ActivitySortedLimit = ctx.Int("number")
	fetcher.query.After = ctx.String("since")

	if ctx.Bool("private") {
		fetcher.query.Visibility = chat1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		fetcher.query.Visibility = chat1.TLFVisibility_PUBLIC
	} else {
		fetcher.query.Visibility = chat1.TLFVisibility_ANY
	}

	return fetcher, err
}

func makeInboxFetcherUnreadFirstFromCli(ctx *cli.Context) (fetcher inboxFetcher, err error) {
	if fetcher.query.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return fetcher, err
	}

	fetcher.query.UnreadFirst = true
	fetcher.query.UnreadFirstLimit = chat1.UnreadFirstNumLimit{
		NumRead: 2,
		AtLeast: ctx.Int("at-least"),
		AtMost:  ctx.Int("at-most"),
	}
	fetcher.query.After = ctx.String("since")

	if ctx.Bool("private") {
		fetcher.query.Visibility = chat1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		fetcher.query.Visibility = chat1.TLFVisibility_PUBLIC
	} else {
		fetcher.query.Visibility = chat1.TLFVisibility_ANY
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

	res, err := chatClient.GetInboxSummaryLocal(ctx, f.query)
	if err != nil {
		return nil, nil, moreTotal, err
	}

	return res.Conversations, res.More, res.MoreTotal, nil
}
