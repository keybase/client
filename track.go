package libkb

import (
	"fmt"
	"github.com/keybase/go-jsonw"
)

// Can either be a RemoteProofChainLink or one of the identities
// listed in a tracking statement
type TrackIdComponent interface {
	ToIdString() string
	ToKeyValuePair() (string, string)
}

type TrackSet map[string]bool

func (ts TrackSet) Add(t TrackIdComponent) {
	ts[t.ToIdString()] = true
}

func (a TrackSet) SubsetOf(b TrackSet) bool {
	for k, _ := range a {
		if inset, found := b[k]; !inset || !found {
			return false
		}
	}
	return true
}

func (a TrackSet) MemberOf(t TrackIdComponent) bool {
	ok, found := a[t.ToIdString()]
	return (ok && found)
}

func (a TrackSet) Equal(b TrackSet) bool {
	return ((len(a) == len(b)) && a.SubsetOf(b))
}

//=====================================================================

type TrackLookup struct {
	link *TrackChainLink     // The original chain link that I signed
	set  TrackSet            // The total set of tracked identities
	ids  map[string][]string // A http -> [foo.com, boo.com] lookup
}

type TrackDiff interface{}
type TrackDiffOmission struct{}
type TrackDiffClash struct{}

func NewTrackLookup(link *TrackChainLink) *TrackLookup {
	sbs := link.ToServiceBlocks()
	set := make(TrackSet)
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

//=====================================================================

type TrackEngine struct {
	TheirName    string
	Them         *User
	Me           *User
	Interactive  bool
	NoSelf       bool
	StrictProofs bool
	MeRequired   bool
}

func (e *TrackEngine) LoadThem() error {

	if e.Them == nil && len(e.TheirName) == 0 {
		return fmt.Errorf("No 'them' passed to TrackEngine")
	}
	if e.Them == nil {
		if u, err := LoadUser(LoadUserArg{
			Name:             e.TheirName,
			RequirePublicKey: true,
			Self:             false,
			LoadSecrets:      false,
			ForceReload:      false,
			SkipVerify:       false,
		}); err != nil {
			return err
		} else {
			e.Them = u
		}
	}
	return nil
}

func (e *TrackEngine) LoadMe() error {
	if e.Me == nil {
		if me, err := LoadMe(); err != nil && e.MeRequired {
			return err
		} else {
			e.Me = me
		}
	}
	return nil
}

func (e *TrackEngine) Run() error {

	var err error

	if err = e.LoadThem(); err != nil {
		return err
	} else if err = e.LoadMe(); err != nil {
		return err
	} else if e.NoSelf && e.Me.Equal(*e.Them) {
		return fmt.Errorf("Cannot track yourself")
	}

	if e.Me != nil {
		track := e.Me.GetTrackingStatementFor(e.Them.name)
		if track != nil {
			e.Them.IdTable.SetMyTrack(track)
		}

	}

	err = e.Them.Identify()
	if err != nil {
		if e.StrictProofs {
			return err
		} else {
			G.Log.Warning("Some proofs failed")
		}
	}

	var jw *jsonw.Wrapper
	jw, err = e.Me.TrackingProofFor(e.Them)
	if err != nil {
		return err
	}
	fmt.Printf("%v\n", jw.MarshalPretty())
	fmt.Printf("%v\n", e.Them.IdTable.MakeTrackSet())

	return nil
}

//=====================================================================
