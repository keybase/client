package attachments

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDetectMIMETypeSmallFile(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for x := 0; x < 4; x++ {
		for y := 0; y < 4; y++ {
			img.Set(x, y, color.RGBA{R: 200, G: 30, B: 30, A: 255})
		}
	}
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, img))
	require.Less(t, buf.Len(), 512)

	typ, err := DetectMIMEType(context.Background(), NewBufReadResetter(buf.Bytes()), "testuser.png")
	require.NoError(t, err)
	require.Equal(t, "image/png", typ)
}
