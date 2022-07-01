package attachments

import (
	"errors"
	"fmt"
	"io"
	"os"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, messageID chat1.MessageID,
	parentDir string, useArbitraryName bool) (string, io.WriteCloser, error) {
	var sink io.WriteCloser
	var err error
	const openFlag int = os.O_RDWR | os.O_CREATE | os.O_TRUNC
	if err := os.MkdirAll(parentDir, libkb.PermDir); err != nil {
		return "", nil, err
	}

	reason := chat1.GetThreadReason_GENERAL
	unboxed, err := g.ChatHelper.GetMessage(ctx, uid, convID,
		messageID, true, &reason)
	if err != nil {
		return "", nil, err
	}
	if !unboxed.IsValid() {
		return "", nil, errors.New("unable to download attachment from invalid message")
	}
	body := unboxed.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil || typ != chat1.MessageType_ATTACHMENT {
		return "", nil, fmt.Errorf("invalid message type for download: %v", typ)
	}
	unsafeBasename := body.Attachment().Object.Filename
	safeBasename := libkb.GetSafeFilename(unsafeBasename)

	filePath, err := libkb.FindFilePathWithNumberSuffix(parentDir, safeBasename, useArbitraryName)
	if err != nil {
		return "", nil, err
	}
	if sink, err = os.OpenFile(filePath, openFlag, libkb.PermFile); err != nil {
		return "", nil, err
	}
	return filePath, sink, nil
}

func Download(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, messageID chat1.MessageID, sink io.WriteCloser, showPreview bool,
	progress func(int64, int64), ri func() chat1.RemoteInterface) (err error) {

	obj, err := AssetFromMessage(ctx, g, uid, convID, messageID, showPreview)
	if err != nil {
		return err
	}
	record := rpc.NewNetworkInstrumenter(g.ExternalG().RemoteNetworkInstrumenterStorage, "ChatAttachmentDownload")
	defer func() { _ = record.RecordAndFinish(ctx, obj.Size) }()
	fetcher := g.AttachmentURLSrv.GetAttachmentFetcher()
	if err = fetcher.FetchAttachment(ctx, sink, convID, obj, ri, NewS3Signer(ri), progress); err != nil {
		sink.Close()
		return err
	}
	if err = sink.Close(); err != nil {
		return err
	}
	return nil
}
