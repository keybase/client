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
	TlfName     string
	TopicName   string
	TopicType   chat1.TopicType
	Visibility  keybase1.TLFVisibility
	MembersType chat1.ConversationMembersType

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

	// Specify whether the resolve should error if a conversation was found
	MustNotExist bool

	IdentifyBehavior keybase1.TLFIdentifyBehavior
}

type chatConversationResolver struct {
	G           *libkb.GlobalContext
	ChatClient  chat1.LocalInterface
	TlfClient   keybase1.TlfInterface
	TeamsClient keybase1.TeamsInterface
}

func newChatConversationResolver(g *libkb.GlobalContext) (c *chatConversationResolver, err error) {
	c = new(chatConversationResolver)
	if c.ChatClient, err = GetChatLocalClient(g); err != nil {
		return c, err
	}
	if c.TlfClient, err = GetTlfClient(g); err != nil {
		return c, err
	}
	if c.TeamsClient, err = GetTeamsClient(g); err != nil {
		return c, err
	}
	c.G = g
	return c, nil
}

// completeAndCanonicalizeTLFName completes tlfName and canonicalizes it if
// necessary. The new TLF name is stored to req.ctx.canonicalizedTlfName.
// len(tlfName) must > 0
func (r *chatConversationResolver) completeAndCanonicalizeTLFName(ctx context.Context, tlfName string, req chatConversationResolvingRequest) error {

	switch req.MembersType {
	case chat1.ConversationMembersType_KBFS:
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
		}
		var cname keybase1.CanonicalTLFNameAndIDWithBreaks
		var err error
		if req.Visibility == keybase1.TLFVisibility_PUBLIC {
			cname, err = r.TlfClient.PublicCanonicalTLFNameAndID(ctx, query)
		} else {
			cname, err = r.TlfClient.CompleteAndCanonicalizePrivateTlfName(ctx, query)
		}
		if err != nil {
			// When a recipient's proofs are failing, this is the error a CLI user
			// will see. It needs to be human readable.
			return fmt.Errorf("failed to open chat conversation: %v", err)
		}
		req.ctx.canonicalizedTlfName = string(cname.CanonicalName)
	case chat1.ConversationMembersType_IMPTEAM:
		// Add our name out front
		if req.Visibility != keybase1.TLFVisibility_PUBLIC {
			username := r.G.Env.GetUsername()
			if len(username) == 0 {
				return libkb.LoginRequiredError{}
			}
			tlfName = username.String() + "," + tlfName
		}
		impRes, err := r.TeamsClient.LookupOrCreateImplicitTeam(ctx, keybase1.LookupOrCreateImplicitTeamArg{
			Name:   tlfName,
			Public: req.Visibility == keybase1.TLFVisibility_PUBLIC,
		})
		if err != nil {
			return err
		}
		req.ctx.canonicalizedTlfName = impRes.DisplayName.String()
	case chat1.ConversationMembersType_TEAM:
		req.ctx.canonicalizedTlfName = tlfName
	}

	return nil
}

func (r *chatConversationResolver) makeGetInboxAndUnboxLocalArg(
	ctx context.Context, req chatConversationResolvingRequest, identifyBehavior keybase1.TLFIdentifyBehavior) (chat1.GetInboxAndUnboxLocalArg, error) {

	var nameQuery *chat1.NameQuery
	if len(req.TlfName) > 0 {
		if err := r.completeAndCanonicalizeTLFName(ctx, req.TlfName, req); err != nil {
			return chat1.GetInboxAndUnboxLocalArg{}, err
		}
		nameQuery = &chat1.NameQuery{
			Name:        req.ctx.canonicalizedTlfName,
			MembersType: req.MembersType,
		}
	}

	var topicName *string
	if len(req.TopicName) > 0 {
		topicName = &req.TopicName
	}

	return chat1.GetInboxAndUnboxLocalArg{
		Query: &chat1.GetInboxLocalQuery{
			Name:          nameQuery,
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

	// Convert argument
	var fcArg chat1.FindConversationsLocalArg
	if arg.Query.Name != nil {
		fcArg.TlfName = arg.Query.Name.Name
		fcArg.MembersType = arg.Query.Name.MembersType
	}
	if arg.Query.TlfVisibility != nil {
		fcArg.Visibility = *arg.Query.TlfVisibility
	}
	if arg.Query.TopicType != nil {
		fcArg.TopicType = *arg.Query.TopicType
	}
	if arg.Query.TopicName != nil {
		fcArg.TopicName = *arg.Query.TopicName
	}
	fcArg.IdentifyBehavior = identifyBehavior
	fcArg.OneChatPerTLF = new(bool)

	res, err := r.ChatClient.FindConversationsLocal(ctx, fcArg)
	if err != nil {
		return nil, err
	}

	return res.Conversations, nil
}

func (r *chatConversationResolver) resolveWithCliUIInteractively(ctx context.Context, req chatConversationResolvingRequest, conversations []chat1.ConversationLocal) (
	conversation *chat1.ConversationLocal, userChosen bool, err error) {
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
		return &conversations[num-1], true, nil
	}
}

func (r *chatConversationResolver) create(ctx context.Context, req chatConversationResolvingRequest) (
	conversationInfo *chat1.ConversationLocal, err error) {

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
		r.G.UI.GetTerminalUI().Printf("%s\n", newConversation)
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
		MembersType:   req.MembersType,
	})
	if err != nil {
		return nil, err
	}
	return &ncres.Conv, nil
}

func (r *chatConversationResolver) Resolve(ctx context.Context, req chatConversationResolvingRequest, behavior chatConversationResolvingBehavior) (
	conversation *chat1.ConversationLocal, userChosen bool, err error) {
	req.ctx = &chatConversationResolvingRequestContext{}

	conversations, err := r.resolveWithService(ctx, req, behavior.IdentifyBehavior)
	if err != nil {
		return nil, false, err
	}

	if behavior.MustNotExist && len(conversations) > 0 {
		return nil, false, fmt.Errorf("conversation already exists")
	}

	switch len(conversations) {
	case 0:
		if behavior.CreateIfNotExists {
			conversation, err = r.create(ctx, req)
			if err != nil {
				return nil, false, err
			}
			return conversation, false, nil
		}
		return nil, false, errors.New("no conversation found")
	case 1:
		if conversations[0].Error != nil {
			return nil, false, errors.New(conversations[0].Error.Message)
		}
		conversation := conversations[0]
		info := conversation.Info
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
					info.Triple.TopicType, conversation.Info.TLFNameExpandedSummary())
			} else {
				r.G.UI.GetTerminalUI().Printf("Found %s %s conversation [%s]: %s\n",
					info.Visibility, info.Triple.TopicType, info.TopicName, info.TLFNameExpandedSummary())
			}
		}
		return &conversation, false, nil
	default:
		if behavior.Interactive {
			return r.resolveWithCliUIInteractively(ctx, req, conversations)
		}
		return nil, false, errors.New("multiple conversations found")
	}
}
