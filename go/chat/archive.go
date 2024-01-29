package chat

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sync"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/chatrender"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/sync/errgroup"
)

const defaultPageSize = 1000

type ChatArchiver struct {
	globals.Contextified
	utils.DebugLabeler
	uid      gregor1.UID
	progress func(messagesComplete, messagesTotal int64)

	sync.Mutex
	messagesComplete int64
	messagesTotal    int64
	remoteClient     func() chat1.RemoteInterface
}

func NewChatArchiver(g *globals.Context, uid gregor1.UID, progress func(messagesComplete, messagesTotal int64), remoteClient func() chat1.RemoteInterface) *ChatArchiver {
	return &ChatArchiver{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ChatArchiver", false),
		uid:          uid,
		progress:     progress,
		remoteClient: remoteClient,
	}
}

func (c *ChatArchiver) notifyProgress(messagesCompleted int64) {
	c.Lock()
	defer c.Unlock()
	c.messagesComplete += messagesCompleted
	if c.messagesComplete > c.messagesTotal {
		// total messages is capped to the convs expunge, don't overreport.
		c.messagesComplete = c.messagesTotal
	}
	c.progress(c.messagesComplete, c.messagesTotal)
}

func (c *ChatArchiver) archiveName(conv chat1.ConversationLocal) string {
	return chatrender.ConvName(c.G().GlobalContext, conv, c.G().GlobalContext.Env.GetUsername().String())
}

func (c *ChatArchiver) attachmentName(msg chat1.MessageUnboxedValid) string {
	body := msg.MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return ""
	}
	if typ == chat1.MessageType_ATTACHMENT {
		att := body.Attachment()
		return fmt.Sprintf("%s (%d) - %s", gregor1.FromTime(msg.ServerHeader.Ctime).Format("2006-01-02 15.04.05"), msg.ServerHeader.MessageID, att.Object.Filename)
	}
	return ""
}

func (c *ChatArchiver) archiveConv(ctx context.Context, arg chat1.ArchiveChatArg, conv chat1.ConversationLocal) error {
	convArchivePath := path.Join(arg.OutputPath, c.archiveName(conv), "chat.txt")
	f, err := os.Create(convArchivePath)
	if err != nil {
		return err
	}
	defer f.Close()

	pagination := &chat1.Pagination{Num: defaultPageSize}
	firstPage := true
	for !pagination.Last {
		thread, err := c.G().ConvSource.Pull(ctx, conv.Info.Id, c.uid,
			chat1.GetThreadReason_ARCHIVE, nil,
			&chat1.GetThreadQuery{
				MarkAsRead: false,
			}, pagination)
		if err != nil {
			return err
		}

		msgs := thread.Messages

		// reverse the thread in place so we render in descending order in the file.
		for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
			msgs[i], msgs[j] = msgs[j], msgs[i]
		}

		view := chatrender.ConversationView{
			Conversation: conv,
			Messages:     msgs,
			Opts: chatrender.RenderOptions{
				UseDateTime: true,
				// Only show the headline message once
				SkipHeadline: !firstPage,
			},
		}

		err = view.RenderToWriter(c.G().GlobalContext, f, 1024, false)
		if err != nil {
			return err
		}

		// Check for any attachment messages and download them alongside the chat.
		var eg errgroup.Group
		// Fetch attachments in parallel but limit the number since we
		// also allow parallel conv fetching.
		eg.SetLimit(5)
		for _, m := range msgs {
			if !m.IsValidFull() {
				continue
			}
			msg := m.Valid()
			body := msg.MessageBody
			typ, err := body.MessageType()
			if err != nil {
				return err
			}
			if typ == chat1.MessageType_ATTACHMENT {
				eg.Go(func() error {
					attachmentPath := path.Join(arg.OutputPath, c.archiveName(conv), c.attachmentName(msg))
					f, err := os.Create(attachmentPath)
					if err != nil {
						return err
					}
					defer f.Close()

					err = attachments.Download(ctx, c.G(), c.uid, conv.Info.Id,
						msg.ServerHeader.MessageID, f, false, func(_, _ int64) {}, c.remoteClient)
					if err != nil {
						return err
					}
					return nil
				})
			}
		}
		err = eg.Wait()
		if err != nil {
			return err
		}

		c.notifyProgress(int64(thread.Pagination.Num))

		// update our global pagination so we can correctly fetch the next page.
		firstPage = false
		pagination = thread.Pagination
		pagination.Num = defaultPageSize
		pagination.Previous = nil
	}
	return nil
}

func (c *ChatArchiver) ArchiveChat(ctx context.Context, arg chat1.ArchiveChatArg) (outpath string, err error) {
	defer c.Trace(ctx, &err, "ArchiveChat")()

	if len(arg.OutputPath) == 0 {
		arg.OutputPath = path.Join(c.G().GlobalContext.Env.GetDownloadsDir(), string(arg.JobID))
	}

	// Make sure the root output path exists
	// TODO option to zip output?
	err = os.MkdirAll(arg.OutputPath, os.ModePerm)
	if err != nil {
		return "", err
	}

	// Resolve query to a set of convIDs.
	iboxRes, _, err := c.G().InboxSource.Read(ctx, c.uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query)
	if err != nil {
		return "", err
	}
	convs := iboxRes.Convs

	// Fetch size of each conv to track progress.
	//    - TODO store job info on disk to allow resumption
	for _, conv := range convs {
		c.messagesTotal += int64(conv.MaxVisibleMsgID() - conv.GetMaxDeletedUpTo())

		convArchivePath := path.Join(arg.OutputPath, c.archiveName(conv))
		err = os.MkdirAll(convArchivePath, os.ModePerm)
		if err != nil {
			return "", err
		}
	}

	// For each conv, fetch batches of messages until all are fetched.
	//    - Messages are rendered in a text format and attachments are downloaded to the archive path.
	var eg errgroup.Group
	eg.SetLimit(10)
	for _, conv := range convs {
		conv := conv
		eg.Go(func() error {
			return c.archiveConv(ctx, arg, conv)
		})
	}
	err = eg.Wait()
	if err != nil {
		return "", err
	}

	outpath = arg.OutputPath
	if arg.Compress {
		outpath += ".tar.gzip"
		err = tarGzip(arg.OutputPath, outpath)
		if err != nil {
			return "", err
		}
		err = os.RemoveAll(arg.OutputPath)
		if err != nil {
			return "", err
		}
	}

	return outpath, nil
}

func tarGzip(inPath, outPath string) error {
	f, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer f.Close()

	zr := gzip.NewWriter(f)
	defer zr.Close()
	tw := tar.NewWriter(zr)
	defer tw.Close()

	err = filepath.Walk(inPath, func(fp string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		header, err := tar.FileInfoHeader(fi, fp)
		if err != nil {
			return err
		}
		name, err := filepath.Rel(inPath, filepath.ToSlash(fp))
		if err != nil {
			return err
		}
		header.Name = name

		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if fi.IsDir() {
			return nil
		}
		file, err := os.Open(fp)
		if err != nil {
			return err
		}
		defer file.Close()
		if _, err := io.Copy(tw, file); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}
