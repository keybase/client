package kbtest

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

// JPEG/PNG bytes can differ across Go versions and GOARCH even when the
// pictures match. nfnt/resize bicubic is float-based; amd64 vs arm64 can
// differ by a few 8-bit levels (observed max 10).
const decodedImageMaxDelta = 16

func RequireDecodedImageNear(t testing.TB, path string, got []byte) {
	t.Helper()
	require.NoError(t, decodedImageNearFile(path, got))
}

func decodedImageNearFile(path string, got []byte) error {
	wantBytes, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	want, err := decodeImage(wantBytes)
	if err != nil {
		return err
	}
	gotImg, err := decodeImage(got)
	if err != nil {
		return err
	}
	if want.Bounds() != gotImg.Bounds() {
		return fmt.Errorf("bounds %v != %v", want.Bounds(), gotImg.Bounds())
	}
	b := want.Bounds()
	var seen int
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			wr, wg, wb, wa := want.At(x, y).RGBA()
			gr, gg, gb, ga := gotImg.At(x, y).RGBA()
			seen = max(seen, chDelta8(wr, gr), chDelta8(wg, gg), chDelta8(wb, gb), chDelta8(wa, ga))
		}
	}
	if seen > decodedImageMaxDelta {
		return fmt.Errorf("max channel delta %d exceeds %d", seen, decodedImageMaxDelta)
	}
	return nil
}

func decodeImage(data []byte) (image.Image, error) {
	if img, err := jpeg.Decode(bytes.NewReader(data)); err == nil {
		return img, nil
	}
	return png.Decode(bytes.NewReader(data))
}

func chDelta8(a, b uint32) int {
	av, bv := int(a>>8), int(b>>8)
	return max(av, bv) - min(av, bv)
}
