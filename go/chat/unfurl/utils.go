package unfurl

import (
	"context"
	"errors"
	"net/url"
	"strings"

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

func MakeBaseUnfurlMessage(ctx context.Context, fromMsg chat1.MessageUnboxed, outboxID chat1.OutboxID) (msg chat1.MessagePlaintext, err error) {
	if !fromMsg.IsValid() {
		return msg, errors.New("invalid message")
	}
	tlfName := fromMsg.Valid().ClientHeader.TlfName
	public := fromMsg.Valid().ClientHeader.TlfPublic
	ephemeralMD := fromMsg.Valid().ClientHeader.EphemeralMetadata
	msg = chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_UNFURL,
			TlfName:     tlfName,
			TlfPublic:   public,
			OutboxID:    &outboxID,
			Supersedes:  fromMsg.GetMessageID(),
		},
		MessageBody: chat1.NewMessageBodyWithUnfurl(chat1.MessageUnfurl{}),
	}
	if ephemeralMD != nil {
		msg.ClientHeader.EphemeralMetadata = &chat1.MsgEphemeralMetadata{
			Lifetime: ephemeralMD.Lifetime,
		}
	}
	return msg, nil
}
