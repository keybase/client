package hal

import (
	"fmt"
	"net/url"
	"strings"
)

// StandardPagingOptions is a helper string to make creating paged collection
// URIs simpler.
const StandardPagingOptions = "{?cursor,limit,order}"

// LinkBuilder is a helper for constructing URLs in horizon.
type LinkBuilder struct {
	Base *url.URL
}

// Link returns a hal.Link whose href is each of the
// provided parts joined by '/'
func (lb *LinkBuilder) Link(parts ...string) Link {
	path := strings.Join(parts, "/")

	href := lb.expandLink(path)

	return NewLink(href)
}

// PagedLink creates a link using the `Link` method and
// appends the common paging options
func (lb *LinkBuilder) PagedLink(parts ...string) Link {
	nl := lb.Link(parts...)
	nl.Href += StandardPagingOptions
	nl.PopulateTemplated()
	return nl
}

// Linkf provides a helper function that returns a link with an
// href created by passing the arguments into fmt.Sprintf
func (lb *LinkBuilder) Linkf(format string, args ...interface{}) Link {
	return lb.Link(fmt.Sprintf(format, args...))
}

// expandLink takes an href and resolves it against the LinkBuilders base url,
// if set. NOTE: this method panics if the input href cannot be parsed. It is
// meant to be used by developer author ed links, not with external data.
func (lb *LinkBuilder) expandLink(href string) string {
	if lb.Base == nil {
		return href
	}

	u, err := url.Parse(href)
	if err != nil {
		panic(err)
	}

	if u.Host == "" {
		u.Host = lb.Base.Host

		if u.Scheme == "" {
			u.Scheme = lb.Base.Scheme
		}
	}

	//HACK: replace the encoded path with the un-encoded path, which preserves
	//the uritemplate parameters.
	result := strings.Replace(u.String(), u.EscapedPath(), u.Path, -1)

	return result
}
