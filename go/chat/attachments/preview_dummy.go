// +build !darwin

package attachments

import (
	"errors"
	"io"

	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func previewVideo(ctx context.Context, log utils.DebugLabeler, src io.Reader, basename string) (*PreviewRes, error) {
	return nil, errors.New("video preview not supported")
}
