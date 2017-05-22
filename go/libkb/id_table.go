// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"fmt"
	"strings"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

type TypedChainLink interface {
	GetRevocations() []keybase1.SigID
	GetRevokeKids() []keybase1.KID
	insertIntoTable(tab *IdentityTable)
	GetSigID() keybase1.SigID
	GetArmoredSig() string
	markRevoked(l TypedChainLink)
	ToDebugString() string
	Type() string
	ToDisplayString() string
	IsRevocationIsh() bool
	IsRevoked() bool
	GetRole() KeyRole
	GetSeqno() Seqno
	GetCTime() time.Time
	GetETime() time.Time
	GetPGPFingerprint() *PGPFingerprint
	GetPGPFullHash() string
	GetKID() keybase1.KID
	IsInCurrentFamily(u *User) bool
	GetUsername() string
	GetUID() keybase1.UID
	GetDelegatedKid() keybase1.KID
	GetParentKid() keybase1.KID
	VerifyReverseSig(ckf ComputedKeyFamily) error
	GetMerkleSeqno() int
	GetDevice() *Device
	DoOwnNewLinkFromServerNotifications(g *GlobalContext)
}

//=========================================================================
// GenericChainLink
//

type GenericChainLink struct {
	*ChainLink
}

func (g *GenericChainLink) GetSigID() keybase1.SigID {
	return g.unpacked.sigID
}
func (g *GenericChainLink) Type() string            { return "generic" }
func (g *GenericChainLink) ToDisplayString() string { return "unknown" }
func (g *GenericChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(g)
}
func (g *GenericChainLink) markRevoked(r TypedChainLink) {
	g.revoked = true
}
func (g *GenericChainLink) ToDebugString() string {
	return fmt.Sprintf("uid=%s, seq=%d, link=%s", g.Parent().uid, g.unpacked.seqno, g.id)
}

func (g *GenericChainLink) GetDelegatedKid() (kid keybase1.KID)          { return }
func (g *GenericChainLink) GetParentKid() (kid keybase1.KID)             { return }
func (g *GenericChainLink) VerifyReverseSig(ckf ComputedKeyFamily) error { return nil }
func (g *GenericChainLink) IsRevocationIsh() bool                        { return false }
func (g *GenericChainLink) GetRole() KeyRole                             { return DLGNone }
func (g *GenericChainLink) IsRevoked() bool                              { return g.revoked }
func (g *GenericChainLink) GetSeqno() Seqno                              { return g.unpacked.seqno }
func (g *GenericChainLink) GetPGPFingerprint() *PGPFingerprint {
	return g.unpacked.pgpFingerprint
}
func (g *GenericChainLink) GetPGPFullHash() string { return "" }

func (g *GenericChainLink) GetArmoredSig() string {
	return g.unpacked.sig
}
func (g *GenericChainLink) GetUsername() string {
	return g.unpacked.username
}
func (g *GenericChainLink) GetUID() keybase1.UID {
	return g.unpacked.uid
}

func (g *GenericChainLink) GetDevice() *Device { return nil }

func (g *GenericChainLink) extractPGPFullHash(loc string) string {
	if jw := g.payloadJSON.AtPath("body." + loc + ".full_hash"); !jw.IsNil() {
		if ret, err := jw.GetString(); err == nil {
			return ret
		}
	}
	return ""
}

func (g *GenericChainLink) DoOwnNewLinkFromServerNotifications(glob *GlobalContext) {}

func CanonicalProofName(t TypedChainLink) string {
	return strings.ToLower(t.ToDisplayString())
}

//
//=========================================================================

//=========================================================================
// Remote, Web and Social
//
type RemoteProofChainLink interface {
	TypedChainLink
	TableKey() string
	LastWriterWins() bool
	GetRemoteUsername() string
	GetHostname() string
	GetProtocol() string
	DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) error
	ToTrackingStatement(keybase1.ProofState) (*jsonw.Wrapper, error)
	CheckDataJSON() *jsonw.Wrapper
	ToIDString() string
	ToKeyValuePair() (string, string)
	ComputeTrackDiff(tl *TrackLookup) TrackDiff
	GetProofType() keybase1.ProofType
	ProofText() string
}

type WebProofChainLink struct {
	GenericChainLink
	protocol  string
	hostname  string
	proofText string
}

type SocialProofChainLink struct {
	GenericChainLink
	service   string
	username  string
	proofText string
}

func (w *WebProofChainLink) TableKey() string {
	if w.protocol == "https" {
		return "http"
	}
	return w.protocol
}

func (w *WebProofChainLink) GetProofType() keybase1.ProofType {
	if w.protocol == "dns" {
		return keybase1.ProofType_DNS
	}
	return keybase1.ProofType_GENERIC_WEB_SITE
}

func (w *WebProofChainLink) ToTrackingStatement(state keybase1.ProofState) (*jsonw.Wrapper, error) {
	ret := w.BaseToTrackingStatement(state)
	err := remoteProofToTrackingStatement(w, ret)
	if err != nil {
		ret = nil
	}
	return ret, err
}

func (w *WebProofChainLink) DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) error {
	return ui.FinishWebProofCheck(ExportRemoteProof(w), lcr.Export())
}

func (w *WebProofChainLink) Type() string { return "proof" }
func (w *WebProofChainLink) insertIntoTable(tab *IdentityTable) {
	remoteProofInsertIntoTable(w, tab)
}
func (w *WebProofChainLink) ToDisplayString() string {
	return w.protocol + "://" + w.hostname
}
func (w *WebProofChainLink) LastWriterWins() bool      { return false }
func (w *WebProofChainLink) GetRemoteUsername() string { return "" }
func (w *WebProofChainLink) GetHostname() string       { return w.hostname }
func (w *WebProofChainLink) GetProtocol() string       { return w.protocol }
func (w *WebProofChainLink) ProofText() string         { return w.proofText }

func (w *WebProofChainLink) CheckDataJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	if w.protocol == "dns" {
		ret.SetKey("protocol", jsonw.NewString(w.protocol))
		ret.SetKey("domain", jsonw.NewString(w.hostname))

	} else {
		ret.SetKey("protocol", jsonw.NewString(w.protocol+":"))
		ret.SetKey("hostname", jsonw.NewString(w.hostname))
	}
	return ret
}
func (w *WebProofChainLink) ToIDString() string { return w.ToDisplayString() }
func (w *WebProofChainLink) ToKeyValuePair() (string, string) {
	return w.GetProtocol(), w.GetHostname()
}

func (w *WebProofChainLink) ComputeTrackDiff(tl *TrackLookup) (res TrackDiff) {

	find := func(list []string) bool {
		for _, e := range list {
			if Cicmp(e, w.hostname) {
				return true
			}
		}
		return false
	}
	if find(tl.ids[w.protocol]) {
		res = TrackDiffNone{}
	} else if w.protocol == "https" && find(tl.ids["http"]) {
		res = TrackDiffUpgraded{"http", "https"}
	} else {
		res = TrackDiffNew{}
	}
	return
}

func (s *SocialProofChainLink) TableKey() string { return s.service }
func (s *SocialProofChainLink) Type() string     { return "proof" }
func (s *SocialProofChainLink) insertIntoTable(tab *IdentityTable) {
	remoteProofInsertIntoTable(s, tab)
}
func (s *SocialProofChainLink) ToDisplayString() string {
	return s.username + "@" + s.service
}
func (s *SocialProofChainLink) LastWriterWins() bool      { return true }
func (s *SocialProofChainLink) GetRemoteUsername() string { return s.username }
func (s *SocialProofChainLink) GetHostname() string       { return "" }
func (s *SocialProofChainLink) GetProtocol() string       { return "" }
func (s *SocialProofChainLink) ProofText() string         { return s.proofText }
func (s *SocialProofChainLink) ToIDString() string        { return s.ToDisplayString() }
func (s *SocialProofChainLink) ToKeyValuePair() (string, string) {
	return s.service, s.username
}
func (s *SocialProofChainLink) GetService() string { return s.service }

var _ RemoteProofChainLink = (*SocialProofChainLink)(nil)
var _ RemoteProofChainLink = (*WebProofChainLink)(nil)

func NewWebProofChainLink(b GenericChainLink, p, h, proofText string) *WebProofChainLink {
	return &WebProofChainLink{b, p, h, proofText}
}
func NewSocialProofChainLink(b GenericChainLink, s, u, proofText string) *SocialProofChainLink {
	return &SocialProofChainLink{
		GenericChainLink: b,
		service:          s,
		username:         u,
		proofText:        proofText,
	}
}

func (s *SocialProofChainLink) ComputeTrackDiff(tl *TrackLookup) TrackDiff {
	k, v := s.ToKeyValuePair()
	if list, found := tl.ids[k]; !found || len(list) == 0 {
		return TrackDiffNew{}
	} else if expected := list[len(list)-1]; !Cicmp(expected, v) {
		return TrackDiffClash{observed: v, expected: expected}
	} else {
		return TrackDiffNone{}
	}
}

func (s *SocialProofChainLink) DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) error {
	return ui.FinishSocialProofCheck(ExportRemoteProof(s), lcr.Export())
}

func (s *SocialProofChainLink) CheckDataJSON() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("username", jsonw.NewString(s.username))
	ret.SetKey("name", jsonw.NewString(s.service))
	return ret
}

func (s *SocialProofChainLink) GetProofType() keybase1.ProofType {
	ret, found := RemoteServiceTypes[s.service]
	if !found {
		ret = keybase1.ProofType_NONE
	}
	return ret
}

//=========================================================================

// Can be used to either parse a proof `service` JSON block, or a
// `remote_key_proof` JSON block in a tracking statement.
type ServiceBlock struct {
	social     bool
	typ        string
	id         string
	proofState keybase1.ProofState
	proofType  keybase1.ProofType
}

func (sb ServiceBlock) GetProofState() keybase1.ProofState { return sb.proofState }

func (sb ServiceBlock) IsSocial() bool { return sb.social }

func (sb ServiceBlock) ToIDString() string {
	if sb.social {
		return sb.id + "@" + sb.typ
	}
	return sb.typ + "://" + sb.id
}

func (sb ServiceBlock) ToKeyValuePair() (string, string) {
	return sb.typ, sb.id
}

func (sb ServiceBlock) LastWriterWins() bool {
	return sb.social
}

func (sb ServiceBlock) GetProofType() keybase1.ProofType { return sb.proofType }

func ParseServiceBlock(jw *jsonw.Wrapper, pt keybase1.ProofType) (sb *ServiceBlock, err error) {
	var social bool
	var typ, id string

	if prot, e1 := jw.AtKey("protocol").GetString(); e1 == nil {

		var hostname string

		jw.AtKey("hostname").GetStringVoid(&hostname, &e1)
		if e1 == nil {
			switch prot {
			case "http:":
				typ, id = "http", hostname
			case "https:":
				typ, id = "https", hostname
			}
		} else if domain, e2 := jw.AtKey("domain").GetString(); e2 == nil && prot == "dns" {
			typ, id = "dns", domain
		}
	} else {

		var e2 error

		jw.AtKey("name").GetStringVoid(&typ, &e2)
		jw.AtKey("username").GetStringVoid(&id, &e2)
		if e2 != nil {
			id, typ = "", ""
		} else {
			social = true
		}
	}

	if len(typ) == 0 {
		err = fmt.Errorf("Unrecognized Web proof @%s", jw.MarshalToDebug())
	}
	sb = &ServiceBlock{social: social, typ: typ, id: id, proofType: pt}
	return
}

// To be used for signatures in a user's signature chain.
func ParseWebServiceBinding(base GenericChainLink) (ret RemoteProofChainLink, e error) {
	jw := base.payloadJSON.AtKey("body").AtKey("service")

	var sptf string
	ptf := base.packed.AtKey("proof_text_full")
	if !ptf.IsNil() {
		// TODO: add test that returning on err here is ok:
		sptf, _ = ptf.GetString()
	}

	if jw.IsNil() {
		ret, e = ParseSelfSigChainLink(base)
	} else if sb, err := ParseServiceBlock(jw, keybase1.ProofType_NONE); err != nil {
		e = fmt.Errorf("%s @%s", err, base.ToDebugString())
	} else if sb.social {
		ret = NewSocialProofChainLink(base, sb.typ, sb.id, sptf)
	} else {
		ret = NewWebProofChainLink(base, sb.typ, sb.id, sptf)
	}

	return
}

func remoteProofInsertIntoTable(l RemoteProofChainLink, tab *IdentityTable) {
	tab.insertLink(l)
	tab.insertRemoteProof(l)
}

//
//=========================================================================

//=========================================================================
// TrackChainLink
//
type TrackChainLink struct {
	GenericChainLink
	whomUsername  NormalizedUsername
	whomUID       keybase1.UID
	untrack       *UntrackChainLink
	local         bool
	tmpExpireTime time.Time // should only be relevant if local is set to true
}

func (l TrackChainLink) IsRemote() bool {
	return !l.local
}

func ParseTrackChainLink(b GenericChainLink) (ret *TrackChainLink, err error) {
	var tmp string
	tmp, err = b.payloadJSON.AtPath("body.track.basics.username").GetString()
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err)
		return
	}
	whomUsername := NewNormalizedUsername(tmp)

	whomUID, err := GetUID(b.payloadJSON.AtPath("body.track.id"))
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err)
		return
	}

	ret = &TrackChainLink{b, whomUsername, whomUID, nil, false, time.Time{}}
	return
}

func (l *TrackChainLink) Type() string { return "track" }

func (l *TrackChainLink) ToDisplayString() string {
	return l.whomUsername.String()
}

func (l *TrackChainLink) GetTmpExpireTime() (ret time.Time) {
	if l.local {
		ret = l.tmpExpireTime
	}
	return ret
}

func (l *TrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
	tab.tracks[l.whomUsername] = append(tab.tracks[l.whomUsername], l)
}

type TrackedKey struct {
	KID         keybase1.KID
	Fingerprint *PGPFingerprint
}

func trackedKeyFromJSON(jw *jsonw.Wrapper) (TrackedKey, error) {
	var ret TrackedKey
	kid, err := GetKID(jw.AtKey("kid"))
	if err != nil {
		return TrackedKey{}, err
	}
	ret.KID = kid

	// It's ok if key_fingerprint doesn't exist.  But if it does, then include it:
	fp, err := GetPGPFingerprint(jw.AtKey("key_fingerprint"))
	if err == nil && fp != nil {
		ret.Fingerprint = fp
	}
	return ret, nil
}

func (l *TrackChainLink) GetTrackedKeys() ([]TrackedKey, error) {
	// presumably order is important, so we'll only use the map as a set
	// to deduplicate keys.
	set := make(map[keybase1.KID]bool)

	var res []TrackedKey

	pgpKeysJSON := l.payloadJSON.AtPath("body.track.pgp_keys")
	if !pgpKeysJSON.IsNil() {
		n, err := pgpKeysJSON.Len()
		if err != nil {
			return nil, err
		}
		for i := 0; i < n; i++ {
			keyJSON := pgpKeysJSON.AtIndex(i)
			tracked, err := trackedKeyFromJSON(keyJSON)
			if err != nil {
				return nil, err
			}
			if !set[tracked.KID] {
				res = append(res, tracked)
				set[tracked.KID] = true
			}
		}
	}
	return res, nil
}

func (l *TrackChainLink) GetEldestKID() (kid keybase1.KID, err error) {
	keyJSON := l.payloadJSON.AtPath("body.track.key")
	if keyJSON.IsNil() {
		return kid, nil
	}
	tracked, err := trackedKeyFromJSON(keyJSON)
	if err != nil {
		return kid, err
	}
	return tracked.KID, nil
}

func (l *TrackChainLink) GetTrackedUID() (keybase1.UID, error) {
	return GetUID(l.payloadJSON.AtPath("body.track.id"))
}

func (l *TrackChainLink) GetTrackedUsername() (NormalizedUsername, error) {
	tmp, err := l.payloadJSON.AtPath("body.track.basics.username").GetString()
	if err != nil {
		return NormalizedUsername(""), nil
	}
	return NewNormalizedUsername(tmp), err
}

func (l *TrackChainLink) IsRevoked() bool {
	return l.revoked || l.untrack != nil
}

func (l *TrackChainLink) RemoteKeyProofs() *jsonw.Wrapper {
	return l.payloadJSON.AtPath("body.track.remote_proofs")
}

func (l *TrackChainLink) ToServiceBlocks() (ret []*ServiceBlock) {
	w := l.RemoteKeyProofs()
	ln, err := w.Len()
	if err != nil {
		return
	}
	for index := 0; index < ln; index++ {
		proof := w.AtIndex(index).AtKey("remote_key_proof")
		sb := convertTrackedProofToServiceBlock(l.G(), proof, index)
		if sb != nil {
			ret = append(ret, sb)
		}
	}
	return ret
}

// convertTrackedProofToServiceBlock will take a JSON stanza from a track statement, and convert it
// to a ServiceBlock if it fails some important sanity checks. We check that the JSON stanza is
// well-formed, and that it's not for a defunct proof type (like Coinbase). If all succeeeds,
// we output a service block that can entered into found-versus-tracked comparison logic.
// The `index` provided is what index this JSON stanza is in the overall track statement.
func convertTrackedProofToServiceBlock(g *GlobalContext, proof *jsonw.Wrapper, index int) (ret *ServiceBlock) {
	var i, t int
	var err error
	i, err = proof.AtKey("state").GetInt()
	if err != nil {
		g.Log.Warning("Bad 'state' in track statement: %s", err)
		return nil
	}
	t, err = proof.AtKey("proof_type").GetInt()
	if err != nil {
		g.Log.Warning("Bad 'proof_type' in track statement: %s", err)
		return nil
	}
	proofType := keybase1.ProofType(t)
	if isProofTypeDefunct(proofType) {
		g.Log.Debug("Ignoring now defunct proof type %q at index=%d", proofType, index)
		return nil
	}
	ret, err = ParseServiceBlock(proof.AtKey("check_data_json"), proofType)
	if err != nil {
		g.Log.Warning("Bad remote_key_proof.check_data_json: %s", err)
		return nil
	}

	ret.proofState = keybase1.ProofState(i)
	if ret.proofState != keybase1.ProofState_OK {
		g.Log.Debug("Including broken proof at index=%d (proof state=%d)", index, ret.proofState)
	}
	return ret
}

func (l *TrackChainLink) DoOwnNewLinkFromServerNotifications(g *GlobalContext) {
	g.Log.Debug("Post notification for new TrackChainLink")
	g.NotifyRouter.HandleTrackingChanged(l.whomUID, l.whomUsername, true)
}

//
//=========================================================================

//=========================================================================
// SibkeyChainLink
//

type SibkeyChainLink struct {
	GenericChainLink
	kid        keybase1.KID
	device     *Device
	reverseSig string
}

func ParseSibkeyChainLink(b GenericChainLink) (ret *SibkeyChainLink, err error) {
	var kid keybase1.KID
	var device *Device

	if kid, err = GetKID(b.payloadJSON.AtPath("body.sibkey.kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Bad sibkey statement @%s: %s", b.ToDebugString(), err)}
		return
	}

	var rs string
	if rs, err = b.payloadJSON.AtPath("body.sibkey.reverse_sig").GetString(); err != nil {
		err = ChainLinkError{fmt.Sprintf("Missing reverse_sig in sibkey delegation: @%s: %s",
			b.ToDebugString(), err)}
		return
	}

	if jw := b.payloadJSON.AtPath("body.device"); !jw.IsNil() {
		if device, err = ParseDevice(jw, b.GetCTime()); err != nil {
			return
		}
	}

	ret = &SibkeyChainLink{b, kid, device, rs}
	return
}

func (s *SibkeyChainLink) GetDelegatedKid() keybase1.KID { return s.kid }
func (s *SibkeyChainLink) GetRole() KeyRole              { return DLGSibkey }
func (s *SibkeyChainLink) Type() string                  { return DelegationTypeSibkey }
func (s *SibkeyChainLink) ToDisplayString() string       { return s.kid.String() }
func (s *SibkeyChainLink) GetDevice() *Device            { return s.device }
func (s *SibkeyChainLink) GetPGPFullHash() string        { return s.extractPGPFullHash("sibkey") }

//-------------------------------------

func makeDeepCopy(w *jsonw.Wrapper) (ret *jsonw.Wrapper, err error) {
	var b []byte
	if b, err = w.Marshal(); err != nil {
		return nil, err
	}
	return jsonw.Unmarshal(b)
}

//-------------------------------------

// VerifyReverseSig checks a SibkeyChainLink's reverse signature using the ComputedKeyFamily provided.
func (s *SibkeyChainLink) VerifyReverseSig(ckf ComputedKeyFamily) (err error) {
	var key GenericKey

	if key, err = ckf.FindKeyWithKIDUnsafe(s.GetDelegatedKid()); err != nil {
		return err
	}

	var p1, p2 []byte
	if p1, _, err = key.VerifyStringAndExtract(s.G().Log, s.reverseSig); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to verify/extract sig: %s", err)}
		return err
	}

	if p1, err = jsonw.Canonicalize(p1); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to canonicalize json: %s", err)}
		return err
	}

	// Null-out the reverse sig on the parent
	path := "body.sibkey.reverse_sig"

	// Make a deep copy. It's dangerous to try to mutate this thing
	// since other goroutines might be accessing it at the same time.
	var jsonCopy *jsonw.Wrapper
	if jsonCopy, err = makeDeepCopy(s.payloadJSON); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to copy payload json: %s", err)}
		return err
	}

	jsonCopy.SetValueAtPath(path, jsonw.NewNil())
	if p2, err = jsonCopy.Marshal(); err != nil {
		err = ReverseSigError{fmt.Sprintf("Can't remarshal JSON statement: %s", err)}
		return err
	}

	eq := FastByteArrayEq(p1, p2)

	if !eq {
		err = ReverseSigError{fmt.Sprintf("JSON mismatch: %s != %s",
			string(p1), string(p2))}
		return err
	}
	return nil
}

//
//=========================================================================
// SubkeyChainLink

type SubkeyChainLink struct {
	GenericChainLink
	kid       keybase1.KID
	parentKid keybase1.KID
}

func ParseSubkeyChainLink(b GenericChainLink) (ret *SubkeyChainLink, err error) {
	var kid, pkid keybase1.KID
	if kid, err = GetKID(b.payloadJSON.AtPath("body.subkey.kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get KID for subkey @%s: %s", b.ToDebugString(), err)}
	} else if pkid, err = GetKID(b.payloadJSON.AtPath("body.subkey.parent_kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get parent_kid for subkey @%s: %s", b.ToDebugString(), err)}
	} else {
		ret = &SubkeyChainLink{b, kid, pkid}
	}
	return
}

func (s *SubkeyChainLink) Type() string                  { return DelegationTypeSubkey }
func (s *SubkeyChainLink) ToDisplayString() string       { return s.kid.String() }
func (s *SubkeyChainLink) GetRole() KeyRole              { return DLGSubkey }
func (s *SubkeyChainLink) GetDelegatedKid() keybase1.KID { return s.kid }
func (s *SubkeyChainLink) GetParentKid() keybase1.KID    { return s.parentKid }
func (s *SubkeyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(s)
}

//
//=========================================================================

//=========================================================================
// PerUserKeyChainLink

type PerUserKeyChainLink struct {
	GenericChainLink
	// KID of the signing key derived from the per-user-secret.
	sigKID keybase1.KID
	// KID of the encryption key derived from the per-user-secret.
	encKID     keybase1.KID
	generation keybase1.PerUserKeyGeneration
	reverseSig string
}

func ParsePerUserKeyChainLink(b GenericChainLink) (ret *PerUserKeyChainLink, err error) {
	var sigKID, encKID keybase1.KID
	var g int
	var reverseSig string
	section := b.payloadJSON.AtPath("body.per_user_key")
	if sigKID, err = GetKID(section.AtKey("signing_kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get signing KID for per_user_secret: @%s: %s", b.ToDebugString(), err)}
	} else if encKID, err = GetKID(section.AtKey("encryption_kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get encryption KID for per_user_secret: @%s: %s", b.ToDebugString(), err)}
	} else if g, err = section.AtKey("generation").GetInt(); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get generation for per_user_secret @%s: %s", b.ToDebugString(), err)}
	} else if reverseSig, err = section.AtKey("reverse_sig").GetString(); err != nil {
		err = ChainLinkError{fmt.Sprintf("Missing reverse_sig in per-user-key section: @%s: %s", b.ToDebugString(), err)}
	} else {
		ret = &PerUserKeyChainLink{b, sigKID, encKID, keybase1.PerUserKeyGeneration(g), reverseSig}
	}
	return ret, err
}

func (s *PerUserKeyChainLink) Type() string { return LinkTypePerUserKey }
func (s *PerUserKeyChainLink) ToDisplayString() string {
	return s.sigKID.String() + " + " + s.encKID.String()
}

// Don't consider per-user-keys as normal delegations. Because they have
// multiple kids and initially can't delegate further. They are handled
// separately by the sigchain loader.
func (s *PerUserKeyChainLink) GetRole() KeyRole                    { return DLGNone }
func (s *PerUserKeyChainLink) GetDelegatedKid() (res keybase1.KID) { return }
func (s *PerUserKeyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(s)
}

func (s *PerUserKeyChainLink) ToPerUserKey() keybase1.PerUserKey {
	return keybase1.PerUserKey{
		Gen:    int(s.generation),
		Seqno:  int(s.GetSeqno()),
		SigKID: s.sigKID,
		EncKID: s.encKID,
	}
}

//-------------------------------------

// VerifyReverseSig checks a SibkeyChainLink's reverse signature using the ComputedKeyFamily provided.
func (s *PerUserKeyChainLink) VerifyReverseSig(_ ComputedKeyFamily) (err error) {
	key, err := ImportNaclSigningKeyPairFromHex(s.sigKID.String())
	if err != nil {
		return fmt.Errorf("Invalid per-user signing KID: %s", s.sigKID)
	}

	var p1, p2 []byte
	if p1, _, err = key.VerifyStringAndExtract(s.G().Log, s.reverseSig); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to verify/extract sig: %s", err)}
		return err
	}

	if p1, err = jsonw.Canonicalize(p1); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to canonicalize json: %s", err)}
		return err
	}

	// Null-out the reverse sig on the parent
	path := "body.per_user_key.reverse_sig"

	// Make a deep copy. It's dangerous to try to mutate this thing
	// since other goroutines might be accessing it at the same time.
	var jsonCopy *jsonw.Wrapper
	if jsonCopy, err = makeDeepCopy(s.payloadJSON); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to copy payload json: %s", err)}
		return err
	}

	jsonCopy.SetValueAtPath(path, jsonw.NewNil())
	if p2, err = jsonCopy.Marshal(); err != nil {
		err = ReverseSigError{fmt.Sprintf("Can't remarshal JSON statement: %s", err)}
		return err
	}

	eq := FastByteArrayEq(p1, p2)

	if !eq {
		err = ReverseSigError{fmt.Sprintf("JSON mismatch: %s != %s",
			string(p1), string(p2))}
		return err
	}
	return nil
}

//
//=========================================================================
// PGPUpdateChainLink
//

// PGPUpdateChainLink represents a chain link which marks a new version of a
// PGP key as current. The KID and a new new full hash are included in the
// pgp_update section of the body.
type PGPUpdateChainLink struct {
	GenericChainLink
	kid keybase1.KID
}

// ParsePGPUpdateChainLink creates a PGPUpdateChainLink from a GenericChainLink
// and verifies that its pgp_update section contains a KID and full_hash
func ParsePGPUpdateChainLink(b GenericChainLink) (ret *PGPUpdateChainLink, err error) {
	var kid keybase1.KID

	pgpUpdate := b.payloadJSON.AtPath("body.pgp_update")

	if pgpUpdate.IsNil() {
		err = ChainLinkError{fmt.Sprintf("missing pgp_update section @%s", b.ToDebugString())}
		return
	}

	if kid, err = GetKID(pgpUpdate.AtKey("kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Missing kid @%s: %s", b.ToDebugString(), err)}
		return
	}

	ret = &PGPUpdateChainLink{b, kid}

	if fh := ret.GetPGPFullHash(); fh == "" {
		err = ChainLinkError{fmt.Sprintf("Missing full_hash @%s", b.ToDebugString())}
		ret = nil
		return
	}

	return
}

func (l *PGPUpdateChainLink) Type() string                       { return DelegationTypePGPUpdate }
func (l *PGPUpdateChainLink) ToDisplayString() string            { return l.kid.String() }
func (l *PGPUpdateChainLink) GetPGPFullHash() string             { return l.extractPGPFullHash("pgp_update") }
func (l *PGPUpdateChainLink) insertIntoTable(tab *IdentityTable) { tab.insertLink(l) }

//
//=========================================================================
//

type DeviceChainLink struct {
	GenericChainLink
	device *Device
}

func ParseDeviceChainLink(b GenericChainLink) (ret *DeviceChainLink, err error) {
	var dobj *Device
	if dobj, err = ParseDevice(b.payloadJSON.AtPath("body.device"), b.GetCTime()); err != nil {
	} else {
		ret = &DeviceChainLink{b, dobj}
	}
	return
}

func (s *DeviceChainLink) GetDevice() *Device { return s.device }
func (s *DeviceChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(s)
}

//=========================================================================
// UntrackChainLink

type UntrackChainLink struct {
	GenericChainLink
	whomUsername NormalizedUsername
	whomUID      keybase1.UID
}

func ParseUntrackChainLink(b GenericChainLink) (ret *UntrackChainLink, err error) {
	var tmp string
	tmp, err = b.payloadJSON.AtPath("body.untrack.basics.username").GetString()
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err)
		return
	}
	whomUsername := NewNormalizedUsername(tmp)

	whomUID, err := GetUID(b.payloadJSON.AtPath("body.untrack.id"))
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err)
		return
	}

	ret = &UntrackChainLink{b, whomUsername, whomUID}
	return
}

func (u *UntrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(u)
	if list, found := tab.tracks[u.whomUsername]; !found {
		u.G().Log.Debug("| Useless untrack of %s; no previous tracking statement found",
			u.whomUsername)
	} else {
		for _, obj := range list {
			obj.untrack = u
		}
	}
}

func (u *UntrackChainLink) ToDisplayString() string {
	return u.whomUsername.String()
}

func (u *UntrackChainLink) Type() string { return "untrack" }

func (u *UntrackChainLink) IsRevocationIsh() bool { return true }

func (u *UntrackChainLink) DoOwnNewLinkFromServerNotifications(g *GlobalContext) {
	g.Log.Debug("Post notification for new UntrackChainLink")
	g.NotifyRouter.HandleTrackingChanged(u.whomUID, u.whomUsername, false)
}

//
//=========================================================================

//=========================================================================
// CryptocurrencyChainLink

type CryptocurrencyChainLink struct {
	GenericChainLink
	pkhash  []byte
	address string
	typ     CryptocurrencyType
}

func (c CryptocurrencyChainLink) GetAddress() string {
	return c.address
}

func ParseCryptocurrencyChainLink(b GenericChainLink) (
	cl *CryptocurrencyChainLink, err error) {

	jw := b.payloadJSON.AtPath("body.cryptocurrency")
	var styp, addr string
	var pkhash []byte

	jw.AtKey("type").GetStringVoid(&styp, &err)
	jw.AtKey("address").GetStringVoid(&addr, &err)

	if err != nil {
		return
	}

	var typ CryptocurrencyType
	typ, pkhash, err = CryptocurrencyParseAndCheck(addr)
	if err != nil {
		err = fmt.Errorf("At signature %s: %s", b.ToDebugString(), err)
		return
	}
	if styp != typ.String() {
		err = fmt.Errorf("Got %q type but wanted %q at: %s", styp, typ.String(), err)
		return
	}

	cl = &CryptocurrencyChainLink{b, pkhash, addr, typ}
	return
}

func (c *CryptocurrencyChainLink) Type() string { return "cryptocurrency" }

func (c *CryptocurrencyChainLink) ToDisplayString() string { return c.address }

func (c *CryptocurrencyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(c)
	tab.cryptocurrency = append(tab.cryptocurrency, c)
}

func (c CryptocurrencyChainLink) Display(ui IdentifyUI) error {
	return ui.DisplayCryptocurrency(c.Export())
}

//
//=========================================================================

//=========================================================================
// RevokeChainLink

type RevokeChainLink struct {
	GenericChainLink
	device *Device
}

func ParseRevokeChainLink(b GenericChainLink) (ret *RevokeChainLink, err error) {
	var device *Device
	if jw := b.payloadJSON.AtPath("body.device"); !jw.IsNil() {
		if device, err = ParseDevice(jw, b.GetCTime()); err != nil {
			return
		}
	}
	ret = &RevokeChainLink{b, device}
	return
}

func (r *RevokeChainLink) Type() string { return "revoke" }

func (r *RevokeChainLink) ToDisplayString() string {
	v := r.GetRevocations()
	list := make([]string, len(v), len(v))
	for i, s := range v {
		list[i] = s.ToString(true)
	}
	return strings.Join(list, ",")
}

func (r *RevokeChainLink) IsRevocationIsh() bool { return true }

func (r *RevokeChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(r)
}

func (r *RevokeChainLink) GetDevice() *Device { return r.device }

//
//=========================================================================

//=========================================================================
// SelfSigChainLink

type SelfSigChainLink struct {
	GenericChainLink
	device *Device
}

func (s *SelfSigChainLink) Type() string { return "self" }

func (s *SelfSigChainLink) ToDisplayString() string { return s.unpacked.username }

func (s *SelfSigChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(s)
}
func (s *SelfSigChainLink) TableKey() string          { return "keybase" }
func (s *SelfSigChainLink) LastWriterWins() bool      { return true }
func (s *SelfSigChainLink) GetRemoteUsername() string { return s.GetUsername() }
func (s *SelfSigChainLink) GetHostname() string       { return "" }
func (s *SelfSigChainLink) GetProtocol() string       { return "" }
func (s *SelfSigChainLink) ProofText() string         { return "" }

func (s *SelfSigChainLink) GetPGPFullHash() string { return s.extractPGPFullHash("key") }

func (s *SelfSigChainLink) DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) error {
	return nil
}

func (s *SelfSigChainLink) CheckDataJSON() *jsonw.Wrapper { return nil }

func (s *SelfSigChainLink) ToTrackingStatement(keybase1.ProofState) (*jsonw.Wrapper, error) {
	return nil, nil
}

func (s *SelfSigChainLink) ToIDString() string { return s.GetUsername() }
func (s *SelfSigChainLink) ToKeyValuePair() (string, string) {
	return s.TableKey(), s.GetUsername()
}

func (s *SelfSigChainLink) ComputeTrackDiff(tl *TrackLookup) TrackDiff { return nil }

func (s *SelfSigChainLink) GetProofType() keybase1.ProofType { return keybase1.ProofType_KEYBASE }

func (s *SelfSigChainLink) ParseDevice() (err error) {
	if jw := s.payloadJSON.AtPath("body.device"); !jw.IsNil() {
		s.device, err = ParseDevice(jw, s.GetCTime())
	}
	return err
}

func (s *SelfSigChainLink) GetDevice() *Device {
	return s.device
}

func ParseSelfSigChainLink(base GenericChainLink) (ret *SelfSigChainLink, err error) {
	ret = &SelfSigChainLink{base, nil}
	if err = ret.ParseDevice(); err != nil {
		ret = nil
	}
	return
}

//
//=========================================================================

//=========================================================================

type IdentityTable struct {
	Contextified
	sigChain         *SigChain
	revocations      map[keybase1.SigID]bool
	links            map[keybase1.SigID]TypedChainLink
	remoteProofLinks *RemoteProofLinks
	tracks           map[NormalizedUsername][]*TrackChainLink
	Order            []TypedChainLink
	sigHints         *SigHints
	cryptocurrency   []*CryptocurrencyChainLink
	checkResult      *CheckResult
	eldest           keybase1.KID
}

func (idt *IdentityTable) GetActiveProofsFor(st ServiceType) (ret []RemoteProofChainLink) {
	return idt.remoteProofLinks.ForService(st)
}

func (idt *IdentityTable) GetTrackMap() map[NormalizedUsername][]*TrackChainLink {
	return idt.tracks
}

func (idt *IdentityTable) insertLink(l TypedChainLink) {
	idt.links[l.GetSigID()] = l
	idt.Order = append(idt.Order, l)
	for _, rev := range l.GetRevocations() {
		idt.revocations[rev] = true
		if targ, found := idt.links[rev]; !found {
			idt.G().Log.Warning("Can't revoke signature %s @%s", rev, l.ToDebugString())
		} else {
			targ.markRevoked(l)
		}
	}
}

func (idt *IdentityTable) MarkCheckResult(err ProofError) {
	idt.checkResult = NewNowCheckResult(idt.G(), err)
}

func NewTypedChainLink(cl *ChainLink) (ret TypedChainLink, w Warning) {
	if ret = cl.typed; ret != nil {
		return
	}

	base := GenericChainLink{cl}

	s, err := cl.payloadJSON.AtKey("body").AtKey("type").GetString()
	if len(s) == 0 || err != nil {
		err = fmt.Errorf("No type in signature @%s", base.ToDebugString())
	} else {
		switch s {
		case "eldest":
			ret, err = ParseSelfSigChainLink(base)
		case "web_service_binding":
			ret, err = ParseWebServiceBinding(base)
		case "track":
			ret, err = ParseTrackChainLink(base)
		case "untrack":
			ret, err = ParseUntrackChainLink(base)
		case "cryptocurrency":
			ret, err = ParseCryptocurrencyChainLink(base)
		case "revoke":
			ret, err = ParseRevokeChainLink(base)
		case DelegationTypeSibkey:
			ret, err = ParseSibkeyChainLink(base)
		case DelegationTypeSubkey:
			ret, err = ParseSubkeyChainLink(base)
		case DelegationTypePGPUpdate:
			ret, err = ParsePGPUpdateChainLink(base)
		case "per_user_key":
			ret, err = ParsePerUserKeyChainLink(base)
		case "device":
			ret, err = ParseDeviceChainLink(base)
		default:
			err = fmt.Errorf("Unknown signature type %s @%s", s, base.ToDebugString())
		}
	}

	if err != nil {
		w = ErrorToWarning(err)
		ret = &base
	}

	cl.typed = ret

	// Basically we never fail, since worse comes to worse, we treat
	// unknown signatures as "generic" and can still display them
	return
}

func NewIdentityTable(g *GlobalContext, eldest keybase1.KID, sc *SigChain, h *SigHints) (*IdentityTable, error) {
	ret := &IdentityTable{
		Contextified:     NewContextified(g),
		sigChain:         sc,
		revocations:      make(map[keybase1.SigID]bool),
		links:            make(map[keybase1.SigID]TypedChainLink),
		remoteProofLinks: NewRemoteProofLinks(),
		tracks:           make(map[NormalizedUsername][]*TrackChainLink),
		sigHints:         h,
		eldest:           eldest,
	}
	err := ret.populate()
	return ret, err
}

func (idt *IdentityTable) populate() (err error) {
	defer idt.G().Trace("IdentityTable::populate", func() error { return err })()

	var links []*ChainLink
	if links, err = idt.sigChain.GetCurrentSubchain(idt.eldest); err != nil {
		return err
	}

	for _, link := range links {
		if isBad, reason := link.IsBad(); isBad {
			idt.G().Log.Debug("Ignoring bad chain link with sig ID %s: %s", link.GetSigID(), reason)
			continue
		}
		if link.IsStubbed() {
			continue
		}
		tcl, w := NewTypedChainLink(link)
		tcl.insertIntoTable(idt)
		if w != nil {
			w.Warn(idt.G())
		}
		if link.isOwnNewLinkFromServer {
			link.isOwnNewLinkFromServer = false
			tcl.DoOwnNewLinkFromServerNotifications(idt.G())
		}
	}
	return nil
}

func isProofTypeDefunct(typ keybase1.ProofType) bool {
	return typ == keybase1.ProofType_COINBASE
}

func (idt *IdentityTable) insertRemoteProof(link RemoteProofChainLink) {

	if isProofTypeDefunct(link.GetProofType()) {
		idt.G().Log.Debug("Ignoring now-defunct proof: %s", link.ToDebugString())
		return
	}

	// note that the links in the identity table have no ProofError state.
	idt.remoteProofLinks.Insert(link, nil)
}

func (idt *IdentityTable) VerifySelfSig(nun NormalizedUsername, uid keybase1.UID) bool {
	list := idt.Order
	ln := len(list)
	for i := ln - 1; i >= 0; i-- {
		link := list[i]

		if link.IsRevoked() {
			continue
		}
		if NewNormalizedUsername(link.GetUsername()).Eq(nun) && link.GetUID().Equal(uid) {
			idt.G().Log.Debug("| Found self-signature for %s @%s", string(nun),
				link.ToDebugString())
			return true
		}
	}
	return false
}

func (idt *IdentityTable) GetTrackList() (ret []*TrackChainLink) {
	for _, v := range idt.tracks {
		for i := len(v) - 1; i >= 0; i-- {
			link := v[i]
			if !link.IsRevoked() {
				ret = append(ret, link)
				break
			}
		}
	}
	return
}

func (idt *IdentityTable) TrackChainLinkFor(username NormalizedUsername, uid keybase1.UID) (*TrackChainLink, error) {
	list, found := idt.tracks[username]
	if !found {
		return nil, nil
	}
	for i := len(list) - 1; i >= 0; i-- {
		link := list[i]
		if link.IsRevoked() {
			// noop; continue on!
			continue
		}
		uid2, err := link.GetTrackedUID()
		if err != nil {
			return nil, fmt.Errorf("Bad tracking statement for %s: %s", username, err)
		}
		if uid.NotEqual(uid2) {
			return nil, fmt.Errorf("Bad UID in tracking statement for %s: %s != %s", username, uid, uid2)
		}
		return link, nil
	}
	return nil, nil
}

func (idt *IdentityTable) ActiveCryptocurrency(family CryptocurrencyFamily) *CryptocurrencyChainLink {
	tab := idt.cryptocurrency
	for i := len(tab) - 1; i >= 0; i-- {
		link := tab[i]
		if link.typ.ToCryptocurrencyFamily() == family {
			if link.IsRevoked() {
				return nil
			}
			return link
		}
	}
	return nil
}

func (idt *IdentityTable) AllActiveCryptocurrency() []CryptocurrencyChainLink {
	var ret []CryptocurrencyChainLink
	for _, link := range idt.cryptocurrency {
		if !link.IsRevoked() {
			ret = append(ret, *link)
		}
	}
	return ret
}

func (idt *IdentityTable) GetRevokedCryptocurrencyForTesting() []CryptocurrencyChainLink {
	ret := []CryptocurrencyChainLink{}
	for _, link := range idt.cryptocurrency {
		if link.IsRevoked() {
			ret = append(ret, *link)
		}
	}
	return ret
}

func (idt *IdentityTable) Len() int {
	return len(idt.Order)
}

type CheckCompletedListener interface {
	CCLCheckCompleted(lcr *LinkCheckResult)
}

type IdentifyTableMode int

const (
	IdentifyTableModePassive IdentifyTableMode = iota
	IdentifyTableModeActive  IdentifyTableMode = iota
)

func (idt *IdentityTable) Identify(ctx context.Context, is IdentifyState, forceRemoteCheck bool, ui IdentifyUI, ccl CheckCompletedListener, itm IdentifyTableMode) error {
	errs := make(chan error, len(is.res.ProofChecks))
	for _, lcr := range is.res.ProofChecks {
		go func(l *LinkCheckResult) {
			errs <- idt.identifyActiveProof(ctx, l, is, forceRemoteCheck, ui, ccl, itm)
		}(lcr)
	}

	allAcc := idt.AllActiveCryptocurrency()
	for _, acc := range allAcc {
		if err := acc.Display(ui); err != nil {
			return err
		}
	}

	for i := 0; i < len(is.res.ProofChecks); i++ {
		err := <-errs
		if err != nil {
			return err
		}
	}

	return nil
}

//=========================================================================

func (idt *IdentityTable) identifyActiveProof(ctx context.Context, lcr *LinkCheckResult, is IdentifyState, forceRemoteCheck bool, ui IdentifyUI, ccl CheckCompletedListener, itm IdentifyTableMode) error {
	idt.proofRemoteCheck(ctx, is.HasPreviousTrack(), forceRemoteCheck, lcr, itm)
	if ccl != nil {
		ccl.CCLCheckCompleted(lcr)
	}
	return lcr.link.DisplayCheck(ui, *lcr)
}

type LinkCheckResult struct {
	hint                 *SigHint
	cached               *CheckResult
	err                  ProofError
	snoozedErr           ProofError
	diff                 TrackDiff
	remoteDiff           TrackDiff
	link                 RemoteProofChainLink
	trackedProofState    keybase1.ProofState
	tmpTrackedProofState keybase1.ProofState
	tmpTrackExpireTime   time.Time
	position             int
	torWarning           bool
}

func (l LinkCheckResult) GetDiff() TrackDiff            { return l.diff }
func (l LinkCheckResult) GetError() error               { return l.err }
func (l LinkCheckResult) GetHint() *SigHint             { return l.hint }
func (l LinkCheckResult) GetCached() *CheckResult       { return l.cached }
func (l LinkCheckResult) GetPosition() int              { return l.position }
func (l LinkCheckResult) GetTorWarning() bool           { return l.torWarning }
func (l LinkCheckResult) GetLink() RemoteProofChainLink { return l.link }

// ComputeRemoteDiff takes as input three tracking results: the permanent track,
// the local temporary track, and the one it observed remotely. It favors the
// permanent track but will roll back to the temporary track if needs be.
func (idt *IdentityTable) ComputeRemoteDiff(tracked, trackedTmp, observed keybase1.ProofState) (ret TrackDiff) {
	idt.G().Log.Debug("+ ComputeRemoteDiff(%v,%v,%v)", tracked, trackedTmp, observed)
	if observed == tracked {
		ret = TrackDiffNone{}
	} else if observed == trackedTmp {
		ret = TrackDiffNoneViaTemporary{}
	} else if observed == keybase1.ProofState_OK {
		ret = TrackDiffRemoteWorking{tracked}
	} else if tracked == keybase1.ProofState_OK {
		ret = TrackDiffRemoteFail{observed}
	} else {
		ret = TrackDiffRemoteChanged{tracked, observed}
	}
	idt.G().Log.Debug("- ComputeRemoteDiff(%v,%v,%v) -> (%+v,(%T))", tracked, trackedTmp, observed, ret, ret)
	return ret
}

func (idt *IdentityTable) proofRemoteCheck(ctx context.Context, hasPreviousTrack, forceRemoteCheck bool, res *LinkCheckResult, itm IdentifyTableMode) {
	p := res.link

	idt.G().Log.CDebugf(ctx, "+ RemoteCheckProof %s", p.ToDebugString())
	doCache := false
	pvlHashUsed := PvlKitHash("")
	sid := p.GetSigID()

	defer func() {

		if hasPreviousTrack {
			observedProofState := ProofErrorToState(res.err)
			res.remoteDiff = idt.ComputeRemoteDiff(res.trackedProofState, res.tmpTrackedProofState, observedProofState)

			// If the remote diff only worked out because of the temporary track, then
			// also update the local diff (i.e., the difference between what we tracked
			// and what Keybase is saying) accordingly.
			if _, ok := res.remoteDiff.(TrackDiffNoneViaTemporary); ok {
				res.diff = res.remoteDiff
			}
		}

		if doCache {
			idt.G().Log.CDebugf(ctx, "| Caching results under key=%s pvlHash=%s", sid, pvlHashUsed)
			if cacheErr := idt.G().ProofCache.Put(sid, res.err, pvlHashUsed); cacheErr != nil {
				idt.G().Log.CWarningf(ctx, "proof cache put error: %s", cacheErr)
			}
		}

		idt.G().Log.CDebugf(ctx, "- RemoteCheckProof %s", p.ToDebugString())
	}()

	pvlSource := idt.G().GetPvlSource()
	if pvlSource == nil {
		res.err = NewProofError(keybase1.ProofStatus_MISSING_PVL, "no pvl source for proof verification")
		return
	}
	pvlU, err := pvlSource.GetPVL(ctx)
	if err != nil {
		res.err = NewProofError(keybase1.ProofStatus_MISSING_PVL, "error getting pvl: %s", err)
		return
	}
	pvlHashUsed = pvlU.Hash

	res.hint = idt.sigHints.Lookup(sid)
	if res.hint == nil {
		res.err = NewProofError(keybase1.ProofStatus_NO_HINT, "No server-given hint for sig=%s", sid)
		return
	}

	var pc ProofChecker

	// Call the Global context's version of what a proof checker is. We might want to stub it out
	// for the purposes of testing.
	pc, res.err = MakeProofChecker(idt.G().Services, p)

	if res.err != nil {
		return
	}

	if idt.G().Env.GetTorMode().Enabled() {
		if e := pc.GetTorError(); e != nil {
			res.torWarning = true
		}
	}

	if !forceRemoteCheck {
		res.cached = idt.G().ProofCache.Get(sid, pvlU.Hash)
		idt.G().Log.CDebugf(ctx, "| Proof cache lookup for %s: %+v", sid, res.cached)
		if res.cached != nil && res.cached.Freshness() == keybase1.CheckResultFreshness_FRESH {
			res.err = res.cached.Status
			idt.G().Log.CDebugf(ctx, "| Early exit after proofCache hit for %s", sid)
			return
		}
	}

	// From this point on in the function, we'll be putting our results into
	// cache (in the defer above).
	doCache = true

	// ProofCheckerModeActive or Passive mainly decides whether we need to reach out to
	// self-hosted services. We want to avoid so doing when the user is acting passively
	// (such as when receiving a message).
	pcm := ProofCheckerModePassive
	if (hasPreviousTrack && res.trackedProofState != keybase1.ProofState_NONE && res.trackedProofState != keybase1.ProofState_UNCHECKED) || itm == IdentifyTableModeActive {
		pcm = ProofCheckerModeActive
	}
	res.err = pc.CheckStatus(idt.G().CloneWithNetContext(ctx), *res.hint, pcm, pvlU)

	// If no error than all good
	if res.err == nil {
		return
	}

	// If the error was soft, and we had a cached successful result that wasn't rancid,
	// then it's OK to stifle the error message for now.  We just have to be certain
	// not to cache it.
	if ProofErrorIsSoft(res.err) && res.cached != nil && res.cached.Status == nil &&
		res.cached.Freshness() != keybase1.CheckResultFreshness_RANCID {
		idt.G().Log.CDebugf(ctx, "| Got soft error (%s) but returning success (last seen at %s)",
			res.err.Error(), res.cached.Time)
		res.snoozedErr = res.err
		res.err = nil
		doCache = false
		return
	}

	idt.G().Log.CDebugf(ctx, "| Check status (%s) failed with error: %s", p.ToDebugString(), res.err.Error())

	return
}
