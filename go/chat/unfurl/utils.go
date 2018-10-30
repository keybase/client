package unfurl

import "net/url"

func GetDomain(uri string) (res string, err error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return res, err
	}
	return parsed.Hostname(), nil
}
