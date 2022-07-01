package chat

import (
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type ConvTranscript struct {
	Messages []ConvTranscriptMsg `json:"messages"`
}

type ConvTranscriptMsg struct {
	SenderUsername string            `json:"senderUsername"`
	Body           chat1.MessageBody `json:"body"`
	Ctime          gregor1.Time      `json:"ctime_ms"`
}

type PullTranscriptConfig struct {
	// How many messages to pull with given filters (so list of usernames, or
	// all users).
	messageCount int

	batchSize  int // how many to pull in one batch
	batchCount int // how many batches to try
}

func PullTranscriptConfigDefault() PullTranscriptConfig {
	return PullTranscriptConfig{
		messageCount: 100,
		batchSize:    100,
		batchCount:   5,
	}
}

func PullTranscript(mctx libkb.MetaContext, convSource types.ConversationSource, convID chat1.ConvIDStr,
	usernames []kbun.NormalizedUsername, config PullTranscriptConfig) (res ConvTranscript, err error) {

	convIDBytes, err := chat1.MakeConvID(convID.String())
	if err != nil {
		return res, err
	}

	mctx.Debug("Pulling transcript for convID=%s, usernames=%v", convID, usernames)
	usernameMap := make(map[string]struct{}, len(usernames))
	if len(usernames) != 0 {
		for _, v := range usernames {
			usernameMap[v.String()] = struct{}{}
		}
	} else {
		mctx.Debug("usernames array is empty, pulling messages for ALL usernames")
	}

	uidBytes := gregor1.UID(mctx.CurrentUID().ToBytes())
	chatQuery := &chat1.GetThreadQuery{
		MarkAsRead:   false,
		MessageTypes: chat1.VisibleChatMessageTypes(),
	}

	var next []byte

outerLoop:
	for i := 0; i < config.batchCount; i++ {
		pagination := &chat1.Pagination{
			Num:  config.batchSize,
			Next: next,
		}
		mctx.Debug("Pulling from ConvSource: i=%d, Pagination=%#v", i, pagination)
		threadView, err := convSource.Pull(mctx.Ctx(), convIDBytes, uidBytes,
			chat1.GetThreadReason_GENERAL, nil, chatQuery, pagination)
		if err != nil {
			return ConvTranscript{}, err
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
			tMsg := ConvTranscriptMsg{
				SenderUsername: mv.SenderUsername,
				Body:           mv.MessageBody,
				Ctime:          mv.ServerHeader.Ctime,
			}
			res.Messages = append(res.Messages, tMsg)
			if len(res.Messages) >= config.messageCount {
				mctx.Debug("Got all messages we wanted (%d) at i=%d", config.messageCount, i)
				break outerLoop
			}
		}

		if threadView.Pagination == nil {
			mctx.Debug("i=%d got no Pagination struct", i)
			break
		}
		if threadView.Pagination.Last {
			mctx.Debug("i=%d was the last page", i)
			break
		}
		next = threadView.Pagination.Next
	}

	return res, nil
}
