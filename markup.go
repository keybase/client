package main

import (
	Q "github.com/PuerkitoBio/goquery"
	"github.com/keybase/go-libkb"
	"io"
)

func renderNode(w io.Writer, s *Q.Selection) {

}

func Render(w io.Writer, m *libkb.Markup) {
	if m == nil {
		return
	}
	doc, err := Q.NewDocumentFromReader(m.ToReader())
	if err != nil {
		G.Log.Error("Cannot render markup: %s", err.Error())
		return
	}
	doc.Contents().Each(func(i int, s *Q.Selection) {
		renderNode(w, s)
	})
}
