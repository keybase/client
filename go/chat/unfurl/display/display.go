package display

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
)

func displayUnfurlGeneric(ctx context.Context, srv types.AttachmentURLSrv, convID chat1.ConversationID,
	unfurl chat1.UnfurlGeneric) (res chat1.UnfurlGenericDisplay) {
	res.Title = unfurl.Title
	res.Url = unfurl.Url
	res.SiteName = unfurl.SiteName
	res.PublishTime = unfurl.PublishTime
	res.Description = unfurl.Description
	if unfurl.Image != nil {
		res.Image = &chat1.UnfurlImageDisplay{
			Height: unfurl.Image.Metadata.Image().Height,
			Width:  unfurl.Image.Metadata.Image().Width,
			Url:    srv.GetUnfurlAssetURL(ctx, convID, *unfurl.Image),
		}
	}
	if unfurl.Favicon != nil {
		res.Favicon = &chat1.UnfurlImageDisplay{
			Height: unfurl.Favicon.Metadata.Image().Height,
			Width:  unfurl.Favicon.Metadata.Image().Width,
			Url:    srv.GetUnfurlAssetURL(ctx, convID, *unfurl.Favicon),
		}
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
	case chat1.UnfurlType_YOUTUBE:
		return chat1.NewUnfurlDisplayWithYoutube(chat1.UnfurlYoutubeDisplay{}), nil
	default:
		return res, errors.New("unknown unfurl type")
	}
}
