// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"strconv"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type chatCLIConversationResolver struct {
	TlfName    string
	TopicName  string
	TopicType  chat1.TopicType
	Visibility chat1.TLFVisibility
}

func (r *chatCLIConversationResolver) Resolve(ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	if len(r.TlfName) > 0 {
		cname, err := tlfClient.CompleteAndCanonicalizeTlfName(ctx, keybase1.CompleteAndCanonicalizeTlfNameArg{
			Query: keybase1.TLFQuery{
				TlfName:          r.TlfName,
				IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
			},
			IsPublic: false,
		})
		if err != nil {
			return nil, false, fmt.Errorf("completing TLF name error: %v", err)
		}
		r.TlfName = string(cname.CanonicalName)
	}

	var tlfName, topicName *string
	if len(r.TlfName) > 0 {
		tlfName = &r.TlfName
	}
	if len(r.TopicName) > 0 {
		topicName = &r.TopicName
	}
	gilres, err := chatClient.GetInboxAndUnboxLocal(ctx, chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TlfName:       tlfName,
			TopicName:     topicName,
			TopicType:     &r.TopicType,
			TlfVisibility: &r.Visibility,
		},
	})
	if err != nil {
		return nil, false, err
	}

	var conversations []chat1.ConversationInfoLocal
	for _, conv := range gilres.Conversations {
		conversations = append(conversations, conv.Info)
	}

	switch len(conversations) {
	case 0:
		return nil, false, nil
	case 1:
		if conversations[0].Triple.TopicType == chat1.TopicType_CHAT {
			g.UI.GetTerminalUI().Printf("Found %s conversation: %s\n", conversations[0].Triple.TopicType.String(), conversations[0].TlfName)
		} else {
			g.UI.GetTerminalUI().Printf("Found %s [%s] conversation: %s\n", conversations[0].Triple.TopicType.String(), conversations[0].TopicName, conversations[0].TlfName)
		}
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

type chatCLIConversationFetcher struct {
	query    chat1.GetConversationForCLILocalQuery
	resolver chatCLIConversationResolver

	chatClient chat1.LocalInterface // for testing only
}

func (f chatCLIConversationFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations chat1.ConversationLocal, messages []chat1.MessageUnboxed, err error) {
	chatClient := f.chatClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(g)
		if err != nil {
			return chat1.ConversationLocal{}, nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	tlfClient, err := GetTlfClient(g)
	if err != nil {
		return chat1.ConversationLocal{}, nil, err
	}

	conversationInfo, _, err := f.resolver.Resolve(ctx, g, chatClient, tlfClient)
	if err != nil {
		return chat1.ConversationLocal{}, nil, fmt.Errorf("resolving conversation error: %v\n", err)
	}
	if conversationInfo == nil {
		return chat1.ConversationLocal{}, nil, nil
	}
	g.UI.GetTerminalUI().Printf("fetching conversation %s ...\n", conversationInfo.TlfName)
	f.query.ConversationId = conversationInfo.Id

	gcfclres, err := chatClient.GetConversationForCLILocal(ctx, f.query)
	if err != nil {
		return chat1.ConversationLocal{}, nil, fmt.Errorf("GetConversationForCLILocal error: %s", err)
	}

	return gcfclres.Conversation, gcfclres.Messages, nil
}

type chatCLIInboxFetcher struct {
	query chat1.GetInboxSummaryForCLILocalQuery

	chatClient chat1.LocalInterface // for testing only
}

func (f chatCLIInboxFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations []chat1.ConversationLocal, err error) {
	chatClient := f.chatClient // should be nil unless in test
	if chatClient == nil {
		chatClient, err = GetChatLocalClient(g)
		if err != nil {
			return nil, fmt.Errorf("Getting chat service client error: %s", err)
		}
	}

	res, err := chatClient.GetInboxSummaryForCLILocal(ctx, f.query)
	if err != nil {
		return nil, err
	}

	return res.Conversations, nil
}

func fetchOneMessage(g *libkb.GlobalContext, conversationID chat1.ConversationID, messageID chat1.MessageID) (chat1.MessageUnboxed, error) {
	deflt := chat1.MessageUnboxed{}

	chatClient, err := GetChatLocalClient(g)
	if err != nil {
		return deflt, err
	}

	arg := chat1.GetMessagesLocalArg{
		ConversationID: conversationID,
		MessageIDs:     []chat1.MessageID{messageID},
	}
	res, err := chatClient.GetMessagesLocal(context.TODO(), arg)
	if err != nil {
		return deflt, err
	}
	if len(res.Messages) < 0 {
		return deflt, fmt.Errorf("empty messages list")
	}
	return res.Messages[0], nil
}
