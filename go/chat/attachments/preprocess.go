package attachments

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"

	"github.com/keybase/client/go/chat/types"
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
	if p.PreviewContentType != "" {
		res.PreviewMimeType = &p.PreviewContentType
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

func processCallerPreview(ctx context.Context, g *globals.Context, callerPreview chat1.MakePreviewRes) (p Preprocess, err error) {
	ltyp, err := callerPreview.Location.Ltyp()
	if err != nil {
		return p, err
	}
	switch ltyp {
	case chat1.PreviewLocationTyp_BYTES:
		source := callerPreview.Location.Bytes()
		p.Preview = make([]byte, len(source))
		copy(p.Preview, source)
	case chat1.PreviewLocationTyp_FILE:
		f, err := os.Open(callerPreview.Location.File())
		if err != nil {
			return p, err
		}
		defer f.Close()
		if p.Preview, err = ioutil.ReadAll(f); err != nil {
			return p, err
		}
	case chat1.PreviewLocationTyp_URL:
		resp, err := libkb.ProxyHTTPGet(g.Env, callerPreview.Location.Url())
		if err != nil {
			return p, err
		}
		defer resp.Body.Close()
		if p.Preview, err = ioutil.ReadAll(resp.Body); err != nil {
			return p, err
		}
	default:
		return p, fmt.Errorf("unknown preview location: %v", ltyp)
	}
	p.ContentType = callerPreview.MimeType
	if callerPreview.PreviewMimeType != nil {
		p.PreviewContentType = *callerPreview.PreviewMimeType
	}
	if callerPreview.Metadata != nil {
		typ, err := callerPreview.Metadata.AssetType()
		if err != nil {
			return p, err
		}
		switch typ {
		case chat1.AssetMetadataType_IMAGE:
			p.PreviewDim = &Dimension{
				Width:  callerPreview.Metadata.Image().Width,
				Height: callerPreview.Metadata.Image().Height,
			}
		case chat1.AssetMetadataType_VIDEO:
			p.PreviewDurationMs = callerPreview.Metadata.Video().DurationMs
			p.PreviewDim = &Dimension{
				Width:  callerPreview.Metadata.Video().Width,
				Height: callerPreview.Metadata.Video().Height,
			}
		case chat1.AssetMetadataType_AUDIO:
			p.PreviewDurationMs = callerPreview.Metadata.Audio().DurationMs
		}
	}
	if callerPreview.BaseMetadata != nil {
		typ, err := callerPreview.BaseMetadata.AssetType()
		if err != nil {
			return p, err
		}
		switch typ {
		case chat1.AssetMetadataType_IMAGE:
			p.BaseDim = &Dimension{
				Width:  callerPreview.BaseMetadata.Image().Width,
				Height: callerPreview.BaseMetadata.Image().Height,
			}
		case chat1.AssetMetadataType_VIDEO:
			p.BaseDurationMs = callerPreview.BaseMetadata.Video().DurationMs
			p.BaseDim = &Dimension{
				Width:  callerPreview.BaseMetadata.Video().Width,
				Height: callerPreview.BaseMetadata.Video().Height,
			}
		case chat1.AssetMetadataType_AUDIO:
			p.BaseDurationMs = callerPreview.BaseMetadata.Audio().DurationMs
		}
	}
	return p, nil
}

func DetectMIMEType(ctx context.Context, src ReadResetter, filename string) (res string, err error) {
	head := make([]byte, 512)
	_, err = io.ReadFull(src, head)
	if err != nil && err != io.ErrUnexpectedEOF {
		return res, err
	}

	res = http.DetectContentType(head)
	if err = src.Reset(); err != nil {
		return res, err
	}
	// MIME type detection failed us, try using an extension map
	if res == "application/octet-stream" {
		ext := strings.ToLower(filepath.Ext(filename))
		if typ, ok := mimeTypes[ext]; ok {
			res = typ
		}
	}
	return res, nil
}

func PreprocessAsset(ctx context.Context, g *globals.Context, log utils.DebugLabeler, src ReadResetter, filename string,
	nvh types.NativeVideoHelper, callerPreview *chat1.MakePreviewRes) (p Preprocess, err error) {
	if callerPreview != nil && callerPreview.Location != nil {
		log.Debug(ctx, "preprocessAsset: caller provided preview, using that")
		if p, err = processCallerPreview(ctx, g, *callerPreview); err != nil {
			log.Debug(ctx, "preprocessAsset: failed to process caller preview, making fresh one: %s", err)
		} else {
			return p, nil
		}
	}
	defer src.Reset()

	if p.ContentType, err = DetectMIMEType(ctx, src, filename); err != nil {
		return p, err
	}
	log.Debug(ctx, "preprocessAsset: detected attachment content type %s", p.ContentType)
	previewRes, err := Preview(ctx, log, src, p.ContentType, filename, nvh)
	if err != nil {
		log.Debug(ctx, "preprocessAsset: error making preview: %s", err)
		return p, err
	}
	if previewRes != nil {
		log.Debug(ctx, "preprocessAsset: made preview for attachment asset: content type: %s",
			previewRes.ContentType)
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
