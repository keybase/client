package unfurl

import (
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
)

type Unfurler struct {
	utils.DebugLabeler

	extractor *Extractor
	scraper   *Scraper
	packager  *Packager
}

func NewUnfurler(log logger.Logger, store attachments.Store, s3signer s3.Signer,
	ri func() chat1.RemoteInterface) *Unfurler {
	extractor := NewExtractor(log)
	scraper := NewScraper(log)
	packager := NewPackager(log, store, s3signer, ri)
	return &Unfurler{
		DebugLabeler: utils.NewDebugLabeler(log, "Unfurler", false),
		extractor:    extractor,
		scraper:      scraper,
		packager:     packager,
	}
}
