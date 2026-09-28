package attachments

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, messageID chat1.MessageID,
	parentDir string, useArbitraryName bool,
) (string, io.WriteCloser, error) {
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
	safeBasename := DownloadBasename(body.Attachment().Object)

	filePath, err := libkb.FindFilePathWithNumberSuffix(parentDir, safeBasename, useArbitraryName)
	if err != nil {
		return "", nil, err
	}
	if sink, err = os.OpenFile(filePath, openFlag, libkb.PermFile); err != nil {
		return "", nil, err
	}
	return filePath, sink, nil
}

// extensionsByMIMEType inverts mimeTypes, keeping the lexically first extension
// when several share a type (.jpeg over .jpg).
var extensionsByMIMEType = func() map[string]string {
	res := make(map[string]string, len(mimeTypes))
	for ext, typ := range mimeTypes {
		if cur, ok := res[typ]; !ok || ext < cur {
			res[typ] = ext
		}
	}
	return res
}()

// DownloadBasename names the file an asset is saved as. Audio recordings sent
// before their filename was kept on upload were stored as "." (the Base of an
// empty path), which would otherwise save with no extension.
func DownloadBasename(asset chat1.Asset) string {
	if safe := libkb.GetSafeFilename(asset.Filename); safe != "." && safe != "/" {
		return safe
	}
	if typ, err := asset.Metadata.AssetType(); err == nil && typ == chat1.AssetMetadataType_VIDEO &&
		asset.Metadata.Video().IsAudio {
		return "audio.m4a"
	}
	if mediaType, _, err := mime.ParseMediaType(asset.MimeType); err == nil {
		if ext, ok := extensionsByMIMEType[mediaType]; ok {
			return "attachment" + ext
		}
	}
	return "attachment"
}

func Download(ctx context.Context, g *globals.Context, uid gregor1.UID,
	convID chat1.ConversationID, messageID chat1.MessageID, sink io.WriteCloser, showPreview bool,
	progress func(int64, int64), ri func() chat1.RemoteInterface,
) (err error) {
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
