package unfurl

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Packager struct {
	utils.DebugLabeler

	ri           func() chat1.RemoteInterface
	store        attachments.Store
	s3signer     s3.Signer
	maxAssetSize int64
}

func NewPackager(l logger.Logger, store attachments.Store, s3signer s3.Signer,
	ri func() chat1.RemoteInterface) *Packager {
	return &Packager{
		DebugLabeler: utils.NewDebugLabeler(l, "Packager", false),
		store:        store,
		ri:           ri,
		s3signer:     s3signer,
		maxAssetSize: 10000000,
	}
}

func (p *Packager) assetFilename(url string) string {
	toks := strings.Split(url, "/")
	if len(toks) > 0 {
		return toks[len(toks)-1]
	}
	return "unknown.jpg"
}

func (p *Packager) assetFromURL(ctx context.Context, url string, uid gregor1.UID,
	convID chat1.ConversationID) (res chat1.Asset, err error) {
	resp, err := http.Get(url)
	if err != nil {
		return res, err
	}
	defer resp.Body.Close()
	if resp.ContentLength > 0 && resp.ContentLength > p.maxAssetSize {
		return res, fmt.Errorf("asset too large: %d > %d", resp.ContentLength, p.maxAssetSize)
	}
	dat, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return res, err
	}
	if int64(len(dat)) > p.maxAssetSize {
		return res, fmt.Errorf("asset too large: %d > %d", len(dat), p.maxAssetSize)
	}

	filename := p.assetFilename(url)
	src := attachments.NewBufReadResetter(dat)
	pre, err := attachments.PreprocessAsset(ctx, p.DebugLabeler, src, filename,
		types.DummyNativeVideoHelper{}, nil)
	if err != nil {
		return res, err
	}
	if err := src.Reset(); err != nil {
		return res, err
	}
	uploadPt := src
	uploadLen := len(dat)
	uploadMd := pre.BaseMetadata()
	uploadContentType := pre.ContentType
	if pre.Preview != nil {
		uploadPt = attachments.NewBufReadResetter(pre.Preview)
		uploadLen = len(pre.Preview)
		uploadMd = pre.PreviewMetadata()
		uploadContentType = pre.PreviewContentType
	} else {
		p.Debug(ctx, "assetFromURL: warning, failed to generate preview for asset, using base")
	}
	atyp, err := uploadMd.AssetType()
	if err != nil {
		return res, err
	}
	if atyp != chat1.AssetMetadataType_IMAGE && uploadContentType != "image/gif" {
		return res, fmt.Errorf("invalid asset for unfurl package: %v mime: %s", atyp, uploadContentType)
	}

	s3params, err := p.ri().GetS3Params(ctx, convID)
	if err != nil {
		return res, err
	}
	outboxID, err := storage.NewOutboxID()
	if err != nil {
		return res, err
	}
	task := attachments.UploadTask{
		S3Params:       s3params,
		Filename:       filename,
		FileSize:       int64(uploadLen),
		Plaintext:      uploadPt,
		S3Signer:       p.s3signer,
		ConversationID: convID,
		UserID:         uid,
		OutboxID:       outboxID,
	}
	if res, err = p.store.UploadAsset(ctx, &task, ioutil.Discard); err != nil {
		return res, err
	}
	res.MimeType = uploadContentType
	res.Metadata = uploadMd
	return res, nil
}

func (p *Packager) Package(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	raw chat1.UnfurlRaw) (res chat1.Unfurl, err error) {
	defer p.Trace(ctx, func() error { return err }, "Package")()
	typ, err := raw.UnfurlType()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.UnfurlType_GENERIC:
		g := chat1.UnfurlGeneric{
			Title:       raw.Generic().Title,
			Url:         raw.Generic().Url,
			SiteName:    raw.Generic().SiteName,
			PublishTime: raw.Generic().PublishTime,
			Description: raw.Generic().Description,
		}
		if raw.Generic().ImageUrl != nil {
			asset, err := p.assetFromURL(ctx, *raw.Generic().ImageUrl, uid, convID)
			if err != nil {
				p.Debug(ctx, "Package: failed to get image asset URL: %s", err)
			} else {
				g.Image = &asset
			}
		}
		if raw.Generic().FaviconUrl != nil {
			asset, err := p.assetFromURL(ctx, *raw.Generic().FaviconUrl, uid, convID)
			if err != nil {
				p.Debug(ctx, "Package: failed to get favicon asset URL: %s", err)
			} else {
				g.Favicon = &asset
			}
		}
		return chat1.NewUnfurlWithGeneric(g), nil
	case chat1.UnfurlType_GIPHY:
		var g chat1.UnfurlGiphy
		asset, err := p.assetFromURL(ctx, raw.Giphy().ImageUrl, uid, convID)
		if err != nil {
			// if we don't get the image, then just bail out of here
			p.Debug(ctx, "Package: failed to get image asset URL: %s", err)
			return res, errors.New("image not available for giphy unfurl")
		}
		g.Image = asset
		if raw.Giphy().FaviconUrl != nil {
			if asset, err := p.assetFromURL(ctx, *raw.Giphy().FaviconUrl, uid, convID); err != nil {
				p.Debug(ctx, "Package: failed to get favicon asset URL: %s", err)
			} else {
				g.Favicon = &asset
			}
		}
		return chat1.NewUnfurlWithGiphy(g), nil
	default:
		return res, errors.New("not implemented")
	}
}
