package libkb

import (
	"fmt"
	"regexp"
	"strings"
)

type AssertionExpression interface {
	ToString() string
	MatchSet(ps ProofSet) bool
	HasOr() bool
	CollectUrls([]AssertionUrl) []AssertionUrl
}

type AssertionOr struct {
	terms []AssertionExpression
}

func (a AssertionOr) HasOr() bool { return true }

func (a AssertionOr) MatchSet(ps ProofSet) bool {
	for _, t := range a.terms {
		if t.MatchSet(ps) {
			return true
		}
	}
	return false
}

func (a AssertionOr) CollectUrls(v []AssertionUrl) []AssertionUrl {
	for _, t := range a.terms {
		v = t.CollectUrls(v)
	}
	return v
}

func (a AssertionOr) ToString() string {
	v := make([]string, len(a.terms))
	for i, t := range a.terms {
		v[i] = t.ToString()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " || "))
}

type AssertionAnd struct {
	factors []AssertionExpression
}

func (a AssertionAnd) HasOr() bool {
	for _, f := range a.factors {
		if f.HasOr() {
			return true
		}
	}
	return false
}

func (a AssertionAnd) CollectUrls(v []AssertionUrl) []AssertionUrl {
	for _, t := range a.factors {
		v = t.CollectUrls(v)
	}
	return v
}

func (a AssertionAnd) MatchSet(ps ProofSet) bool {
	for _, f := range a.factors {
		if !f.MatchSet(ps) {
			return false
		}
	}
	return true
}

func (a AssertionAnd) ToString() string {
	v := make([]string, len(a.factors))
	for i, f := range a.factors {
		v[i] = f.ToString()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " && "))
}

type AssertionUrl interface {
	AssertionExpression
	Keys() []string
	Check() error
	IsKeybase() bool
	IsSocial() bool
	IsFingerprint() bool
	MatchProof(p Proof) bool
	ToKeyValuePair() (string, string)
	CacheKey() string
	GetValue() string
	ToLookup() (string, string, error)
}

type AssertionUrlBase struct {
	Key, Value string
}

func (b AssertionUrlBase) ToKeyValuePair() (string, string) {
	return b.Key, b.Value
}

func (b AssertionUrlBase) CacheKey() string {
	return b.Key + ":" + b.Value
}

func (b AssertionUrlBase) GetValue() string {
	return b.Value
}

func (a AssertionUrlBase) matchSet(v AssertionUrl, ps ProofSet) bool {
	proofs := ps.Get(v.Keys())
	for _, proof := range proofs {
		if v.MatchProof(proof) {
			return true
		}
	}
	return false
}

func (a AssertionUrlBase) HasOr() bool { return false }

func (a AssertionKeybase) MatchSet(ps ProofSet) bool { return a.matchSet(a, ps) }
func (a AssertionWeb) MatchSet(ps ProofSet) bool     { return a.matchSet(a, ps) }
func (a AssertionSocial) MatchSet(ps ProofSet) bool  { return a.matchSet(a, ps) }
func (a AssertionHttp) MatchSet(ps ProofSet) bool    { return a.matchSet(a, ps) }
func (a AssertionHttps) MatchSet(ps ProofSet) bool   { return a.matchSet(a, ps) }
func (a AssertionDns) MatchSet(ps ProofSet) bool     { return a.matchSet(a, ps) }
func (a AssertionFingerprint) MatchSet(ps ProofSet) bool {
	return a.matchSet(a, ps)
}
func (a AssertionWeb) Keys() []string {
	return []string{"dns", "http", "https"}
}
func (a AssertionHttp) Keys() []string         { return []string{"http", "https"} }
func (a AssertionUrlBase) Keys() []string      { return []string{a.Key} }
func (a AssertionUrlBase) IsKeybase() bool     { return false }
func (a AssertionUrlBase) IsSocial() bool      { return false }
func (a AssertionUrlBase) IsFingerprint() bool { return false }
func (a AssertionUrlBase) MatchProof(proof Proof) bool {
	return (strings.ToLower(proof.Value) == a.Value)
}

// Fingerprint matching is on the suffixes.  If the assertion matches
// any suffix of the proof, then we're OK
func (a AssertionFingerprint) MatchProof(proof Proof) bool {
	v1, v2 := strings.ToLower(proof.Value), a.Value
	l1, l2 := len(v1), len(v2)
	if l2 > l1 {
		return false
	} else {
		// Match the suffixes of the fingerprint
		return (v1[(l1-l2):] == v2)
	}
}

func (a AssertionKeybase) CollectUrls(v []AssertionUrl) []AssertionUrl     { return append(v, a) }
func (a AssertionWeb) CollectUrls(v []AssertionUrl) []AssertionUrl         { return append(v, a) }
func (a AssertionSocial) CollectUrls(v []AssertionUrl) []AssertionUrl      { return append(v, a) }
func (a AssertionHttp) CollectUrls(v []AssertionUrl) []AssertionUrl        { return append(v, a) }
func (a AssertionHttps) CollectUrls(v []AssertionUrl) []AssertionUrl       { return append(v, a) }
func (a AssertionDns) CollectUrls(v []AssertionUrl) []AssertionUrl         { return append(v, a) }
func (a AssertionFingerprint) CollectUrls(v []AssertionUrl) []AssertionUrl { return append(v, a) }

type AssertionSocial struct{ AssertionUrlBase }
type AssertionWeb struct{ AssertionUrlBase }
type AssertionKeybase struct{ AssertionUrlBase }
type AssertionHttp struct{ AssertionUrlBase }
type AssertionHttps struct{ AssertionUrlBase }
type AssertionDns struct{ AssertionUrlBase }
type AssertionFingerprint struct{ AssertionUrlBase }

func (a AssertionUrlBase) Check() (err error) {
	if len(a.Value) == 0 {
		err = fmt.Errorf("Bad assertion, no value given (key=%s)", a.Key)
	}
	return err
}

func (a AssertionHttp) Check() (err error)  { return a.CheckHost() }
func (a AssertionHttps) Check() (err error) { return a.CheckHost() }
func (a AssertionDns) Check() (err error)   { return a.CheckHost() }
func (a AssertionWeb) Check() (err error)   { return a.CheckHost() }

func (a AssertionUrlBase) CheckHost() (err error) {
	s := a.Value
	if err = a.Check(); err == nil {
		// Found this here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
		re := regexp.MustCompile(`^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$`)
		if !re.MatchString(s) {
			err = fmt.Errorf("Invalid hostname: %s", s)
		}
	}
	return
}

func (a AssertionUrlBase) ToString() string {
	return fmt.Sprintf("%s://%s", a.Key, a.Value)
}

func (k AssertionWeb) ToLookup() (key, value string, err error) {
	return "web", k.Value, nil
}
func (k AssertionHttp) ToLookup() (key, value string, err error) {
	return "http", k.Value, nil
}
func (k AssertionHttps) ToLookup() (key, value string, err error) {
	return "https", k.Value, nil
}
func (k AssertionDns) ToLookup() (key, value string, err error) {
	return "dns", k.Value, nil
}
func (k AssertionFingerprint) ToLookup() (key, value string, err error) {
	cmp := len(k.Value) - PGP_FINGERPRINT_HEX_LEN
	value = k.Value
	if len(k.Value) < 4 {
		err = fmt.Errorf("fingerprint queries must be at least 2 bytes long")
	} else if cmp == 0 {
		key = "key_fingerprint"
	} else if cmp < 0 {
		key = "key_suffix"
	} else {
		err = fmt.Errorf("bad fingerprint; too long: %s", k.Value)
	}
	return
}

func parseToKVPair(s string) (key string, value string, err error) {

	re := regexp.MustCompile(`^[0-9a-zA-Z@:/_-]`)
	if !re.MatchString(s) {
		err = fmt.Errorf("Invalid key-value identity: %s", s)
		return
	}

	colon := strings.IndexByte(s, byte(':'))
	atsign := strings.IndexByte(s, byte('@'))
	if colon >= 0 {
		key = s[0:colon]
		value = s[(colon + 1):]
		if len(value) >= 2 && value[0:2] == "//" {
			value = value[2:]
		}
	} else if atsign >= 0 {
		value = s[0:atsign]
		key = s[(atsign + 1):]
	} else {
		value = s
	}
	key = strings.ToLower(key)
	value = strings.ToLower(value)
	return
}

func (k AssertionKeybase) IsKeybase() bool         { return true }
func (k AssertionSocial) IsSocial() bool           { return true }
func (k AssertionFingerprint) IsFingerprint() bool { return true }

func (k AssertionKeybase) ToLookup() (key, value string, err error) {
	return "username", k.Value, nil
}

func (s AssertionSocial) Check() (err error) {
	networks := map[string]bool{
		"github":     true,
		"coinbase":   true,
		"reddit":     true,
		"twitter":    true,
		"hackernews": true,
	}
	b, ok := networks[s.Key]
	if !b || !ok {
		err = fmt.Errorf("Unknown social network: %s", s.Key)
	}
	return
}

func (k AssertionSocial) ToLookup() (key, value string, err error) {
	return k.Key, k.Value, nil
}

func ParseAssertionUrl(s string, strict bool) (ret AssertionUrl, err error) {
	key, val, err := parseToKVPair(s)

	if err != nil {
		return
	}
	return ParseAssertionUrlKeyValue(key, val, strict)
}

func ParseAssertionUrlKeyValue(key, val string,
	strict bool) (ret AssertionUrl, err error) {

	if len(key) == 0 {
		if strict {
			err = fmt.Errorf("Bad assertion, no 'type' given: %s", val)
			return
		} else {
			key = "keybase"
		}
	}
	base := AssertionUrlBase{key, val}
	switch key {
	case "keybase":
		ret = AssertionKeybase{base}
	case "web":
		ret = AssertionWeb{base}
	case "http":
		ret = AssertionHttp{base}
	case "https":
		ret = AssertionHttps{base}
	case "dns":
		ret = AssertionDns{base}
	case "fingerprint":
		ret = AssertionFingerprint{base}
	default:
		ret = AssertionSocial{base}
	}

	if err == nil && ret != nil {
		if err = ret.Check(); err != nil {
			ret = nil
		}
	}

	return
}

type Proof struct {
	Key, Value string
}

type ProofSet struct {
	proofs map[string]([]Proof)
}

func NewProofSet(proofs []Proof) *ProofSet {
	ret := &ProofSet{}
	d := make(map[string]([]Proof))
	for _, proof := range proofs {
		v, ok := d[proof.Key]
		if !ok {
			v = []Proof{proof}
		} else {
			v = append(v, proof)
		}
		d[proof.Key] = v
	}
	ret.proofs = d
	return ret
}

func (ps ProofSet) Get(keys []string) (ret []Proof) {
	ret = []Proof{}
	for _, key := range keys {
		if v, ok := ps.proofs[key]; ok {
			ret = append(ret, v...)
		}
	}
	return ret
}
