package unfurl

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/publicsuffix"
)

func GetDefaultFaviconURL(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	parsed.Path = "favicon.ico"
	parsed.RawQuery = ""
	return parsed.String(), nil
}

func GetDefaultAppleTouchURL(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	parsed.Path = "apple-touch-icon.png"
	parsed.RawQuery = ""
	return parsed.String(), nil
}

func GetHostname(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	return parsed.Hostname(), nil
}

func GetDomain(uri string) (res string, err error) {
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	// hostnames are case-insensitive and the allow and block lists store lowercase
	hostname = strings.ToLower(hostname)
	if len(hostname) == 0 {
		return res, errors.New("no hostname")
	}
	if hostname == types.MapsDomain {
		return hostname, nil
	}
	// Check if hostname is an IP address. If so, return it directly
	// since publicsuffix.EffectiveTLDPlusOne doesn't work with IPs.
	if net.ParseIP(hostname) != nil {
		return hostname, nil
	}
	return publicsuffix.EffectiveTLDPlusOne(hostname)
}

// isAutoAllowedDomain reports domains that always unfurl, in every mode, and
// so can never be stored on either list.
func isAutoAllowedDomain(domain string) bool {
	switch domain {
	case "giphy.com", types.MapsDomain:
		return true
	}
	return false
}

func autoAllowedError(domain string) error {
	return fmt.Errorf("%s is always allowed and cannot be listed", domain)
}

// NormalizeDomain turns user input (a bare domain or a URL) into the domain
// form stored on the allow and block lists.
func NormalizeDomain(input string) (string, error) {
	uri := strings.ToLower(strings.TrimSpace(input))
	if !strings.Contains(uri, "://") {
		uri = "http://" + uri
	}
	domain, err := GetDomain(uri)
	if err != nil {
		return "", fmt.Errorf("invalid domain %q: %w", input, err)
	}
	if isAutoAllowedDomain(domain) {
		return "", autoAllowedError(domain)
	}
	if !strings.Contains(domain, ".") && net.ParseIP(domain) == nil {
		return "", fmt.Errorf("invalid domain %q", input)
	}
	return domain, nil
}

func IsDomain(domain, target string) bool {
	return strings.Contains(domain, target+".")
}

func ClassifyDomain(domain string) chat1.UnfurlType {
	switch {
	case domain == "gph.is":
		fallthrough
	case IsDomain(domain, "giphy"):
		return chat1.UnfurlType_GIPHY
	case domain == types.MapsDomain:
		return chat1.UnfurlType_MAPS
	default:
		return chat1.UnfurlType_GENERIC
	}
}
