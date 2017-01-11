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

type chatConversationResolvingRequestContext struct {
	canonicalizedTlfName string
}

type chatConversationResolvingRequest struct {
	TlfName    string
	TopicName  string
	TopicType  chat1.TopicType
	Visibility chat1.TLFVisibility

	ctx *chatConversationResolvingRequestContext
}

type chatConversationResolvingBehavior struct {
	// Specify whether the resolver should use CLI prompts to ask for more
	// information from user. If false, Resolve errors when multiple conversation
	// is found, or when trying to create a new conversation without enough
	// information.
	Interactive bool

	// Specify whether the resolve should create a conversation if none is found.
	CreateIfNotExists bool

	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

type chatConversationResolver struct {
	G          *libkb.GlobalContext
	ChatClient chat1.LocalInterface
	TlfClient  keybase1.TlfInterface
}

// completeAndCanonicalizeTLFName completes tlfName and canonicalizes it if
// necessary. The new TLF name is stored to req.ctx.canonicalizedTlfName.
// len(tlfName) must > 0
func (r *chatConversationResolver) completeAndCanonicalizeTLFName(ctx context.Context, tlfName string, req chatConversationResolvingRequest) error {

	query := keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	var cname keybase1.CanonicalTLFNameAndIDWithBreaks
	var err error
	var visout string
	if req.Visibility == chat1.TLFVisibility_PUBLIC {
		visout = "public"
		cname, err = r.TlfClient.PublicCanonicalTLFNameAndID(ctx, query)
	} else {
		visout = "private"
		cname, err = r.TlfClient.CompleteAndCanonicalizePrivateTlfName(ctx, query)
	}
	if err != nil {
		return fmt.Errorf("completing TLF name error: %v", err)
	}
	if string(cname.CanonicalName) != tlfName {
		// If we auto-complete TLF name, we should let users know.
		// TODO: don't spam user here if it's just re-ordering
		r.G.UI.GetTerminalUI().Printf("Using %s conversation %s.\n", visout, cname.CanonicalName)
	}
	req.ctx.canonicalizedTlfName = string(cname.CanonicalName)

	return nil
}

func (r *chatConversationResolver) makeGetInboxAndUnboxLocalArg(
	ctx context.Context, req chatConversationResolvingRequest, identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.GetInboxAndUnboxLocalArg, error) {
	if len(req.TopicName) > 0 && req.TopicType == chat1.TopicType_CHAT {
		return chat1.GetInboxAndUnboxLocalArg{},
			errors.New("we are not supporting setting topic name for chat conversations yet")
	}

	var tlfName *string
	if len(req.TlfName) > 0 {
		err := r.completeAndCanonicalizeTLFName(ctx, req.TlfName, req)
		if err != nil {
			return chat1.GetInboxAndUnboxLocalArg{}, err
		}
		tlfName = &req.ctx.canonicalizedTlfName
	}

	var topicName *string
	if len(req.TopicName) > 0 {
		topicName = &req.TopicName
	}

	return chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			TlfName:       tlfName,
			TopicName:     topicName,
			TopicType:     &req.TopicType,
			TlfVisibility: &req.Visibility,
		},
		IdentifyBehavior: identifyBehavior,
	}, nil
}

func (r *chatConversationResolver) resolveWithService(ctx context.Context, req chatConversationResolvingRequest, identifyBehavior keybase1.TLFIdentifyBehavior) ([]chat1.ConversationLocal, error) {
	arg, err := r.makeGetInboxAndUnboxLocalArg(ctx, req, identifyBehavior)
	if err != nil {
		return nil, err
	}

	gilres, err := r.ChatClient.GetInboxAndUnboxLocal(ctx, arg)
	if err != nil {
		return nil, err
	}

	return gilres.Conversations, nil
}

func (r *chatConversationResolver) resolveWithCliUIInteractively(ctx context.Context, req chatConversationResolvingRequest, conversations []chat1.ConversationLocal) (
	conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	switch len(conversations) {
	case 0:
		fallthrough
	case 1:
		return nil, false, errors.New("resolveWithCliUI called with less than 2 conversations")
	default:
		r.G.UI.GetTerminalUI().Printf(
			"There are %d conversations. Please choose one:\n", len(conversations))
		conversationInfoListView(conversations).show(r.G)
		var num int
		for num = -1; num < 1 || num > len(conversations); {
			input, err := r.G.UI.GetTerminalUI().Prompt(PromptDescriptorChooseConversation,
				fmt.Sprintf("Please enter a number [1-%d]: ", len(conversations)))
			if err != nil {
				return nil, false, err
			}
			if num, err = strconv.Atoi(input); err != nil {
				r.G.UI.GetTerminalUI().Printf("Error converting input to number: %v\n", err)
				continue
			}
		}
		return &conversations[num-1].Info, true, nil
	}
}

func (r *chatConversationResolver) create(ctx context.Context, req chatConversationResolvingRequest) (
	conversationInfo *chat1.ConversationInfoLocal, err error) {
	var newConversation string
	if req.TopicType == chat1.TopicType_CHAT {
		newConversation = fmt.Sprintf("Creating a new %s %s conversation", req.Visibility, req.TopicType)
	} else {
		newConversation = fmt.Sprintf("Creating a new %s %s conversation [%s]", req.Visibility, req.TopicType, req.TopicName)
	}

	if len(req.ctx.canonicalizedTlfName) == 0 {
		tlfName, err := r.G.UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatTLFName, fmt.Sprintf(
			"No conversation found. %s. Hit Ctrl-C to cancel, or specify a TLF name to continue: ",
			newConversation))
		if err != nil {
			return nil, err
		}
		err = r.completeAndCanonicalizeTLFName(ctx, tlfName, req)
		if err != nil {
			return nil, err
		}
	} else {
		r.G.UI.GetTerminalUI().Printf(newConversation+": %s.\n", req.ctx.canonicalizedTlfName)
	}

	var tnp *string
	if len(req.TopicName) > 0 {
		tnp = &req.TopicName
	}
	ncres, err := r.ChatClient.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
		TlfName:       req.ctx.canonicalizedTlfName,
		TopicName:     tnp,
		TopicType:     req.TopicType,
		TlfVisibility: req.Visibility,
	})
	if err != nil {
		return nil, fmt.Errorf("creating conversation error: %v\n", err)
	}
	return &ncres.Conv.Info, err
}

func (r *chatConversationResolver) Resolve(ctx context.Context, req chatConversationResolvingRequest, behavior chatConversationResolvingBehavior) (
	conversationInfo *chat1.ConversationInfoLocal, userChosen bool, err error) {
	req.ctx = &chatConversationResolvingRequestContext{}

	conversations, err := r.resolveWithService(ctx, req, behavior.IdentifyBehavior)
	if err != nil {
		return nil, false, err
	}

	switch len(conversations) {
	case 0:
		if behavior.CreateIfNotExists {
			conversationInfo, err = r.create(ctx, req)
			if err != nil {
				return nil, false, err
			}
			return conversationInfo, false, nil
		}
		return nil, false, errors.New("no conversation found")
	case 1:
		if conversations[0].Error != nil {
			return nil, false, errors.New(*conversations[0].Error)
		}
		info := conversations[0].Info
		if req.TlfName != info.TlfName {
			// This must be:
			//
			// 1) a special case where user only has one conversation, and user
			//    didn't specify TLF name; or
			// 2) user specified TLF name but we auto-completed it or canonicalized
			//    it.
			//
			// Either way, we present a visual confirmation so that user knows chich
			// conversation she's sending into or reading from.
			if info.Triple.TopicType == chat1.TopicType_CHAT {
				r.G.UI.GetTerminalUI().Printf("Found %s %s conversation: %s\n",
					info.Visibility,
					info.Triple.TopicType, info.TLFNameExpandedSummary())
			} else {
				r.G.UI.GetTerminalUI().Printf("Found %s %s conversation [%s]: %s\n",
					info.Visibility, info.Triple.TopicType, info.TopicName, info.TLFNameExpandedSummary())
			}
		}
		return &info, false, nil
	default:
		if behavior.Interactive {
			return r.resolveWithCliUIInteractively(ctx, req, conversations)
		}
		return nil, false, errors.New("multiple conversations found")
	}
}
