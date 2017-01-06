package chat

import (
	"bytes"
	"errors"
	"image"
	"image/color/palette"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"io"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/nfnt/resize"

	"camlistore.org/pkg/images"
)

const (
	previewImageWidth  = 320
	previewImageHeight = 320
)

type BufferSource struct {
	buf      *bytes.Buffer
	basename string
}

func newBufferSource(buf *bytes.Buffer, basename string) *BufferSource {
	return &BufferSource{
		buf:      buf,
		basename: basename,
	}
}

func (b *BufferSource) Basename() string {
	return b.basename
}

func (b *BufferSource) FileSize() int {
	return b.buf.Len()
}

func (b *BufferSource) Open(sessionID int, cli *keybase1.StreamUiClient) (ReadResetter, error) {
	if b.buf == nil {
		return nil, errors.New("nil buf in BufferSource")
	}
	return newBufReadResetter(b.buf.Bytes()), nil
}

func (b *BufferSource) Close() error {
	b.buf.Reset()
	return nil
}

type bufReadResetter struct {
	buf []byte
	r   *bytes.Reader
}

func newBufReadResetter(buf []byte) *bufReadResetter {
	return &bufReadResetter{
		buf: buf,
		r:   bytes.NewReader(buf),
	}
}

func (b *bufReadResetter) Read(p []byte) (int, error) {
	return b.r.Read(p)
}

func (b *bufReadResetter) Reset() error {
	b.r.Reset(b.buf)
	return nil
}

type PreviewRes struct {
	Source        *BufferSource
	ContentType   string
	BaseWidth     int
	BaseHeight    int
	PreviewWidth  int
	PreviewHeight int
}

// Preview creates preview assets from src.  It returns an in-memory BufferSource
// and the content type of the preview asset.
func Preview(ctx context.Context, src io.Reader, contentType, basename string) (*PreviewRes, error) {
	switch contentType {
	case "image/jpeg", "image/png":
		return previewImage(ctx, src, basename)
	case "image/gif":
		return previewGIF(ctx, src, basename)
	}

	return nil, nil
}

// previewImage will resize a single-frame image into a jpeg.
func previewImage(ctx context.Context, src io.Reader, basename string) (*PreviewRes, error) {
	// images.Decode in camlistore correctly handles exif orientation information.
	img, _, err := images.Decode(src, nil)
	if err != nil {
		return nil, err
	}

	width, height := previewDimensions(img.Bounds())

	// nfnt/resize with NearestNeighbor is the fastest I've found.
	preview := resize.Resize(width, height, img, resize.NearestNeighbor)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, preview, nil); err != nil {
		return nil, err
	}

	return &PreviewRes{
		Source:        newBufferSource(&buf, basename),
		ContentType:   "image/jpeg",
		BaseWidth:     img.Bounds().Dx(),
		BaseHeight:    img.Bounds().Dy(),
		PreviewWidth:  int(width),
		PreviewHeight: int(height),
	}, nil
}

// previewGIF handles resizing multiple frames in an animated gif.
// Based on code in https://github.com/dpup/go-scratch/blob/master/gif-resize/gif-resize.go
func previewGIF(ctx context.Context, src io.Reader, basename string) (*PreviewRes, error) {
	g, err := gif.DecodeAll(src)
	if err != nil {
		return nil, err
	}

	if len(g.Image) == 0 {
		return nil, errors.New("no image frames in GIF")
	}

	// create a new image based on the first frame to draw
	// the incremental frames
	origBounds := g.Image[0].Bounds()
	img := image.NewRGBA(origBounds)

	// draw each frame, then resize it, replacing the existing frames.
	width, height := previewDimensions(origBounds)
	for index, frame := range g.Image {
		bounds := frame.Bounds()
		draw.Draw(img, bounds, frame, bounds.Min, draw.Over)
		g.Image[index] = imageToPaletted(resize.Resize(width, height, img, resize.NearestNeighbor))
	}

	// change the image Config to the new size
	g.Config.Width = int(width)
	g.Config.Height = int(height)

	// encode all the frames into buf
	var buf bytes.Buffer
	if err := gif.EncodeAll(&buf, g); err != nil {
		return nil, err
	}

	return &PreviewRes{
		Source:        newBufferSource(&buf, basename),
		ContentType:   "image/gif",
		BaseWidth:     origBounds.Dx(),
		BaseHeight:    origBounds.Dy(),
		PreviewWidth:  int(width),
		PreviewHeight: int(height),
	}, nil
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
