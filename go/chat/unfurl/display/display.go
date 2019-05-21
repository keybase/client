package display

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
)

func assetToImageDisplay(ctx context.Context, convID chat1.ConversationID, asset chat1.Asset,
	srv types.AttachmentURLSrv) (res chat1.UnfurlImageDisplay, err error) {
	var height, width int
	typ, err := asset.Metadata.AssetType()
	if err != nil {
		return res, err
	}
	isVideo := false
	switch typ {
	case chat1.AssetMetadataType_IMAGE:
		height = asset.Metadata.Image().Height
		width = asset.Metadata.Image().Width
	case chat1.AssetMetadataType_VIDEO:
		isVideo = asset.MimeType != "image/gif"
		height = asset.Metadata.Video().Height
		width = asset.Metadata.Video().Width
	default:
		return res, errors.New("unknown asset type")
	}
	return chat1.UnfurlImageDisplay{
		IsVideo: isVideo,
		Height:  height,
		Width:   width,
		Url:     srv.GetUnfurlAssetURL(ctx, convID, asset),
	}, nil
}

func displayUnfurlGeneric(ctx context.Context, srv types.AttachmentURLSrv, convID chat1.ConversationID,
	unfurl chat1.UnfurlGeneric) (res chat1.UnfurlGenericDisplay) {
	res.Title = unfurl.Title
	res.Url = unfurl.Url
	res.SiteName = unfurl.SiteName
	res.PublishTime = unfurl.PublishTime
	res.Description = unfurl.Description
	if unfurl.Image != nil {
		if media, err := assetToImageDisplay(ctx, convID, *unfurl.Image, srv); err == nil {
			res.Media = &media
		}
	}
	if unfurl.Favicon != nil {
		res.Favicon = new(chat1.UnfurlImageDisplay)
		if fav, err := assetToImageDisplay(ctx, convID, *unfurl.Favicon, srv); err == nil {
			res.Favicon = &fav
		}
	}
	return res
}

func displayUnfurlGiphy(ctx context.Context, srv types.AttachmentURLSrv, convID chat1.ConversationID,
	unfurl chat1.UnfurlGiphy) (res chat1.UnfurlGiphyDisplay, err error) {
	if unfurl.Image != nil {
		if img, err := assetToImageDisplay(ctx, convID, *unfurl.Image, srv); err == nil {
			res.Image = &img
		}
	}
	if unfurl.Video != nil {
		if vid, err := assetToImageDisplay(ctx, convID, *unfurl.Video, srv); err == nil {
			res.Video = &vid
		}
	}
	if unfurl.Favicon != nil {
		res.Favicon = new(chat1.UnfurlImageDisplay)
		if fav, err := assetToImageDisplay(ctx, convID, *unfurl.Favicon, srv); err == nil {
			res.Favicon = &fav
		}
	}
	if res.Image == nil && res.Video == nil {
		return res, errors.New("no image for video for giphy")
	}
	return res, nil
}

func DisplayUnfurl(ctx context.Context, srv types.AttachmentURLSrv, convID chat1.ConversationID,
	unfurl chat1.Unfurl) (res chat1.UnfurlDisplay, err error) {
	typ, err := unfurl.UnfurlType()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.UnfurlType_GENERIC:
		return chat1.NewUnfurlDisplayWithGeneric(displayUnfurlGeneric(ctx, srv, convID, unfurl.Generic())),
			nil
	case chat1.UnfurlType_GIPHY:
		giphy, err := displayUnfurlGiphy(ctx, srv, convID, unfurl.Giphy())
		if err != nil {
			return res, err
		}
		return chat1.NewUnfurlDisplayWithGiphy(giphy), nil
	case chat1.UnfurlType_YOUTUBE:
		return chat1.NewUnfurlDisplayWithYoutube(chat1.UnfurlYoutubeDisplay{}), nil
	default:
		return res, errors.New("unknown unfurl type")
	}
}
