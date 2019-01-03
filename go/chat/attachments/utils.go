package attachments

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"os"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

func AssetFromMessage(ctx context.Context, g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, preview bool) (res chat1.Asset, err error) {
	reason := chat1.GetThreadReason_GENERAL
	msgs, err := g.ChatHelper.GetMessages(ctx, uid, convID, []chat1.MessageID{msgID}, true, &reason)
	if err != nil {
		return res, err
	}
	if len(msgs) == 0 {
		return res, libkb.NotFoundError{}
	}
	first := msgs[0]
	st, err := first.State()
	if err != nil {
		return res, err
	}
	if st == chat1.MessageUnboxedState_ERROR {
		em := first.Error().ErrMsg
		return res, errors.New(em)
	}
	if st != chat1.MessageUnboxedState_VALID {
		// given a message id that doesn't exist, msgs can come back
		// with an empty message in it (and st == 0).
		// this check prevents a panic, but perhaps the server needs
		// a fix as well.
		return res, libkb.NotFoundError{}
	}

	msg := first.Valid()
	body := msg.MessageBody
	t, err := body.MessageType()
	if err != nil {
		return res, err
	}

	var attachment chat1.MessageAttachment
	switch t {
	case chat1.MessageType_ATTACHMENT:
		attachment = msg.MessageBody.Attachment()
	case chat1.MessageType_ATTACHMENTUPLOADED:
		uploaded := msg.MessageBody.Attachmentuploaded()
		attachment = chat1.MessageAttachment{
			Object:   uploaded.Object,
			Previews: uploaded.Previews,
			Metadata: uploaded.Metadata,
		}
	default:
		return res, errors.New("not an attachment message")
	}
	res = attachment.Object
	if preview {
		if len(attachment.Previews) > 0 {
			res = attachment.Previews[0]
		} else if attachment.Preview != nil {
			res = *attachment.Preview
		} else {
			return res, errors.New("no preview in attachment")
		}
	}
	return res, nil
}

type FileReadResetter struct {
	filename string
	file     *os.File
	buf      *bufio.Reader
}

func NewFileReadResetter(name string) (*FileReadResetter, error) {
	f := &FileReadResetter{filename: name}
	if err := f.open(); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *FileReadResetter) open() error {
	ff, err := os.Open(f.filename)
	if err != nil {
		return err
	}
	f.file = ff
	f.buf = bufio.NewReader(f.file)
	return nil
}

func (f *FileReadResetter) Read(p []byte) (int, error) {
	return f.buf.Read(p)
}

func (f *FileReadResetter) Reset() error {
	_, err := f.file.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}
	f.buf.Reset(f.file)
	return nil
}

func (f *FileReadResetter) Close() error {
	f.buf = nil
	if f.file != nil {
		return f.file.Close()
	}
	return nil
}

type BufReadResetter struct {
	buf []byte
	r   *bytes.Reader
}

func NewBufReadResetter(buf []byte) *BufReadResetter {
	return &BufReadResetter{
		buf: buf,
		r:   bytes.NewReader(buf),
	}
}

func (b *BufReadResetter) Read(p []byte) (int, error) {
	return b.r.Read(p)
}

func (b *BufReadResetter) Reset() error {
	b.r.Reset(b.buf)
	return nil
}

func AddPendingPreview(ctx context.Context, g *globals.Context, obr *chat1.OutboxRecord) error {
	pre, err := NewPendingPreviews(g).Get(ctx, obr.OutboxID)
	if err != nil {
		return err
	}
	mpr, err := pre.Export(func() *chat1.PreviewLocation {
		loc := chat1.NewPreviewLocationWithUrl(g.AttachmentURLSrv.GetPendingPreviewURL(ctx,
			obr.OutboxID))
		return &loc
	})
	if err != nil {
		return err
	}
	obr.Preview = &mpr
	return nil
}
