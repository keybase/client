package libkb

import (
	"bufio"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/crypto/openpgp/packet"
)

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
	bd.d[k] = append(bd.d[k], v)
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
	ret := make([]string, 0, len(m))
	for k := range m {
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
	ID64        string
	Created     int64
	Expires     int64
	fingerprint *PgpFingerprint
}

func (k GpgBaseKey) AlgoString() string {
	switch packet.PublicKeyAlgorithm(k.Algo) {
	case packet.PubKeyAlgoDSA:
		return "D"
	case packet.PubKeyAlgoRSA:
		return "R"
	case packet.PubKeyAlgoECDSA:
		return "E"
	default:
		return "?"
	}
}

func (k GpgBaseKey) ExpirationString() string {
	if k.Expires == 0 {
		return "never"
	}
	layout := "2006-01-02"
	return time.Unix(int64(k.Expires), 0).Format(layout)
}

func (k *GpgBaseKey) ParseBase(line *GpgIndexLine) (err error) {
	if line.Len() < 12 {
		err = GpgIndexError{line.lineno, "Not enough fields (need 12)"}
		return
	}

	k.Type = line.At(0)
	k.Trust = line.At(1)
	k.ID64 = line.At(4)

	parseTimeStamp := func(s string) (ret int64, err error) {
		// No date was specified
		if len(s) == 0 {
			return
		}
		// GPG 2.0+ format
		if ret, err = strconv.ParseInt(s, 10, 0); err == nil {
			return
		}
		var tmp time.Time
		if tmp, err = time.Parse("2006-01-02", s); err != nil {
			return
		}
		ret = tmp.Unix()
		return
	}

	if k.Bits, err = strconv.Atoi(line.At(2)); err != nil {
	} else if k.Algo, err = strconv.Atoi(line.At(3)); err != nil {
	} else if k.Created, err = parseTimeStamp(line.At(5)); err != nil {
	} else if k.Expires, err = parseTimeStamp(line.At(6)); err != nil {
	}

	return
}

//=============================================================================

type GpgFingerprinter interface {
	SetFingerprint(pgp *PgpFingerprint)
}

type GpgPrimaryKey struct {
	GpgBaseKey
	subkeys    []*GpgSubKey
	identities []*Identity
	top        GpgFingerprinter
}

func (k *GpgPrimaryKey) IsValid() bool {
	if k.Trust == "r" {
		return false
	} else if k.Expires == 0 {
		return true
	} else {
		return time.Now().Before(time.Unix(int64(k.Expires), 0))
	}
}

func (k *GpgPrimaryKey) ToRow(i int) []string {
	v := []string{
		fmt.Sprintf("(%d)", i),
		fmt.Sprintf("%d%s", k.Bits, k.AlgoString()),
		k.fingerprint.ToKeyID(),
		k.ExpirationString(),
	}
	for _, i := range k.identities {
		v = append(v, i.Email)
	}
	return v
}

func (k *GpgBaseKey) SetFingerprint(pgp *PgpFingerprint) {
	k.fingerprint = pgp
}

func (k *GpgPrimaryKey) Parse(l *GpgIndexLine) (err error) {
	if err = k.ParseBase(l); err != nil {
	} else if err = k.AddUID(l); err != nil {
	}
	return
}

func NewGpgPrimaryKey() *GpgPrimaryKey {
	ret := &GpgPrimaryKey{}
	ret.top = ret
	return ret
}

func ParseGpgPrimaryKey(l *GpgIndexLine) (key *GpgPrimaryKey, err error) {
	key = NewGpgPrimaryKey()
	err = key.Parse(l)
	return
}

func (k *GpgPrimaryKey) AddUID(l *GpgIndexLine) (err error) {
	var id *Identity
	if f := l.At(9); len(f) == 0 {
	} else if id, err = ParseIdentity(f); err != nil {
	} else {
		k.identities = append(k.identities, id)
	}
	if err != nil {
		err = ErrorToGpgIndexError(l.lineno, err)
	}
	return
}

func (k *GpgPrimaryKey) AddFingerprint(l *GpgIndexLine) (err error) {
	var fp *PgpFingerprint
	if f := l.At(9); len(f) == 0 {
		err = fmt.Errorf("no fingerprint given")
	} else if fp, err = PgpFingerprintFromHex(f); err == nil {
		k.top.SetFingerprint(fp)
	}
	if err != nil {
		err = ErrorToGpgIndexError(l.lineno, err)
	}
	return
}

func (k *GpgPrimaryKey) GetFingerprint() *PgpFingerprint {
	return k.fingerprint
}

func (k *GpgPrimaryKey) GetPgpIdentities() []keybase1.PgpIdentity {
	ret := make([]keybase1.PgpIdentity, len(k.identities))
	for i, ident := range k.identities {
		ret[i] = ident.Export()
	}
	return ret
}

func (k *GpgPrimaryKey) GetEmails() []string {
	ret := make([]string, len(k.identities))
	for i, id := range k.identities {
		ret[i] = id.Email
	}
	return ret
}

func (k *GpgPrimaryKey) GetAllID64s() []string {
	var ret []string
	add := func(fp *PgpFingerprint) {
		if fp != nil {
			ret = append(ret, fp.ToKeyID())
		}
	}
	add(k.GetFingerprint())
	for _, sk := range k.subkeys {
		add(sk.fingerprint)
	}
	return ret
}

func (k *GpgPrimaryKey) AddSubkey(l *GpgIndexLine) (err error) {
	var sk *GpgSubKey
	if sk, err = ParseGpgSubKey(l); err == nil {
		k.subkeys = append(k.subkeys, sk)
		k.top = sk
	}
	return
}

func (k *GpgPrimaryKey) ToKey() *GpgPrimaryKey { return k }

func (k *GpgPrimaryKey) AddLine(l *GpgIndexLine) (err error) {
	if l.Len() < 2 {
		err = GpgIndexError{l.lineno, "too few fields"}
	} else {
		f := l.At(0)
		switch f {
		case "fpr":
			err = k.AddFingerprint(l)
		case "uid":
			err = k.AddUID(l)
		case "uat":
		case "sub", "ssb":
			err = k.AddSubkey(l)
		default:
			err = GpgIndexError{l.lineno, fmt.Sprintf("Unknown subfield: %s", f)}
		}

	}
	return err
}

//=============================================================================

type GpgSubKey struct {
	GpgBaseKey
}

func ParseGpgSubKey(l *GpgIndexLine) (sk *GpgSubKey, err error) {
	sk = &GpgSubKey{}
	err = sk.ParseBase(l)
	return
}

//=============================================================================

type GpgIndexElement interface {
	ToKey() *GpgPrimaryKey
}

type GpgKeyIndex struct {
	Keys                        []*GpgPrimaryKey
	Emails, Fingerprints, ID64s *BucketDict
}

func (ki *GpgKeyIndex) Len() int {
	return len(ki.Keys)
}
func (ki *GpgKeyIndex) Swap(i, j int) {
	ki.Keys[i], ki.Keys[j] = ki.Keys[j], ki.Keys[i]
}
func (ki *GpgKeyIndex) Less(i, j int) bool {
	a, b := ki.Keys[i], ki.Keys[j]
	if len(a.identities) > len(b.identities) {
		return true
	}
	if len(a.identities) < len(b.identities) {
		return false
	}
	if a.Expires == 0 {
		return true
	}
	if b.Expires == 0 {
		return false
	}
	if a.Expires > b.Expires {
		return true
	}
	return false
}

func (ki *GpgKeyIndex) GetRowFunc() func() []string {
	i := 0
	return func() []string {
		if i >= len(ki.Keys) {
			return nil
		}
		ret := ki.Keys[i].ToRow(i + 1)
		i++
		return ret
	}
}

func (ki *GpgKeyIndex) Sort() {
	sort.Sort(ki)
}

func NewGpgKeyIndex() *GpgKeyIndex {
	return &GpgKeyIndex{
		Emails:       NewBuckDict(),
		Fingerprints: NewBuckDict(),
		ID64s:        NewBuckDict(),
	}
}

func (ki *GpgKeyIndex) IndexKey(k *GpgPrimaryKey) {
	ki.Keys = append(ki.Keys, k)
	if fp := k.GetFingerprint(); fp != nil {
		ki.Fingerprints.Add(fp.String(), k)
	}
	for _, e := range Uniquify(k.GetEmails()) {
		ki.Emails.Add(e, k)
	}
	for _, i := range Uniquify(k.GetAllID64s()) {
		ki.ID64s.Add(i, k)
	}
}

func (ki *GpgKeyIndex) PushElement(e GpgIndexElement) {
	if key := e.ToKey(); key == nil {
	} else if key.IsValid() {
		ki.IndexKey(key)
	}
}

func (ki *GpgKeyIndex) AllFingerprints() []PgpFingerprint {
	var ret []PgpFingerprint
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

func (g GpgIndexLine) IsNewKey() bool {
	return len(g.v) > 0 && (g.v[0] == "sec" || g.v[0] == "pub")
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
	p.warnings.Push(w)
}

func (p *GpgIndexParser) ParseElement() (ret GpgIndexElement, err error) {
	var line *GpgIndexLine
	line, err = p.GetLine()
	if err != nil || line == nil {
	} else if line.IsNewKey() {
		ret, err = p.ParseKey(line)
	}
	return
}

func (p *GpgIndexParser) ParseKey(l *GpgIndexLine) (ret *GpgPrimaryKey, err error) {
	var line *GpgIndexLine
	ret, err = ParseGpgPrimaryKey(l)
	done := false
	for !done && err == nil && !p.isEOF() {
		if line, err = p.GetLine(); line == nil || err != nil {
		} else if line.IsNewKey() {
			p.PutbackLine(line)
			done = true
		} else if e2 := ret.AddLine(line); e2 == nil {
		} else {
			p.warnings.Push(ErrorToWarning(e2))
		}
	}
	return
}

func (p *GpgIndexParser) GetLine() (ret *GpgIndexLine, err error) {
	if p.putback != nil {
		ret = p.putback
		p.putback = nil
		return
	}

	if p.isEOF() {
		return
	}

	s, e2 := p.src.ReadString(byte('\n'))
	if e2 == io.EOF {
		p.eof = true
		return
	}
	if e2 != nil {
		return nil, e2
	}

	p.lineno++
	return ParseLine(s, p.lineno)
}

func (p *GpgIndexParser) PutbackLine(line *GpgIndexLine) {
	p.putback = line
}

func (p GpgIndexParser) isEOF() bool { return p.eof }

func (p *GpgIndexParser) Parse(stream io.Reader) (ki *GpgKeyIndex, err error) {
	p.src = bufio.NewReader(stream)
	ki = NewGpgKeyIndex()
	for err == nil && !p.isEOF() {
		var el GpgIndexElement
		if el, err = p.ParseElement(); err == nil && el != nil {
			ki.PushElement(el)
		}
	}
	ki.Sort()
	return
}

//=============================================================================

func ParseGpgIndexStream(stream io.Reader) (ki *GpgKeyIndex, w Warnings, err error) {
	eng := NewGpgIndexParser()
	ki, err = eng.Parse(stream)
	w = eng.warnings
	return
}

//=============================================================================

func (g *GpgCLI) Index(secret bool, query string) (ki *GpgKeyIndex, w Warnings, err error) {
	var k string
	if secret {
		k = "-K"
	} else {
		k = "-k"
	}
	args := []string{"--with-colons", "--fingerprint", k}
	if len(query) > 0 {
		args = append(args, query)
	}
	garg := RunGpg2Arg{
		Arguments: args,
		Stdout:    true,
	}
	if res := g.Run2(garg); res.Err != nil {
		err = res.Err
	} else if ki, w, err = ParseGpgIndexStream(res.Stdout); err != nil {
	} else {
		err = res.Wait()
	}
	return
}

//=============================================================================
