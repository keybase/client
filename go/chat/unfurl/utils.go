package unfurl

import (
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
