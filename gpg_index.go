package libkb

import (
	"bufio"
	"fmt"
	"io"
	"strings"
)

//=============================================================================

func (g *GpgCLI) IndexToStream(query string, out io.WriteCloser) error {
	args := []string{"--with-colons", "--fingerprints", "-k"}
	if len(query) > 0 {
		args = append(args, query)
	}
	garg := RunGpgArg{
		Arguments: args,
		Stdin:     false,
		Stdout:    out,
	}
	res := g.Run(garg)
	return res.Err
}

//=============================================================================

type BucketDict struct {
	d map[string][]GpgKeyInfo
}

func NewBuckDict() *BucketDict {
	return &BucketDict{
		d: make(map[string][]GpgKeyInfo),
	}
}

func (bd *BucketDict) Add(k string, v GpgKeyInfo) {
	k = strings.ToLower(k)
	var bucket []GpgKeyInfo
	var found bool
	if bucket, found = bd.d[k]; !found {
		bucket = make([]GpgKeyInfo, 0, 1)
	}
	bucket = append(bucket, v)
	bd.d[k] = bucket
}

func (bd BucketDict) Get(k string) []GpgKeyInfo {
	k = strings.ToLower(k)
	ret, found := bd.d[k]
	if !found {
		ret = nil
	}
	return ret
}

func (bd BucketDict) Get0Or1(k string) (ret GpgKeyInfo, err error) {
	v := bd.Get(k)
	if len(v) > 1 {
		err = GpgError{fmt.Sprintf("Wanted a unique lookup but got %d objects for key %s", len(v), k)}
	} else if len(v) == 1 {
		ret = v[0]
	}
	return
}

//=============================================================================

func Uniquify(inp []string) []string {
	m := make(map[string]bool)
	for _, s := range inp {
		m[strings.ToLower(s)] = true
	}
	ret := make([]string, 0, len(inp))
	for k, _ := range m {
		ret = append(ret, k)
	}
	return ret
}

//=============================================================================

type GpgKeyInfo interface {
	GpgIndexElement
	Fingerprint() string
	Emails() []string
	AllId64s() []string
}

type GpgIndexElement interface {
	ToKey() GpgKeyInfo
	Error() error
	IsOk() bool
}

type KeyIndex struct {
	Keys                        []GpgKeyInfo
	Emails, Fingerprints, Id64s *BucketDict
}

func NewKeyIndex() *KeyIndex {
	return &KeyIndex{
		Keys:         make([]GpgKeyInfo, 0, 1),
		Emails:       NewBuckDict(),
		Fingerprints: NewBuckDict(),
		Id64s:        NewBuckDict(),
	}
}

func (ki *KeyIndex) IndexKey(k GpgKeyInfo) {
	ki.Keys = append(ki.Keys, k)
	ki.Fingerprints.Add(k.Fingerprint(), k)
	for _, e := range Uniquify(k.Emails()) {
		ki.Emails.Add(e, k)
	}
	for _, i := range Uniquify(k.AllId64s()) {
		ki.Id64s.Add(i, k)
	}
}

func (k *KeyIndex) PushElement(e GpgIndexElement) {
	if key := e.ToKey(); key != nil {
		k.IndexKey(key)
	}
}

func (ki *KeyIndex) AllFingerprints() []PgpFingerprint {
	ret := make([]PgpFingerprint, 0, 1)
	for _, k := range ki.Keys {
		if fp := PgpFingerprintFromHexNoError(k.Fingerprint()); fp != nil {
			ret = append(ret, *fp)
		}
	}
	return ret
}

//=============================================================================

type GpgIndexLine struct {
	v      []string
	lineno int
}

func ParseLine(s string, i int) (ret *GpgIndexLine, err error) {
	s = strings.TrimSpace(s)
	v := strings.Split(s, ":")
	if v == nil {
		err = GpgError{fmt.Sprintf("%d: Bad line; split failed", i)}
	} else {
		ret = &GpgIndexLine{v, i}
	}
	return
}

func (l GpgIndexLine) IsNewKey() bool {
	return len(l.v) > 0 && (l.v[0] == "sec" || l.v[0] == "pub")
}

//=============================================================================

type GpgIndexParser struct {
	warnings Warnings
	putback  *GpgIndexLine
	src      *bufio.Reader
	eof      bool
	lineno   int
}

func NewGpgIndexParser() *GpgIndexParser {
	return &GpgIndexParser{
		eof:     false,
		lineno:  0,
		putback: nil,
	}
}

func (p *GpgIndexParser) Warn(w Warning) {
	p.warnings = append(p.warnings, w)
}

func (p *GpgIndexParser) ParseElement() (ret GpgIndexElement, err error) {
	var line *GpgIndexLine
	line, err = p.GetLine()
	if err != nil {
	} else if line.IsNewKey() {
		ret, err = p.ParseKey(line)
	}
	return
}

func (p *GpgIndexParser) ParseKey(l *GpgIndexLine) (key GpgKeyInfo, err error) {
	return
}

func (p *GpgIndexParser) GetLine() (ret *GpgIndexLine, err error) {
	if p.putback != nil {
		ret = p.putback
		p.putback = nil
	} else if !p.isEof() {
	} else if s, e2 := p.src.ReadString(byte('\n')); e2 == nil {
		p.lineno++
		ret, err = ParseLine(s, p.lineno)
	} else if e2 == io.EOF {
		p.eof = true
	} else {
		err = e2
	}
	return
}

func (p *GpgIndexParser) PutbackLine(line *GpgIndexLine) {
	p.putback = line
}

func (p GpgIndexParser) isEof() bool { return p.eof }

func (p *GpgIndexParser) Parse(stream io.Reader) (ki *KeyIndex, err error) {
	p.src = bufio.NewReader(stream)
	index := NewKeyIndex()
	for err == nil && !p.isEof() {
		var el GpgIndexElement
		if el, err = p.ParseElement(); err == nil {
			index.PushElement(el)
		}
	}
	return
}

//=============================================================================
