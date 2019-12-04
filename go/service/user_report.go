// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type convTranscript struct {
	Messages []convTranscriptMsg `json:"messages"`
}

type convTranscriptMsg struct {
	SenderUsername string            `json:"senderUsername"`
	Body           chat1.MessageBody `json:"body"`
}

// When sending a transcript, send the following number of most recent chat
// messages of selected types.
const transcriptMessageLimit = 100

func pullTranscript(mctx libkb.MetaContext, chatG *globals.ChatContext, convIDStr string) (res string, err error) {
	convIDBytes, err := chat1.MakeConvID(convIDStr)
	if err != nil {
		return "", err
	}
	uidBytes := gregor1.UID(mctx.CurrentUID().ToBytes())
	chatQuery := &chat1.GetThreadQuery{
		MarkAsRead:   false,
		MessageTypes: chat1.VisibleChatMessageTypes(),
	}
	pagination := &chat1.Pagination{
		Num: transcriptMessageLimit,
	}
	threadView, err := chatG.ConvSource.Pull(mctx.Ctx(), convIDBytes, uidBytes, chat1.GetThreadReason_GENERAL,
		chatQuery, pagination)
	if err != nil {
		return "", err
	}
	var transcript convTranscript
	for _, msg := range threadView.Messages {
		if !msg.IsValid() {
			continue
		}
		mv := msg.Valid()
		tMsg := convTranscriptMsg{
			SenderUsername: mv.SenderUsername,
			Body:           mv.MessageBody,
		}
		transcript.Messages = append(transcript.Messages, tMsg)
	}
	transcriptStr, err := json.Marshal(transcript)
	if err != nil {
		return "", err
	}
	return string(transcriptStr), nil
}

func (h *UserHandler) ReportUser(ctx context.Context, arg keybase1.ReportUserArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("REPORT")
	convIDStr := "nil"
	if arg.ConvID != nil {
		convIDStr = *arg.ConvID
	}
	defer mctx.TraceTimed(fmt.Sprintf(
		"UserHandler#ReportUser(username=%q,transcript=%t,convId=%s)",
		arg.Username, arg.IncludeTranscript, convIDStr),
		func() error { return err })()

	postArgs := libkb.HTTPArgs{
		"username": libkb.S{Val: arg.Username},
		"reason":   libkb.S{Val: arg.Reason},
		"comment":  libkb.S{Val: arg.Comment},
	}
	if arg.ConvID != nil {
		postArgs["conv_id"] = libkb.S{Val: *arg.ConvID}
	}
	if arg.IncludeTranscript {
		if arg.ConvID == nil {
			return errors.New("invalid arguments: IncludeTranscript is true but ConvID == nil")
		}
		convID := *arg.ConvID

		transcript, err := pullTranscript(mctx, h.ChatG(), convID)
		if err == nil {
			mctx.Debug("Got transcript for %s, size: %d", convID, len(transcript))
			postArgs["transcript"] = libkb.S{Val: transcript}
		} else {
			mctx.Warning("Could not load conversation transcript: %s", err)
		}
	}

	apiArg := libkb.APIArg{
		Endpoint:    "report/conversation",
		SessionType: libkb.APISessionTypeREQUIRED,
		Args:        postArgs,
	}
	_, err = mctx.G().API.Post(mctx, apiArg)
	return err
}
