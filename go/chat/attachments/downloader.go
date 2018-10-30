package attachments

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

func getDownloadTempDir(g *globals.Context, basename string) (string, error) {
	p := filepath.Join(g.GetEnv().GetCacheDir(), "dltemp")
	if err := os.MkdirAll(p, os.ModePerm); err != nil {
		return "", err
	}
	return filepath.Join(p, basename), nil
}

func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, messageID chat1.MessageID,
	filename string) (string, io.WriteCloser, error) {
	var sink io.WriteCloser
	var err error
	if filename == "" {
		// No filename means we will create one in the OS temp dir
		// Get the sent file name first
		reason := chat1.GetThreadReason_GENERAL
		unboxed, err := g.ChatHelper.GetMessages(ctx, uid, convID,
			[]chat1.MessageID{messageID}, true, &reason)
		if err != nil {
			return "", nil, err
		}
		if !unboxed[0].IsValid() {
			return "", nil, errors.New("unable to download attachment from invalid message")
		}
		body := unboxed[0].Valid().MessageBody
		typ, err := body.MessageType()
		if err != nil || typ != chat1.MessageType_ATTACHMENT {
			return "", nil, fmt.Errorf("invalid message type for download: %v", typ)
		}
		basepath := body.Attachment().Object.Filename
		basename := path.Base(basepath)
		fullpath, err := getDownloadTempDir(g, basename)
		if err != nil {
			return "", nil, err
		}
		f, err := os.OpenFile(fullpath, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0644)
		if err != nil {
			return "", nil, err
		}
		filename = fullpath
		sink = f
	} else {
		if sink, err = os.OpenFile(filename, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0600); err != nil {
			return "", nil, err
		}
	}
	return filename, sink, nil
}

func Download(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, messageID chat1.MessageID, sink io.WriteCloser, showPreview bool,
	progress func(int64, int64), ri func() chat1.RemoteInterface) error {

	obj, err := AssetFromMessage(ctx, g, uid, convID, messageID, showPreview)
	if err != nil {
		return err
	}
	fetcher := g.AttachmentURLSrv.GetAttachmentFetcher()
	if err := fetcher.FetchAttachment(ctx, sink, convID, obj, ri,
		NewS3Signer(ri), progress); err != nil {
		sink.Close()
		return err
	}
	if err := sink.Close(); err != nil {
		return err
	}
	return nil
}
