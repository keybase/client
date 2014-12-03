package main

import (
	"bytes"
	"code.google.com/p/go.net/html"
	"code.google.com/p/go.net/html/atom"
	"fmt"
	Q "github.com/PuerkitoBio/goquery"
	"github.com/keybase/go-libkb"
	"github.com/kr/text"
	"io"
	"os"
	"regexp"
	"strings"
)

var INDENT int = 3

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

// spacify replaces arbitrary strings of whitespace with
// a single ' ' character. Also strips off leading and trailing
// whitespace.
func spacify(s string) string {
	v := regexp.MustCompile(`[[:space:]]+`).Split(s, -1)
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
	return &Renderer{indent: 0, out: out, cols: 80}
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

func (r *Renderer) RenderNode(node *html.Node) {
	if node.Type == html.TextNode {
		r.Buffer([]byte(node.Data))
		return
	}

	var cp *CodePair

	if node.DataAtom == atom.Ul {
		r.indent++
	} else if node.DataAtom == atom.Li {
		r.NewParagraph("* ")
	} else if node.DataAtom == atom.P {
		r.NewParagraph("")
	} else if node.DataAtom == atom.Strong {
		cp = &CpBold
	} else if node.DataAtom == atom.Em {
		cp = &CpItalic
	} else if node.Data == "url" {
		cp = &CpUnderline
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

func Render(w io.Writer, m *libkb.Markup) {
	if m == nil {
		return
	}
	doc, err := Q.NewDocumentFromReader(m.ToReader())
	if err != nil {
		fmt.Printf("Cannot render markup: %s\n", err.Error())
		return
	}
	renderer := NewRenderer(os.Stdout)
	renderer.RenderNodes(doc.Nodes)
}
