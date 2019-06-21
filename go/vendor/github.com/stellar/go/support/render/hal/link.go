package hal

import (
	"regexp"
)

type Link struct {
	Href      string `json:"href"`
	Templated bool   `json:"templated,omitempty"`
}

func (l *Link) PopulateTemplated() {
	var err error
	l.Templated, err = regexp.Match("{.*}", []byte(l.Href))
	if err != nil {
		panic(err)
	}
}

func NewLink(href string) Link {
	l := Link{Href: href}
	l.PopulateTemplated()
	return l
}
