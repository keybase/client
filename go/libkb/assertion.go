// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type AssertionExpression interface {
	String() string
	MatchSet(ps ProofSet) bool
	HasOr() bool
	NeedsParens() bool
	CollectUrls([]AssertionURL) []AssertionURL
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

type AssertionURL interface {
	AssertionExpression
	Keys() []string
	CheckAndNormalize(ctx AssertionContext) (AssertionURL, error)
	IsKeybase() bool
	IsUID() bool
	ToUID() keybase1.UID
	IsTeamID() bool
	IsTeamName() bool
	IsImplicitTeamName() bool
	ToTeamID() keybase1.TeamID
	IsSocial() bool
	IsRemote() bool
	IsFingerprint() bool
	MatchProof(p Proof) bool
	ToKeyValuePair() (string, string)
	CacheKey() string
	GetValue() string
	GetKey() string
	ToLookup() (string, string, error)
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

func (a AssertionUID) MatchSet(ps ProofSet) bool              { return a.matchSet(a, ps) }
func (a AssertionTeamID) MatchSet(ps ProofSet) bool           { return a.matchSet(a, ps) }
func (a AssertionTeamName) MatchSet(ps ProofSet) bool         { return a.matchSet(a, ps) }
func (a AssertionImplicitTeamName) MatchSet(ps ProofSet) bool { return a.matchSet(a, ps) }
func (a AssertionKeybase) MatchSet(ps ProofSet) bool          { return a.matchSet(a, ps) }
func (a AssertionWeb) MatchSet(ps ProofSet) bool              { return a.matchSet(a, ps) }
func (a AssertionSocial) MatchSet(ps ProofSet) bool           { return a.matchSet(a, ps) }
func (a AssertionHTTP) MatchSet(ps ProofSet) bool             { return a.matchSet(a, ps) }
func (a AssertionHTTPS) MatchSet(ps ProofSet) bool            { return a.matchSet(a, ps) }
func (a AssertionDNS) MatchSet(ps ProofSet) bool              { return a.matchSet(a, ps) }
func (a AssertionFingerprint) MatchSet(ps ProofSet) bool {
	return a.matchSet(a, ps)
}
func (a AssertionWeb) Keys() []string {
	return []string{"dns", "http", "https"}
}
func (a AssertionHTTP) Keys() []string                     { return []string{"http", "https"} }
func (b AssertionURLBase) Keys() []string                  { return []string{b.Key} }
func (b AssertionURLBase) IsKeybase() bool                 { return false }
func (b AssertionURLBase) IsSocial() bool                  { return false }
func (b AssertionURLBase) IsRemote() bool                  { return false }
func (b AssertionURLBase) IsFingerprint() bool             { return false }
func (b AssertionURLBase) IsUID() bool                     { return false }
func (b AssertionURLBase) ToUID() (ret keybase1.UID)       { return ret }
func (b AssertionURLBase) IsTeamID() bool                  { return false }
func (b AssertionURLBase) IsTeamName() bool                { return false }
func (b AssertionURLBase) IsImplicitTeamName() bool        { return false }
func (b AssertionURLBase) ToTeamID() (ret keybase1.TeamID) { return ret }
func (b AssertionURLBase) MatchProof(proof Proof) bool {
	return (strings.ToLower(proof.Value) == b.Value)
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

func (a AssertionUID) CollectUrls(v []AssertionURL) []AssertionURL              { return append(v, a) }
func (a AssertionTeamID) CollectUrls(v []AssertionURL) []AssertionURL           { return append(v, a) }
func (a AssertionTeamName) CollectUrls(v []AssertionURL) []AssertionURL         { return append(v, a) }
func (a AssertionImplicitTeamName) CollectUrls(v []AssertionURL) []AssertionURL { return append(v, a) }
func (a AssertionKeybase) CollectUrls(v []AssertionURL) []AssertionURL          { return append(v, a) }
func (a AssertionWeb) CollectUrls(v []AssertionURL) []AssertionURL              { return append(v, a) }
func (a AssertionSocial) CollectUrls(v []AssertionURL) []AssertionURL           { return append(v, a) }
func (a AssertionHTTP) CollectUrls(v []AssertionURL) []AssertionURL             { return append(v, a) }
func (a AssertionHTTPS) CollectUrls(v []AssertionURL) []AssertionURL            { return append(v, a) }
func (a AssertionDNS) CollectUrls(v []AssertionURL) []AssertionURL              { return append(v, a) }
func (a AssertionFingerprint) CollectUrls(v []AssertionURL) []AssertionURL      { return append(v, a) }

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
type AssertionImplicitTeamName struct {
	AssertionURLBase
	name keybase1.TeamName // The implicit team name
}

func (a *AssertionTeamName) Name() keybase1.TeamName {
	return a.name
}
func (a *AssertionImplicitTeamName) Name() keybase1.TeamName {
	return a.name
}

type AssertionHTTP struct{ AssertionURLBase }
type AssertionHTTPS struct{ AssertionURLBase }
type AssertionDNS struct{ AssertionURLBase }
type AssertionFingerprint struct{ AssertionURLBase }

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
		return nil, NewBadUsernameErrorWithFullMessage("bad keybase username '%s': %s", a.Value, CheckUsername.Hint)
	}
	return a, nil
}

func (a AssertionFingerprint) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	a.Value = strings.ToLower(a.Value)
	if _, err := hex.DecodeString(a.Value); err != nil {
		return nil, fmt.Errorf("bad hex string: '%s'", a.Value)
	}
	return a, nil
}

func (b *AssertionURLBase) checkAndNormalizeHost() error {

	if len(b.Value) == 0 {
		return fmt.Errorf("Bad assertion, no value given (key=%s)", b.Key)
	}

	b.Value = strings.ToLower(b.Value)

	if !IsValidHostname(b.Value) {
		return fmt.Errorf("Invalid hostname: %s", b.Value)
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

var pairRE = regexp.MustCompile(`^[0-9a-zA-Z@:/_-]`)

func parseToKVPair(s string) (key string, value string, err error) {

	if !pairRE.MatchString(s) {
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
	return
}

func (a AssertionKeybase) IsKeybase() bool                   { return true }
func (a AssertionSocial) IsSocial() bool                     { return true }
func (a AssertionSocial) IsRemote() bool                     { return true }
func (a AssertionWeb) IsRemote() bool                        { return true }
func (a AssertionFingerprint) IsFingerprint() bool           { return true }
func (a AssertionUID) IsUID() bool                           { return true }
func (a AssertionTeamID) IsTeamID() bool                     { return true }
func (a AssertionTeamName) IsTeamName() bool                 { return true }
func (a AssertionImplicitTeamName) IsImplicitTeamName() bool { return true }
func (a AssertionHTTP) IsRemote() bool                       { return true }
func (a AssertionHTTPS) IsRemote() bool                      { return true }
func (a AssertionDNS) IsRemote() bool                        { return true }

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

func (a AssertionImplicitTeamName) ToLookup() (key, value string, err error) {
	return "itid", a.Value, nil
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

func (a AssertionImplicitTeamName) CheckAndNormalize(_ AssertionContext) (AssertionURL, error) {
	var err error
	a.name, err = keybase1.TeamNameFromString(keybase1.ImplicitTeamPrefix + a.Value)
	if err != nil {
		return a, err
	}
	if !a.name.IsImplicit() {
		return a, fmt.Errorf("invalid implicit team 'itid' assertion: '%v'", a.Value)
	}
	a.Value = a.name.String()
	return a, err
}

func (a AssertionSocial) CheckAndNormalize(ctx AssertionContext) (AssertionURL, error) {
	var err error
	a.Value, err = ctx.NormalizeSocialName(a.Key, a.Value)
	return a, err
}

func (a AssertionSocial) ToLookup() (key, value string, err error) {
	return a.Key, a.Value, nil
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
	case "itid":
		ret = AssertionImplicitTeamName{AssertionURLBase: base}
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

	var uid, tid, kb, team, iteam, soc, fp, rooter AssertionURL

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
		} else if u.IsImplicitTeamName() {
			iteam = u
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

	order := []AssertionURL{uid, tid, kb, team, iteam, fp, rooter, soc, urls[0]}
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
	return au != nil && (au.IsTeamID() || au.IsTeamName() || au.IsImplicitTeamName())
}

func parseImplicitTeamPart(ctx AssertionContext, s string) (typ string, name string, err error) {
	nColons := strings.Count(s, ":")
	nAts := strings.Count(s, "@")
	nDelimiters := nColons + nAts
	if nDelimiters > 1 {
		return "", "", fmt.Errorf("Invalid implicit team part, can have at most one ':' xor '@'")
	}
	if nDelimiters == 0 {
		if CheckUsername.F(s) {
			return "keybase", strings.ToLower(s), nil
		}

		return "", "", fmt.Errorf("Parsed part as keybase username, but invalid username")
	}
	assertion, err := ParseAssertionURL(ctx, s, true)
	if err != nil {
		return "", "", fmt.Errorf("Could not parse part as SBS assertion")
	}
	return string(assertion.GetKey()), assertion.GetValue(), nil
}

func ParseImplicitTeamName(ctx AssertionContext, s string, isPrivate bool) (ret keybase1.ImplicitTeamName, err error) {
	// TODO this needs to parse out public/private and conflict
	// TODO so this probably shouldn't take isPrivate as an argument

	// Turn the whole string tolower
	s = strings.ToLower(s)

	parts := strings.Split(s, "#")
	if len(parts) > 2 {
		return ret, NewImplicitTeamNameError("can have at most one '#' separator")
	}

	seen := make(map[string]bool)
	var readers, writers keybase1.ImplicitTeamUserSet
	writers, err = parseImplicitTeamUserSet(ctx, parts[0], seen)
	if err != nil {
		return ret, err
	}

	if writers.NumTotalUsers() == 0 {
		return ret, NewImplicitTeamNameError("need at least one writer")
	}

	if len(parts) == 2 {
		readers, err = parseImplicitTeamUserSet(ctx, parts[1], seen)
		if err != nil {
			return ret, err
		}
	}

	ret = keybase1.ImplicitTeamName{
		IsPrivate:    isPrivate,
		ConflictInfo: nil,
		Writers:      writers,
		Readers:      readers,
	}
	return ret, nil
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

func ParseImplicitTeamTLFName(ctx AssertionContext, s string) (keybase1.ImplicitTeamName, error) {
	ret := keybase1.ImplicitTeamName{}
	s = strings.ToLower(s)
	parts := strings.Split(s, "/")
	if len(parts) != 4 {
		return ret, fmt.Errorf("Invalid team TLF name, must have four parts")
	}
	if parts[0] != "" || parts[1] != "keybase" || (parts[2] != "private" && parts[2] != "public") {
		return ret, fmt.Errorf("Invalid team TLF name")
	}
	isPrivate := parts[2] == "private"
	return ParseImplicitTeamName(ctx, parts[3], isPrivate)
}
