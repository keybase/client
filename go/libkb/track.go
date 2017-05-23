// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"errors"
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

var ErrTrackingExpired = errors.New("Local track expired")

// Can be a ProofLinkWithState, one of the identities listed in a
// tracking statement, or a PGP Fingerprint!
type TrackIDComponent interface {
	ToIDString() string
	ToKeyValuePair() (string, string)
	GetProofState() keybase1.ProofState
	LastWriterWins() bool
	GetProofType() keybase1.ProofType
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
	link         *TrackChainLink     // The original chain link that I signed
	set          *TrackSet           // The total set of tracked identities
	ids          map[string][]string // A http -> [foo.com, boo.com] lookup
	trackerSeqno keybase1.Seqno      // The seqno in the tracker's sighcain
}

func (l TrackLookup) ToSummary() TrackSummary {
	ret := TrackSummary{
		time:     l.GetCTime(),
		isRemote: l.IsRemote(),
	}
	return ret
}

func (l TrackLookup) GetProofState(id string) keybase1.ProofState {
	return l.set.GetProofState(id)
}

func (l TrackLookup) GetTrackerSeqno() keybase1.Seqno {
	return l.trackerSeqno
}

func (l TrackLookup) GetTrackedKeys() []TrackedKey {
	ret, err := l.link.GetTrackedKeys()
	if err != nil {
		G.Log.Warning("Error in lookup of tracked PGP fingerprints: %s", err)
	}
	return ret
}

func (l TrackLookup) GetEldestKID() keybase1.KID {
	ret, err := l.link.GetEldestKID()
	if err != nil {
		G.Log.Warning("Error in lookup of eldest KID: %s", err)
	}
	return ret
}

func (l TrackLookup) GetTmpExpireTime() (ret time.Time) {
	return l.link.GetTmpExpireTime()
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

type TrackDiffNoneViaTemporary struct{}

func (t TrackDiffNoneViaTemporary) BreaksTracking() bool     { return false }
func (t TrackDiffNoneViaTemporary) IsSameAsTracked() bool    { return true }
func (t TrackDiffNoneViaTemporary) ToDisplayString() string  { return "snoozed" }
func (t TrackDiffNoneViaTemporary) ToDisplayMarkup() *Markup { return NewMarkup(t.ToDisplayString()) }
func (t TrackDiffNoneViaTemporary) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_NONE_VIA_TEMPORARY
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

type TrackDiffSnoozedRevoked struct {
	idc TrackIDComponent
}

func (t TrackDiffSnoozedRevoked) BreaksTracking() bool {
	return false
}
func (t TrackDiffSnoozedRevoked) ToDisplayString() string {
	return "Deleted proof: " + t.idc.ToIDString() + " (snoozed)"
}
func (t TrackDiffSnoozedRevoked) IsSameAsTracked() bool {
	return true
}
func (t TrackDiffSnoozedRevoked) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
}
func (t TrackDiffSnoozedRevoked) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_NONE_VIA_TEMPORARY
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

type TrackDiffNewEldest struct {
	tracked  keybase1.KID
	observed keybase1.KID
}

func (t TrackDiffNewEldest) BreaksTracking() bool {
	return true
}
func (t TrackDiffNewEldest) IsSameAsTracked() bool {
	return false
}
func (t TrackDiffNewEldest) GetTrackDiffType() keybase1.TrackDiffType {
	return keybase1.TrackDiffType_NEW_ELDEST
}
func (t TrackDiffNewEldest) ToDisplayString() string {
	if t.tracked.IsNil() {
		return fmt.Sprintf("No key when followed; established new eldest key %s", t.observed)
	}
	return fmt.Sprintf("Account reset! Old key was %s; new key is %s", t.tracked, t.observed)
}
func (t TrackDiffNewEldest) ToDisplayMarkup() *Markup {
	return NewMarkup(t.ToDisplayString())
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
	ret := &TrackLookup{link: link, set: set, ids: ids, trackerSeqno: link.GetSeqno()}
	return ret
}

func (l *TrackLookup) GetCTime() time.Time {
	return l.link.GetCTime()
}

//=====================================================================

func LocalTrackDBKey(tracker, trackee keybase1.UID, expireLocal bool) DbKey {
	key := fmt.Sprintf("%s-%s", tracker, trackee)
	if expireLocal {
		key += "-expires"
	}
	return DbKey{Typ: DBLocalTrack, Key: key}
}

//=====================================================================

func localTrackChainLinkFor(tracker, trackee keybase1.UID, localExpires bool, g *GlobalContext) (ret *TrackChainLink, err error) {
	var obj *jsonw.Wrapper
	obj, err = g.LocalDb.Get(LocalTrackDBKey(tracker, trackee, localExpires))
	if err != nil {
		g.Log.Debug("| DB lookup failed")
		return
	}
	if obj == nil {
		g.Log.Debug("| No local track found")
		return
	}

	cl := &ChainLink{Contextified: NewContextified(g), payloadJSON: obj, unsigned: true}
	if err = cl.UnpackLocal(); err != nil {
		g.Log.Debug("| unpack failed -> %s", err)
		return
	}

	var linkETime time.Time

	if localExpires {
		linkETime = cl.GetCTime().Add(g.Env.GetLocalTrackMaxAge())

		g.Log.Debug("| local track created %s, expires: %s, it is now %s", cl.GetCTime(), linkETime.String(), g.Clock().Now())

		if linkETime.Before(g.Clock().Now()) {
			g.Log.Debug("| expired local track, deleting")
			removeLocalTrack(tracker, trackee, true, g)
			ret = nil
			err = ErrTrackingExpired
			return ret, err
		}
	}

	base := GenericChainLink{cl}
	ret, err = ParseTrackChainLink(base)
	if ret != nil && err == nil {
		ret.local = true
		ret.tmpExpireTime = linkETime
	}

	return
}

func LocalTrackChainLinkFor(tracker, trackee keybase1.UID, g *GlobalContext) (ret *TrackChainLink, err error) {
	return localTrackChainLinkFor(tracker, trackee, false, g)
}

func LocalTmpTrackChainLinkFor(tracker, trackee keybase1.UID, g *GlobalContext) (ret *TrackChainLink, err error) {
	return localTrackChainLinkFor(tracker, trackee, true, g)
}

func StoreLocalTrack(tracker keybase1.UID, trackee keybase1.UID, expiringLocal bool, statement *jsonw.Wrapper, g *GlobalContext) error {
	g.Log.Debug("| StoreLocalTrack, expiring = %v", expiringLocal)
	return g.LocalDb.Put(LocalTrackDBKey(tracker, trackee, expiringLocal), nil, statement)
}

func removeLocalTrack(tracker keybase1.UID, trackee keybase1.UID, expiringLocal bool, g *GlobalContext) error {
	g.Log.Debug("| RemoveLocalTrack, expiring = %v", expiringLocal)
	return g.LocalDb.Delete(LocalTrackDBKey(tracker, trackee, expiringLocal))
}

func RemoveLocalTracks(tracker keybase1.UID, trackee keybase1.UID, g *GlobalContext) error {
	e1 := removeLocalTrack(tracker, trackee, false, g)
	e2 := removeLocalTrack(tracker, trackee, true, g)
	return PickFirstError(e1, e2)
}
