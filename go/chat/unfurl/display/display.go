package display

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
)

func assetToImageDisplay(ctx context.Context, convID chat1.ConversationID, asset chat1.Asset,
	srv types.AttachmentURLSrv) (res chat1.UnfurlImageDisplay) {
	// double check type before charging forward
	typ, err := asset.Metadata.AssetType()
	if err != nil || typ != chat1.AssetMetadataType_IMAGE {
		return res
	}
	return chat1.UnfurlImageDisplay{
		Height: asset.Metadata.Image().Height,
		Width:  asset.Metadata.Image().Width,
		Url:    srv.GetUnfurlAssetURL(ctx, convID, asset),
	}
}

func displayUnfurlGeneric(ctx context.Context, srv types.AttachmentURLSrv, convID chat1.ConversationID,
	unfurl chat1.UnfurlGeneric) (res chat1.UnfurlGenericDisplay) {
	res.Title = unfurl.Title
	res.Url = unfurl.Url
	res.SiteName = unfurl.SiteName
	res.PublishTime = unfurl.PublishTime
	res.Description = unfurl.Description
	if unfurl.Image != nil {
		res.Image = new(chat1.UnfurlImageDisplay)
		*res.Image = assetToImageDisplay(ctx, convID, *unfurl.Image, srv)
	}
	if unfurl.Favicon != nil {
		res.Favicon = new(chat1.UnfurlImageDisplay)
		*res.Favicon = assetToImageDisplay(ctx, convID, *unfurl.Favicon, srv)
	}
	return res
}

func displayUnfurlGiphy(ctx context.Context, srv types.AttachmentURLSrv, convID chat1.ConversationID,
	unfurl chat1.UnfurlGiphy) (res chat1.UnfurlGiphyDisplay) {

	giphyAssetToDisplay := func(asset chat1.Asset) (res *chat1.UnfurlImageDisplay, err error) {
		var height, width int
		typ, err := asset.Metadata.AssetType()
		if err != nil {
			return res, err
		}
		switch typ {
		case chat1.AssetMetadataType_IMAGE:
			height = asset.Metadata.Image().Height
			width = asset.Metadata.Image().Width
		case chat1.AssetMetadataType_VIDEO:
			height = asset.Metadata.Video().Height
			width = asset.Metadata.Video().Width
		default:
			return res, errors.New("unknown asset type")
		}
		return &chat1.UnfurlImageDisplay{
			Height: height,
			Width:  width,
			Url:    srv.GetUnfurlAssetURL(ctx, convID, asset),
		}, nil
	}
	var err error
	if unfurl.Image != nil {
		if res.Image, err = giphyAssetToDisplay(*unfurl.Image); err != nil {
			return res
		}
	}
	if unfurl.Video != nil {
		if res.Video, err = giphyAssetToDisplay(*unfurl.Video); err != nil {
			return res
		}
	}
	if unfurl.Favicon != nil {
		res.Favicon = new(chat1.UnfurlImageDisplay)
		*res.Favicon = assetToImageDisplay(ctx, convID, *unfurl.Favicon, srv)
	}
	return res
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
		return chat1.NewUnfurlDisplayWithGiphy(displayUnfurlGiphy(ctx, srv, convID, unfurl.Giphy())), nil
	case chat1.UnfurlType_YOUTUBE:
		return chat1.NewUnfurlDisplayWithYoutube(chat1.UnfurlYoutubeDisplay{}), nil
	default:
		return res, errors.New("unknown unfurl type")
	}
}
