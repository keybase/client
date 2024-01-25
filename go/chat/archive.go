package chat

import (
	"context"
	"os"
	"path"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const defaultPageSize = 300

type ChatArchiver struct {
	globals.Contextified
	utils.DebugLabeler
	uid      gregor1.UID
	progress func(messagesComplete, messagesTotal int64)

	sync.Mutex
	messagesComplete int64
	messagesTotal    int64
}

func NewChatArchiver(g *globals.Context, uid gregor1.UID, progress func(messagesComplete, messagesTotal int64)) *ChatArchiver {
	return &ChatArchiver{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ChatArchiver", false),
		uid:          uid,
		progress:     progress,
	}
}

// TODO format this properly
func archiveName(conv chat1.ConversationLocal) string {
	return conv.Info.TlfName
}

func (c *ChatArchiver) notifyProgress(messagesCompleted int64) {
	c.Lock()
	defer c.Unlock()
	c.messagesComplete += messagesCompleted
	c.progress(c.messagesComplete, c.messagesTotal)
}

func (c *ChatArchiver) archiveConv(ctx context.Context, arg chat1.ArchiveChatArg, conv chat1.ConversationLocal) error {
	convArchivePath := path.Join(arg.OutputPath, archiveName(conv), "chat.txt")
	f, err := os.Create(convArchivePath)
	if err != nil {
		return err
	}

	pagination := &chat1.Pagination{Num: defaultPageSize}
	for !pagination.Last {
		thread, err := c.G().ConvSource.Pull(ctx, conv.Info.Id, c.uid,
			chat1.GetThreadReason_ARCHIVE, nil,
			&chat1.GetThreadQuery{
				MarkAsRead: false,
			}, pagination)
		if err != nil {
			return err
		}

		for _, msg := range thread.Messages {
			// TODO fetch attachments, render
			_, err = f.WriteString(msg.SearchableText())
			if err != nil {
				return err
			}
		}
		c.notifyProgress(int64(thread.Pagination.Num))

		// update our global pagination so we can correctly fetch the next page.
		pagination = thread.Pagination
		pagination.Num = defaultPageSize
		pagination.Previous = nil
	}
	return nil
}

func (c *ChatArchiver) ArchiveChat(ctx context.Context, arg chat1.ArchiveChatArg) (err error) {
	defer c.Trace(ctx, &err, "ArchiveChat")()

	// Make sure the root output path exists
	// TODO sensible path if empty
	err = os.MkdirAll(arg.OutputPath, os.ModePerm)
	if err != nil {
		return err
	}

	// Resolve query to a set of convIDs.
	iboxRes, _, err := c.G().InboxSource.Read(ctx, c.uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query)
	if err != nil {
		return err
	}
	convs := iboxRes.Convs

	// Fetch size of each conv to track progress.
	//    - TODO store job info on disk to allow resumption
	for _, conv := range convs {
		c.messagesTotal += int64(conv.MaxVisibleMsgID())

		// TODO convert name
		convArchivePath := path.Join(arg.OutputPath, archiveName(conv))
		err = os.MkdirAll(convArchivePath, os.ModePerm)
		if err != nil {
			return err
		}
	}

	// For each conv, fetch batches of messages until all are fetched.
	//    - Messages are rendered in a text format and attachments are downloaded to the archive path.
	for _, conv := range convs {
		// TODO in parallel?
		if err = c.archiveConv(ctx, arg, conv); err != nil {
			return err
		}
	}

	return nil
}
