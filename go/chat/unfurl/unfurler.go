package unfurl

import (
	"context"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type unfurlTask struct {
	Status types.UnfurlerTaskStatus
	Source string
}

type Unfurler struct {
	utils.DebugLabeler

	extractor *Extractor
	scraper   *Scraper
	packager  *Packager
}

func NewUnfurler(log logger.Logger, store attachments.Store, s3signer s3.Signer,
	ri func() chat1.RemoteInterface) *Unfurler {
	extractor := NewExtractor(log)
	scraper := NewScraper(log)
	packager := NewPackager(log, store, s3signer, ri)
	return &Unfurler{
		DebugLabeler: utils.NewDebugLabeler(log, "Unfurler", false),
		extractor:    extractor,
		scraper:      scraper,
		packager:     packager,
	}
}

func (u *Unfurler) Complete(ctx context.Context, outboxID chat1.OutboxID) error {

}

func (u *Unfurler) Status(ctx context.Context, outboxID chat1.OutboxID) (types.UnfurlerTaskStatus, chat1.Unfurl, error) {

}

func (u *Unfurler) Unfurl(ctx context.Context, msg chat1.MessageUnboxed) (res chat1.Unfurl, err error) {
	defer u.Trace(ctx, func() error { return err }, "UnfurlMessage")()

}

func (u *Unfurler) makeMessage(ctx context.Context, tlfName string, public bool, outboxID chat1.OutboxID,
	ephemeralLifetime *gregor1.DurationSec) (msg chat1.MessagePlaintext) {
	msg = chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_UNFURL,
			TlfName:     tlfName,
			TlfPublic:   public,
			OutboxID:    &outboxID,
		},
		MessageBody: chat1.NewMessageBodyWithUnfurl(chat1.MessageUnfurl{}),
	}
	if ephemeralLifetime != nil {
		msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{
			Lifetime: *ephemeralLifetime,
		}
	}
	return msg
}

func (u *Unfurler) UnfurlAndSend(ctx context.Context, sender types.Sender, convID chat1.ConversationID, msg chat1.MessageUnboxed) (outboxID chat1.OutboxID, msgID *chat1.MessageID, err error) {
	defer u.Trace(ctx, func() error { return err }, "UnfurlAndSend")()
	outboxID, err = storage.NewOutboxID()
	if err != nil {
		return outboxID, msgID, err
	}

}
