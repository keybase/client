package unfurl

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"

	"github.com/keybase/client/go/chat/maps"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/giphy"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"

	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type Packager struct {
	globals.Contextified
	utils.DebugLabeler

	cache        *unfurlCache
	ri           func() chat1.RemoteInterface
	store        attachments.Store
	s3signer     s3.Signer
	maxAssetSize int64
}

func NewPackager(g *globals.Context, store attachments.Store, s3signer s3.Signer,
	ri func() chat1.RemoteInterface) *Packager {
	return &Packager{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Packager", false),
		cache:        newUnfurlCache(),
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

func (p *Packager) assetBodyAndLength(ctx context.Context, url string) (body io.ReadCloser, size int64, err error) {
	resp, err := libkb.ProxyHTTPGet(p.G().Env, url)
	if err != nil {
		return body, size, err
	}
	return resp.Body, resp.ContentLength, nil
}

func (p *Packager) assetFromURL(ctx context.Context, url string, uid gregor1.UID,
	convID chat1.ConversationID, usePreview bool) (res chat1.Asset, err error) {
	body, contentLength, err := p.assetBodyAndLength(ctx, url)
	if err != nil {
		return res, err
	}
	defer body.Close()
	return p.assetFromURLWithBody(ctx, body, contentLength, url, uid, convID, usePreview)
}

func (p *Packager) uploadAsset(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	src *attachments.BufReadResetter, filename string, len int64, md chat1.AssetMetadata, contentType string) (res chat1.Asset, err error) {
	atyp, err := md.AssetType()
	if err != nil {
		return res, err
	}
	if atyp != chat1.AssetMetadataType_IMAGE && atyp != chat1.AssetMetadataType_VIDEO {
		return res, fmt.Errorf("invalid asset for unfurl package: %v mime: %s", atyp, contentType)
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
		FileSize:       len,
		Plaintext:      src,
		S3Signer:       p.s3signer,
		ConversationID: convID,
		UserID:         uid,
		OutboxID:       outboxID,
	}
	if res, err = p.store.UploadAsset(ctx, &task, ioutil.Discard); err != nil {
		return res, err
	}
	res.MimeType = contentType
	res.Metadata = md
	return res, nil
}

func (p *Packager) assetFromURLWithBody(ctx context.Context, body io.ReadCloser, contentLength int64,
	url string, uid gregor1.UID, convID chat1.ConversationID, usePreview bool) (res chat1.Asset, err error) {
	defer body.Close()
	if contentLength > 0 && contentLength > p.maxAssetSize {
		return res, fmt.Errorf("asset too large: %d > %d", contentLength, p.maxAssetSize)
	}
	dat, err := ioutil.ReadAll(body)
	if err != nil {
		return res, err
	}
	if int64(len(dat)) > p.maxAssetSize {
		return res, fmt.Errorf("asset too large: %d > %d", len(dat), p.maxAssetSize)
	}

	filename := p.assetFilename(url)
	src := attachments.NewBufReadResetter(dat)
	pre, err := attachments.PreprocessAsset(ctx, p.G(), p.DebugLabeler, src, filename,
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
	if usePreview && pre.Preview != nil {
		uploadPt = attachments.NewBufReadResetter(pre.Preview)
		uploadLen = len(pre.Preview)
		uploadMd = pre.PreviewMetadata()
		uploadContentType = pre.PreviewContentType
	} else {
		p.Debug(ctx, "assetFromURL: warning, failed to generate preview for asset, using base")
	}
	return p.uploadAsset(ctx, uid, convID, uploadPt, filename, int64(uploadLen), uploadMd, uploadContentType)
}

func (p *Packager) uploadVideo(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	video chat1.UnfurlVideo) (res chat1.Asset, err error) {
	body, len, err := p.assetBodyAndLength(ctx, video.Url)
	if err != nil {
		return res, err
	}
	defer body.Close()
	return p.uploadVideoWithBody(ctx, uid, convID, body, len, video)
}

func (p *Packager) uploadVideoWithBody(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	body io.ReadCloser, len int64, video chat1.UnfurlVideo) (res chat1.Asset, err error) {
	dat, err := ioutil.ReadAll(body)
	if err != nil {
		return res, err
	}
	return p.uploadAsset(ctx, uid, convID, attachments.NewBufReadResetter(dat), "video.mp4",
		len, chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{
			Width:      video.Width,
			Height:     video.Height,
			DurationMs: 1,
		}), video.MimeType)
}

func (p *Packager) packageGeneric(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	raw chat1.UnfurlRaw) (res chat1.Unfurl, err error) {
	g := chat1.UnfurlGeneric{
		Title:       raw.Generic().Title,
		Url:         raw.Generic().Url,
		SiteName:    raw.Generic().SiteName,
		PublishTime: raw.Generic().PublishTime,
		Description: raw.Generic().Description,
	}
	if raw.Generic().Video != nil {
		asset, err := p.uploadVideo(ctx, uid, convID, *raw.Generic().Video)
		if err != nil {
			p.Debug(ctx, "packageGeneric: failed to package video asset: %s", err)
		}
		g.Image = &asset
	}
	if g.Image == nil && raw.Generic().ImageUrl != nil {
		asset, err := p.assetFromURL(ctx, *raw.Generic().ImageUrl, uid, convID, true)
		if err != nil {
			p.Debug(ctx, "packageGeneric: failed to get image asset URL: %s", err)
		} else {
			g.Image = &asset
		}
	}
	if raw.Generic().FaviconUrl != nil {
		asset, err := p.assetFromURL(ctx, *raw.Generic().FaviconUrl, uid, convID, true)
		if err != nil {
			p.Debug(ctx, "packageGeneric: failed to get favicon asset URL: %s", err)
		} else {
			g.Favicon = &asset
		}
	}
	return chat1.NewUnfurlWithGeneric(g), nil
}

func (p *Packager) packageGiphy(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	raw chat1.UnfurlRaw) (res chat1.Unfurl, err error) {
	var g chat1.UnfurlGiphy
	var imgBody io.ReadCloser
	var imgLength int64
	if raw.Giphy().ImageUrl != nil {
		imgBody, imgLength, err = giphy.Asset(libkb.NewMetaContext(ctx, p.G().ExternalG()),
			*raw.Giphy().ImageUrl)
		if err != nil {
			p.Debug(ctx, "Package: failed to get body specs for giphy image: %s", err)
			return res, err
		}
		defer imgBody.Close()
	}
	if raw.Giphy().Video != nil {
		// If we found a video, then let's see if it is smaller than the image, if so we will
		// set it (which means it will get used by the frontend)
		vidBody, vidLength, err := giphy.Asset(libkb.NewMetaContext(ctx, p.G().ExternalG()),
			raw.Giphy().Video.Url)
		if err == nil && (imgLength == 0 || vidLength < imgLength) && vidLength < p.maxAssetSize {
			p.Debug(ctx, "Package: found video: len: %d", vidLength)
			defer vidBody.Close()
			asset, err := p.uploadVideoWithBody(ctx, uid, convID, vidBody, int64(vidLength),
				*raw.Giphy().Video)
			if err != nil {
				p.Debug(ctx, "Package: failed to get video asset URL: %s", err)
			} else {
				g.Video = &asset
			}
		} else if err != nil {
			p.Debug(ctx, "Package: failed to get video specs: %s", err)
		} else {
			defer vidBody.Close()
			p.Debug(ctx, "Package: not selecting video: %d(video) > %d(image)", vidLength, imgLength)
		}
	}
	if g.Video == nil && raw.Giphy().ImageUrl != nil {
		// Only grab the image if we didn't get a video
		asset, err := p.assetFromURLWithBody(ctx, imgBody, imgLength, *raw.Giphy().ImageUrl, uid,
			convID, true)
		if err != nil {
			// if we don't get the image, then just bail out of here
			p.Debug(ctx, "Package: failed to get image asset URL: %s", err)
			return res, errors.New("image not available for giphy unfurl")
		}
		g.Image = &asset
	}
	if raw.Giphy().FaviconUrl != nil {
		if asset, err := p.assetFromURL(ctx, *raw.Giphy().FaviconUrl, uid, convID, true); err != nil {
			p.Debug(ctx, "Package: failed to get favicon asset URL: %s", err)
		} else {
			g.Favicon = &asset
		}
	}
	return chat1.NewUnfurlWithGiphy(g), nil
}

func (p *Packager) packageMaps(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	raw chat1.UnfurlRaw) (res chat1.Unfurl, err error) {
	mapsRaw := raw.Maps()
	g := chat1.UnfurlGeneric{
		Title:       mapsRaw.Title,
		Url:         mapsRaw.Url,
		SiteName:    mapsRaw.SiteName,
		Description: &mapsRaw.Description,
	}
	// load map
	var reader io.ReadCloser
	var length int64
	mapsURL := mapsRaw.ImageUrl
	locReader, locLength, err := maps.MapReaderFromURL(ctx, mapsURL)
	if err != nil {
		return res, err
	}
	defer locReader.Close()
	if mapsRaw.HistoryImageUrl != nil {
		liveReader, _, err := maps.MapReaderFromURL(ctx, *mapsRaw.HistoryImageUrl)
		if err != nil {
			return res, err
		}
		defer liveReader.Close()
		if reader, length, err = maps.CombineMaps(ctx, locReader, liveReader); err != nil {
			return res, err
		}
	} else {
		reader = locReader
		length = locLength
	}
	asset, err := p.assetFromURLWithBody(ctx, reader, length, mapsURL, uid, convID, true)
	if err != nil {
		p.Debug(ctx, "Package: failed to get maps asset URL: %s", err)
		return res, errors.New("image not available for maps unfurl")
	}
	g.Image = &asset
	return chat1.NewUnfurlWithGeneric(g), nil
}

func (p *Packager) cacheKey(uid gregor1.UID, convID chat1.ConversationID, raw chat1.UnfurlRaw) string {
	url := raw.GetUrl()
	if url == "" {
		return ""
	}
	typ, err := raw.UnfurlType()
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%s-%s-%s-%s", uid, convID, url, typ)
}

func (p *Packager) Package(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	raw chat1.UnfurlRaw) (res chat1.Unfurl, err error) {
	defer p.Trace(ctx, func() error { return err }, "Package")()

	cacheKey := p.cacheKey(uid, convID, raw)
	if item, valid := p.cache.get(cacheKey); cacheKey != "" && valid {
		p.Debug(ctx, "Package: using cached value")
		return item.data.(chat1.Unfurl), nil
	}
	defer func() {
		if cacheKey != "" && err == nil {
			p.cache.put(cacheKey, res)
		}
	}()

	typ, err := raw.UnfurlType()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.UnfurlType_GENERIC:
		return p.packageGeneric(ctx, uid, convID, raw)
	case chat1.UnfurlType_GIPHY:
		return p.packageGiphy(ctx, uid, convID, raw)
	case chat1.UnfurlType_MAPS:
		return p.packageMaps(ctx, uid, convID, raw)
	default:
		return res, errors.New("not implemented")
	}
}
