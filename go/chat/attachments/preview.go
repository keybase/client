package attachments

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/color/palette"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"io/ioutil"
	"strings"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"

	_ "github.com/keybase/golang-ico" // for image decoding
	"github.com/nfnt/resize"
	_ "golang.org/x/image/bmp" // for image decoding
	"golang.org/x/net/context"

	"camlistore.org/pkg/images"
)

const (
	previewImageWidth  = 640
	previewImageHeight = 640
)

type PreviewRes struct {
	Source            []byte
	ContentType       string
	BaseWidth         int
	BaseHeight        int
	BaseDurationMs    int
	PreviewWidth      int
	PreviewHeight     int
	PreviewDurationMs int
}

// Preview creates preview assets from src.  It returns an in-memory BufferSource
// and the content type of the preview asset.
func Preview(ctx context.Context, log utils.DebugLabeler, src ReadResetter, contentType,
	basename string, nvh types.NativeVideoHelper) (*PreviewRes, error) {
	switch contentType {
	case "image/jpeg", "image/png", "image/vnd.microsoft.icon", "image/x-icon":
		return previewImage(ctx, log, src, basename, contentType)
	case "image/gif":
		return previewGIF(ctx, log, src, basename)
	}
	if strings.HasPrefix(contentType, "video") {
		pre, err := previewVideo(ctx, log, src, basename, nvh)
		if err == nil {
			log.Debug(ctx, "Preview: found video preview for filename: %s contentType: %s", basename,
				contentType)
			return pre, nil
		}
		log.Debug(ctx, "Preview: failed to get video preview for filename: %s contentType: %s err: %s",
			basename, contentType, err)
		return previewVideoBlank(ctx, log, src, basename)
	}
	return nil, nil
}

// previewVideoBlank previews a video by inserting a black rectangle with a play button on it.
func previewVideoBlank(ctx context.Context, log utils.DebugLabeler, src io.Reader,
	basename string) (res *PreviewRes, err error) {
	const width, height = 300, 150
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.NRGBA{
				R: 0,
				G: 0,
				B: 0,
				A: 255,
			})
		}
	}
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		return res, err
	}
	imagePreview, err := previewImage(ctx, log, &out, basename, "image/png")
	if err != nil {
		return res, err
	}
	return &PreviewRes{
		Source:         imagePreview.Source,
		ContentType:    "image/png",
		BaseWidth:      imagePreview.BaseWidth,
		BaseHeight:     imagePreview.BaseHeight,
		BaseDurationMs: 1,
		PreviewHeight:  imagePreview.PreviewHeight,
		PreviewWidth:   imagePreview.PreviewWidth,
	}, nil
}

// previewImage will resize a single-frame image.
func previewImage(ctx context.Context, log utils.DebugLabeler, src io.Reader, basename, contentType string) (res *PreviewRes, err error) {
	defer log.Trace(ctx, func() error { return err }, "previewImage")()
	// images.Decode in camlistore correctly handles exif orientation information.
	log.Debug(ctx, "previewImage: decoding image")
	img, _, err := images.Decode(src, nil)
	if err != nil {
		return nil, err
	}

	width, height := previewDimensions(img.Bounds())

	log.Debug(ctx, "previewImage: resizing image: bounds: %s", img.Bounds())
	preview := resize.Resize(width, height, img, resize.Bicubic)
	var buf bytes.Buffer

	var encodeContentType string
	switch contentType {
	case "image/vnd.microsoft.icon", "image/x-icon", "image/png":
		encodeContentType = "image/png"
		if err := png.Encode(&buf, preview); err != nil {
			return nil, err
		}
	default:
		encodeContentType = "image/jpeg"
		if err := jpeg.Encode(&buf, preview, &jpeg.Options{Quality: 90}); err != nil {
			return nil, err
		}
	}

	return &PreviewRes{
		Source:        buf.Bytes(),
		ContentType:   encodeContentType,
		BaseWidth:     img.Bounds().Dx(),
		BaseHeight:    img.Bounds().Dy(),
		PreviewWidth:  int(width),
		PreviewHeight: int(height),
	}, nil
}

// previewGIF handles resizing multiple frames in an animated gif.
// Based on code in https://github.com/dpup/go-scratch/blob/master/gif-resize/gif-resize.go
func previewGIF(ctx context.Context, log utils.DebugLabeler, src io.Reader, basename string) (*PreviewRes, error) {
	raw, err := ioutil.ReadAll(src)
	if err != nil {
		return nil, err
	}
	g, err := gif.DecodeAll(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}

	frames := len(g.Image)
	if frames == 0 {
		return nil, errors.New("no image frames in GIF")
	}

	log.Debug(ctx, "previewGIF: number of frames = %d", frames)

	var baseDuration int
	if frames > 1 {
		if len(raw) < 10*1024*1024 {
			log.Debug(ctx, "previewGif: not resizing because multiple-frame original < 10MB")

			// don't resize if multiple frames and < 5MB
			bounds := g.Image[0].Bounds()
			duration := gifDuration(g)
			res := &PreviewRes{
				Source:            raw,
				ContentType:       "image/gif",
				BaseWidth:         bounds.Dx(),
				BaseHeight:        bounds.Dy(),
				PreviewWidth:      bounds.Dx(),
				PreviewHeight:     bounds.Dy(),
				BaseDurationMs:    duration,
				PreviewDurationMs: duration,
			}
			return res, nil
		}

		log.Debug(ctx, "previewGif: large multiple-frame gif: %d, just using frame 0", len(raw))
		baseDuration = gifDuration(g)
		g.Image = g.Image[:1]
		g.Delay = g.Delay[:1]
		g.Disposal = g.Disposal[:1]
	}

	// create a new image based on the first frame to draw
	// the incremental frames
	origBounds := g.Image[0].Bounds()
	img := image.NewRGBA(origBounds)

	// draw each frame, then resize it, replacing the existing frames.
	width, height := previewDimensions(origBounds)
	log.Debug(ctx, "previewGif: resizing to %d x %d", width, height)
	for index, frame := range g.Image {
		bounds := frame.Bounds()
		draw.Draw(img, bounds, frame, bounds.Min, draw.Over)
		g.Image[index] = imageToPaletted(resize.Resize(width, height, img, resize.Bicubic))
		log.Debug(ctx, "previewGIF: resized frame %d", index)
	}

	// change the image Config to the new size
	g.Config.Width = int(width)
	g.Config.Height = int(height)

	// encode all the frames into buf
	var buf bytes.Buffer
	if err := gif.EncodeAll(&buf, g); err != nil {
		return nil, err
	}

	res := &PreviewRes{
		Source:         buf.Bytes(),
		ContentType:    "image/gif",
		BaseWidth:      origBounds.Dx(),
		BaseHeight:     origBounds.Dy(),
		PreviewWidth:   int(width),
		PreviewHeight:  int(height),
		BaseDurationMs: baseDuration,
	}

	if len(g.Image) > 1 {
		res.PreviewDurationMs = gifDuration(g)
	}

	return res, nil
}

func previewDimensions(origBounds image.Rectangle) (uint, uint) {
	origWidth := uint(origBounds.Dx())
	origHeight := uint(origBounds.Dy())

	if previewImageWidth >= origWidth && previewImageHeight >= origHeight {
		return origWidth, origHeight
	}

	newWidth, newHeight := origWidth, origHeight
	// Preserve aspect ratio
	if origWidth > previewImageWidth {
		newHeight = uint(origHeight * previewImageWidth / origWidth)
		if newHeight < 1 {
			newHeight = 1
		}
		newWidth = previewImageWidth
	}

	if newHeight > previewImageHeight {
		newWidth = uint(newWidth * previewImageHeight / newHeight)
		if newWidth < 1 {
			newWidth = 1
		}
		newHeight = previewImageHeight
	}

	return newWidth, newHeight
}

// imageToPaletted converts image.Image to *image.Paletted.
// From https://github.com/dpup/go-scratch/blob/master/gif-resize/gif-resize.go
func imageToPaletted(img image.Image) *image.Paletted {
	b := img.Bounds()
	pm := image.NewPaletted(b, palette.Plan9)
	draw.FloydSteinberg.Draw(pm, b, img, image.ZP)
	return pm
}

// gifDuration returns the duration of one loop of an animated gif
// in milliseconds.
func gifDuration(g *gif.GIF) int {
	var total int
	for _, d := range g.Delay {
		total += d
	}

	// total is in 100ths of a second, multiply by 10 to get milliseconds
	return total * 10
}
