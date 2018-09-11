// +build !darwin,!android

package attachments

import (
	"io"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func previewVideo(ctx context.Context, g *globals.Context, log utils.DebugLabeler, src io.Reader,
	basename string) (*PreviewRes, error) {
	return previewVideoBlank(ctx, g, log, src, basename)
}
