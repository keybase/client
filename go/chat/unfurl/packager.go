package unfurl

import (
	"context"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
)

type Packager struct {
	utils.DebugLabeler
}

func NewPackager(l logger.Logger) *Packager {
	return &Packager{
		DebugLabeler: utils.NewDebugLabeler(l, "Packager", false),
	}
}

func (p *Packager) Package(ctx context.Context, raw chat1.UnfurlRaw) (res chat1.Unfurl, err error) {
	defer p.Trace(ctx, func() error { return err }, "Package")()
	return res, err
}
