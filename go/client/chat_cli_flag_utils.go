// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
)

var chatFlags = map[string]cli.Flag{
	"topic-type": cli.StringFlag{
		Name:  "topic-type",
		Value: "chat",
		Usage: `Specify topic type of the conversation. Has to be chat or dev`,
	},
	"topic-name": cli.StringFlag{
		Name:  "topic-name",
		Usage: `Specify topic name of the conversation.`,
	},
	"set-topic-name": cli.StringFlag{
		Name:  "set-topic-name",
		Usage: `Set topic name for the conversation`,
	},
	"set-headline": cli.StringFlag{
		Name:  "set-headline",
		Usage: `Set the headline for the conversation`,
	},
	"clear-headline": cli.BoolFlag{
		Name:  "clear-headline",
		Usage: `Clear the headline for the conversation`,
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
		Usage: `Only show updates after certain time. Supports durations like "2d" or RFC3339 time like 2017-01-02T15:04:05Z07:00`,
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
	"nonblock": cli.BoolFlag{
		Name:  "nonblock",
		Usage: `Send message without success confirmation`,
	},
	"include-hidden": cli.BoolFlag{
		Name:  "include-hidden",
		Usage: `Include hidden conversations`,
	},
	"block": cli.BoolFlag{
		Name:  "b, block",
		Usage: "Block the conversation (instead of hiding until next activity)",
	},
	"unhide": cli.BoolFlag{
		Name:  "u, unhide",
		Usage: "Unhide/unblock the conversation",
	},
	"unmute": cli.BoolFlag{
		Name:  "u, unmute",
		Usage: "Unmute the conversation",
	},
	"async": cli.BoolFlag{
		Name:  "async",
		Usage: "Fetch inbox and unbox asynchronously",
	},
	"team": cli.BoolFlag{
		Name:  "team",
		Usage: "Treat conversation name as a team name",
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
	return mustGetChatFlags("topic-type", "topic-name", "public", "private", "team")
}

func getMessageFetcherFlags() []cli.Flag {
	return append(mustGetChatFlags("at-least", "at-most", "since", "show-device-name"), getConversationResolverFlags()...)
}

func getInboxFetcherUnreadFirstFlags() []cli.Flag {
	return append(mustGetChatFlags("at-least", "at-most", "since", "show-device-name"), getConversationResolverFlags()...)
}

func getInboxFetcherActivitySortedFlags() []cli.Flag {
	return append(mustGetChatFlags("number", "since", "include-hidden", "async"), getConversationResolverFlags()...)
}

func parseConversationTopicType(ctx *cli.Context) (topicType chat1.TopicType, err error) {
	switch t := strings.ToLower(ctx.String("topic-type")); t {
	case "chat":
		topicType = chat1.TopicType_CHAT
	case "dev":
		topicType = chat1.TopicType_DEV
	default:
		err = fmt.Errorf("invalid topic-type '%s'. Has to be one of %v", t, []string{"chat", "dev"})
	}
	return topicType, err
}

func parseConversationResolvingRequest(ctx *cli.Context, tlfName string) (req chatConversationResolvingRequest, err error) {
	req.TopicName = ctx.String("topic-name")
	req.TlfName = tlfName
	if req.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return chatConversationResolvingRequest{}, err
	}
	if ctx.Bool("private") {
		req.Visibility = chat1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		req.Visibility = chat1.TLFVisibility_PUBLIC
	} else {
		req.Visibility = chat1.TLFVisibility_ANY
	}
	if ctx.Bool("team") {
		req.MembersType = chat1.ConversationMembersType_TEAM
	}

	if req.TopicType == chat1.TopicType_CHAT && len(req.TopicName) != 0 &&
		req.MembersType != chat1.ConversationMembersType_TEAM {
		return chatConversationResolvingRequest{}, errors.New("multiple topics only supported for teams and dev channels")
	}

	// Set the default topic name to #general if none is specified
	if req.MembersType == chat1.ConversationMembersType_TEAM && len(req.TopicName) == 0 {
		req.TopicName = chat.DefaultTeamTopic
	}

	return req, nil
}

func makeChatCLIConversationFetcher(ctx *cli.Context, tlfName string, markAsRead bool) (fetcher chatCLIConversationFetcher, err error) {
	fetcher.query.MessageTypes = []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
	}
	fetcher.query.Limit = chat1.UnreadFirstNumLimit{
		NumRead: 2,
		AtLeast: ctx.Int("at-least"),
		AtMost:  ctx.Int("at-most"),
	}

	if timeStr := ctx.String("since"); len(timeStr) > 0 {
		fetcher.query.Since = &timeStr
	}

	fetcher.query.MarkAsRead = markAsRead

	if fetcher.resolvingRequest, err = parseConversationResolvingRequest(ctx, tlfName); err != nil {
		return chatCLIConversationFetcher{}, err
	}

	return fetcher, nil
}

func makeChatCLIInboxFetcherActivitySorted(ctx *cli.Context) (fetcher chatCLIInboxFetcher, err error) {
	if fetcher.query.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return chatCLIInboxFetcher{}, err
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

	if !ctx.Bool("include-hidden") {
		fetcher.query.Status = utils.VisibleChatConversationStatuses()
	}

	fetcher.async = ctx.Bool("async")

	return fetcher, err
}

func makeChatCLIInboxFetcherUnreadFirst(ctx *cli.Context) (fetcher chatCLIInboxFetcher, err error) {
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

	if !ctx.Bool("include-hidden") {
		fetcher.query.Status = utils.VisibleChatConversationStatuses()
	}

	return fetcher, err
}
