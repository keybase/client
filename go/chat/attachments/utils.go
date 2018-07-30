package attachments

import (
	"bufio"
	"bytes"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

func AssetFromMessage(ctx context.Context, g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, preview bool) (res chat1.Asset, err error) {

	msgs, err := g.ChatHelper.GetMessages(ctx, uid, convID, []chat1.MessageID{msgID}, true)
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

type fileReadResetter struct {
	filename string
	file     *os.File
	buf      *bufio.Reader
}

func newFileReadResetter(name string) (*fileReadResetter, error) {
	f := &fileReadResetter{filename: name}
	if err := f.open(); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *fileReadResetter) open() error {
	ff, err := os.Open(f.filename)
	if err != nil {
		return err
	}
	f.file = ff
	f.buf = bufio.NewReader(f.file)
	return nil
}

func (f *fileReadResetter) Read(p []byte) (int, error) {
	return f.buf.Read(p)
}

func (f *fileReadResetter) Reset() error {
	_, err := f.file.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}
	f.buf.Reset(f.file)
	return nil
}

func (f *fileReadResetter) Close() error {
	f.buf = nil
	if f.file != nil {
		return f.file.Close()
	}
	return nil
}

type bufReadResetter struct {
	buf []byte
	r   *bytes.Reader
}

func newBufReadResetter(buf []byte) *bufReadResetter {
	return &bufReadResetter{
		buf: buf,
		r:   bytes.NewReader(buf),
	}
}

func (b *bufReadResetter) Read(p []byte) (int, error) {
	return b.r.Read(p)
}

func (b *bufReadResetter) Reset() error {
	b.r.Reset(b.buf)
	return nil
}

type ContentTypeOverridingResponseWriter struct {
	original http.ResponseWriter
}

var _ http.ResponseWriter = (*ContentTypeOverridingResponseWriter)(nil)

func NewContentTypeOverridingResponseWriter(
	original http.ResponseWriter) *ContentTypeOverridingResponseWriter {
	return &ContentTypeOverridingResponseWriter{
		original: original,
	}
}

func (w *ContentTypeOverridingResponseWriter) overrideMimeType(
	mimeType string) (newMimeType string) {
	// Send text/plain for all HTML and JS files to avoid them being executed
	// by the frontend WebView.
	lower := strings.ToLower(mimeType)
	if strings.Contains(lower, "javascript") ||
		strings.Contains(lower, "html") {
		return "text/plain"
	}
	return mimeType
}

func (w *ContentTypeOverridingResponseWriter) override() {
	t := w.original.Header().Get("Content-Type")
	if len(t) > 0 {
		w.original.Header().Set("Content-Type", w.overrideMimeType(t))
	}
	w.original.Header().Set("X-Content-Type-Options", "nosniff")
}

func (w *ContentTypeOverridingResponseWriter) Header() http.Header {
	return w.original.Header()
}

func (w *ContentTypeOverridingResponseWriter) WriteHeader(statusCode int) {
	w.override()
	w.original.WriteHeader(statusCode)
}

func (w *ContentTypeOverridingResponseWriter) Write(data []byte) (int, error) {
	w.override()
	return w.original.Write(data)
}
