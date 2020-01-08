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

// How many messages do we pull in each call to ConvSource.Pull...
const transcriptMessageBatch = 100

// ...to try to get the following number of messages sent by chosen users
// (usually user being reported and the reporting user).
const transcriptMessageCount = 50

// Hard limit on Pull calls so we don't spend too much time digging.
const transcriptCallLimit = 5

func PullTranscript(mctx libkb.MetaContext, convSource types.ConversationSource, convIDStr string,
	usernames []kbun.NormalizedUsername) (res ConvTranscript, err error) {

	convIDBytes, err := chat1.MakeConvID(convIDStr)
	if err != nil {
		return res, err
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

	var next []byte

outerLoop:
	for i := 0; i < transcriptCallLimit; i++ {
		pagination := &chat1.Pagination{
			Num:  transcriptMessageBatch,
			Next: next,
		}
		mctx.Debug("Pulling from ConvSource: i=%d, Pagination=%#v", i, pagination)
		threadView, err := convSource.Pull(mctx.Ctx(), convIDBytes, uidBytes, chat1.GetThreadReason_GENERAL,
			chatQuery, pagination)
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
			if len(res.Messages) >= transcriptMessageCount {
				mctx.Debug("Got all messages we wanted (%d) at i=%d", transcriptMessageCount, i)
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
