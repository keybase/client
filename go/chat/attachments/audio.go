package attachments

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"math"

	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type audioVisualizer struct {
	amps        []float64
	bkgColor    color.Color
	strokeColor color.Color
	strokeWidth int
	strokeGap   int
	height      int
	minAmp      float64
}

func newAudioVisualizer(amps []float64) *audioVisualizer {
	return &audioVisualizer{
		amps:        amps,
		bkgColor:    color.White,
		strokeColor: color.Black,
		strokeWidth: 1,
		strokeGap:   1,
		height:      64,
		minAmp:      -80,
	}
}

func (a *audioVisualizer) stroke(offset, height int, img *image.NRGBA) {
	for i := offset; i < offset+a.strokeWidth; i++ {
		for j := 0; j < height; j++ {
			img.Set(i, a.height-j, a.strokeColor)
		}
	}
}

func (a *audioVisualizer) getHeight(amp float64) int {
	prop := math.Min(1.0, math.Max(1.0-amp/a.minAmp, 0.1))
	return int(float64(a.height) * prop)
}

func (a *audioVisualizer) visualize() ([]byte, int) {
	numStrokes := len(a.amps)
	width := numStrokes * (a.strokeWidth + a.strokeGap)
	img := image.NewNRGBA(image.Rect(0, 0, width, a.height))
	offset := 0
	for i := 0; i < width; i++ {
		for j := 0; j < a.height; j++ {
			img.Set(i, j, a.bkgColor)
		}
	}
	for i := 0; i < numStrokes; i++ {
		height := a.getHeight(a.amps[i])
		a.stroke(offset, height, img)
		offset += a.strokeWidth + a.strokeGap
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes(), width
}

func (s *Sender) MakeAudioPreview(ctx context.Context, amps []float64, duration int) (res chat1.MakePreviewRes, err error) {
	defer s.Trace(ctx, &err, "MakeAudioPreview")()
	v := newAudioVisualizer(amps)
	previewDat, previewWidth := v.visualize()
	res.MimeType = "video/mp4"
	res.PreviewMimeType = new(string)
	*res.PreviewMimeType = "image/png"
	location := chat1.NewPreviewLocationWithBytes(previewDat)
	res.Location = &location
	baseMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{
		Width:      previewWidth,
		Height:     v.height,
		DurationMs: duration,
		IsAudio:    true,
	})
	res.BaseMetadata = &baseMd
	previewMd := chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
		Width:     previewWidth,
		Height:    v.height,
		AudioAmps: amps,
	})
	res.Metadata = &previewMd
	return res, nil
}
