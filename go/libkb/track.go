package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// Can either be a RemoteProofChainLink or one of the identities
// listed in a tracking statement, or a PGP Fingerprint!
type TrackIdComponent interface {
	ToIdString() string
	ToKeyValuePair() (string, string)
	GetProofState() int
	LastWriterWins() bool
}

type TrackSet struct {
	ids      map[string]TrackIdComponent
	services map[string]bool
}

func NewTrackSet() *TrackSet {
	return &TrackSet{
		ids:      make(map[string]TrackIdComponent),
		services: make(map[string]bool),
	}
}

func (ts TrackSet) Add(t TrackIdComponent) {
	ts.ids[t.ToIdString()] = t
	if t.LastWriterWins() {
		k, _ := t.ToKeyValuePair()
		ts.services[k] = true
	}
}

func (ts TrackSet) GetProofState(tic TrackIdComponent) int {
	ret := PROOF_STATE_NONE
	if obj := ts.ids[tic.ToIdString()]; obj != nil {
		ret = obj.GetProofState()
	}
	return ret
}

func (ts TrackSet) Subtract(b TrackSet) (out []TrackIdComponent) {
	for _, c := range ts.ids {
		if !b.HasMember(c) {
			out = append(out, c)
		}
	}
	return
}

func (ts TrackSet) HasMember(t TrackIdComponent) bool {
	var found bool

	// For LastWriterWins like social networks, then it just matters
	// that there is some proof for the service.  For non-last-writer-wins,
	// like HTTPS and DNS, then the full proof needs to show up in A.
	if t.LastWriterWins() {
		k, _ := t.ToKeyValuePair()
		_, found = ts.services[k]
	} else {
		_, found = ts.ids[t.ToIdString()]
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

func (l TrackLookup) GetProofState(tic TrackIdComponent) int {
	return l.set.GetProofState(tic)
}

func (l TrackLookup) GetTrackedPGPFingerprints() []PgpFingerprint {
	ret, err := l.link.GetTrackedPGPFingerprints()
	if err != nil {
		G.Log.Warning("Error in lookup up tracked PGP fingerprints: %s", err)
	}
	return ret
}

func (l TrackLookup) GetTrackedPGPFOKIDs() []FOKID {
	ret, err := l.link.GetTrackedPGPFOKIDs()
	if err != nil {
		G.Log.Warning("Error in lookup up tracked PGP FOKIDs: %s", err)
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

type TrackDiffError struct {
	err error
}

func (t TrackDiffError) BreaksTracking() bool {
	return true
}
func (t TrackDiffError) ToDisplayString() string {
	return "error"
}
func (t TrackDiffError) IsSameAsTracked() bool {
	return false
}
func (t TrackDiffError) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffError) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_ERROR
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

type TrackDiffDeleted struct {
	idc TrackIdComponent
}

func (t TrackDiffDeleted) BreaksTracking() bool {
	return true
}
func (t TrackDiffDeleted) ToDisplayString() string {
	return "Deleted proof: " + t.idc.ToIdString()
}
func (t TrackDiffDeleted) IsSameAsTracked() bool {
	return false
}
func (t TrackDiffDeleted) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffDeleted) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_DELETED
}

type TrackDiffRemoteFail struct {
	observed int
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
	tracked int
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
	tracked, observed int
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
		list, found := ids[k]
		if !found {
			list = make([]string, 0, 1)
		}
		ids[k] = append(list, v)
	}
	ret := &TrackLookup{link: link, set: set, ids: ids}
	return ret
}

func (l *TrackLookup) GetCTime() time.Time {
	return l.link.GetCTime()
}

//=====================================================================

func LocalTrackDBKey(tracker, trackee UID) DbKey {
	return DbKey{Typ: DB_LOCAL_TRACK, Key: fmt.Sprintf("%s-%s", tracker.String(), trackee.String())}
}

//=====================================================================

func GetLocalTrack(tracker, trackee UID) (ret *TrackChainLink, err error) {
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

	cl := &ChainLink{payloadJson: obj, unsigned: true}
	if err = cl.UnpackLocal(); err != nil {
		G.Log.Debug("| unpack failed -> %s", err.Error())
		return
	}
	base := GenericChainLink{cl}
	ret, err = ParseTrackChainLink(base)
	if ret != nil && err == nil {
		ret.local = true
	}

	return
}

func StoreLocalTrack(tracker UID, trackee UID, statement *jsonw.Wrapper) error {
	G.Log.Debug("| StoreLocalTrack")
	return G.LocalDb.Put(LocalTrackDBKey(tracker, trackee), nil, statement)
}

func RemoveLocalTrack(tracker UID, trackee UID) error {
	G.Log.Debug("| RemoveLocalTrack")
	return G.LocalDb.Delete(LocalTrackDBKey(tracker, trackee))
}
