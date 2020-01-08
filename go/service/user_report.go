// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/keybase/client/go/kbun"

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
	Ctime          gregor1.Time      `json:"ctime_ms"`
}

// How many messages do we pull in each call to ConvSource.Pull...
const transcriptMessageBatch = 100

// ...to try to get the following number of messages sent by chosen users
// (usually user being reported and the reporting user).
const transcriptMessageCount = 50

// Hard limit on Pull calls so we don't spend too much time digging.
const transcriptCallLimit = 5

func pullTranscript(mctx libkb.MetaContext, chatG *globals.ChatContext, convIDStr string, usernames []kbun.NormalizedUsername) (res string, err error) {
	convIDBytes, err := chat1.MakeConvID(convIDStr)
	if err != nil {
		return "", err
	}

	mctx.Debug("Pulling transcript for convID=%s, usernames=%v", convIDStr, usernames)
	if len(usernames) == 0 {
		mctx.Debug("usernames array is empty, pulling messages for ALL usernames")
	}
	usernameMap := make(map[string]struct{}, len(usernames))
	for _, v := range usernames {
		usernameMap[v.String()] = struct{}{}
	}

	uidBytes := gregor1.UID(mctx.CurrentUID().ToBytes())
	chatQuery := &chat1.GetThreadQuery{
		MarkAsRead:   false,
		MessageTypes: chat1.VisibleChatMessageTypes(),
	}
	var transcript convTranscript
	var next []byte

outerLoop:
	for i := 0; i < transcriptCallLimit; i++ {
		pagination := &chat1.Pagination{
			Num:  transcriptMessageBatch,
			Next: next,
		}
		mctx.Debug("Pulling from ConvSource: i=%d, Pagination=%#v", i, pagination)
		threadView, err := chatG.ConvSource.Pull(mctx.Ctx(), convIDBytes, uidBytes, chat1.GetThreadReason_GENERAL,
			chatQuery, pagination)
		if err != nil {
			return "", err
		}
		mctx.Debug("Got %d messages to search through", len(threadView.Messages))
		for _, msg := range threadView.Messages {
			if !msg.IsValid() {
				continue
			}
			mv := msg.Valid()
			// Filter by usernames
			if len(usernames) != 0 {
				if _, ok := usernameMap[mv.SenderUsername]; !ok {
					// Skip this message
					continue
				}
			}
			tMsg := convTranscriptMsg{
				SenderUsername: mv.SenderUsername,
				Body:           mv.MessageBody,
				Ctime:          mv.ServerHeader.Ctime,
			}
			transcript.Messages = append(transcript.Messages, tMsg)
			if len(transcript.Messages) >= transcriptMessageCount {
				mctx.Debug("Got all messages we wanted (%d) at i=%d", transcriptMessageCount, i)
				break outerLoop
			}
		}

		if threadView.Pagination.Last {
			mctx.Debug("i=%d was the last page", i)
			break
		}
		next = threadView.Pagination.Next
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
		// Pull transcripts with messages from curent user and the reported user.
		usernames := []kbun.NormalizedUsername{
			kbun.NewNormalizedUsername(arg.Username),
			mctx.CurrentUsername(),
		}
		transcript, err := pullTranscript(mctx, h.ChatG(), convID, usernames)
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
