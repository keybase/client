// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type NewConvWithAliasError struct{}

func (e NewConvWithAliasError) Error() string {
	return "cannot create conversation using only conversation alias"
}

type NewConvWithoutTLFNameError struct{}

func (e NewConvWithoutTLFNameError) Error() string {
	return "cannot create conversation without a TLF name"
}

type NoConversationFoundError struct{}

func (e NoConversationFoundError) Error() string {
	return "no conversation found"
}

type MultipleConversationFoundError struct{}

func (e MultipleConversationFoundError) Error() string {
	return "multiple conversation found"
}

type ChatTLFNameModifierRequest struct {
	Raw      string
	IsPublic bool
}

type ChatTLFNameModifier interface {
	Modify(ctx context.Context, req ChatTLFNameModifierRequest) (modified string, err error)
}

type chatCLITLFNameModifier struct {
	tlfClient  keybase1.TlfInterface
	terminalUI libkb.TerminalUI

	memorized map[ChatTLFNameModifierRequest]string
}

func newChatCLITLFNameModifier(tlfClient keybase1.TlfInterface, terminalUI libkb.TerminalUI) *chatCLITLFNameModifier {
	return &chatCLITLFNameModifier{
		tlfClient:  tlfClient,
		terminalUI: terminalUI,
		memorized:  make(map[ChatTLFNameModifierRequest]string),
	}
}

func (c *chatCLITLFNameModifier) Modify(
	ctx context.Context, req ChatTLFNameModifierRequest) (modified string, err error) {
	if modified, ok := c.memorized[req]; ok {
		return modified, nil
	}

	query := keybase1.TLFQuery{
		TlfName:          req.Raw,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_CLI,
	}
	if req.IsPublic {
		res, err := c.tlfClient.PublicCanonicalTLFNameAndID(ctx, query)
		if err != nil {
			return "", fmt.Errorf("canonicalizing TLF name error: %v", err)
		}
		modified = string(res.CanonicalName)
	} else {
		res, err := c.tlfClient.CompleteAndCanonicalizePrivateTlfName(ctx, query)
		if err != nil {
			return "", fmt.Errorf("completing and canonicalizing TLF name error: %v", err)
		}
		modified = string(res.CanonicalName)
	}
	c.memorized[req] = modified

	if req.Raw != modified {
		c.terminalUI.Printf("Using TLF name: %s\n", modified)
	}

	return modified, nil
}

type ChatConversationResolvingRequest interface {
	GetInboxAndUnboxLocalArg(ctx context.Context, modifier ChatTLFNameModifier) (chat1.GetInboxAndUnboxLocalArg, error)
	NewConversationLocalArg(ctx context.Context, modifier ChatTLFNameModifier) (chat1.NewConversationLocalArg, error)
	Pick([]chat1.ConversationInfoLocal) []chat1.ConversationInfoLocal
}

type chatCLIAliasResolvingRequest struct {
	alias ShortConversationAlias
}

func (r chatCLIAliasResolvingRequest) GetInboxAndUnboxLocalArg(ctx context.Context, modifier ChatTLFNameModifier) (chat1.GetInboxAndUnboxLocalArg, error) {
	return chat1.GetInboxAndUnboxLocalArg{}, nil
}

func (r chatCLIAliasResolvingRequest) NewConversationLocalArg(ctx context.Context, modifier ChatTLFNameModifier) (chat1.NewConversationLocalArg, error) {
	return chat1.NewConversationLocalArg{}, NewConvWithAliasError{}
}

func (r chatCLIAliasResolvingRequest) Pick(old []chat1.ConversationInfoLocal) (picked []chat1.ConversationInfoLocal) {
	for _, conv := range old {
		if r.alias.MatchesConversationID(conv.Id) {
			picked = append(picked, conv)
		}
	}
	return picked
}

type chatCLIResolvingRequest struct {
	TlfName    string
	TopicName  string
	TopicType  chat1.TopicType
	Visibility chat1.TLFVisibility
}

func (r chatCLIResolvingRequest) GetInboxAndUnboxLocalArg(ctx context.Context, modifier ChatTLFNameModifier) (chat1.GetInboxAndUnboxLocalArg, error) {
	if len(r.TopicName) > 0 && r.TopicType == chat1.TopicType_CHAT {
		return chat1.GetInboxAndUnboxLocalArg{},
			errors.New("we are not supporting setting topic name for chat conversations yet")
	}

	var tlfName *string
	if len(r.TlfName) > 0 {
		cTlfName, err := modifier.Modify(ctx, ChatTLFNameModifierRequest{
			Raw:      r.TlfName,
			IsPublic: r.Visibility == chat1.TLFVisibility_PUBLIC,
		})
		if err != nil {
			return chat1.GetInboxAndUnboxLocalArg{}, err
		}
		tlfName = &cTlfName
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

func (r chatCLIResolvingRequest) NewConversationLocalArg(ctx context.Context, modifier ChatTLFNameModifier) (chat1.NewConversationLocalArg, error) {
	if len(r.TlfName) == 0 {
		return chat1.NewConversationLocalArg{}, NewConvWithoutTLFNameError{}
	}
	cTlfName, err := modifier.Modify(ctx, ChatTLFNameModifierRequest{
		Raw:      r.TlfName,
		IsPublic: r.Visibility == chat1.TLFVisibility_PUBLIC,
	})
	if err != nil {
		return chat1.NewConversationLocalArg{}, err
	}

	var tnp *string
	if len(r.TopicName) > 0 {
		tnp = &r.TopicName
	}
	return chat1.NewConversationLocalArg{
		TlfName:       cTlfName,
		TopicName:     tnp,
		TopicType:     r.TopicType,
		TlfVisibility: r.Visibility,
	}, nil
}

func (r chatCLIResolvingRequest) Pick(old []chat1.ConversationInfoLocal) []chat1.ConversationInfoLocal {
	return old
}

type ChatConversationResolver struct {
	ChatClient chat1.LocalInterface
	TlfClient  keybase1.TlfInterface
}

func (r *ChatConversationResolver) resolve(
	ctx context.Context, req ChatConversationResolvingRequest, modifier ChatTLFNameModifier) (
	conversations []chat1.ConversationInfoLocal, err error) {

	giarg, err := req.GetInboxAndUnboxLocalArg(ctx, modifier)
	if err != nil {
		return nil, err
	}

	gilres, err := r.ChatClient.GetInboxAndUnboxLocal(ctx, giarg)
	if err != nil {
		return nil, err
	}

	for _, conv := range gilres.Conversations {
		conversations = append(conversations, conv.Info)
	}

	return req.Pick(conversations), nil
}

func (r *ChatConversationResolver) create(
	ctx context.Context, req ChatConversationResolvingRequest, modifier ChatTLFNameModifier) (
	conversationInfo *chat1.ConversationInfoLocal, err error) {

	ncarg, err := req.NewConversationLocalArg(ctx, modifier)
	if err != nil {
		return nil, err
	}
	ncres, err := r.ChatClient.NewConversationLocal(ctx, ncarg)
	if err != nil {
		return nil, fmt.Errorf("creating conversation error: %v\n", err)
	}
	return &ncres.Conv.Info, err
}

func (r *ChatConversationResolver) Resolve(
	ctx context.Context, req ChatConversationResolvingRequest, terminalUI libkb.TerminalUI) (
	conversationInfo *chat1.ConversationInfoLocal, err error) {

	var modifier ChatTLFNameModifier
	if terminalUI != nil {
		modifier = newChatCLITLFNameModifier(r.TlfClient, terminalUI)
	} else {
		// set modifier here for non-CLI
		return nil, errors.New("unimplemented")
	}

	convs, err := r.resolve(ctx, req, modifier)
	if err != nil {
		return nil, err
	}

	switch len(convs) {
	case 0:
		return nil, NoConversationFoundError{}
	case 1:
		return &convs[0], nil
	default:
		return nil, MultipleConversationFoundError{}
	}
}

func (r *ChatConversationResolver) ResolveOrCreate(
	ctx context.Context, req ChatConversationResolvingRequest, terminalUI libkb.TerminalUI) (
	conversationInfo *chat1.ConversationInfoLocal, err error) {

	var modifier ChatTLFNameModifier
	if terminalUI != nil {
		modifier = newChatCLITLFNameModifier(r.TlfClient, terminalUI)
	} else {
		// set modifier here for non-CLI
		return nil, errors.New("unimplemented")
	}

	convs, err := r.resolve(ctx, req, modifier)
	if err != nil {
		return nil, err
	}

	switch len(convs) {
	case 0:
		conv, err := r.create(ctx, req, modifier)
		if err != nil {
			return nil, err
		}
		return conv, nil
	case 1:
		return &convs[0], nil
	default:
		return nil, MultipleConversationFoundError{}
	}
}
