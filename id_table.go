package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
	"strings"
	"time"
)

type TypedChainLink interface {
	GetRevocations() []*SigId
	insertIntoTable(tab *IdentityTable)
	GetSigId() SigId
	GetArmoredSig() string
	markRevoked(l TypedChainLink)
	ToDebugString() string
	Type() string
	ToDisplayString() string
	IsRevocationIsh() bool
	IsRevoked() bool
	IsActiveKey() bool
	GetSeqno() Seqno
	GetCTime() time.Time
	GetPgpFingerprint() PgpFingerprint
	GetUsername() string
	MarkChecked(ProofError)
	GetProofStateTCL() int
	GetUID() UID
}

//=========================================================================
// GenericChainLink
//

type GenericChainLink struct {
	*ChainLink
}

func (b *GenericChainLink) GetSigId() SigId {
	return b.unpacked.sigId
}
func (b *GenericChainLink) Type() string            { return "generic" }
func (b *GenericChainLink) ToDisplayString() string { return "unknown" }
func (b *GenericChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(b)
}
func (b *GenericChainLink) markRevoked(r TypedChainLink) {
	b.revoked = true
}
func (b *GenericChainLink) ToDebugString() string {
	return fmt.Sprintf("uid=%s, seq=%d, link=%s",
		string(b.parent.uid), b.unpacked.seqno, b.id.ToString())
}

func (g *GenericChainLink) IsRevocationIsh() bool { return false }
func (g *GenericChainLink) IsRevoked() bool       { return g.revoked }
func (g *GenericChainLink) IsActiveKey() bool     { return g.activeKey }
func (g *GenericChainLink) GetSeqno() Seqno       { return g.unpacked.seqno }
func (g *GenericChainLink) GetPgpFingerprint() PgpFingerprint {
	return g.unpacked.pgpFingerprint
}

func (g *GenericChainLink) GetCTime() time.Time {
	return time.Unix(int64(g.unpacked.ctime), 0)
}
func (g *GenericChainLink) GetArmoredSig() string {
	return g.unpacked.sig
}
func (g *GenericChainLink) GetUsername() string {
	return g.unpacked.username
}
func (g *GenericChainLink) GetUID() UID {
	return g.unpacked.uid
}
func (g *GenericChainLink) GetProofStateTCL() int { return g.GetProofState() }

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
	DisplayCheck(lcr LinkCheckResult, is IdentifyState)
	ToTrackingStatement() (*jsonw.Wrapper, error)
	CheckDataJson() *jsonw.Wrapper
	ToIdString() string
	ToKeyValuePair() (string, string)
	ComputeTrackDiff(tl *TrackLookup) TrackDiff
}

type WebProofChainLink struct {
	GenericChainLink
	protocol string
	hostname string
}

type SocialProofChainLink struct {
	GenericChainLink
	service  string
	username string
}

func (w *WebProofChainLink) TableKey() string {
	if w.protocol == "https" {
		return "http"
	} else {
		return w.protocol
	}
}

func (s *WebProofChainLink) ToTrackingStatement() (*jsonw.Wrapper, error) {
	ret := s.BaseToTrackingStatement()
	err := remoteProofToTrackingStatement(s, ret)
	if err != nil {
		ret = nil
	}
	return ret, err
}

func (s *WebProofChainLink) DisplayCheck(lcr LinkCheckResult, is IdentifyState) {
	var msg, lcrs string

	if lcr.diff != nil {
		lcrs = lcr.diff.ToDisplayString() + " "
	}

	if lcr.err == nil {
		if s.protocol == "dns" {
			msg += (CHECK + " " + lcrs + "admin of DNS zone " +
				ColorString("green", s.hostname) +
				": found TXT entry " + lcr.hint.checkText)
		} else {
			var color string
			if s.protocol == "https" {
				color = "green"
			} else {
				color = "yellow"
			}
			msg += (CHECK + " " + lcrs + "admin of " +
				ColorString(color, s.hostname) + " via " +
				ColorString(color, strings.ToUpper(s.protocol)) +
				": " + lcr.hint.humanUrl)
		}
	} else {
		msg = (BADX + " " + lcrs +
			ColorString("red", "Proof for "+s.ToDisplayString()+" "+
				ColorString("bold", "failed")+": "+
				lcr.err.Error()))
	}

	if lcr.cached != nil {
		msg += " " + ColorString("magenta", lcr.cached.ToDisplayString())
	}
	is.Report(msg)
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

func (s *WebProofChainLink) CheckDataJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	if s.protocol == "dns" {
		ret.SetKey("protocol", jsonw.NewString(s.protocol))
		ret.SetKey("domain", jsonw.NewString(s.hostname))

	} else {
		ret.SetKey("protocol", jsonw.NewString(s.protocol+":"))
		ret.SetKey("hostname", jsonw.NewString(s.hostname))
	}
	return ret
}
func (s *WebProofChainLink) ToIdString() string { return s.ToDisplayString() }
func (s *WebProofChainLink) ToKeyValuePair() (string, string) {
	return s.GetProtocol(), s.GetHostname()
}

func (s *WebProofChainLink) ComputeTrackDiff(tl *TrackLookup) TrackDiff {
	find := func(list []string) bool {
		for _, e := range list {
			if cicmp(e, s.hostname) {
				return true
			}
		}
		return false
	}
	if find(tl.ids[s.protocol]) {
		return TrackDiffNone{}
	} else if s.protocol == "https" && find(tl.ids["http"]) {
		return TrackDiffUpgraded{"http", "https"}
	} else {
		return TrackDiffMissing{}
	}
}

func (s *SocialProofChainLink) TableKey() string { return s.service }
func (s *SocialProofChainLink) Type() string     { return "proof" }
func (s *SocialProofChainLink) insertIntoTable(tab *IdentityTable) {
	remoteProofInsertIntoTable(s, tab)
}
func (w *SocialProofChainLink) ToDisplayString() string {
	return w.username + "@" + w.service
}
func (s *SocialProofChainLink) LastWriterWins() bool      { return true }
func (s *SocialProofChainLink) GetRemoteUsername() string { return s.username }
func (w *SocialProofChainLink) GetHostname() string       { return "" }
func (w *SocialProofChainLink) GetProtocol() string       { return "" }
func (s *SocialProofChainLink) ToIdString() string        { return s.ToDisplayString() }
func (s *SocialProofChainLink) ToKeyValuePair() (string, string) {
	return s.service, s.username
}

func NewWebProofChainLink(b GenericChainLink, p, h string) *WebProofChainLink {
	return &WebProofChainLink{b, p, h}
}
func NewSocialProofChainLink(b GenericChainLink, s, u string) *SocialProofChainLink {
	return &SocialProofChainLink{b, s, u}
}

func (s *SocialProofChainLink) ComputeTrackDiff(tl *TrackLookup) TrackDiff {
	k, v := s.ToKeyValuePair()
	if list, found := tl.ids[k]; !found || len(list) == 0 {
		return TrackDiffMissing{}
	} else if expected := list[len(list)-1]; !cicmp(expected, v) {
		return TrackDiffClash{expected, v}
	} else {
		return TrackDiffNone{}
	}
}

func (s *SocialProofChainLink) DisplayCheck(lcr LinkCheckResult, is IdentifyState) {

	var msg, lcrs string

	if lcr.diff != nil {
		lcrs = lcr.diff.ToDisplayString() + " "
	}

	if lcr.err == nil {
		msg += (CHECK + " " + lcrs + `"` +
			ColorString("green", s.username) + `" on ` + s.service +
			": " + lcr.hint.humanUrl)
	} else {
		msg += (BADX + " " + lcrs +
			ColorString("red", `"`+s.username+`" on `+s.service+" "+
				ColorString("bold", "failed")+": "+
				lcr.err.Error()))
	}
	if lcr.cached != nil {
		msg += " " + ColorString("magenta", lcr.cached.ToDisplayString())
	}
	is.Report(msg)
}

func (s *SocialProofChainLink) CheckDataJson() *jsonw.Wrapper {
	ret := jsonw.NewDictionary()
	ret.SetKey("username", jsonw.NewString(s.username))
	ret.SetKey("name", jsonw.NewString(s.service))
	return ret
}

//=========================================================================

// Can be used to either parse a proof `service` JSON block, or a
// `remote_key_proof` JSON block in a tracking statement.
type ServiceBlock struct {
	social bool
	typ    string
	id     string
}

func (sb ServiceBlock) ToIdString() string {
	if sb.social {
		return sb.id + "@" + sb.typ
	} else {
		return sb.typ + "://" + sb.id
	}
}

func (sb ServiceBlock) ToKeyValuePair() (string, string) {
	return sb.typ, sb.id
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
		err = fmt.Errorf("Unrecognized Web proof: %s @%s", jw.MarshalToDebug())
	}
	sb = &ServiceBlock{social, typ, id}
	return
}

// To be used for signatures in a user's signature chain.
func ParseWebServiceBinding(base GenericChainLink) (ret RemoteProofChainLink, e error) {

	jw := base.payloadJson.AtKey("body").AtKey("service")

	if jw.IsNil() {
		ret = &SelfSigChainLink{base}
	} else if sb, err := ParseServiceBlock(jw); err != nil {
		e = fmt.Errorf("%s @%s", err.Error(), base.ToDebugString())
	} else if sb.social {
		ret = NewSocialProofChainLink(base, sb.typ, sb.id)
	} else {
		ret = NewWebProofChainLink(base, sb.typ, sb.id)
	}
	return
}

func remoteProofInsertIntoTable(l RemoteProofChainLink, tab *IdentityTable) {
	tab.insertLink(l)
	if k := l.TableKey(); len(k) > 0 {
		v, found := tab.remoteProofs[k]
		if !found {
			v = make([]RemoteProofChainLink, 0, 1)
		}
		v = append(v, l)
		tab.remoteProofs[k] = v
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
}

func ParseTrackChainLink(b GenericChainLink) (ret *TrackChainLink, err error) {
	var whom string
	whom, err = b.payloadJson.AtPath("body.track.basics.username").GetString()
	if err != nil {
		err = fmt.Errorf("Bad track statement @%s: %s", b.ToDebugString(), err.Error())
	} else {
		ret = &TrackChainLink{b, whom, nil}
	}
	return
}

func (t *TrackChainLink) Type() string { return "track" }

func (b *TrackChainLink) ToDisplayString() string {
	return b.whom
}

func (l *TrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
	list, found := tab.tracks[l.whom]
	if !found {
		list = make([]*TrackChainLink, 0, 1)
	}
	list = append(list, l)
	tab.tracks[l.whom] = list
}

func (l *TrackChainLink) GetTrackedPgpFingerprint() (*PgpFingerprint, error) {
	return GetPgpFingerprint(l.payloadJson.AtPath("body.track.key.key_fingerprint"))
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
	ret = make([]*ServiceBlock, 0, ln)
	for i := 0; i < ln; i++ {
		proof := w.AtIndex(i).AtKey("remote_key_proof")
		if i, e := proof.AtKey("state").GetInt(); e != nil {
			G.Log.Warning("Bad 'state' in track statement: %s", e.Error())
		} else if i != PROOF_STATE_OK {
			G.Log.Debug("Skipping proof state = %d\n", i)
		} else if sb, e := ParseServiceBlock(proof.AtKey("check_data_json")); e != nil {
			G.Log.Warning("Bad remote_key_proof.check_data_json: %s", e.Error())
		} else {
			ret = append(ret, sb)
		}
	}
	return
}

//
//=========================================================================

//=========================================================================
// UntrackChainLink
//

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

func (b *UntrackChainLink) ToDisplayString() string {
	return b.whom
}

func (r *UntrackChainLink) Type() string { return "untrack" }

func (r *UntrackChainLink) IsRevocationIsh() bool { return true }

//
//=========================================================================

//=========================================================================
// CryptocurrencyChainLink

type CryptocurrencyChainLink struct {
	GenericChainLink
	pkhash  []byte
	address string
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

func (r *CryptocurrencyChainLink) Type() string { return "cryptocurrency" }

func (r *CryptocurrencyChainLink) ToDisplayString() string { return r.address }

func (l *CryptocurrencyChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
	tab.cryptocurrency = append(tab.cryptocurrency, l)
}

func (l CryptocurrencyChainLink) Display(is IdentifyState) {
	msg := (BTC + " bitcoin " + ColorString("green", l.address))
	is.Report(msg)
}

//
//=========================================================================

//=========================================================================
// RevokeChainLink

type RevokeChainLink struct {
	GenericChainLink
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

func (l *RevokeChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
}

//
//=========================================================================

//=========================================================================
// SelfSigChainLink

type SelfSigChainLink struct {
	GenericChainLink
}

func (r *SelfSigChainLink) Type() string { return "self" }

func (s *SelfSigChainLink) ToDisplayString() string { return s.unpacked.username }

func (l *SelfSigChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
}
func (w *SelfSigChainLink) TableKey() string          { return "keybase" }
func (w *SelfSigChainLink) LastWriterWins() bool      { return true }
func (w *SelfSigChainLink) GetRemoteUsername() string { return w.GetUsername() }
func (w *SelfSigChainLink) GetHostname() string       { return "" }
func (w *SelfSigChainLink) GetProtocol() string       { return "" }

func (s *SelfSigChainLink) DisplayCheck(lcr LinkCheckResult, is IdentifyState) {
	return
}

func (s *SelfSigChainLink) CheckDataJson() *jsonw.Wrapper { return nil }

func (s *SelfSigChainLink) ToTrackingStatement() (*jsonw.Wrapper, error) {
	return nil, nil
}

func (s *SelfSigChainLink) ToIdString() string { return s.GetUsername() }
func (s *SelfSigChainLink) ToKeyValuePair() (string, string) {
	return s.TableKey(), s.GetUsername()
}

func (s *SelfSigChainLink) ComputeTrackDiff(tl *TrackLookup) TrackDiff { return nil }

//
//=========================================================================

type IdentityTable struct {
	sigChain       *SigChain
	revocations    map[SigId]bool
	links          map[SigId]TypedChainLink
	remoteProofs   map[string][]RemoteProofChainLink
	tracks         map[string][]*TrackChainLink
	Order          []TypedChainLink
	sigHints       *SigHints
	activeProofs   []RemoteProofChainLink
	cryptocurrency []*CryptocurrencyChainLink
	checkResult    *CheckResult
}

func (tab *IdentityTable) insertLink(l TypedChainLink) {
	tab.links[l.GetSigId()] = l
	tab.Order = append(tab.Order, l)
	for _, rev := range l.GetRevocations() {
		tab.revocations[*rev] = true
		if targ, found := tab.links[*rev]; !found {
			G.Log.Warning("Can't revoke signature %s @%s",
				rev.ToString(true), l.ToDebugString())
		} else {
			targ.markRevoked(l)
		}
	}
}

func (tab *IdentityTable) MarkCheckResult(err ProofError) {
	tab.checkResult = NewNowCheckResult(err)
}

func NewTypedChainLink(cl *ChainLink) (ret TypedChainLink, w Warning) {

	base := GenericChainLink{cl}

	s, err := cl.payloadJson.AtKey("body").AtKey("type").GetString()
	if len(s) == 0 || err != nil {
		err = fmt.Errorf("No type in signature @%s", base.ToDebugString())
	} else {
		switch s {
		case "web_service_binding":
			ret, err = ParseWebServiceBinding(base)
		case "track":
			ret, err = ParseTrackChainLink(base)
		case "untrack":
			ret, err = ParseUntrackChainLink(base)
		case "cryptocurrency":
			ret, err = ParseCryptocurrencyChainLink(base)
		case "revoke":
			ret = &RevokeChainLink{base}
		default:
			err = fmt.Errorf("Unknown signature type %s @%s", s, base.ToDebugString())
		}
	}

	if err != nil {
		w = ErrorToWarning(err)
		ret = &base
	}

	// Basically we never fail, since worse comes to worse, we treat
	// unknown signatures as "generic" and can still display them
	return
}

func NewIdentityTable(sc *SigChain, h *SigHints) *IdentityTable {
	ret := &IdentityTable{
		sigChain:       sc,
		revocations:    make(map[SigId]bool),
		links:          make(map[SigId]TypedChainLink),
		remoteProofs:   make(map[string][]RemoteProofChainLink),
		tracks:         make(map[string][]*TrackChainLink),
		Order:          make([]TypedChainLink, 0, sc.Len()),
		sigHints:       h,
		activeProofs:   make([]RemoteProofChainLink, 0, sc.Len()),
		cryptocurrency: make([]*CryptocurrencyChainLink, 0, 0),
	}
	ret.Populate()
	ret.CollectAndDedupeActiveProofs()
	return ret
}

func (idt *IdentityTable) Populate() {
	G.Log.Debug("+ Populate ID Table")
	for _, link := range idt.sigChain.chainLinks {
		tl, w := NewTypedChainLink(link)
		tl.insertIntoTable(idt)
		if w != nil {
			G.Log.Warning(w.Warning())
		}
	}
	G.Log.Debug("- Populate ID Table")
}

func (idt *IdentityTable) VerifySelfSig(s string, uid UID) bool {
	list := idt.Order
	ln := len(list)
	for i := ln - 1; i >= 0; i-- {
		link := list[i]
		if !link.IsActiveKey() {
			break
		}
		if link.IsRevoked() {
			continue
		}
		if link.GetUsername() == s && link.GetUID() == uid {
			G.Log.Debug("| Found self-signature for %s @%s", s,
				link.ToDebugString())
			return true
		}
	}
	return false
}

func (idt *IdentityTable) GetTrackingStatementFor(s string) *TrackChainLink {
	if list, found := idt.tracks[s]; found {
		l := len(list)
		for i := l - 1; i >= 0; i-- {
			link := list[i]
			if !link.IsRevoked() && link.untrack == nil {
				return link
			}
		}
	}
	return nil
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

func (idt *IdentityTable) CollectAndDedupeActiveProofs() {
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

func (idt *IdentityTable) Identify(is IdentifyState) {
	if is.track != nil {
		G.Log.Debug("| with tracking %v", is.track.set)
	}

	done := make(chan bool)
	for _, activeProof := range idt.activeProofs {
		go func(p RemoteProofChainLink) {
			idt.IdentifyActiveProof(p, is)
			done <- true
		}(activeProof)
	}

	// wait for all goroutines to complete before exiting
	for _ = range idt.activeProofs {
		<-done
	}

	if acc := idt.ActiveCryptocurrency(); acc != nil {
		acc.Display(is)
	}
}

//=========================================================================

func (idt *IdentityTable) IdentifyActiveProof(p RemoteProofChainLink, is IdentifyState) {
	lcr := idt.CheckActiveProof(p, is.track)

	is.Lock()
	p.DisplayCheck(lcr, is)
	is.res.AddLinkCheckResult(lcr)
	is.Unlock()
}

type LinkCheckResult struct {
	hint   *SigHint
	cached *CheckResult
	err    ProofError
	diff   TrackDiff
}

func (idt *IdentityTable) CheckActiveProof(p RemoteProofChainLink, track *TrackLookup) (
	res LinkCheckResult) {

	G.Log.Debug("+ CheckActiveProof %s", p.ToDebugString())
	defer G.Log.Debug("- CheckActiveProof %s", p.ToDebugString())

	sid := p.GetSigId()
	res.hint = idt.sigHints.Lookup(sid)
	if res.hint == nil {
		res.err = NewProofError(PROOF_NO_HINT,
			"No server-given hint for sig=%s", sid.ToString(true))
		return
	}

	if track != nil {
		//
		// XXX maybe revisit this decision...
		// We're using a shared TrackLookup() object, so let's
		// serialize access to it here.
		//
		track.Lock()
		res.diff = p.ComputeTrackDiff(track)
		track.Unlock()
	}

	if G.ProofCache != nil {
		if res.cached = G.ProofCache.Get(sid); res.cached != nil {
			p.MarkChecked(res.err)
			res.err = res.cached.Status
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

//=========================================================================

func (idt *IdentityTable) ToProofs(proofs []Proof) []Proof {
	for _, ap := range idt.activeProofs {
		if ap.GetProofStateTCL() == PROOF_STATE_OK {
			k, v := ap.ToKeyValuePair()
			proofs = append(proofs, Proof{Key: k, Value: v})
		}
	}
	return proofs
}

//=========================================================================

func (idt *IdentityTable) MakeTrackSet() TrackSet {
	ret := make(TrackSet)
	for _, ap := range idt.activeProofs {
		if ap.GetProofStateTCL() == PROOF_STATE_OK {
			ret.Add(ap)
		}
	}
	return ret
}

//=========================================================================
