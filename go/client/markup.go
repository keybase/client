// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bytes"
	"io"
	"regexp"
	"strings"

	Q "github.com/PuerkitoBio/goquery"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/kr/text"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var INDENT = 3

type Paragraph struct {
	data   []byte
	indent int
	cols   int
	prefix string
}

// Buffer adds data to the internal paragraph buffer.
func (p *Paragraph) Buffer(b []byte) {
	p.data = append(p.data, b...)
}

var (
	nl = []byte{'\n'}
	sp = []byte{' '}
)

// makePad makes a whitespace pad that is l bytes long.
func makePad(l int) []byte {
	ret := make([]byte, l)
	for i := 0; i < l; i++ {
		ret[i] = ' '
	}
	return ret
}

var spaceRE = regexp.MustCompile(`[[:space:]]+`)

// spacify replaces arbitrary strings of whitespace with
// a single ' ' character. Also strips off leading and trailing
// whitespace.
func spacify(s string) string {
	v := spaceRE.Split(s, -1)
	if len(v) > 0 && v[0] == "" {
		v = v[1:]
	}
	l := len(v)
	if l > 0 && v[l-1] == "" {
		v = v[0:(l - 1)]
	}
	return strings.Join(v, " ")
}

// Output a paragraph to the io.Writer, applying the proper
// formatting.
func (p Paragraph) Output(out io.Writer) {
	s := []byte(spacify(string(p.data)))
	if len(s) == 0 {
		out.Write(nl)
		return
	}
	indent := p.indent * INDENT
	width := p.cols - indent - len(p.prefix)
	wrapped := text.WrapBytes(s, width)
	lines := bytes.Split(wrapped, nl)
	gutter := makePad(indent)
	pad := makePad(len(p.prefix))

	for i, line := range lines {
		out.Write(gutter)
		if i == 0 {
			out.Write([]byte(p.prefix))
		} else {
			out.Write(pad)
		}
		out.Write(line)
		out.Write(nl)
	}
}

type Renderer struct {
	indent    int
	cols      int
	out       io.Writer
	paragraph *Paragraph
}

func NewRenderer(out io.Writer) *Renderer {
	width, _ := GlobUI.GetTerminalSize()
	if width == 0 {
		width = 80
	}
	return &Renderer{indent: 0, out: out, cols: width}
}

func (r *Renderer) RenderNodes(nodes []*html.Node) {
	for _, n := range nodes {
		r.RenderNode(n)
	}
}

func (r *Renderer) Buffer(d []byte) {
	if r.paragraph == nil {
		d = bytes.TrimSpace(d)
		if len(d) > 0 {
			G.Log.Warning("floating data in Markup is ignored: %v", d)
		}
	} else {
		r.paragraph.Buffer(d)
	}
}

func (r *Renderer) NewParagraph(prefix string) *Paragraph {
	r.FlushParagraph()
	r.paragraph = &Paragraph{indent: r.indent, cols: r.cols, prefix: prefix}
	return r.paragraph
}

func (r *Renderer) FlushParagraph() {
	if r.paragraph != nil {
		r.paragraph.Output(r.out)
		r.paragraph = nil
	}
}

func GetNodeAttrVal(node *html.Node, which string) *string {
	for _, attr := range node.Attr {
		if attr.Key == which {
			return &attr.Val
		}
	}
	return nil
}

func (r *Renderer) RenderNode(node *html.Node) {
	if node.Type == html.TextNode {
		r.Buffer([]byte(node.Data))
		return
	}

	var cp *CodePair

	switch node.DataAtom {
	case atom.Ul:
		r.indent++
	case atom.Li:
		var bullet string
		if bp := GetNodeAttrVal(node, "bullet"); bp != nil {
			bullet = *bp
		} else {
			bullet = "• "
		}
		r.NewParagraph(bullet)
	case atom.P:
		r.NewParagraph("")
	case atom.Strong:
		cp = &CpBold
	case atom.Em:
		cp = &CpItalic
	default:
		if node.Data == "url" {
			cp = &CpUnderline
		} else if node.Data == "color" {
			if c := GetNodeAttrVal(node, "name"); c != nil {
				cp = GetColorCode(*c)
			}
		}
	}

	if cp != nil {
		r.Buffer(cp.OpenBytes())
	}

	if node.FirstChild != nil {
		for c := node.FirstChild; c != nil; c = c.NextSibling {
			r.RenderNode(c)
		}
	}

	if node.DataAtom == atom.Ul {
		r.indent--
	}
	if node.DataAtom == atom.Li || node.DataAtom == atom.P {
		r.FlushParagraph()
	}
	if cp != nil {
		r.Buffer(cp.CloseBytes())
	}
}

func getWriter(w io.Writer) io.Writer {
	if w == nil {
		w = GlobUI.OutputWriter()
	}
	return w
}

func Render(w io.Writer, m *libkb.Markup) {
	if m == nil {
		return
	}
	w = getWriter(w)
	doc, err := Q.NewDocumentFromReader(m.ToReader())
	if err != nil {
		GlobUI.Printf("Cannot render markup: %s\n", err)
		return
	}
	renderer := NewRenderer(w)
	renderer.RenderNodes(doc.Nodes)
}

func RenderText(w io.Writer, txt keybase1.Text) {
	w = getWriter(w)
	if !txt.Markup {
		w.Write([]byte(txt.Data))
	} else {
		Render(w, libkb.NewMarkup(txt.Data))
	}
}

// BoolString maps a bool to true and false strings (like "yes"
// and "no").  For example:  BoolString(b, "yes", "no").
func BoolString(b bool, t, f string) string {
	if b {
		return t
	}
	return f
}
