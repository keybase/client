// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"fmt"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	isatty "github.com/mattn/go-isatty"
)

type chatCLIConversationFetcher struct {
	query            chat1.GetConversationForCLILocalQuery
	resolvingRequest chatConversationResolvingRequest
}

func (f chatCLIConversationFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations chat1.ConversationLocal, messages []chat1.MessageUnboxed, err error) {
	chatClient, err := GetChatLocalClient(g)
	if err != nil {
		return chat1.ConversationLocal{}, nil, fmt.Errorf("Getting chat service client error: %s", err)
	}
	resolver := &chatConversationResolver{G: g, ChatClient: chatClient}
	resolver.TlfClient, err = GetTlfClient(g)
	if err != nil {
		return chat1.ConversationLocal{}, nil, err
	}

	hasTTY := isatty.IsTerminal(os.Stdout.Fd())

	conversation, _, err := resolver.Resolve(ctx, f.resolvingRequest, chatConversationResolvingBehavior{
		CreateIfNotExists: false,
		MustNotExist:      false,
		Interactive:       hasTTY,
		IdentifyBehavior:  keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		// Resolver errors should already by human readable.
		return chat1.ConversationLocal{}, nil, err
	}
	if conversation == nil {
		return chat1.ConversationLocal{}, nil, nil
	}
	f.query.Conv = *conversation

	if conversation.Info.Id == nil || len(conversation.Info.Id) == 0 {
		return chat1.ConversationLocal{}, nil, fmt.Errorf("empty conversationInfo.Id: %+v", conversation.Info)
	}

	gcfclres, err := chatClient.GetConversationForCLILocal(ctx, f.query)
	if err != nil {
		return chat1.ConversationLocal{}, nil, fmt.Errorf("GetConversationForCLILocal error: %s", err)
	}

	if gcfclres.Offline {
		g.UI.GetTerminalUI().Printf(ColorString("yellow", "WARNING: conversation results obtained in OFFLINE mode\n"))
	}

	return gcfclres.Conversation, gcfclres.Messages, nil
}

type chatCLIInboxFetcher struct {
	query chat1.GetInboxSummaryForCLILocalQuery
}

func (f chatCLIInboxFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations []chat1.ConversationLocal, err error) {
	chatClient, err := GetChatLocalClient(g)
	if err != nil {
		return nil, fmt.Errorf("Getting chat service client error: %s", err)
	}

	var convs []chat1.ConversationLocal
	res, err := chatClient.GetInboxSummaryForCLILocal(ctx, f.query)
	if err != nil {
		return nil, err
	}
	convs = res.Conversations
	if res.Offline {
		g.UI.GetTerminalUI().Printf(ColorString("yellow", "WARNING: inbox results obtained in OFFLINE mode\n"))
	}

	return convs, nil
}
