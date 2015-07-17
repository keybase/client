package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// Can be a ProofLinkWithState, one of the identities listed in a
// tracking statement, or a PGP Fingerprint!
type TrackIDComponent interface {
	ToIDString() string
	ToKeyValuePair() (string, string)
	GetProofState() keybase1.ProofState
	LastWriterWins() bool
}

type TrackSet struct {
	ids      map[string]TrackIDComponent
	services map[string]bool
}

func NewTrackSet() *TrackSet {
	return &TrackSet{
		ids:      make(map[string]TrackIDComponent),
		services: make(map[string]bool),
	}
}

func (ts TrackSet) Add(t TrackIDComponent) {
	ts.ids[t.ToIDString()] = t
	if t.LastWriterWins() {
		k, _ := t.ToKeyValuePair()
		ts.services[k] = true
	}
}

func (ts TrackSet) GetProofState(id string) keybase1.ProofState {
	ret := keybase1.ProofState_NONE
	if obj := ts.ids[id]; obj != nil {
		ret = obj.GetProofState()
	}
	return ret
}

func (ts TrackSet) Subtract(b TrackSet) (out []TrackIDComponent) {
	for _, c := range ts.ids {
		if !b.HasMember(c) {
			out = append(out, c)
		}
	}
	return
}

func (ts TrackSet) HasMember(t TrackIDComponent) bool {
	var found bool

	// For LastWriterWins like social networks, then it just matters
	// that there is some proof for the service.  For non-last-writer-wins,
	// like HTTPS and DNS, then the full proof needs to show up in A.
	if t.LastWriterWins() {
		k, _ := t.ToKeyValuePair()
		_, found = ts.services[k]
	} else {
		_, found = ts.ids[t.ToIDString()]
	}
	return found
}

func (ts TrackSet) LenEq(b TrackSet) bool {
	return len(ts.ids) == len(b.ids)
}

//=====================================================================

type TrackInstructions struct {
	Local  bool
	Remote bool
}

//=====================================================================

type TrackSummary struct {
	time     time.Time
	isRemote bool
	username string
}

func (s TrackSummary) IsRemote() bool      { return s.isRemote }
func (s TrackSummary) GetCTime() time.Time { return s.time }
func (s TrackSummary) Username() string    { return s.username }

//=====================================================================

type TrackLookup struct {
	link *TrackChainLink     // The original chain link that I signed
	set  *TrackSet           // The total set of tracked identities
	ids  map[string][]string // A http -> [foo.com, boo.com] lookup
}

func (l TrackLookup) ToSummary() TrackSummary {
	return TrackSummary{
		time:     l.GetCTime(),
		isRemote: l.IsRemote(),
	}
}

func (l TrackLookup) GetProofState(id string) keybase1.ProofState {
	return l.set.GetProofState(id)
}

func (l TrackLookup) GetTrackedKeys() []TrackedKey {
	ret, err := l.link.GetTrackedKeys()
	if err != nil {
		G.Log.Warning("Error in lookup up tracked PGP fingerprints: %s", err)
	}
	return ret
}

func (l TrackLookup) IsRemote() bool {
	return l.link.IsRemote()
}

type TrackDiff interface {
	BreaksTracking() bool
	ToDisplayString() string
	ToDisplayMarkup() *Markup
	IsSameAsTracked() bool
	GetTrackDiffType() keybase1.TrackDiffType
}

type TrackDiffUpgraded struct {
	prev, curr string
}

func (t TrackDiffUpgraded) IsSameAsTracked() bool {
	return false
}

func (t TrackDiffUpgraded) BreaksTracking() bool {
	return false
}
func (t TrackDiffUpgraded) ToDisplayString() string {
	return "Upgraded from " + t.prev + " to " + t.curr
}
func (t TrackDiffUpgraded) GetPrev() string { return t.prev }
func (t TrackDiffUpgraded) GetCurr() string { return t.curr }
func (t TrackDiffUpgraded) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffUpgraded) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_UPGRADED
}

type TrackDiffNone struct{}

func (t TrackDiffNone) BreaksTracking() bool {
	return false
}
func (t TrackDiffNone) IsSameAsTracked() bool {
	return true
}

func (t TrackDiffNone) ToDisplayString() string {
	return "tracked"
}
func (t TrackDiffNone) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffNone) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_NONE
}

type TrackDiffNew struct{}

func (t TrackDiffNew) BreaksTracking() bool {
	return false
}
func (t TrackDiffNew) IsSameAsTracked() bool {
	return false
}

type TrackDiffClash struct {
	observed, expected string
}

func (t TrackDiffNew) ToDisplayString() string {
	return "new"
}
func (t TrackDiffNew) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffNew) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_NEW
}

func (t TrackDiffClash) BreaksTracking() bool {
	return true
}

func (t TrackDiffClash) ToDisplayString() string {
	return "CHANGED from \"" + t.expected + "\""
}
func (t TrackDiffClash) IsSameAsTracked() bool {
	return false
}
func (t TrackDiffClash) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffClash) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_CLASH
}

type TrackDiffRevoked struct {
	idc TrackIDComponent
}

func (t TrackDiffRevoked) BreaksTracking() bool {
	return true
}
func (t TrackDiffRevoked) ToDisplayString() string {
	return "Deleted proof: " + t.idc.ToIDString()
}
func (t TrackDiffRevoked) IsSameAsTracked() bool {
	return false
}
func (t TrackDiffRevoked) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffRevoked) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_REVOKED
}

type TrackDiffRemoteFail struct {
	observed keybase1.ProofState
}

func (t TrackDiffRemoteFail) BreaksTracking() bool {
	return true
}
func (t TrackDiffRemoteFail) ToDisplayString() string {
	return "remote failed"
}
func (t TrackDiffRemoteFail) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffRemoteFail) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_REMOTE_FAIL
}
func (t TrackDiffRemoteFail) IsSameAsTracked() bool {
	return false
}

type TrackDiffRemoteWorking struct {
	tracked keybase1.ProofState
}

func (t TrackDiffRemoteWorking) BreaksTracking() bool {
	return false
}
func (t TrackDiffRemoteWorking) ToDisplayString() string {
	return "working"
}
func (t TrackDiffRemoteWorking) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffRemoteWorking) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_REMOTE_WORKING
}
func (t TrackDiffRemoteWorking) IsSameAsTracked() bool {
	return false
}

type TrackDiffRemoteChanged struct {
	tracked, observed keybase1.ProofState
}

func (t TrackDiffRemoteChanged) BreaksTracking() bool {
	return false
}
func (t TrackDiffRemoteChanged) ToDisplayString() string {
	return "changed"
}
func (t TrackDiffRemoteChanged) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffRemoteChanged) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_REMOTE_CHANGED
}
func (t TrackDiffRemoteChanged) IsSameAsTracked() bool {
	return false
}

func NewTrackLookup(link *TrackChainLink) *TrackLookup {
	sbs := link.ToServiceBlocks()
	set := NewTrackSet()
	ids := make(map[string][]string)
	for _, sb := range sbs {
		set.Add(sb)
		k, v := sb.ToKeyValuePair()
		ids[k] = append(ids[k], v)
	}
	ret := &TrackLookup{link: link, set: set, ids: ids}
	return ret
}

func (l *TrackLookup) GetCTime() time.Time {
	return l.link.GetCTime()
}

//=====================================================================

func LocalTrackDBKey(tracker, trackee keybase1.UID) DbKey {
	return DbKey{Typ: DBLocalTrack, Key: fmt.Sprintf("%s-%s", tracker, trackee)}
}

//=====================================================================

func LocalTrackChainLinkFor(tracker, trackee keybase1.UID) (ret *TrackChainLink, err error) {
	G.Log.Debug("+ GetLocalTrack(%s,%s)", tracker, trackee)
	defer G.Log.Debug("- GetLocalTrack(%s,%s) -> (%v, %s)", tracker, trackee, ret, ErrToOk(err))

	var obj *jsonw.Wrapper
	obj, err = G.LocalDb.Get(LocalTrackDBKey(tracker, trackee))
	if err != nil {
		G.Log.Debug("| DB lookup failed")
		return
	}
	if obj == nil {
		G.Log.Debug("| No local track found")
		return
	}

	cl := &ChainLink{payloadJSON: obj, unsigned: true}
	if err = cl.UnpackLocal(); err != nil {
		G.Log.Debug("| unpack failed -> %s", err)
		return
	}
	base := GenericChainLink{cl}
	ret, err = ParseTrackChainLink(base)
	if ret != nil && err == nil {
		ret.local = true
	}

	return
}

func StoreLocalTrack(tracker keybase1.UID, trackee keybase1.UID, statement *jsonw.Wrapper) error {
	G.Log.Debug("| StoreLocalTrack")
	return G.LocalDb.Put(LocalTrackDBKey(tracker, trackee), nil, statement)
}

func RemoveLocalTrack(tracker keybase1.UID, trackee keybase1.UID) error {
	G.Log.Debug("| RemoveLocalTrack")
	return G.LocalDb.Delete(LocalTrackDBKey(tracker, trackee))
}
