package libkb

import (
	"fmt"
	"strings"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

type TypedChainLink interface {
	GetRevocations() []keybase1.SigID
	GetRevokeKids() []KID
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
	GetPgpFingerprint() *PgpFingerprint
	GetKid() KID
	GetFOKID() FOKID
	IsInCurrentFamily(u *User) bool
	GetUsername() string
	MarkChecked(ProofError)
	GetProofState() keybase1.ProofState
	GetUID() keybase1.UID
	GetDelegatedKid() KID
	GetParentKid() KID
	VerifyReverseSig(kf *KeyFamily) error
	GetMerkleSeqno() int
	GetDevice() *Device
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

func (g *GenericChainLink) GetDelegatedKid() KID                 { return nil }
func (g *GenericChainLink) GetParentKid() KID                    { return nil }
func (g *GenericChainLink) VerifyReverseSig(kf *KeyFamily) error { return nil }
func (g *GenericChainLink) IsRevocationIsh() bool                { return false }
func (g *GenericChainLink) GetRole() KeyRole                     { return DLG_NONE }
func (g *GenericChainLink) IsRevoked() bool                      { return g.revoked }
func (g *GenericChainLink) GetSeqno() Seqno                      { return g.unpacked.seqno }
func (g *GenericChainLink) GetPgpFingerprint() *PgpFingerprint {
	return g.unpacked.pgpFingerprint
}

func (g *GenericChainLink) GetArmoredSig() string {
	return g.unpacked.sig
}
func (g *GenericChainLink) GetUsername() string {
	return g.unpacked.username
}
func (g *GenericChainLink) GetUID() keybase1.UID {
	return g.unpacked.uid
}
func (g *GenericChainLink) GetProofState() keybase1.ProofState { return g.GetProofState0() }

func (g *GenericChainLink) GetDevice() *Device { return nil }

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
	DisplayCheck(ui IdentifyUI, lcr LinkCheckResult)
	ToTrackingStatement() (*jsonw.Wrapper, error)
	CheckDataJson() *jsonw.Wrapper
	ToIdString() string
	ToKeyValuePair() (string, string)
	ComputeTrackDiff(tl *TrackLookup) TrackDiff
	GetProofType() keybase1.ProofType
	ProofText() string
}

type RemoteProofList []RemoteProofChainLink

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

func (w *WebProofChainLink) ToTrackingStatement() (*jsonw.Wrapper, error) {
	ret := w.BaseToTrackingStatement()
	err := remoteProofToTrackingStatement(w, ret)
	if err != nil {
		ret = nil
	}
	return ret, err
}

func (w *WebProofChainLink) DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) {
	ui.FinishWebProofCheck(ExportRemoteProof(w), lcr.Export())
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

func (w *WebProofChainLink) CheckDataJson() *jsonw.Wrapper {
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
func (w *WebProofChainLink) ToIdString() string { return w.ToDisplayString() }
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
func (s *SocialProofChainLink) ToIdString() string        { return s.ToDisplayString() }
func (s *SocialProofChainLink) ToKeyValuePair() (string, string) {
	return s.service, s.username
}
func (s *SocialProofChainLink) GetService() string { return s.service }

func NewWebProofChainLink(b GenericChainLink, p, h, proofText string) *WebProofChainLink {
	return &WebProofChainLink{b, p, h, proofText}
}
func NewSocialProofChainLink(b GenericChainLink, s, u, proofText string) *SocialProofChainLink {
	return &SocialProofChainLink{b, s, u, proofText}
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

func (s *SocialProofChainLink) DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) {
	ui.FinishSocialProofCheck(ExportRemoteProof(s), lcr.Export())
}

func (s *SocialProofChainLink) CheckDataJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("username", jsonw.NewString(s.username))
	ret.SetKey("name", jsonw.NewString(s.service))
	return ret
}

func (s *SocialProofChainLink) GetProofType() keybase1.ProofType {
	ret, found := REMOTE_SERVICE_TYPES[s.service]
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
}

func (sb ServiceBlock) GetProofState() keybase1.ProofState { return sb.proofState }

func (sb ServiceBlock) IsSocial() bool { return sb.social }

func (sb ServiceBlock) ToIdString() string {
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

func ParseServiceBlock(jw *jsonw.Wrapper) (sb *ServiceBlock, err error) {
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
	sb = &ServiceBlock{social: social, typ: typ, id: id}
	return
}

// To be used for signatures in a user's signature chain.
func ParseWebServiceBinding(base GenericChainLink) (ret RemoteProofChainLink, e error) {
	jw := base.payloadJson.AtKey("body").AtKey("service")

	var sptf string
	ptf := base.packed.AtKey("proof_text_full")
	if !ptf.IsNil() {
		var err error
		sptf, err = ptf.GetString()
		if err == nil {
			G.Log.Debug("Found proof_text_full: %s", sptf)
		}
	}

	if jw.IsNil() {
		ret, e = ParseSelfSigChainLink(base)
	} else if sb, err := ParseServiceBlock(jw); err != nil {
		e = fmt.Errorf("%s @%s", err.Error(), base.ToDebugString())
	} else if sb.social {
		ret = NewSocialProofChainLink(base, sb.typ, sb.id, sptf)
	} else {
		ret = NewWebProofChainLink(base, sb.typ, sb.id, sptf)
	}

	return
}

func remoteProofInsertIntoTable(l RemoteProofChainLink, tab *IdentityTable) {
	tab.insertLink(l)
	if k := l.TableKey(); len(k) > 0 {
		tab.remoteProofs[k] = append(tab.remoteProofs[k], l)
	}
}

//
//=========================================================================

//=========================================================================
// TrackChainLink
//
type TrackChainLink struct {
	GenericChainLink
	whom    string
	untrack *UntrackChainLink
	local   bool
}

func (l TrackChainLink) IsRemote() bool {
	return !l.local
}

func ParseTrackChainLink(b GenericChainLink) (ret *TrackChainLink, err error) {
	var whom string
	whom, err = b.payloadJson.AtPath("body.track.basics.username").GetString()
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err.Error())
	} else {
		ret = &TrackChainLink{b, whom, nil, false}
	}
	return
}

func (l *TrackChainLink) Type() string { return "track" }

func (l *TrackChainLink) ToDisplayString() string {
	return l.whom
}

func (l *TrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
	tab.tracks[l.whom] = append(tab.tracks[l.whom], l)
}

func (l *TrackChainLink) GetTrackedFOKID() (ret FOKID) {
	jw := l.payloadJson.AtPath("body.track.key")
	ret.Fp, _ = GetPgpFingerprint(jw.AtKey("key_fingerprint"))
	ret.Kid, _ = GetKID(jw.AtKey("kid"))
	return
}

func (l *TrackChainLink) GetTrackedPGPFingerprints() ([]PgpFingerprint, error) {
	// presumably order is important, so we'll only use the map as a set
	// to deduplicate keys.
	set := make(map[PgpFingerprint]bool)

	var res []PgpFingerprint

	fk := l.GetTrackedFOKID()
	if fk.Fp != nil {
		res = append(res, *fk.Fp)
		set[*fk.Fp] = true
	}

	jw := l.payloadJson.AtPath("body.track.pgp_keys")
	if jw.IsNil() {
		return res, nil
	}

	n, err := jw.Len()
	if err != nil {
		return nil, err
	}
	for i := 0; i < n; i++ {
		fp, err := GetPgpFingerprint(jw.AtIndex(i).AtKey("key_fingerprint"))
		if err != nil {
			return nil, err
		}
		if fp != nil && !set[*fp] {
			res = append(res, *fp)
			set[*fp] = true
		}
	}
	return res, nil
}

func (l *TrackChainLink) GetTrackedPGPFOKIDs() ([]FOKID, error) {
	// presumably order is important, so we'll only use the map as a set
	// to deduplicate keys.
	set := make(map[PgpFingerprint]bool)

	var res []FOKID

	fk := l.GetTrackedFOKID()
	if fk.Fp != nil {
		res = append(res, fk)
		set[*fk.Fp] = true
	}

	jw := l.payloadJson.AtPath("body.track.pgp_keys")
	if jw.IsNil() {
		return res, nil
	}

	n, err := jw.Len()
	if err != nil {
		return nil, err
	}
	for i := 0; i < n; i++ {
		fp, err := GetPgpFingerprint(jw.AtIndex(i).AtKey("key_fingerprint"))
		if err != nil {
			return nil, err
		}
		// it might not exist:
		kid, _ := GetKID(jw.AtIndex(i).AtKey("kid"))
		if fp != nil && !set[*fp] {
			res = append(res, FOKID{Fp: fp, Kid: kid})
			set[*fp] = true
		}
	}
	return res, nil
}

func (l *TrackChainLink) GetTrackedUid() (keybase1.UID, error) {
	return GetUID(l.payloadJson.AtPath("body.track.id"))
}

func (l *TrackChainLink) GetTrackedUsername() (string, error) {
	return l.payloadJson.AtPath("body.track.basics.username").GetString()
}

func (l *TrackChainLink) IsRevoked() bool {
	return l.revoked || l.untrack != nil
}

func (l *TrackChainLink) RemoteKeyProofs() *jsonw.Wrapper {
	return l.payloadJson.AtPath("body.track.remote_proofs")
}

func (l *TrackChainLink) ToServiceBlocks() (ret []*ServiceBlock) {
	w := l.RemoteKeyProofs()
	ln, err := w.Len()
	if err != nil {
		return
	}
	for i := 0; i < ln; i++ {
		proof := w.AtIndex(i).AtKey("remote_key_proof")
		if i, e := proof.AtKey("state").GetInt(); e != nil {
			G.Log.Warning("Bad 'state' in track statement: %s", e.Error())
		} else if sb, e := ParseServiceBlock(proof.AtKey("check_data_json")); e != nil {
			G.Log.Warning("Bad remote_key_proof.check_data_json: %s", e.Error())
		} else {
			sb.proofState = keybase1.ProofState(i)
			if sb.proofState != keybase1.ProofState_OK {
				G.Log.Debug("Including broken proof at index = %d\n", i)
			}
			ret = append(ret, sb)
		}
	}
	return
}

//
//=========================================================================

//=========================================================================
// SibkeyChainLink
//

type SibkeyChainLink struct {
	GenericChainLink
	kid        KID
	device     *Device
	reverseSig string
}

func ParseSibkeyChainLink(b GenericChainLink) (ret *SibkeyChainLink, err error) {
	var kid KID
	var device *Device

	if kid, err = GetKID(b.payloadJson.AtPath("body.sibkey.kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Bad sibkey statement @%s: %s", b.ToDebugString(), err.Error())}
		return
	}

	var rs string
	if rs, err = b.payloadJson.AtPath("body.sibkey.reverse_sig").GetString(); err != nil {
		err = ChainLinkError{fmt.Sprintf("Missing reverse_sig in sibkey delegation: @%s: %s",
			b.ToDebugString(), err.Error())}
		return
	}

	if jw := b.payloadJson.AtPath("body.device"); !jw.IsNil() {
		if device, err = ParseDevice(jw); err != nil {
			return
		}
	}

	ret = &SibkeyChainLink{b, kid, device, rs}
	return
}

func (s *SibkeyChainLink) GetDelegatedKid() KID    { return s.kid }
func (s *SibkeyChainLink) GetRole() KeyRole        { return DLG_SIBKEY }
func (s *SibkeyChainLink) Type() string            { return SIBKEY_TYPE }
func (s *SibkeyChainLink) ToDisplayString() string { return s.kid.String() }
func (s *SibkeyChainLink) GetDevice() *Device      { return s.device }
func (s *SibkeyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(s)
}

//-------------------------------------

func (s *SibkeyChainLink) VerifyReverseSig(kf *KeyFamily) (err error) {
	var key GenericKey

	if len(s.reverseSig) == 0 {
		G.Log.Warning("!! Sibkey delegations without reverse sigs are soon to be retired!!")
		G.Log.Warning("!! We're leaving them on for now for testing purposes!!")
		G.Log.Warning("!! SibkeyChainLink: %s (device: %+v)", s.ToDisplayString(), s.device)
		return
	}

	if key, err = kf.FindKeyWithKIDUnsafe(s.GetDelegatedKid()); err != nil {
		return err
	}

	var p1, p2 []byte
	if p1, _, err = key.VerifyStringAndExtract(s.reverseSig); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to verify/extract sig: %s", err.Error())}
		return
	}

	if p1, err = jsonw.Canonicalize(p1); err != nil {
		err = ReverseSigError{fmt.Sprintf("Failed to canonicalize json: %s", err.Error())}
		return
	}

	// Null-out the reverse sig on the parent
	path := "body.sibkey.reverse_sig"
	s.payloadJson.SetValueAtPath(path, jsonw.NewNil())
	if p2, err = s.payloadJson.Marshal(); err != nil {
		err = ReverseSigError{fmt.Sprintf("Can't remarshal JSON statement: %s", err.Error())}
		return
	}

	eq := FastByteArrayEq(p1, p2)
	s.payloadJson.SetValueAtPath(path, jsonw.NewString(s.reverseSig))

	if !eq {
		err = ReverseSigError{fmt.Sprintf("JSON mismatch: %s != %s",
			string(p1), string(p2))}
		return
	}
	return
}

//
//=========================================================================
// SubkeyChainLink

type SubkeyChainLink struct {
	GenericChainLink
	kid       KID
	parentKid KID
}

func ParseSubkeyChainLink(b GenericChainLink) (ret *SubkeyChainLink, err error) {
	var kid, pkid KID
	if kid, err = GetKID(b.payloadJson.AtPath("body.subkey.kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get KID for subkey @%s: %s", b.ToDebugString(), err.Error())}
	} else if pkid, err = GetKID(b.payloadJson.AtPath("body.subkey.parent_kid")); err != nil {
		err = ChainLinkError{fmt.Sprintf("Can't get parent_kid for subkey @%s: %s", b.ToDebugString(), err.Error())}
	} else {
		ret = &SubkeyChainLink{b, kid, pkid}
	}
	return
}

func (s *SubkeyChainLink) Type() string            { return SUBKEY_TYPE }
func (s *SubkeyChainLink) ToDisplayString() string { return s.kid.String() }
func (s *SubkeyChainLink) GetRole() KeyRole        { return DLG_SUBKEY }
func (s *SubkeyChainLink) GetDelegatedKid() KID    { return s.kid }
func (s *SubkeyChainLink) GetParentKid() KID       { return s.parentKid }
func (s *SubkeyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(s)
}

//
//=========================================================================
//

type DeviceChainLink struct {
	GenericChainLink
	device *Device
}

func ParseDeviceChainLink(b GenericChainLink) (ret *DeviceChainLink, err error) {
	var dobj *Device
	if dobj, err = ParseDevice(b.payloadJson.AtPath("body.device")); err != nil {
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
	whom string
}

func ParseUntrackChainLink(b GenericChainLink) (ret *UntrackChainLink, err error) {
	var whom string
	whom, err = b.payloadJson.AtPath("body.untrack.basics.username").GetString()
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err.Error())
	} else {
		ret = &UntrackChainLink{b, whom}
	}
	return
}

func (u *UntrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(u)
	if list, found := tab.tracks[u.whom]; !found {
		G.Log.Notice("Bad untrack of %s; no previous tracking statement found",
			u.whom)
	} else {
		for _, obj := range list {
			obj.untrack = u
		}
	}
}

func (u *UntrackChainLink) ToDisplayString() string {
	return u.whom
}

func (u *UntrackChainLink) Type() string { return "untrack" }

func (u *UntrackChainLink) IsRevocationIsh() bool { return true }

//
//=========================================================================

//=========================================================================
// CryptocurrencyChainLink

type CryptocurrencyChainLink struct {
	GenericChainLink
	pkhash  []byte
	address string
}

func (c CryptocurrencyChainLink) GetAddress() string {
	return c.address
}

func ParseCryptocurrencyChainLink(b GenericChainLink) (
	cl *CryptocurrencyChainLink, err error) {

	jw := b.payloadJson.AtPath("body.cryptocurrency")
	var typ, addr string
	var pkhash []byte

	jw.AtKey("type").GetStringVoid(&typ, &err)
	jw.AtKey("address").GetStringVoid(&addr, &err)

	if err != nil {
		return
	}

	if typ != "bitcoin" {
		err = fmt.Errorf("Can only handle 'bitcoin' addresses for now; got %s", typ)
		return
	}

	_, pkhash, err = BtcAddrCheck(addr, nil)
	if err != nil {
		err = fmt.Errorf("At signature %s: %s", b.ToDebugString(), err.Error())
		return
	}
	cl = &CryptocurrencyChainLink{b, pkhash, addr}
	return
}

func (c *CryptocurrencyChainLink) Type() string { return "cryptocurrency" }

func (c *CryptocurrencyChainLink) ToDisplayString() string { return c.address }

func (c *CryptocurrencyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(c)
	tab.cryptocurrency = append(tab.cryptocurrency, c)
}

func (c CryptocurrencyChainLink) Display(ui IdentifyUI) {
	ui.DisplayCryptocurrency(c.Export())
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
	if jw := b.payloadJson.AtPath("body.device"); !jw.IsNil() {
		if device, err = ParseDevice(jw); err != nil {
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

func (s *SelfSigChainLink) DisplayCheck(ui IdentifyUI, lcr LinkCheckResult) {}

func (s *SelfSigChainLink) CheckDataJson() *jsonw.Wrapper { return nil }

func (s *SelfSigChainLink) ToTrackingStatement() (*jsonw.Wrapper, error) {
	return nil, nil
}

func (s *SelfSigChainLink) ToIdString() string { return s.GetUsername() }
func (s *SelfSigChainLink) ToKeyValuePair() (string, string) {
	return s.TableKey(), s.GetUsername()
}

func (s *SelfSigChainLink) ComputeTrackDiff(tl *TrackLookup) TrackDiff { return nil }

func (s *SelfSigChainLink) GetProofType() keybase1.ProofType { return keybase1.ProofType_KEYBASE }

func (s *SelfSigChainLink) ParseDevice() (err error) {
	if jw := s.payloadJson.AtPath("body.device"); !jw.IsNil() {
		s.device, err = ParseDevice(jw)
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
	sigChain       *SigChain
	revocations    map[keybase1.SigID]bool
	links          map[keybase1.SigID]TypedChainLink
	remoteProofs   map[string][]RemoteProofChainLink
	tracks         map[string][]*TrackChainLink
	Order          []TypedChainLink
	sigHints       *SigHints
	activeProofs   []RemoteProofChainLink
	cryptocurrency []*CryptocurrencyChainLink
	checkResult    *CheckResult
	eldest         FOKID
}

func (idt *IdentityTable) AllActiveProofs() []RemoteProofChainLink {
	return idt.activeProofs
}

func (idt *IdentityTable) GetActiveProofsFor(st ServiceType) (ret []RemoteProofChainLink) {
	for _, k := range st.AllStringKeys() {
		for _, l := range idt.remoteProofs[k] {
			if !l.IsRevoked() {
				ret = append(ret, l)
				if l.LastWriterWins() {
					break
				}
			}
		}
	}
	return
}

func (idt *IdentityTable) GetTrackMap() map[string][]*TrackChainLink {
	return idt.tracks
}

func (idt *IdentityTable) insertLink(l TypedChainLink) {
	idt.links[l.GetSigID()] = l
	idt.Order = append(idt.Order, l)
	for _, rev := range l.GetRevocations() {
		idt.revocations[rev] = true
		if targ, found := idt.links[rev]; !found {
			G.Log.Warning("Can't revoke signature %s @%s", rev, l.ToDebugString())
		} else {
			targ.markRevoked(l)
		}
	}
}

func (idt *IdentityTable) MarkCheckResult(err ProofError) {
	idt.checkResult = NewNowCheckResult(err)
}

func NewTypedChainLink(cl *ChainLink) (ret TypedChainLink, w Warning) {

	if ret = cl.typed; ret != nil {
		return
	}

	base := GenericChainLink{cl}

	s, err := cl.payloadJson.AtKey("body").AtKey("type").GetString()
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
		case SIBKEY_TYPE:
			ret, err = ParseSibkeyChainLink(base)
		case SUBKEY_TYPE:
			ret, err = ParseSubkeyChainLink(base)
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

func NewIdentityTable(eldest FOKID, sc *SigChain, h *SigHints) *IdentityTable {
	ret := &IdentityTable{
		sigChain:     sc,
		revocations:  make(map[keybase1.SigID]bool),
		links:        make(map[keybase1.SigID]TypedChainLink),
		remoteProofs: make(map[string][]RemoteProofChainLink),
		tracks:       make(map[string][]*TrackChainLink),
		sigHints:     h,
		eldest:       eldest,
	}
	ret.populate()
	ret.collectAndDedupeActiveProofs()
	return ret
}

func (idt *IdentityTable) populate() {
	G.Log.Debug("+ Populate ID Table")
	for _, link := range idt.sigChain.LimitToEldestFOKID(idt.eldest) {
		tl, w := NewTypedChainLink(link)
		tl.insertIntoTable(idt)
		if w != nil {
			w.Warn()
		}
	}
	G.Log.Debug("- Populate ID Table")
}

func (idt *IdentityTable) VerifySelfSig(s string, uid keybase1.UID) bool {
	list := idt.Order
	ln := len(list)
	for i := ln - 1; i >= 0; i-- {
		link := list[i]

		if link.IsRevoked() {
			continue
		}
		if link.GetUsername() == s && link.GetUID().Equal(uid) {
			G.Log.Debug("| Found self-signature for %s @%s", s,
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

func (idt *IdentityTable) GetTrackingStatementFor(s string, uid keybase1.UID) (
	ret *TrackChainLink, err error) {
	if list, found := idt.tracks[s]; found {
		l := len(list)
		for i := l - 1; i >= 0 && ret == nil && err == nil; i-- {
			link := list[i]
			if link.IsRevoked() {
				// noop; continue on!
			} else if uid2, e2 := link.GetTrackedUid(); e2 != nil {
				err = fmt.Errorf("Bad tracking statement for %s: %s", s, e2.Error())
			} else if uid.NotEqual(uid2) {
				err = fmt.Errorf("Bad UID in tracking statement for %s: %s != %s", s, uid, uid2)
			} else {
				ret = link
			}
		}
	}
	return
}

func (idt *IdentityTable) ActiveCryptocurrency() *CryptocurrencyChainLink {
	var ret *CryptocurrencyChainLink
	tab := idt.cryptocurrency
	if len(tab) > 0 {
		last := tab[len(tab)-1]
		if !last.IsRevoked() {
			ret = last
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

func (idt *IdentityTable) collectAndDedupeActiveProofs() {
	seen := make(map[string]bool)
	tab := idt.activeProofs
	for _, list := range idt.remoteProofs {
		for i := len(list) - 1; i >= 0; i-- {
			link := list[i]
			if link.IsRevoked() {
				continue
			}

			// We only want to use the last proof in the list
			// if we have several (like for dns://chriscoyne.com)
			id := link.ToDisplayString()
			_, found := seen[id]
			if !found {
				tab = append(tab, link)
				seen[id] = true
			}

			// Things like Twitter, Github, etc, are last-writer wins.
			// Things like dns/https can have multiples
			if link.LastWriterWins() {
				break
			}
		}
	}
	idt.activeProofs = tab
}

func (idt *IdentityTable) Len() int {
	return len(idt.Order)
}

func (idt *IdentityTable) Identify(is IdentifyState, ui IdentifyUI) {

	var wg sync.WaitGroup
	for _, lcr := range is.res.ProofChecks {
		wg.Add(1)
		go func(l *LinkCheckResult) {
			defer wg.Done()
			idt.identifyActiveProof(l, is, ui)
		}(lcr)
	}

	// wait for all goroutines to complete before exiting
	wg.Wait()

	if acc := idt.ActiveCryptocurrency(); acc != nil {
		acc.Display(ui)
	}
}

//=========================================================================

func (idt *IdentityTable) identifyActiveProof(lcr *LinkCheckResult, is IdentifyState, ui IdentifyUI) {
	idt.proofRemoteCheck((is.Track != nil), lcr)
	lcr.link.DisplayCheck(ui, *lcr)
}

type LinkCheckResult struct {
	hint              *SigHint
	cached            *CheckResult
	err               ProofError
	diff              TrackDiff
	remoteDiff        TrackDiff
	link              RemoteProofChainLink
	trackedProofState keybase1.ProofState
	position          int
}

func (l LinkCheckResult) GetDiff() TrackDiff      { return l.diff }
func (l LinkCheckResult) GetError() error         { return l.err }
func (l LinkCheckResult) GetHint() *SigHint       { return l.hint }
func (l LinkCheckResult) GetCached() *CheckResult { return l.cached }
func (l LinkCheckResult) GetPosition() int        { return l.position }

func ComputeRemoteDiff(tracked, observed keybase1.ProofState) TrackDiff {
	if observed == tracked {
		return TrackDiffNone{}
	} else if observed == keybase1.ProofState_OK {
		return TrackDiffRemoteFail{observed}
	} else if tracked == keybase1.ProofState_OK {
		return TrackDiffRemoteWorking{tracked}
	}
	return TrackDiffRemoteChanged{tracked, observed}
}

func (idt *IdentityTable) proofRemoteCheck(hasPreviousTrack bool, res *LinkCheckResult) {

	p := res.link

	G.Log.Debug("+ RemoteCheckProof %s", p.ToDebugString())
	defer func() {
		if hasPreviousTrack {
			observedProofState := ProofErrorToState(res.err)
			res.remoteDiff = ComputeRemoteDiff(res.trackedProofState, observedProofState)
		}
		G.Log.Debug("- RemoteCheckProof %s", p.ToDebugString())
	}()

	sid := p.GetSigID()
	res.hint = idt.sigHints.Lookup(sid)
	if res.hint == nil {
		res.err = NewProofError(keybase1.ProofStatus_NO_HINT, "No server-given hint for sig=%s", sid)
		return
	}

	if G.ProofCache != nil {
		if res.cached = G.ProofCache.Get(sid); res.cached != nil {
			res.err = res.cached.Status
			p.MarkChecked(res.err)
			return
		}
	}

	var pc ProofChecker
	pc, res.err = NewProofChecker(p)

	if res.err != nil {
		return
	}

	res.err = pc.CheckHint(*res.hint)
	if res.err == nil {
		res.err = pc.CheckStatus(*res.hint)
	}

	p.MarkChecked(res.err)
	if G.ProofCache != nil {
		G.ProofCache.Put(sid, res.err)
	}

	return
}

func (idt *IdentityTable) MakeTrackSet() *TrackSet {
	ret := NewTrackSet()
	for _, ap := range idt.activeProofs {
		ret.Add(ap)
	}
	return ret
}
