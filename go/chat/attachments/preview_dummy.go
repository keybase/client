// +build !darwin,!android

package attachments

import (
	"io"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func previewVideo(ctx context.Context, log utils.DebugLabeler, src io.Reader,
	basename string, nvh types.NativeVideoHelper) (*PreviewRes, error) {
	return previewVideoBlank(ctx, log, src, basename)
}
