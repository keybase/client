// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"encoding/json"
	"fmt"

	"github.com/keybase/client/go/chat"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbun"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

// pullTranscript uses chat transcript functions to pull transcript and encode
// it to postArgs.
func pullTranscript(mctx libkb.MetaContext, postArgs libkb.HTTPArgs, convSource types.ConversationSource,
	convID chat1.ConvIDStr, usernames []kbun.NormalizedUsername) (err error) {

	config := chat.PullTranscriptConfigDefault()
	transcript, err := chat.PullTranscript(mctx, convSource, convID, usernames, config)
	if err != nil {
		return err
	}
	transcriptStr, err := json.Marshal(transcript)
	if err != nil {
		return err
	}
	postArgs["transcript"] = libkb.S{Val: string(transcriptStr)}
	mctx.Debug("Got transcript for %s, %d messages, JSON size: %d", convID,
		len(transcript.Messages), len(transcriptStr))
	return nil
}

func (h *UserHandler) ReportUser(ctx context.Context, arg keybase1.ReportUserArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("REPORT")
	defer mctx.Trace(fmt.Sprintf(
		"UserHandler#ReportUser(username=%q,transcript=%t,convId=%v)",
		arg.Username, arg.IncludeTranscript, arg.ConvID),
		&err)()

	postArgs := libkb.HTTPArgs{
		"username": libkb.S{Val: arg.Username},
		"reason":   libkb.S{Val: arg.Reason},
		"comment":  libkb.S{Val: arg.Comment},
	}
	if arg.ConvID != nil {
		postArgs["conv_id"] = libkb.S{Val: *arg.ConvID}
	}
	if arg.IncludeTranscript && arg.ConvID != nil {
		convID := *arg.ConvID
		// Pull transcripts with messages from curent user and the reported user.
		usernames := []kbun.NormalizedUsername{
			kbun.NewNormalizedUsername(arg.Username),
			mctx.CurrentUsername(),
		}
		err = pullTranscript(mctx, postArgs, h.ChatG().ConvSource, chat1.ConvIDStr(convID), usernames)
		if err != nil {
			// This is not a failure of entire RPC, just warn about the error.
			// Report can still go through without the transcript.
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
