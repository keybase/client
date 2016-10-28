// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type chatCLIConversationResolver struct {
	TlfName    string
	TopicName  string
	TopicType  chat1.TopicType
	Visibility chat1.TLFVisibility

	canonicalizedTlfName string
}

// completeAndCanonicalizeTLFName completes tlfName and canonicalizes it if
// necessary. The new TLF name is stored to r.canonicalizedTlfName.
// len(tlfName) must > 0
// TODO: support public TLFs
func (r *chatCLIConversationResolver) completeAndCanonicalizeTLFName(
	ctx context.Context, g *libkb.GlobalContext, tlfClient keybase1.TlfInterface, tlfName string) error {
	cname, err := tlfClient.CompleteAndCanonicalizePrivateTlfName(ctx, keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	})
	if err != nil {
		return fmt.Errorf("completing TLF name error: %v", err)
	}
	if string(cname.CanonicalName) != tlfName {
		// If we auto-complete TLF name, we should let users know.
		// TODO: don't spam user here if it's just re-ordering
		g.UI.GetTerminalUI().Printf("Using TLF %s.\n", cname.CanonicalName)
	}
	r.canonicalizedTlfName = string(cname.CanonicalName)

	return nil
}

func (r *chatCLIConversationResolver) makeGetInboxAndUnboxLocalArg(
	ctx context.Context, g *libkb.GlobalContext, tlfClient keybase1.TlfInterface) (
	chat1.GetInboxAndUnboxLocalArg, error) {
	if len(r.TopicName) > 0 && r.TopicType == chat1.TopicType_CHAT {
		return chat1.GetInboxAndUnboxLocalArg{},
			errors.New("we are not supporting setting topic name for chat conversations yet")
	}

	var tlfName *string
	if len(r.TlfName) > 0 {
		err := r.completeAndCanonicalizeTLFName(ctx, g, tlfClient, r.TlfName)
		if err != nil {
			return chat1.GetInboxAndUnboxLocalArg{}, err
		}
		tlfName = &r.canonicalizedTlfName
	}

	var topicName *string
	if len(r.TopicName) > 0 {
		topicName = &r.TopicName
	}

	return chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TlfName:       tlfName,
			TopicName:     topicName,
			TopicType:     &r.TopicType,
			TlfVisibility: &r.Visibility,
		},
	}, nil
}

func (r *chatCLIConversationResolver) resolveWithService(
	ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (
	conversations []chat1.ConversationInfoLocal, err error) {
	arg, err := r.makeGetInboxAndUnboxLocalArg(ctx, g, tlfClient)
	if err != nil {
		return nil, err
	}

	gilres, err := chatClient.GetInboxAndUnboxLocal(ctx, arg)
	if err != nil {
		return nil, err
	}

	for _, conv := range gilres.Conversations {
		conversations = append(conversations, conv.Info)
	}

	return conversations, nil
}

func (r *chatCLIConversationResolver) resolveWithCliUI(
	ctx context.Context, g *libkb.GlobalContext, conversations []chat1.ConversationInfoLocal) (
	conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	switch len(conversations) {
	case 0:
		return nil, false, errors.New("resolveWithCliUI called with empty conversation")
	case 1:
		if r.TlfName != conversations[0].TlfName {
			// This must be:
			//
			// 1) a special case where user only has one conversation, and user
			//    didn't specify TLF name; or
			// 2) user specified TLF name but we auto-completed it or canonicalized
			//    it.
			//
			// Either way, we present a visual confirmation so that user knows chich
			// conversation she's sending into or reading from.
			if conversations[0].Triple.TopicType == chat1.TopicType_CHAT {
				g.UI.GetTerminalUI().Printf("Found %s conversation: %s\n",
					conversations[0].Triple.TopicType.String(), conversations[0].TlfName)
			} else {
				g.UI.GetTerminalUI().Printf("Found %s conversation [%s]: %s\n",
					conversations[0].Triple.TopicType.String(), conversations[0].TopicName, conversations[0].TlfName)
			}
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

func (r *chatCLIConversationResolver) create(
	ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (
	conversationInfo *chat1.ConversationInfoLocal, err error) {
	var newConversation string
	if r.TopicType == chat1.TopicType_CHAT {
		newConversation = fmt.Sprintf("Creating a new %s conversation", r.TopicType.String())
	} else {
		newConversation = fmt.Sprintf("Creating a new %s conversation [%s]", r.TopicType.String(), r.TopicName)
	}

	if len(r.canonicalizedTlfName) == 0 {
		tlfName, err := g.UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatTLFName, fmt.Sprintf(
			"No conversation found. %s. Hit Ctrl-C to cancel, or specify a TLF name to continue: ",
			newConversation))
		if err != nil {
			return nil, err
		}
		err = r.completeAndCanonicalizeTLFName(ctx, g, tlfClient, tlfName)
		if err != nil {
			return nil, err
		}
	} else {
		g.UI.GetTerminalUI().Printf(newConversation+": %s.\n", r.canonicalizedTlfName)
	}

	var tnp *string
	if len(r.TopicName) > 0 {
		tnp = &r.TopicName
	}
	ncres, err := chatClient.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
		TlfName:       r.canonicalizedTlfName,
		TopicName:     tnp,
		TopicType:     r.TopicType,
		TlfVisibility: r.Visibility,
	})
	if err != nil {
		return nil, fmt.Errorf("creating conversation error: %v\n", err)
	}
	return &ncres.Conv.Info, err
}

func (r *chatCLIConversationResolver) Resolve(
	ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (
	conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	conversations, err := r.resolveWithService(ctx, g, chatClient, tlfClient)
	if err != nil {
		return nil, false, err
	}

	switch len(conversations) {
	case 0:
		return nil, false, errors.New("no conversation found")
	default:
		return r.resolveWithCliUI(ctx, g, conversations)
	}
}

func (r *chatCLIConversationResolver) ResolveOrCreate(
	ctx context.Context, g *libkb.GlobalContext, chatClient chat1.LocalInterface, tlfClient keybase1.TlfInterface) (
	conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	conversations, err := r.resolveWithService(ctx, g, chatClient, tlfClient)
	if err != nil {
		return nil, false, err
	}

	switch len(conversations) {
	case 0:
		conversationInfo, err = r.create(ctx, g, chatClient, tlfClient)
		if err != nil {
			return nil, false, err
		}
		return conversationInfo, false, nil
	default:
		return r.resolveWithCliUI(ctx, g, conversations)
	}
}
