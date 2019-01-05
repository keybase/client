package hal

import (
	sUrl "github.com/stellar/go/support/url"
	"net/url"
	"strconv"
)

// BasePage represents the simplest page: one with no links and only embedded records.
// Can be used to build custom page-like resources
type BasePage struct {
	FullURL *url.URL `json:"-"`
	Embedded struct {
		Records []Pageable `json:"records"`
	} `json:"_embedded"`
}

// Add appends the provided record onto the page
func (p *BasePage) Add(rec Pageable) {
	p.Embedded.Records = append(p.Embedded.Records, rec)
}

// Init initialized the Records slice.  This ensures that an empty page
// renders its records as an empty array, rather than `null`
func (p *BasePage) Init() {
	if p.Embedded.Records == nil {
		p.Embedded.Records = make([]Pageable, 0, 1)
	}
}

// Links represents the Links in a Page
type Links struct {
	Self Link `json:"self"`
	Next Link `json:"next"`
	Prev Link `json:"prev"`
}

// Page represents the common page configuration (i.e. has self, next, and prev
// links) and has a helper method `PopulateLinks` to automate their
// initialization.
type Page struct {
	Links Links `json:"_links"`
	BasePage
	Order    string `json:"-"`
	Limit    uint64 `json:"-"`
	Cursor   string `json:"-"`
}

// PopulateLinks sets the common links for a page.
func (p *Page) PopulateLinks() {
	p.Init()

	rec := p.Embedded.Records

	//verify paging params
	selfUrl := sUrl.URL(*p.FullURL).
		SetParam("cursor", p.Cursor).
		SetParam("order", p.Order).
		SetParam("limit", strconv.FormatInt(int64(p.Limit), 10))

	//self: re-encode existing query params
	p.Links.Self = NewLink(selfUrl.String())

	//next: update cursor to last record (if any)
	nextUrl := selfUrl
	if len(rec) > 0 {
		nextUrl = nextUrl.SetParam("cursor", rec[len(rec)-1].PagingToken())
	}
	p.Links.Next = NewLink(nextUrl.String())

	//prev: inverse order and update cursor to first record (if any)
	prevUrl := selfUrl.SetParam("order", p.InvertedOrder())
	if len(rec) > 0 {
		prevUrl = prevUrl.SetParam("cursor", rec[0].PagingToken())
	}
	p.Links.Prev = NewLink(prevUrl.String())
}

// InvertedOrder returns the inversion of the page's current order. Used to
// populate the prev link
func (p *Page) InvertedOrder() string {
	switch p.Order {
	case "asc":
		return "desc"
	case "desc":
		return "asc"
	default:
		return "asc"
	}
}
