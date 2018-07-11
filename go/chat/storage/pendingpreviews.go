package storage

import (
	"bytes"
	"io"
	"path/filepath"

	"github.com/keybase/client/go/encrypteddb"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type PendingPreviews struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewPendingPreviews(g *globals.Context) *PendingPreviews {
	return &PendingPreviews{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "PendingPreviews", false),
	}
}

func (p *PendingPreviews) getDir() string {
	return filepath.Join(p.G().GetCacheDir(), "pendingpreviews")
}

func (p *PendingPreviews) getPath(outboxID chat1.OutboxID) string {
	return filepath.Join(p.getDir(), outboxID.String()+".preview")
}

func (p *PendingPreviews) keyFn() encrypteddb.KeyFn {
	return func(ctx context.Context) ([32]byte, error) {
		return getSecretBoxKey(ctx, p.G().ExternalG(), DefaultSecretUI)
	}
}

func (p *PendingPreviews) Get(ctx context.Context, outboxID chat1.OutboxID) (res io.Reader, err error) {
	defer p.Trace(ctx, func() error { return err }, "Get(%s)", outboxID)()

	var dat []byte
	file := encrypteddb.NewFile(p.G().ExternalG(), p.getPath(outboxID), p.keyFn())
	if err := file.Get(ctx, &dat); err != nil {
		return res, err
	}
	return bytes.NewReader(dat), nil
}

func (p *PendingPreviews) Put(ctx context.Context, outboxID chat1.OutboxID, preview []byte) (err error) {
	defer p.Trace(ctx, func() error { return err }, "Put(%s)", outboxID)()
	file := encrypteddb.NewFile(p.G().ExternalG(), p.getPath(outboxID), p.keyFn())
	return file.Put(ctx, preview)
}

func (p *PendingPreviews) Remove(ctx context.Context, outboxID chat1.OutboxID) (err error) {
	defer p.Trace(ctx, func() error { return err }, "Remove(%s)", outboxID)()
	file := encrypteddb.NewFile(p.G().ExternalG(), p.getPath(outboxID), p.keyFn())
	return file.Remove(ctx)
}
