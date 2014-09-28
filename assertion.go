
package libkbgo

import (
	"fmt"
	"strings"
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
}

type AssertionUrlBase struct {
	Key,Value string
}

func (a AssertionUrlBase) matchSet(v AssertionUrl, ps ProofSet) bool {
	proofs := ps.Get(v.Keys())
	for _, proof := range(proofs) {
		if strings.ToLower(proof.Value) == a.Value {
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

func (a AssertionWeb) Keys() []string {return []string { "dns", "http", "https", } }
func (a AssertionHttp) Keys() []string {return []string { "http", "https", } }
func (a AssertionUrlBase) Keys() []string {return []string { a.Key } }
func (a AssertionUrlBase) IsKeybase() bool {return false; }

type AssertionSocial struct {AssertionUrlBase }
type AssertionWeb struct {AssertionUrlBase }
type AssertionKeybase struct {AssertionUrlBase }
type AssertionHttp struct {AssertionUrlBase }
type AssertionHttps struct {AssertionUrlBase }
type AssertionDns struct {AssertionUrlBase }


func (a AssertionUrlBase) Check() (err error) {
	if len(a.Value) == 0 {
		err = fmt.Errorf("Bad assertion, no value given")
	}
	return err
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
		value := s[(colon+1):]
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
	b, ok := networks[s.Value]
	if !b || !ok {
		err = fmt.Errorf("Unknown social network: %s", s.Value)
	}
	return
}

func ParseAssertionUrl(s string, strict bool) (ret AssertionUrl, err error) {
	key,value := parseToKVPair(s)

	if len(key) == 0 {
		if strict {
			err = fmt.Errorf("Bad assertion, no 'type' given: %s", s)
		} else {
			key = "keybase"
		}
	}

	base := AssertionUrlBase { key, value }
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