
package libkb

import (
	"fmt"
	"strings"
	"regexp"
)

type AssertionExpression interface {
	ToString() string
	MatchSet(ps ProofSet) bool
}

type AssertionOr struct {
	terms []AssertionExpression
}

func (a AssertionOr) MatchSet(ps ProofSet) bool {
	for _, t := range(a.terms) {
		if t.MatchSet(ps) {
			return true
		}
	}
	return false
}

func (a AssertionOr) ToString() string {
	v := make([]string, len(a.terms))
	for i,t := range a.terms {
		v[i] = t.ToString()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " || " ))
}

type AssertionAnd struct {
	factors []AssertionExpression
}

func (a AssertionAnd) MatchSet(ps ProofSet) bool {
	for _, f := range(a.factors) {
		if !f.MatchSet(ps) {
			return false
		}
	}
	return true
}

func (a AssertionAnd) ToString() string {
	v := make([]string, len(a.factors))
	for i,f := range a.factors {
		v[i] = f.ToString()
	}
	return fmt.Sprintf("(%s)", strings.Join(v, " && " ))
}

type AssertionUrl interface {
	Keys() []string
	Check() error
	IsKeybase() bool
	ToString() string
	MatchSet(ps ProofSet) bool
	MatchProof(p Proof) bool
}

type AssertionUrlBase struct {
	Key,Value string
}

func (a AssertionUrlBase) matchSet(v AssertionUrl, ps ProofSet) bool {
	proofs := ps.Get(v.Keys())
	for _, proof := range(proofs) {
		if v.MatchProof(proof) {
			return true
		}
	}
	return false
}

func (a AssertionKeybase) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }
func (a AssertionWeb) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }
func (a AssertionSocial) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }
func (a AssertionHttp) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }
func (a AssertionHttps) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }
func (a AssertionDns) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }
func (a AssertionFingerprint) MatchSet(ps ProofSet) bool {return a.matchSet(a, ps) }

func (a AssertionWeb) Keys() []string {return []string { "dns", "http", "https", } }
func (a AssertionHttp) Keys() []string {return []string { "http", "https", } }
func (a AssertionUrlBase) Keys() []string {return []string { a.Key } }
func (a AssertionUrlBase) IsKeybase() bool {return false; }
func (a AssertionUrlBase) MatchProof(proof Proof) bool {
	return (strings.ToLower(proof.Value) == a.Value )
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

type AssertionSocial struct {AssertionUrlBase }
type AssertionWeb struct {AssertionUrlBase }
type AssertionKeybase struct {AssertionUrlBase }
type AssertionHttp struct {AssertionUrlBase }
type AssertionHttps struct {AssertionUrlBase }
type AssertionDns struct {AssertionUrlBase }
type AssertionFingerprint struct {AssertionUrlBase }

func (a AssertionUrlBase) Check() (err error) {
	if len(a.Value) == 0 {
		err = fmt.Errorf("Bad assertion, no value given (key=%s)", a.Key)
	}
	return err
}

func (a AssertionHttp) Check() (err error) { return a.CheckHost() }
func (a AssertionHttps) Check() (err error) { return a.CheckHost() }
func (a AssertionDns) Check() (err error) { return a.CheckHost() }
func (a AssertionWeb) Check() (err error) { return a.CheckHost() }

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

func parseToKVPair(s string) (key string, value string) {
	colon := strings.IndexByte(s,byte(':'))
	if colon < 0 {
		value = s
	} else {
		key = s[0:colon]
		value = s[(colon+1):]
		if len(value) >= 2 && value[0:2] == "//" {
			value = value[2:]
		}
	}
	key = strings.ToLower(key)
	value = strings.ToLower(value)
	return
}

func (k AssertionKeybase) IsKeybase() bool {
	return true
}

func (s AssertionSocial) Check() (err error) {
	networks := map[string]bool {
		"github" : true,
		"coinbase" : true,
		"reddit" : true,
		"twitter" : true,
		"hackernews" : true,
	}
	b, ok := networks[s.Key]
	if !b || !ok {
		err = fmt.Errorf("Unknown social network: %s", s.Key)
	}
	return
}

func ParseAssertionUrl(s string, strict bool) (ret AssertionUrl, err error) {
	key,val := parseToKVPair(s)

	if len(key) == 0 {
		if strict {
			err = fmt.Errorf("Bad assertion, no 'type' given: %s", s)
		} else {
			key = "keybase"
		}
	}
	base := AssertionUrlBase { key, val}
	switch key {
		case "keybase": 
			ret = AssertionKeybase { base }
		case "web" :
			ret = AssertionWeb { base } 
		case "http":
			ret = AssertionHttp { base }
		case "https":
			ret = AssertionHttps { base }
		case "dns":
			ret = AssertionDns { base }
		case "fingerprint":
			ret = AssertionFingerprint { base }
		default : 
			ret = AssertionSocial { base }
	}

	if err == nil && ret != nil {
		if err = ret.Check(); err != nil {
			ret = nil
		}
	}

	return
}

type Proof struct {
	Key,Value string	
}

type ProofSet struct {
	proofs map[string]([]Proof)	
}

func NewProofSet(proofs []Proof) *ProofSet {
	ret := &ProofSet {}
	d := make(map[string]([]Proof))
	for _, proof := range(proofs) {
		v, ok := d[proof.Key]
		if !ok {
			v = []Proof { proof }
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
	for _, key := range(keys) {
		if v, ok := ps.proofs[key]; ok {
			ret = append(ret, v...)	
		}	
	}
	return ret
}
