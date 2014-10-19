package libkb

import (
	"fmt"
	"time"
)

type TypedChainLink interface {
	GetRevocations() []*SigId
	insertIntoTable(tab *IdentityTable)
	GetSigId() SigId
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
}

//=========================================================================
// GenericChainLink
//

type GenericChainLink struct {
	*ChainLink
	revoked bool
}

func (b GenericChainLink) GetSigId() SigId {
	return b.unpacked.sigId
}
func (b GenericChainLink) Type() string            { return "generic" }
func (b GenericChainLink) ToDisplayString() string { return "generic" }
func (b GenericChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(b)
}
func (b GenericChainLink) markRevoked(r TypedChainLink) {
	b.revoked = true
}
func (b GenericChainLink) ToDebugString() string {
	return fmt.Sprintf("uid=%s, seq=%d, link=%s",
		string(b.parent.uid), b.unpacked.seqno, b.id.ToString())
}

func (g GenericChainLink) IsRevocationIsh() bool { return false }
func (g GenericChainLink) IsRevoked() bool       { return g.revoked }
func (g GenericChainLink) IsActiveKey() bool     { return g.activeKey }
func (g GenericChainLink) GetSeqno() Seqno       { return g.unpacked.seqno }
func (g GenericChainLink) GetPgpFingerprint() PgpFingerprint {
	return g.unpacked.pgpFingerprint
}

func (g GenericChainLink) GetCTime() time.Time {
	return time.Unix(int64(g.unpacked.ctime), 0)
}

//
//=========================================================================

//=========================================================================
// Remote, Web and Social
//
type RemoteProofChainLink interface {
	TypedChainLink
	TableKey() string
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

func (w WebProofChainLink) TableKey() string { return "web" }
func (w WebProofChainLink) Type() string     { return "proof" }
func (w WebProofChainLink) insertIntoTable(tab *IdentityTable) {
	remoteProofInsertIntoTable(w, tab)
}
func (w WebProofChainLink) ToDisplayString() string {
	return w.protocol + "://" + w.hostname
}
func (s SocialProofChainLink) TableKey() string { return s.service }
func (s SocialProofChainLink) Proof() string    { return "proof" }
func (s SocialProofChainLink) insertIntoTable(tab *IdentityTable) {
	remoteProofInsertIntoTable(s, tab)
}
func (w SocialProofChainLink) ToDisplayString() string {
	return w.username + "@" + w.service
}

func NewWebProofChainLink(b GenericChainLink, p, h string) WebProofChainLink {
	return WebProofChainLink{b, p, h}
}
func NewSocialProofChainLink(b GenericChainLink, s, u string) SocialProofChainLink {
	return SocialProofChainLink{b, s, u}
}

func ParseWebServiceBinding(base GenericChainLink) (ret RemoteProofChainLink) {

	jw := base.payloadJson.AtKey("body").AtKey("service")

	if prot, e1 := jw.AtKey("protocol").GetString(); e1 == nil {

		var hostname string

		jw.AtKey("hostname").GetStringVoid(&hostname, &e1)
		if e1 == nil {
			switch prot {
			case "http:":
				ret = NewWebProofChainLink(base, "http", hostname)
			case "https:":
				ret = NewWebProofChainLink(base, "https", hostname)
			}
		} else if domain, e2 := jw.AtKey("domain").GetString(); e2 == nil && prot == "dns" {
			ret = NewWebProofChainLink(base, "dns", domain)
		}

	} else {

		var service, username string
		var e2 error

		jw.AtKey("name").GetStringVoid(&service, &e2)
		jw.AtKey("username").GetStringVoid(&username, &e2)
		if e2 == nil {
			ret = NewSocialProofChainLink(base, service, username)
		}
	}

	if ret == nil {
		G.Log.Warning("Unrecognized Web proof: %s @%s", jw.MarshalToDebug(),
			base.ToDebugString())
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

func ParseTrackChainLink(b GenericChainLink) (ret TrackChainLink) {
	whom, err := b.payloadJson.AtPath("body.track.basics.username").GetString()
	if err != nil {
		G.Log.Warning("Bad track statement @%s: %s", b.ToDebugString(), err.Error())
	} else {
		ret = TrackChainLink{b, whom, nil}
	}
	return
}

func (t TrackChainLink) Type() string { return "track" }

func (b TrackChainLink) ToDisplayString() string {
	return b.whom
}

func (l TrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(l)
	tab.tracks[l.whom] = l
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

func ParseUntrackChainLink(b GenericChainLink) (ret UntrackChainLink) {
	whom, err := b.payloadJson.AtPath("body.untrack.basics.username").GetString()
	if err != nil {
		G.Log.Warning("Bad track statement @%s: %s", b.ToDebugString(), err.Error())
	} else {
		ret = UntrackChainLink{b, whom}
	}
	return
}

func (u UntrackChainLink) insertIntoTable(tab *IdentityTable) {
	tab.insertLink(u)
	if tobj, found := tab.tracks[u.whom]; !found {
		G.Log.Notice("Bad untrack of %s; no previous tracking statement found",
			u.whom)
	} else {
		tobj.untrack = &u
	}
}

func (b UntrackChainLink) ToDisplayString() string {
	return b.whom
}

func (r UntrackChainLink) Type() string { return "untrack" }

//
//=========================================================================

type CryptocurrencyChainLink struct {
	GenericChainLink
}

func (r CryptocurrencyChainLink) Type() string { return "cryptocurrency" }

type RevokeChainLink struct {
	GenericChainLink
}

func (r RevokeChainLink) Type() string { return "revoke" }

type SelfSigChainLink struct {
	GenericChainLink
}

func (r SelfSigChainLink) Type() string { return "self" }

type IdentityTable struct {
	sigChain     *SigChain
	revocations  map[SigId]bool
	links        map[SigId]TypedChainLink
	remoteProofs map[string][]RemoteProofChainLink
	tracks       map[string]TrackChainLink
	order        []TypedChainLink
}

func (tab *IdentityTable) insertLink(l TypedChainLink) {
	tab.links[l.GetSigId()] = l
	tab.order = append(tab.order, l)
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

func NewTypedChainLink(cl *ChainLink) (ret TypedChainLink) {

	base := GenericChainLink{cl, false}

	s, err := cl.payloadJson.AtKey("body").AtKey("type").GetString()
	if len(s) == 0 || err != nil {
		G.Log.Warning("No type in signature @%s", base.ToDebugString())
	} else {
		switch s {
		case "web_service_binding":
			ret = ParseWebServiceBinding(base)
		case "track":
			ret = ParseTrackChainLink(base)
		case "untrack":
			ret = ParseUntrackChainLink(base)
		case "cryptocurrency":
			ret = CryptocurrencyChainLink{base}
		case "revoke":
			ret = RevokeChainLink{base}
		case "self_sig":
			ret = SelfSigChainLink{base}
		default:
			G.Log.Warning("Unknown signature type %s @%s", s, base.ToDebugString())
		}
	}

	if ret == nil {
		ret = base
	}

	// Basically we never fail, since worse comes to worse, we treat
	// unknown signatures as "generic" and can still display them
	return
}

func NewIdentityTable(sc *SigChain) *IdentityTable {
	ret := &IdentityTable{
		sigChain:     sc,
		revocations:  make(map[SigId]bool),
		links:        make(map[SigId]TypedChainLink),
		remoteProofs: make(map[string][]RemoteProofChainLink),
		tracks:       make(map[string]TrackChainLink),
		order:        make([]TypedChainLink, 0, sc.Len()),
	}
	ret.Populate()
	return ret
}

func (idt *IdentityTable) Populate() {
	G.Log.Debug("+ Populate ID Table")
	for _, link := range idt.sigChain.chainLinks {
		tl := NewTypedChainLink(link)
		tl.insertIntoTable(idt)
	}
	G.Log.Debug("- Populate ID Table")
}

func (idt *IdentityTable) Len() int {
	return len(idt.order)
}
