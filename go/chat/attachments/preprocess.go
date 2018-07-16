package attachments

import (
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/keybase/client/go/chat/utils"

	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/context"
)

type Dimension struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

func (d *Dimension) Empty() bool {
	return d.Width == 0 && d.Height == 0
}

func (d *Dimension) Encode() string {
	if d.Width == 0 && d.Height == 0 {
		return ""
	}
	enc, err := json.Marshal(d)
	if err != nil {
		return ""
	}
	return string(enc)
}

type Preprocess struct {
	ContentType        string
	Preview            []byte
	PreviewContentType string
	BaseDim            *Dimension
	BaseDurationMs     int
	PreviewDim         *Dimension
	PreviewDurationMs  int
}

func (p *Preprocess) BaseMetadata() chat1.AssetMetadata {
	if p.BaseDim == nil || p.BaseDim.Empty() {
		return chat1.AssetMetadata{}
	}
	if p.BaseDurationMs > 0 {
		return chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{
			Width:      p.BaseDim.Width,
			Height:     p.BaseDim.Height,
			DurationMs: p.BaseDurationMs,
		})
	}
	return chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
		Width:  p.BaseDim.Width,
		Height: p.BaseDim.Height,
	})
}

func (p *Preprocess) PreviewMetadata() chat1.AssetMetadata {
	if p.PreviewDim == nil || p.PreviewDim.Empty() {
		return chat1.AssetMetadata{}
	}
	if p.PreviewDurationMs > 0 {
		return chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{
			Width:      p.PreviewDim.Width,
			Height:     p.PreviewDim.Height,
			DurationMs: p.PreviewDurationMs,
		})
	}
	return chat1.NewAssetMetadataWithImage(chat1.AssetMetadataImage{
		Width:  p.PreviewDim.Width,
		Height: p.PreviewDim.Height,
	})
}

func (p *Preprocess) Export(getLocation func() *chat1.PreviewLocation) (res chat1.MakePreviewRes, err error) {
	res = chat1.MakePreviewRes{
		MimeType: p.ContentType,
		Location: getLocation(),
	}
	md := p.PreviewMetadata()
	var empty chat1.AssetMetadata
	if md != empty {
		res.Metadata = &md
	}
	baseMd := p.BaseMetadata()
	if baseMd != empty {
		res.BaseMetadata = &baseMd
	}
	return res, nil
}

func PreprocessAsset(ctx context.Context, log utils.DebugLabeler, filename string) (p Preprocess, err error) {
	src, err := os.Open(filename)
	if err != nil {
		return p, err
	}
	defer src.Close()

	head := make([]byte, 512)
	_, err = io.ReadFull(src, head)
	if err != nil && err != io.ErrUnexpectedEOF {
		return p, err
	}

	p = Preprocess{
		ContentType: http.DetectContentType(head),
	}
	log.Debug(ctx, "preprocessAsset: detected attachment content type %s", p.ContentType)
	if _, err := src.Seek(0, 0); err != nil {
		return p, err
	}
	previewRes, err := Preview(ctx, log, src, p.ContentType, filename)
	if err != nil {
		log.Debug(ctx, "preprocessAsset: error making preview: %s", err)
		return p, err
	}
	if previewRes != nil {
		log.Debug(ctx, "preprocessAsset: made preview for attachment asset")
		p.Preview = previewRes.Source
		p.PreviewContentType = previewRes.ContentType
		if previewRes.BaseWidth > 0 || previewRes.BaseHeight > 0 {
			p.BaseDim = &Dimension{Width: previewRes.BaseWidth, Height: previewRes.BaseHeight}
		}
		if previewRes.PreviewWidth > 0 || previewRes.PreviewHeight > 0 {
			p.PreviewDim = &Dimension{Width: previewRes.PreviewWidth, Height: previewRes.PreviewHeight}
		}
		p.BaseDurationMs = previewRes.BaseDurationMs
		p.PreviewDurationMs = previewRes.PreviewDurationMs
	}

	return p, nil
}
