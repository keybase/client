package url

import (
	gUrl "net/url"
)

// URL wraps around the native golang URL struct to allow for custom methods
type URL gUrl.URL

// SetParam returns a new URL with the given param created or modified if already exists
func (u URL) SetParam(key string, val string) URL {
	gu := gUrl.URL(u)
	q := gu.Query()
	q.Del(key)
	q.Add(key, val)
	gu.RawQuery = q.Encode()
	return URL(gu)
}

// String encodes all URL segments to a fully qualified URL string
func (u URL) String() string {
	gu := gUrl.URL(u)
	return gu.String()
}

// Parse decodes a URL string. Returns error if string is not a legal
func Parse(s string) (u URL, err error) {
	gu, err := gUrl.Parse(s)
	if err != nil {
		return
	}
	u = URL(*gu)
	return
}
