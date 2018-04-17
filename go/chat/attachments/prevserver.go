package attachments

import (
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type PreviewServer interface {
	GetURLs(ctx context.Context, ats []chat1.ConversationIDMessageIDPair) ([]string, error)
}

type RemotePreviewServer struct {
	globals.Contextified
	utils.DebugLabeler

	httpSrv *libkb.HTTPSrv
}
