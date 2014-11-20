package libkb

import (
	"bufio"
	"fmt"
	"io"
	"strconv"
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
	d map[string][]*GpgPrimaryKey
}

func NewBuckDict() *BucketDict {
	return &BucketDict{
		d: make(map[string][]*GpgPrimaryKey),
	}
}

func (bd *BucketDict) Add(k string, v *GpgPrimaryKey) {
	k = strings.ToLower(k)
	var bucket []*GpgPrimaryKey
	var found bool
	if bucket, found = bd.d[k]; !found {
		bucket = make([]*GpgPrimaryKey, 0, 1)
	}
	bucket = append(bucket, v)
	bd.d[k] = bucket
}

func (bd BucketDict) Get(k string) []*GpgPrimaryKey {
	k = strings.ToLower(k)
	ret, found := bd.d[k]
	if !found {
		ret = nil
	}
	return ret
}

func (bd BucketDict) Get0Or1(k string) (ret *GpgPrimaryKey, err error) {
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

type GpgBaseKey struct {
	Type        string
	Trust       string
	Bits        int
	Algo        int
	Id64        string
	Created     int
	Expires     int
	fingerprint *PgpFingerprint
}

func (k *GpgBaseKey) ParseBase(line *GpgIndexLine) (err error) {
	if line.Len() < 12 {
		err = GpgIndexError{line.lineno, "Not enough fields (need 12)"}
		return
	}

	k.Type = line.At(0)
	k.Trust = line.At(1)
	k.Id64 = line.At(4)

	if k.Bits, err = strconv.Atoi(line.At(2)); err != nil {
	} else if k.Algo, err = strconv.Atoi(line.At(3)); err != nil {
	} else if k.Created, err = strconv.Atoi(line.At(5)); err != nil {
	} else if k.Expires, err = strconv.Atoi(line.At(6)); err != nil {
	}

	return
}

//=============================================================================

type GpgPrimaryKey struct {
	GpgBaseKey
	subkeys    []GpgSubKey
	identities []*Identity
}

func (k *GpgPrimaryKey) Parse(l *GpgIndexLine) (err error) {
	if err = k.ParseBase(l); err != nil {
	} else if err = k.AddUid(l); err != nil {
	}
	return
}

func ParseGpgPrimaryKey(l *GpgIndexLine) (key *GpgPrimaryKey, err error) {
	key = &GpgPrimaryKey{}
	err = key.Parse(l)
	return
}

func (k *GpgPrimaryKey) AddUid(l *GpgIndexLine) (err error) {
	var id *Identity
	if f := l.At(9); len(f) == 0 {
	} else if id, err = ParseIdentity(f); err != nil {
	} else {
		k.identities = append(k.identities, id)
	}
	return
}

func (k *GpgPrimaryKey) GetFingerprint() *PgpFingerprint {
	return k.fingerprint
}

func (k *GpgPrimaryKey) GetEmails() []string {
	ret := make([]string, 0, len(k.identities))
	for _, i := range k.identities {
		ret = append(ret, i.Email)
	}
	return ret
}

func (k *GpgPrimaryKey) GetAllId64s() []string {
	var ret []string
	add := func(fp *PgpFingerprint) {
		if fp != nil {
			ret = append(ret, fp.ToKeyId())
		}
	}
	add(k.GetFingerprint())
	for _, sk := range k.subkeys {
		add(sk.fingerprint)
	}
	return ret
}

func (g *GpgPrimaryKey) ToKey() *GpgPrimaryKey { return g }
func (g *GpgPrimaryKey) Error() error          { return nil }
func (g *GpgPrimaryKey) IsOk() bool            { return false }

type GpgSubKey struct {
	GpgBaseKey
}

//=============================================================================

type GpgIndexElement interface {
	ToKey() *GpgPrimaryKey
	Error() error
	IsOk() bool
}

type KeyIndex struct {
	Keys                        []*GpgPrimaryKey
	Emails, Fingerprints, Id64s *BucketDict
}

func NewKeyIndex() *KeyIndex {
	return &KeyIndex{
		Keys:         make([]*GpgPrimaryKey, 0, 1),
		Emails:       NewBuckDict(),
		Fingerprints: NewBuckDict(),
		Id64s:        NewBuckDict(),
	}
}

func (ki *KeyIndex) IndexKey(k *GpgPrimaryKey) {
	ki.Keys = append(ki.Keys, k)
	if fp := k.GetFingerprint(); fp != nil {
		ki.Fingerprints.Add(fp.ToString(), k)
	}
	for _, e := range Uniquify(k.GetEmails()) {
		ki.Emails.Add(e, k)
	}
	for _, i := range Uniquify(k.GetAllId64s()) {
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
		if fp := k.GetFingerprint(); fp != nil {
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

func (g GpgIndexLine) Len() int        { return len(g.v) }
func (g GpgIndexLine) At(i int) string { return g.v[i] }

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

func (p *GpgIndexParser) ParseKey(l *GpgIndexLine) (ret *GpgPrimaryKey, err error) {
	ret, err = ParseGpgPrimaryKey(l)
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
