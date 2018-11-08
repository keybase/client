package unfurl

import (
	"context"
	"errors"
	"net/url"
	"strings"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/publicsuffix"
)

func GetHostname(uri string) (res string, err error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return res, err
	}
	return parsed.Hostname(), nil
}

func GetDomain(uri string) (res string, err error) {
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	if len(hostname) == 0 {
		return res, errors.New("no hostname")
	}
	return publicsuffix.EffectiveTLDPlusOne(hostname)
}

func IsDomain(domain, target string) bool {
	return strings.Contains(domain, target+".")
}

func ClassifyDomain(domain string) chat1.UnfurlType {
	if IsDomain(domain, "youtube") {
		return chat1.UnfurlType_YOUTUBE
	}
	return chat1.UnfurlType_GENERIC
}

func ClassifyDomainFromURI(uri string) (typ chat1.UnfurlType, domain string, err error) {
	if domain, err = GetDomain(uri); err != nil {
		return typ, domain, err
	}
	return ClassifyDomain(domain), domain, nil
}

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
			Width:  unfurl.Image.Metadata.Image(), Width,
			Url: srv.GetUnfurlAssetURL(ctx, convID, *unfurl.Image),
		}
	}
	if unfurl.Favicon != nil {
		res.Favicon = &chat1.UnfurlImageDisplay{
			Height: unfurl.Favicon.Metadata.Image().Height,
			Width:  unfurl.Favicon.Metadata.Image(), Width,
			Url: srv.GetUnfurlAssetURL(ctx, convID, *unfurl.Favicon),
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
		return chat1.NewUnfurlDisplayWithGeneric(displayUnfurlGeneric(ctx, srv, unfurl.Generic())), nil
	case chat1.UnfurlType_YOUTUBE:
		return chat1.NewUnfurlDisplayWithYoutube(chat1.UnfurlYoutubeDisplay{}), nil
	default:
		return res, errors.New("unknown unfurl type")
	}
}
