// +build android

package attachments

import (
	"bytes"
	"io"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"golang.org/x/net/context"
)

func previewVideo(ctx context.Context, g *globals.Context, log utils.DebugLabeler, src io.Reader,
	basename string) (res *PreviewRes, err error) {
	defer log.Trace(ctx, func() error { return err }, "previewVideo")()
	dat, duration, err := g.NativeVideoHelper.ThumbnailAndDuration(ctx, basename)
	if err != nil {
		return res, err
	}
	log.Debug(ctx, "previewVideo: size: %d duration: %d", len(dat), duration)
	if len(dat) == 0 {
		log.Debug(ctx, "failed to generate preview from native, using blank image")
		return previewVideoBlank(ctx, g, log, src, basename)
	}
	imagePreview, err := previewImage(ctx, log, bytes.NewReader(dat), basename, "image/jpeg")
	if err != nil {
		return res, err
	}
	return &PreviewRes{
		Source:         imagePreview.Source,
		ContentType:    "image/jpeg",
		BaseWidth:      imagePreview.BaseWidth,
		BaseHeight:     imagePreview.BaseHeight,
		BaseDurationMs: duration,
		PreviewHeight:  imagePreview.PreviewHeight,
		PreviewWidth:   imagePreview.PreviewWidth,
	}, nil
}
