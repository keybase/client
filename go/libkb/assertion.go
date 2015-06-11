package libkb

import (
	"fmt"
	"regexp"
	"strings"

	keybase1 "github.com/keybase/client/protocol/go"
)

type AssertionExpression interface {
	String() string
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

func (a AssertionOr) String() string {
	v := make([]string, len(a.terms))
	for i, t := range a.terms {
		v[i] = t.String()
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

func (a AssertionAnd) String() string {
	v := make([]string, len(a.factors))
	for i, f := range a.factors {
		v[i] = f.String()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " && "))
}

type AssertionUrl interface {
	AssertionExpression
	Keys() []string
	Check() error
	IsKeybase() bool
	IsUid() bool
	ToUid() keybase1.UID
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

func (b AssertionUrlBase) matchSet(v AssertionUrl, ps ProofSet) bool {
	proofs := ps.Get(v.Keys())
	for _, proof := range proofs {
		if v.MatchProof(proof) {
			return true
		}
	}
	return false
}

func (b AssertionUrlBase) HasOr() bool { return false }

func (a AssertionUid) MatchSet(ps ProofSet) bool     { return a.matchSet(a, ps) }
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
func (a AssertionHttp) Keys() []string               { return []string{"http", "https"} }
func (b AssertionUrlBase) Keys() []string            { return []string{b.Key} }
func (b AssertionUrlBase) IsKeybase() bool           { return false }
func (b AssertionUrlBase) IsSocial() bool            { return false }
func (b AssertionUrlBase) IsFingerprint() bool       { return false }
func (b AssertionUrlBase) IsUid() bool               { return false }
func (b AssertionUrlBase) ToUid() (ret keybase1.UID) { return ret }
func (b AssertionUrlBase) MatchProof(proof Proof) bool {
	return (strings.ToLower(proof.Value) == b.Value)
}

// Fingerprint matching is on the suffixes.  If the assertion matches
// any suffix of the proof, then we're OK
func (a AssertionFingerprint) MatchProof(proof Proof) bool {
	v1, v2 := strings.ToLower(proof.Value), a.Value
	l1, l2 := len(v1), len(v2)
	if l2 > l1 {
		return false
	}
	// Match the suffixes of the fingerprint
	return (v1[(l1-l2):] == v2)
}

func (a AssertionUid) CollectUrls(v []AssertionUrl) []AssertionUrl         { return append(v, a) }
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
type AssertionUid struct {
	AssertionUrlBase
	uid keybase1.UID
}
type AssertionHttp struct{ AssertionUrlBase }
type AssertionHttps struct{ AssertionUrlBase }
type AssertionDns struct{ AssertionUrlBase }
type AssertionFingerprint struct{ AssertionUrlBase }

func (b AssertionUrlBase) Check() error {
	if len(b.Value) == 0 {
		return fmt.Errorf("Bad assertion, no value given (key=%s)", b.Key)
	}
	return nil
}

func (a AssertionHttp) Check() (err error)  { return a.CheckHost() }
func (a AssertionHttps) Check() (err error) { return a.CheckHost() }
func (a AssertionDns) Check() (err error)   { return a.CheckHost() }
func (a AssertionWeb) Check() (err error)   { return a.CheckHost() }

func (b AssertionUrlBase) CheckHost() (err error) {
	s := b.Value
	if err = b.Check(); err == nil {
		// Found this here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
		if !IsValidHostname(s) {
			err = fmt.Errorf("Invalid hostname: %s", s)
		}
	}
	return
}

func (b AssertionUrlBase) String() string {
	return fmt.Sprintf("%s://%s", b.Key, b.Value)
}

func (a AssertionWeb) ToLookup() (key, value string, err error) {
	return "web", a.Value, nil
}
func (a AssertionHttp) ToLookup() (key, value string, err error) {
	return "http", a.Value, nil
}
func (a AssertionHttps) ToLookup() (key, value string, err error) {
	return "https", a.Value, nil
}
func (a AssertionDns) ToLookup() (key, value string, err error) {
	return "dns", a.Value, nil
}
func (a AssertionFingerprint) ToLookup() (key, value string, err error) {
	cmp := len(a.Value) - PGP_FINGERPRINT_HEX_LEN
	value = a.Value
	if len(a.Value) < 4 {
		err = fmt.Errorf("fingerprint queries must be at least 2 bytes long")
	} else if cmp == 0 {
		key = "key_fingerprint"
	} else if cmp < 0 {
		key = "key_suffix"
	} else {
		err = fmt.Errorf("bad fingerprint; too long: %s", a.Value)
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

func (a AssertionKeybase) IsKeybase() bool         { return true }
func (a AssertionSocial) IsSocial() bool           { return true }
func (a AssertionFingerprint) IsFingerprint() bool { return true }
func (a AssertionUid) IsUid() bool                 { return true }

func (a AssertionUid) ToUid() keybase1.UID {
	if a.uid.IsNil() {
		if tmp, err := UIDFromHex(a.Value); err == nil {
			a.uid = tmp
		}
	}
	return a.uid
}

func (a AssertionKeybase) ToLookup() (key, value string, err error) {
	return "username", a.Value, nil
}

func (a AssertionUid) ToLookup() (key, value string, err error) {
	return "uid", a.Value, nil
}

func (a AssertionUid) Check() (err error) {
	a.uid, err = UIDFromHex(a.Value)
	return
}

func (a AssertionSocial) Check() (err error) {
	if ok, found := _socialNetworks[strings.ToLower(a.Key)]; !ok || !found {
		err = fmt.Errorf("Unknown social network: %s", a.Key)
	}
	return
}

func (a AssertionSocial) ToLookup() (key, value string, err error) {
	return a.Key, a.Value, nil
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
		}
		key = "keybase"
	}
	base := AssertionUrlBase{key, val}
	switch key {
	case "keybase":
		ret = AssertionKeybase{base}
	case "uid":
		ret = AssertionUid{AssertionUrlBase: base}
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
	proofs map[string][]Proof
}

func NewProofSet(proofs []Proof) *ProofSet {
	ret := &ProofSet{
		proofs: make(map[string][]Proof),
	}
	for _, proof := range proofs {
		ret.Add(proof)
	}
	return ret
}

func (ps *ProofSet) Add(p Proof) {
	ps.proofs[p.Key] = append(ps.proofs[p.Key], p)
}

func (ps ProofSet) Get(keys []string) (ret []Proof) {
	for _, key := range keys {
		if v, ok := ps.proofs[key]; ok {
			ret = append(ret, v...)
		}
	}
	return ret
}

var _socialNetworks map[string]bool

func RegisterSocialNetwork(s string) {
	if _socialNetworks == nil {
		_socialNetworks = make(map[string]bool)
	}
	_socialNetworks[s] = true
}
