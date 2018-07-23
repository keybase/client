package attachments

import (
	"os"
	"path/filepath"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
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
		return storage.GetSecretBoxKey(ctx, p.G().ExternalG(), storage.DefaultSecretUI)
	}
}

func (p *PendingPreviews) Get(ctx context.Context, outboxID chat1.OutboxID) (res Preprocess, err error) {
	defer p.Trace(ctx, func() error { return err }, "Get(%s)", outboxID)()

	file := encrypteddb.NewFile(p.G().ExternalG(), p.getPath(outboxID), p.keyFn())
	if err := file.Get(ctx, &res); err != nil {
		return res, err
	}
	return res, nil
}

func (p *PendingPreviews) Put(ctx context.Context, outboxID chat1.OutboxID, pre Preprocess) (err error) {
	defer p.Trace(ctx, func() error { return err }, "Put(%s)", outboxID)()
	if err := os.MkdirAll(p.getDir(), os.ModePerm); err != nil {
		return err
	}
	file := encrypteddb.NewFile(p.G().ExternalG(), p.getPath(outboxID), p.keyFn())
	return file.Put(ctx, pre)
}

func (p *PendingPreviews) Remove(ctx context.Context, outboxID chat1.OutboxID) {
	defer p.Trace(ctx, func() error { return nil }, "Remove(%s)", outboxID)()
	file := encrypteddb.NewFile(p.G().ExternalG(), p.getPath(outboxID), p.keyFn())
	if err := file.Remove(ctx); err != nil {
		p.Debug(ctx, "Remove: failed: %s", err)
	}
}
