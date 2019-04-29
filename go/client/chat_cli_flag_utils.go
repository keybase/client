// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/search"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

var chatFlags = map[string]cli.Flag{
	"topic-type": cli.StringFlag{
		Name:  "topic-type",
		Value: "chat",
		Usage: `Specify topic type of the conversation. Has to be chat or dev`,
	},
	"channel": cli.StringFlag{
		Name:  "channel",
		Usage: `Specify the conversation channel.`,
	},
	"set-channel": cli.StringFlag{
		Name:  "set-channel",
		Usage: `Rename a channel in a conversation`,
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
		Value: 15,
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
	"exploding-lifetime": cli.DurationFlag{
		Name: "exploding-lifetime",
		Usage: fmt.Sprintf(`Make this message an exploding message and set the lifetime for the given duration.
	The maximum lifetime is %v (one week) and the minimum lifetime is %v. Cannot be used in conjunction with --public.`,
			libkb.MaxEphemeralContentLifetime, libkb.MinEphemeralContentLifetime),
	},
}

var chatSearchFlags = []cli.Flag{
	cli.IntFlag{
		Name:  "max-hits",
		Value: 10,
		Usage: fmt.Sprintf("Specify the maximum number of search hits to get. Maximum value is %d.", search.MaxAllowedSearchHits),
	},
	cli.StringFlag{
		Name:  "sent-to",
		Value: "",
		Usage: "Filter search results to @ mentions of the given username",
	},
	cli.StringFlag{
		Name:  "sent-by",
		Value: "",
		Usage: "Filter search results by the username of the sender.",
	},
	cli.StringFlag{
		Name:  "sent-before",
		Value: "",
		Usage: "Filter search results by the message creation time. Mutually exclusive with sent-after.",
	},
	cli.StringFlag{
		Name:  "sent-after",
		Value: "",
		Usage: "Filter search results by the message creation time. Mutually exclusive with sent-before.",
	},
	cli.IntFlag{
		Name:  "B, before-context",
		Value: 0,
		Usage: "Print number messages of leading context before each match.",
	},
	cli.IntFlag{
		Name:  "A, after-context",
		Value: 0,
		Usage: "Print number of messages of trailing context after each match.",
	},
	cli.IntFlag{
		Name:  "C, context",
		Value: 2,
		Usage: "Print number of messages of leading and trailing context surrounding each match.",
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
	return mustGetChatFlags("topic-type", "channel", "public", "private")
}

func getMessageFetcherFlags() []cli.Flag {
	return append(mustGetChatFlags("at-least", "at-most", "since", "show-device-name"), getConversationResolverFlags()...)
}

func getInboxFetcherUnreadFirstFlags() []cli.Flag {
	return append(mustGetChatFlags("at-least", "at-most", "since", "show-device-name"), getConversationResolverFlags()...)
}

func getInboxFetcherActivitySortedFlags() []cli.Flag {
	return append(mustGetChatFlags("number", "since", "include-hidden"), getConversationResolverFlags()...)
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
	req.TopicName = utils.SanitizeTopicName(ctx.String("channel"))
	req.TlfName = tlfName
	if req.TopicType, err = parseConversationTopicType(ctx); err != nil {
		return chatConversationResolvingRequest{}, err
	}

	if ctx.Bool("private") {
		req.Visibility = keybase1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		req.Visibility = keybase1.TLFVisibility_PUBLIC
	} else {
		req.Visibility = keybase1.TLFVisibility_ANY
	}

	return req, nil
}

// The purpose of this function is to provide more
// information in resolvingRequest, with the ability
// to use the socket, since this is not available
// at parse time.
func annotateResolvingRequest(g *libkb.GlobalContext, req *chatConversationResolvingRequest) (err error) {
	userOrTeamResult, err := CheckUserOrTeamName(context.TODO(), g, req.TlfName)
	if err != nil {
		return err
	}
	switch userOrTeamResult {
	case keybase1.UserOrTeamResult_USER:
		if g.Env.GetChatMemberType() == "impteam" {
			req.MembersType = chat1.ConversationMembersType_IMPTEAMNATIVE
		} else {
			req.MembersType = chat1.ConversationMembersType_KBFS
		}
	case keybase1.UserOrTeamResult_TEAM:
		req.MembersType = chat1.ConversationMembersType_TEAM
	}
	if req.TopicType == chat1.TopicType_CHAT && len(req.TopicName) != 0 &&
		req.MembersType != chat1.ConversationMembersType_TEAM {
		return errors.New("multiple topics only supported for teams and dev channels")
	}

	// Set the default topic name to #general if none is specified
	if req.MembersType == chat1.ConversationMembersType_TEAM && len(req.TopicName) == 0 {
		req.TopicName = globals.DefaultTeamTopic
	}

	return nil
}

func makeChatCLIConversationFetcher(ctx *cli.Context, tlfName string, markAsRead bool) (fetcher chatCLIConvFetcher, err error) {
	fetcher.query.MessageTypes = []chat1.MessageType{
		chat1.MessageType_TEXT,
		chat1.MessageType_ATTACHMENT,
		chat1.MessageType_JOIN,
		chat1.MessageType_LEAVE,
		chat1.MessageType_SYSTEM,
		chat1.MessageType_SENDPAYMENT,
		chat1.MessageType_REQUESTPAYMENT,
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
		return chatCLIConvFetcher{}, err
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
		fetcher.query.Visibility = keybase1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		fetcher.query.Visibility = keybase1.TLFVisibility_PUBLIC
	} else {
		fetcher.query.Visibility = keybase1.TLFVisibility_ANY
	}

	if !ctx.Bool("include-hidden") {
		fetcher.query.Status = utils.VisibleChatConversationStatuses()
	}

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
		fetcher.query.Visibility = keybase1.TLFVisibility_PRIVATE
	} else if ctx.Bool("public") {
		fetcher.query.Visibility = keybase1.TLFVisibility_PUBLIC
	} else {
		fetcher.query.Visibility = keybase1.TLFVisibility_ANY
	}

	if !ctx.Bool("include-hidden") {
		fetcher.query.Status = utils.VisibleChatConversationStatuses()
	}

	return fetcher, err
}
