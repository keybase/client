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
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
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

	return gcfclres.Conversation, gcfclres.Messages, nil
}

type chatCLIInboxFetcher struct {
	query chat1.GetInboxSummaryForCLILocalQuery
	async bool
}

func (f chatCLIInboxFetcher) fetch(ctx context.Context, g *libkb.GlobalContext) (conversations []chat1.ConversationLocal, err error) {
	chatClient, err := GetChatLocalClient(g)
	if err != nil {
		return nil, fmt.Errorf("Getting chat service client error: %s", err)
	}

	var convs []chat1.ConversationLocal
	if f.async {
		ui := &ChatUI{
			Contextified: libkb.NewContextified(g),
			terminal:     g.UI.GetTerminalUI(),
		}
		protocols := []rpc.Protocol{
			chat1.ChatUiProtocol(ui),
		}
		if err := RegisterProtocolsWithContext(protocols, g); err != nil {
			return nil, err
		}

		_, err := chatClient.GetInboxNonblockLocal(ctx, chat1.GetInboxNonblockLocalArg{
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		})
		if err != nil {
			return nil, err
		}

	} else {
		res, err := chatClient.GetInboxSummaryForCLILocal(ctx, f.query)
		if err != nil {
			return nil, err
		}
		convs = res.Conversations
	}

	return convs, nil
}
