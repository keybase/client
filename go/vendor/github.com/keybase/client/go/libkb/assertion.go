// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type AssertionExpression interface {
	String() string
	MatchSet(ps ProofSet) bool
	HasOr() bool
	NeedsParens() bool
	CollectUrls([]AssertionURL) []AssertionURL
	ToSocialAssertion() (keybase1.SocialAssertion, error)
}

type AssertionOr struct {
	symbol string // the divider symbol used e.g. "," or "||"
	terms  []AssertionExpression
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

func (a AssertionOr) NeedsParens() bool {
	for _, t := range a.terms {
		if t.NeedsParens() {
			return true
		}
	}
	return false
}

func (a AssertionOr) CollectUrls(v []AssertionURL) []AssertionURL {
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
	return strings.Join(v, ",")
}

func (a AssertionOr) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return sa, fmt.Errorf("cannot convert OR expression to single social assertion")
}

type AssertionAnd struct {
	factors []AssertionExpression
}

func (a AssertionAnd) Len() int {
	return len(a.factors)
}

func (a AssertionAnd) HasOr() bool {
	for _, f := range a.factors {
		if f.HasOr() {
			return true
		}
	}
	return false
}

func (a AssertionAnd) NeedsParens() bool {
	for _, f := range a.factors {
		if f.HasOr() {
			return true
		}
	}
	return false
}

func (a AssertionAnd) CollectUrls(v []AssertionURL) []AssertionURL {
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

func (a AssertionAnd) HasFactor(pf Proof) bool {
	ps := NewProofSet([]Proof{pf})
	for _, f := range a.factors {
		if f.MatchSet(*ps) {
			return true
		}
	}
	return false
}

func (a AssertionAnd) String() string {
	v := make([]string, len(a.factors))
	for i, f := range a.factors {
		v[i] = f.String()
		if _, ok := f.(AssertionOr); ok {
			v[i] = "(" + v[i] + ")"
		}
	}
	return strings.Join(v, "+")
}

func (a AssertionAnd) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return sa, fmt.Errorf("cannot convert AND expression to single social assertion")
}

type AssertionURL interface {
	AssertionExpression
	Keys() []string
	CheckAndNormalize(ctx AssertionContext) (AssertionURL, error)
	IsKeybase() bool
	IsUID() bool
	IsTeamID() bool
	IsTeamName() bool
	IsSocial() bool
	IsRemote() bool
	IsFingerprint() bool
	MatchProof(p Proof) bool
	ToUID() keybase1.UID
	ToTeamID() keybase1.TeamID
	ToTeamName() keybase1.TeamName
	ToKeyValuePair() (string, string)
	CacheKey() string
	GetValue() string
	GetKey() string
	ToLookup() (string, string, error)
	IsServerTrust() bool
}

type AssertionURLBase struct {
	Key, Value string
}

func (b AssertionURLBase) ToKeyValuePair() (string, string) {
	return b.Key, b.Value
}
func (b AssertionURLBase) GetKey() string { return b.Key }

func (b AssertionURLBase) CacheKey() string {
	return b.Key + ":" + b.Value
}

func (b AssertionURLBase) GetValue() string {
	return b.Value
}

func (b AssertionURLBase) matchSet(v AssertionURL, ps ProofSet) bool {
	proofs := ps.Get(v.Keys())
	for _, proof := range proofs {
		if v.MatchProof(proof) {
			return true
		}
	}
	return false
}

func (b AssertionURLBase) NeedsParens() bool { return false }
func (b AssertionURLBase) HasOr() bool       { return false }

func (a AssertionUID) MatchSet(ps ProofSet) bool         { return a.matchSet(a, ps) }
func (a AssertionTeamID) MatchSet(ps ProofSet) bool      { return a.matchSet(a, ps) }
func (a AssertionTeamName) MatchSet(ps ProofSet) bool    { return a.matchSet(a, ps) }
func (a AssertionKeybase) MatchSet(ps ProofSet) bool     { return a.matchSet(a, ps) }
func (a AssertionWeb) MatchSet(ps ProofSet) bool         { return a.matchSet(a, ps) }
func (a AssertionSocial) MatchSet(ps ProofSet) bool      { return a.matchSet(a, ps) }
func (a AssertionHTTP) MatchSet(ps ProofSet) bool        { return a.matchSet(a, ps) }
func (a AssertionHTTPS) MatchSet(ps ProofSet) bool       { return a.matchSet(a, ps) }
func (a AssertionDNS) MatchSet(ps ProofSet) bool         { return a.matchSet(a, ps) }
func (a AssertionFingerprint) MatchSet(ps ProofSet) bool { return a.matchSet(a, ps) }
func (a AssertionPhoneNumber) MatchSet(ps ProofSet) bool { return a.matchSet(a, ps) }
func (a AssertionEmail) MatchSet(ps ProofSet) bool       { return a.matchSet(a, ps) }
func (a AssertionWeb) Keys() []string {
	return []string{"dns", "http", "https"}
}
func (a AssertionHTTP) Keys() []string                         { return []string{"http", "https"} }
func (b AssertionURLBase) Keys() []string                      { return []string{b.Key} }
func (b AssertionURLBase) IsKeybase() bool                     { return false }
func (b AssertionURLBase) IsSocial() bool                      { return false }
func (b AssertionURLBase) IsRemote() bool                      { return false }
func (b AssertionURLBase) IsFingerprint() bool                 { return false }
func (b AssertionURLBase) IsUID() bool                         { return false }
func (b AssertionURLBase) ToUID() (ret keybase1.UID)           { return ret }
func (b AssertionURLBase) IsTeamID() bool                      { return false }
func (b AssertionURLBase) IsTeamName() bool                    { return false }
func (b AssertionURLBase) ToTeamID() (ret keybase1.TeamID)     { return ret }
func (b AssertionURLBase) ToTeamName() (ret keybase1.TeamName) { return ret }
func (b AssertionURLBase) MatchProof(proof Proof) bool {
	return (strings.ToLower(proof.Value) == b.Value)
}
func (b AssertionURLBase) IsServerTrust() bool { return false }

func (b AssertionURLBase) ToSocialAssertionHelper() (sa keybase1.SocialAssertion, err error) {
	return keybase1.SocialAssertion{
		User:    b.GetValue(),
		Service: keybase1.SocialAssertionService(b.GetKey()),
	}, nil
}
func (a AssertionUID) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return sa, fmt.Errorf("cannot convert AssertionUID to social assertion")
}
func (a AssertionTeamID) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return sa, fmt.Errorf("cannot convert AssertionTeamID to social assertion")
}
func (a AssertionTeamName) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return sa, fmt.Errorf("cannot convert AssertionTeamName to social assertion")
}
func (a AssertionKeybase) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return sa, fmt.Errorf("cannot convert AssertionKeybase to social assertion")
}
func (a AssertionWeb) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return a.ToSocialAssertionHelper()
}
func (a AssertionSocial) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return a.ToSocialAssertionHelper()
}
func (a AssertionHTTP) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return a.ToSocialAssertionHelper()
}
func (a AssertionHTTPS) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return a.ToSocialAssertionHelper()
}
func (a AssertionDNS) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return a.ToSocialAssertionHelper()
}
func (a AssertionFingerprint) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	return a.ToSocialAssertionHelper()
}
func (a AssertionPhoneNumber) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	// Phone number is not "social" like facebook or twitter, and there are no
	// public prooofs, but it still conforms to keybase1.SocialAssertion type
	// used in implicit team handling code.
	return a.ToSocialAssertionHelper()
}
func (a AssertionEmail) ToSocialAssertion() (sa keybase1.SocialAssertion, err error) {
	// Email have no public proofs, but can still be converted to
	// keybase1.SocialAssertion, used in implicit team handling code.
	return a.ToSocialAssertionHelper()
}
func (a AssertionEmail) String() string {
	return fmt.Sprintf("[%s]@email", a.Value)
}

func (a AssertionSocial) GetValue() string {
	return a.Value
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

func (a AssertionUID) CollectUrls(v []AssertionURL) []AssertionURL         { return append(v, a) }
func (a AssertionTeamID) CollectUrls(v []AssertionURL) []AssertionURL      { return append(v, a) }
func (a AssertionTeamName) CollectUrls(v []AssertionURL) []AssertionURL    { return append(v, a) }
func (a AssertionKeybase) CollectUrls(v []AssertionURL) []AssertionURL     { return append(v, a) }
func (a AssertionWeb) CollectUrls(v []AssertionURL) []AssertionURL         { return append(v, a) }
func (a AssertionSocial) CollectUrls(v []AssertionURL) []AssertionURL      { return append(v, a) }
func (a AssertionHTTP) CollectUrls(v []AssertionURL) []AssertionURL        { return append(v, a) }
func (a AssertionHTTPS) CollectUrls(v []AssertionURL) []AssertionURL       { return append(v, a) }
func (a AssertionDNS) CollectUrls(v []AssertionURL) []AssertionURL         { return append(v, a) }
func (a AssertionFingerprint) CollectUrls(v []AssertionURL) []AssertionURL { return append(v, a) }
func (a AssertionPhoneNumber) CollectUrls(v []AssertionURL) []AssertionURL { return append(v, a) }
func (a AssertionPhoneNumber) IsServerTrust() bool                         { return true }

func (a AssertionEmail) CollectUrls(v []AssertionURL) []AssertionURL { return append(v, a) }
func (a AssertionEmail) IsServerTrust() bool                         { return true }

type AssertionSocial struct{ AssertionURLBase }
type AssertionWeb struct{ AssertionURLBase }
type AssertionKeybase struct{ AssertionURLBase }
type AssertionUID struct {
	AssertionURLBase
	uid keybase1.UID
}
type AssertionTeamID struct {
	AssertionURLBase
	tid keybase1.TeamID
}
type AssertionTeamName struct {
	AssertionURLBase
	name keybase1.TeamName
}

type AssertionHTTP struct{ AssertionURLBase }
type AssertionHTTPS struct{ AssertionURLBase }
type AssertionDNS struct{ AssertionURLBase }
type AssertionFingerprint struct{ AssertionURLBase }
type AssertionPhoneNumber struct{ AssertionURLBase }
type AssertionEmail struct{ AssertionURLBase }

func (a AssertionHTTP) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	if err := a.checkAndNormalizeHost(); err != nil {
		return nil, err
	}
	return a, nil
}
func (a AssertionHTTPS) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	if err := a.checkAndNormalizeHost(); err != nil {
		return nil, err
	}
	return a, nil
}
func (a AssertionDNS) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	if err := a.checkAndNormalizeHost(); err != nil {
		return nil, err
	}
	return a, nil
}
func (a AssertionWeb) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	if err := a.checkAndNormalizeHost(); err != nil {
		return nil, err
	}
	return a, nil
}

func (a AssertionKeybase) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	a.Value = strings.ToLower(a.Value)
	if !CheckUsername.F(a.Value) {
		return nil, NewAssertionCheckError("bad keybase username '%s': %s", a.Value, CheckUsername.Hint)
	}
	return a, nil
}

func (a AssertionFingerprint) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	a.Value = strings.ToLower(a.Value)
	if _, err := hex.DecodeString(a.Value); err != nil {
		return nil, NewAssertionCheckError("bad hex string: '%s'", a.Value)
	}
	return a, nil
}

func (b *AssertionURLBase) checkAndNormalizeHost() error {

	if len(b.Value) == 0 {
		return NewAssertionCheckError("Bad assertion, no value given (key=%s)", b.Key)
	}

	b.Value = strings.ToLower(b.Value)

	if !IsValidHostname(b.Value) {
		return NewAssertionCheckError("Invalid hostname: %s", b.Value)
	}

	return nil
}

func (b AssertionURLBase) String() string {
	return fmt.Sprintf("%s@%s", b.Value, b.Key)
}
func (a AssertionKeybase) String() string {
	return a.Value
}

func (a AssertionWeb) ToLookup() (key, value string, err error) {
	return "web", a.Value, nil
}
func (a AssertionHTTP) ToLookup() (key, value string, err error) {
	return "http", a.Value, nil
}
func (a AssertionHTTPS) ToLookup() (key, value string, err error) {
	return "https", a.Value, nil
}
func (a AssertionDNS) ToLookup() (key, value string, err error) {
	return "dns", a.Value, nil
}
func (a AssertionFingerprint) ToLookup() (key, value string, err error) {
	cmp := len(a.Value) - PGPFingerprintHexLen
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

var assertionBracketNameRxx = regexp.MustCompile(`^\[[-_a-zA-Z0-9.@+]+\]$`)
var assertionNameRxx = regexp.MustCompile(`^[-_a-zA-Z0-9.]+$`)
var assertionServiceRxx = regexp.MustCompile(`^[a-zA-Z.]+$`)

func parseToKVPair(s string) (key string, value string, err error) {
	// matchNameAndService runs regexp against potential name and service
	// strings extracted from assertion.
	matchNameAndService := func(name, service string) bool {
		var k, v string // temp variables for key and value
		if !assertionServiceRxx.MatchString(service) {
			return false
		}

		// Normalize service name at parser level.
		k = strings.ToLower(service)

		if name == "" {
			// We are fine with matching just the service. "dns:" is a valid
			// assertion at parser level (but is rejected later in the
			// process).
			key = k
			return true
		}

		var hasBrackets bool
		if assertionNameRxx.MatchString(name) {
			v = name
		} else if assertionBracketNameRxx.MatchString(name) {
			v = name[1 : len(name)-1]
			hasBrackets = true
		} else {
			return false
		}

		// Set err in outer scope if find invalid square bracket syntax.
		// Still return `true` because it's a successful match.
		if k == "email" && !hasBrackets {
			err = fmt.Errorf("expected bracket syntax for email assertion")
		} else if k != "email" && hasBrackets {
			err = fmt.Errorf("unexpected bracket syntax for assertion: %s", k)
		}

		// Finally pass back temp variables to outer scope.
		key = k
		value = v
		return true
	}

	if atIndex := strings.LastIndex(s, "@"); atIndex != -1 {
		name := s[:atIndex]
		service := s[atIndex+1:]

		if matchNameAndService(name, service) {
			return key, value, err
		}
	}

	if colIndex := strings.Index(s, ":"); colIndex != -1 {
		service := s[:colIndex]
		name := s[colIndex+1:]

		if strings.HasPrefix(name, "//") {
			// "dns://keybase.io" syntax.
			name = name[2:]
		}

		if matchNameAndService(name, service) {
			return key, value, err
		}
	}

	if assertionNameRxx.MatchString(s) {
		key = ""
		value = s
		return key, value, nil
	}

	// We've exhausted our options, it's not a valid assertion we can parse.
	return "", "", fmt.Errorf("Invalid key-value identity: %s", s)
}

func (a AssertionKeybase) IsKeybase() bool         { return true }
func (a AssertionSocial) IsSocial() bool           { return true }
func (a AssertionSocial) IsRemote() bool           { return true }
func (a AssertionWeb) IsRemote() bool              { return true }
func (a AssertionFingerprint) IsFingerprint() bool { return true }
func (a AssertionUID) IsUID() bool                 { return true }
func (a AssertionTeamID) IsTeamID() bool           { return true }
func (a AssertionTeamName) IsTeamName() bool       { return true }
func (a AssertionHTTP) IsRemote() bool             { return true }
func (a AssertionHTTPS) IsRemote() bool            { return true }
func (a AssertionDNS) IsRemote() bool              { return true }
func (a AssertionPhoneNumber) IsRemote() bool      { return true }
func (a AssertionEmail) IsRemote() bool            { return true }

func (a AssertionUID) ToUID() keybase1.UID {
	if a.uid.IsNil() {
		if tmp, err := UIDFromHex(a.Value); err == nil {
			a.uid = tmp
		}
	}
	return a.uid
}

func (a AssertionTeamID) ToTeamID() keybase1.TeamID {
	if a.tid.IsNil() {
		if tmp, err := keybase1.TeamIDFromString(a.Value); err == nil {
			a.tid = tmp
		}
	}
	return a.tid
}

func (a AssertionTeamName) ToTeamName() keybase1.TeamName {
	if a.name.IsNil() {
		if tmp, err := keybase1.TeamNameFromString(a.Value); err != nil {
			a.name = tmp
		}
	}
	return a.name
}

func (a AssertionKeybase) ToLookup() (key, value string, err error) {
	return "username", a.Value, nil
}

func (a AssertionUID) ToLookup() (key, value string, err error) {
	return "uid", a.Value, nil
}

func (a AssertionUID) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	var err error
	a.uid, err = UIDFromHex(a.Value)
	a.Value = strings.ToLower(a.Value)
	return a, err
}

func (a AssertionTeamID) ToLookup() (key, value string, err error) {
	return "tid", a.Value, nil
}

func (a AssertionTeamName) ToLookup() (key, value string, err error) {
	return "team", a.Value, nil
}

func (a AssertionTeamID) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	var err error
	a.tid, err = keybase1.TeamIDFromString(a.Value)
	a.Value = strings.ToLower(a.Value)
	return a, err
}

func (a AssertionTeamName) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	var err error
	a.name, err = keybase1.TeamNameFromString(a.Value)
	a.Value = a.name.String()
	return a, err
}

func (a AssertionSocial) CheckAndNormalize(ctx AssertionContext) (AssertionURL, error) {
	var err error
	a.Value, err = ctx.NormalizeSocialName(a.Key, a.Value)
	return a, err
}

func (a AssertionPhoneNumber) CheckAndNormalize(ctx AssertionContext) (AssertionURL, error) {
	if !IsPossiblePhoneNumber(a.Value) {
		return nil, NewAssertionCheckError("Invalid phone number: %s", a.Value)
	}
	return a, nil
}

func (a AssertionEmail) CheckAndNormalize(ctx AssertionContext) (AssertionURL, error) {
	if strings.Count(a.Value, "@") != 1 {
		return nil, NewAssertionCheckError("Invalid email address: %s", a.Value)
	}
	return a, nil
}

func (a AssertionSocial) ToLookup() (key, value string, err error) {
	return a.Key, a.Value, nil
}

func (a AssertionPhoneNumber) ToLookup() (key, value string, err error) {
	return "phone", "+" + a.Value, nil
}

func (a AssertionEmail) ToLookup() (key, value string, err error) {
	return "email", a.Value, nil
}

func ParseAssertionURL(ctx AssertionContext, s string, strict bool) (ret AssertionURL, err error) {
	key, val, err := parseToKVPair(s)

	if err != nil {
		return
	}
	return ParseAssertionURLKeyValue(ctx, key, val, strict)
}

func ParseAssertionURLKeyValue(ctx AssertionContext, key string, val string, strict bool) (ret AssertionURL, err error) {

	if len(key) == 0 {
		if strict {
			err = fmt.Errorf("Bad assertion, no 'type' given: %s", val)
			return nil, err
		}
		key = "keybase"
	}

	base := AssertionURLBase{key, val}
	switch key {
	case "keybase":
		ret = AssertionKeybase{base}
	case "uid":
		ret = AssertionUID{AssertionURLBase: base}
	case "tid":
		ret = AssertionTeamID{AssertionURLBase: base}
	case "team":
		ret = AssertionTeamName{AssertionURLBase: base}
	case "web":
		ret = AssertionWeb{base}
	case "http":
		ret = AssertionHTTP{base}
	case "https":
		ret = AssertionHTTPS{base}
	case "dns":
		ret = AssertionDNS{base}
	case PGPAssertionKey:
		ret = AssertionFingerprint{base}
	case "phone":
		ret = AssertionPhoneNumber{base}
	case "email":
		ret = AssertionEmail{base}
	default:
		ret = AssertionSocial{base}
	}
	return ret.CheckAndNormalize(ctx)
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

func FindBestIdentifyComponentURL(e AssertionExpression) AssertionURL {
	urls := e.CollectUrls(nil)
	if len(urls) == 0 {
		return nil
	}

	var uid, tid, kb, team, soc, fp, rooter AssertionURL

	for _, u := range urls {
		if u.IsUID() {
			uid = u
			break
		}
		if u.IsTeamID() {
			tid = u
			break
		}

		if u.IsKeybase() {
			kb = u
		} else if u.IsTeamName() {
			team = u
		} else if u.IsFingerprint() && fp == nil {
			fp = u
		} else if u.IsSocial() {
			k, _ := u.ToKeyValuePair()
			if k == "rooter" {
				rooter = u
			} else if soc == nil {
				soc = u
			}
		}
	}

	order := []AssertionURL{uid, tid, kb, team, fp, rooter, soc, urls[0]}
	for _, p := range order {
		if p != nil {
			return p
		}
	}
	return nil
}

func FindBestIdentifyComponent(e AssertionExpression) string {
	u := FindBestIdentifyComponentURL(e)
	if u == nil {
		return ""
	}
	return u.String()
}

func CollectAssertions(e AssertionExpression) (remotes AssertionAnd, locals AssertionAnd) {
	urls := e.CollectUrls(nil)
	for _, u := range urls {
		if u.IsRemote() {
			remotes.factors = append(remotes.factors, u)
		} else {
			locals.factors = append(locals.factors, u)
		}
	}
	return remotes, locals
}

func AssertionIsTeam(au AssertionURL) bool {
	return au != nil && (au.IsTeamID() || au.IsTeamName())
}

func parseImplicitTeamPart(ctx AssertionContext, s string) (typ string, name string, err error) {
	nColons := strings.Count(s, ":")
	nAts := strings.Count(s, "@")
	nDelimiters := nColons + nAts
	if nDelimiters > 1 {
		return "", "", fmt.Errorf("Invalid implicit team part, can have at most one ':' xor '@': %v", s)
	}
	if nDelimiters == 0 {
		if CheckUsername.F(s) {
			return "keybase", strings.ToLower(s), nil
		}

		return "", "", fmt.Errorf("Parsed part as keybase username, but invalid username (%q)", s)
	}
	assertion, err := ParseAssertionURL(ctx, s, true)
	if err != nil {
		return "", "", fmt.Errorf("Could not parse part as SBS assertion")
	}
	return string(assertion.GetKey()), assertion.GetValue(), nil
}

func FormatImplicitTeamDisplayNameSuffix(conflict keybase1.ImplicitTeamConflictInfo) string {
	return fmt.Sprintf("(conflicted copy %v #%v)",
		conflict.Time.Time().UTC().Format("2006-01-02"),
		conflict.Generation)
}

// Parse a name like "mlsteele,malgorithms@twitter#bot (conflicted copy 2017-03-04 #2)"
func ParseImplicitTeamDisplayName(ctx AssertionContext, s string, isPublic bool) (ret keybase1.ImplicitTeamDisplayName, err error) {
	// Turn the whole string tolower
	s = strings.ToLower(s)

	split1 := strings.SplitN(s, " ", 2)     // split1: [assertions, ?conflict]
	split2 := strings.Split(split1[0], "#") // split2: [writers, ?readers]
	if len(split2) > 2 {
		return ret, NewImplicitTeamDisplayNameError("can have at most one '#' separator")
	}

	seen := make(map[string]bool)
	var readers, writers keybase1.ImplicitTeamUserSet
	writers, err = parseImplicitTeamUserSet(ctx, split2[0], seen)
	if err != nil {
		return ret, err
	}

	if writers.NumTotalUsers() == 0 {
		return ret, NewImplicitTeamDisplayNameError("need at least one writer")
	}

	if len(split2) == 2 {
		readers, err = parseImplicitTeamUserSet(ctx, split2[1], seen)
		if err != nil {
			return ret, err
		}
	}

	var conflictInfo *keybase1.ImplicitTeamConflictInfo
	if len(split1) > 1 {
		suffix := split1[1]
		if len(suffix) == 0 {
			return ret, NewImplicitTeamDisplayNameError("empty suffix")
		}
		conflictInfo, err = ParseImplicitTeamDisplayNameSuffix(suffix)
		if err != nil {
			return ret, err
		}
	}

	ret = keybase1.ImplicitTeamDisplayName{
		IsPublic:     isPublic,
		ConflictInfo: conflictInfo,
		Writers:      writers,
		Readers:      readers,
	}
	return ret, nil
}

var implicitTeamDisplayNameConflictRxx = regexp.MustCompile(`^\(conflicted copy (\d{4}-\d{2}-\d{2})( #(\d+))?\)$`)

func ParseImplicitTeamDisplayNameSuffix(suffix string) (ret *keybase1.ImplicitTeamConflictInfo, err error) {
	if len(suffix) == 0 {
		return ret, NewImplicitTeamDisplayNameError("cannot parse empty suffix")
	}
	matches := implicitTeamDisplayNameConflictRxx.FindStringSubmatch(suffix)
	if len(matches) == 0 {
		return ret, NewImplicitTeamDisplayNameError("malformed suffix: '%s'", suffix)
	}
	if len(matches) != 4 {
		return ret, NewImplicitTeamDisplayNameError("malformed suffix; bad number of matches: %d", len(matches))
	}

	conflictTime, err := time.Parse("2006-01-02", matches[1])
	if err != nil {
		return ret, NewImplicitTeamDisplayNameError("malformed suffix time: %v", conflictTime)
	}

	var generation int
	if len(matches[3]) == 0 {
		generation = 1
	} else {
		generation, err = strconv.Atoi(matches[3])
		if err != nil || generation <= 0 {
			return ret, NewImplicitTeamDisplayNameError("malformed suffix generation: %v", matches[3])
		}
	}

	return &keybase1.ImplicitTeamConflictInfo{
		Generation: keybase1.ConflictGeneration(generation),
		Time:       keybase1.ToTime(conflictTime.UTC()),
	}, nil
}

func parseImplicitTeamUserSet(ctx AssertionContext, s string, seen map[string]bool) (ret keybase1.ImplicitTeamUserSet, err error) {

	for _, part := range strings.Split(s, ",") {
		typ, name, err := parseImplicitTeamPart(ctx, part)
		if err != nil {
			return keybase1.ImplicitTeamUserSet{}, err
		}
		sa := keybase1.SocialAssertion{User: name, Service: keybase1.SocialAssertionService(typ)}
		idx := sa.String()
		if seen[idx] {
			continue
		}
		seen[idx] = true
		if typ == "keybase" {
			ret.KeybaseUsers = append(ret.KeybaseUsers, name)
		} else {
			ret.UnresolvedUsers = append(ret.UnresolvedUsers, sa)
		}
	}
	sort.Strings(ret.KeybaseUsers)
	sort.Slice(ret.UnresolvedUsers, func(i, j int) bool { return ret.UnresolvedUsers[i].String() < ret.UnresolvedUsers[j].String() })
	return ret, nil
}

// Parse a name like "/keybase/private/mlsteele,malgorithms@twitter#bot (conflicted copy 2017-03-04 #2)"
func ParseImplicitTeamTLFName(ctx AssertionContext, s string) (keybase1.ImplicitTeamDisplayName, error) {
	ret := keybase1.ImplicitTeamDisplayName{}
	s = strings.ToLower(s)
	parts := strings.Split(s, "/")
	if len(parts) != 4 {
		return ret, fmt.Errorf("Invalid team TLF name, must have four parts")
	}
	if parts[0] != "" || parts[1] != "keybase" || (parts[2] != "private" && parts[2] != "public") {
		return ret, fmt.Errorf("Invalid team TLF name")
	}
	isPublic := parts[2] == "public"
	return ParseImplicitTeamDisplayName(ctx, parts[3], isPublic)
}

// Parse a name like "/keybase/team/happy.toucans"
func ParseTeamPrivateKBFSPath(s string) (ret keybase1.TeamName, err error) {
	s = strings.ToLower(s)
	parts := strings.Split(s, "/")
	if len(parts) != 4 {
		return ret, fmt.Errorf("Invalid team TLF name, must have four parts")
	}
	if parts[0] != "" || parts[1] != "keybase" || parts[2] != "team" {
		return ret, fmt.Errorf("Invalid team TLF name")
	}
	return keybase1.TeamNameFromString(parts[3])
}

type ResolvedAssertion struct {
	UID           keybase1.UID
	Assertion     AssertionExpression
	ResolveResult ResolveResult
}
