package engine

import (
	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	"github.com/keybase/go-jsonw"
	"regexp"
	"sort"
	"strings"
)

type TrackList []*libkb.TrackChainLink

func (tl TrackList) Len() int {
	return len(tl)
}

func (tl TrackList) Swap(i, j int) {
	tl[i], tl[j] = tl[j], tl[i]
}

func (tl TrackList) Less(i, j int) bool {
	return strings.ToLower(tl[i].ToDisplayString()) < strings.ToLower(tl[j].ToDisplayString())
}

type ListTrackingEngineArg struct {
	Json    bool
	Verbose bool
	Filter  string
}

type ListTrackingEngine struct {
	arg         *ListTrackingEngineArg
	tableResult []keybase_1.TrackEntry
	jsonResult  string
}

func NewListTrackingEngine(arg *ListTrackingEngineArg) *ListTrackingEngine {
	return &ListTrackingEngine{arg: arg}
}

func (s *ListTrackingEngine) Name() string {
	return "ListTracking"
}

func (e *ListTrackingEngine) GetPrereqs() EnginePrereqs { return EnginePrereqs{} }

func (k *ListTrackingEngine) RequiredUIs() []libkb.UIKind { return []libkb.UIKind{} }

func (s *ListTrackingEngine) SubConsumers() []libkb.UIConsumer { return nil }

func (e *ListTrackingEngine) Run(ctx *Context, varg interface{}, vres interface{}) (err error) {
	arg := libkb.LoadUserArg{Self: true}
	user, err := libkb.LoadUser(arg)

	if err != nil {
		return
	}

	var trackList TrackList
	trackList = user.IdTable.GetTrackList()

	trackList, err = filterRxx(trackList, e.arg.Filter)
	if err != nil {
		return
	}

	sort.Sort(trackList)

	if e.arg.Json {
		err = e.runJson(trackList, e.arg.Verbose)
	} else {
		err = e.runTable(trackList)
	}

	return
}

func filterTracks(trackList TrackList, f func(libkb.TrackChainLink) bool) TrackList {
	ret := TrackList{}
	for _, link := range trackList {
		if f(*link) {
			ret = append(ret, link)
		}
	}
	return ret
}

func filterRxx(trackList TrackList, filter string) (ret TrackList, err error) {
	if len(filter) == 0 {
		return trackList, nil
	}
	rxx, err := regexp.Compile(filter)
	if err != nil {
		return
	}
	return filterTracks(trackList, func(l libkb.TrackChainLink) bool {
		if rxx.MatchString(l.ToDisplayString()) {
			return true
		}
		for _, sb := range l.ToServiceBlocks() {
			_, v := sb.ToKeyValuePair()
			if rxx.MatchString(v) {
				return true
			}
		}
		return false
	}), nil
}

func (e *ListTrackingEngine) runTable(trackList TrackList) (err error) {
	e.tableResult = []keybase_1.TrackEntry{}
	for _, link := range trackList {
		var fp *libkb.PgpFingerprint
		fp, err = link.GetTrackedPgpFingerprint()
		if err != nil {
			G.Log.Warning("Bad track of %s: %s", link.ToDisplayString(), err.Error())
			continue
		}
		entry := keybase_1.TrackEntry{
			Username:       link.ToDisplayString(),
			SigId:          link.GetSigId().ToDisplayString(true),
			PgpFingerprint: fp.String(),
			TrackTime:      link.GetCTime().Unix(),
			Proofs:         []keybase_1.TrackProof{},
		}
		for _, sb := range link.ToServiceBlocks() {
			proofType, proofName := sb.ToKeyValuePair()
			entry.Proofs = append(entry.Proofs, keybase_1.TrackProof{
				ProofType: proofType,
				ProofName: proofName,
				IdString:  sb.ToIdString(),
			})
		}
		e.tableResult = append(e.tableResult, entry)
	}
	return
}

func (e *ListTrackingEngine) runJson(trackList TrackList, verbose bool) (err error) {
	tmp := make([]*jsonw.Wrapper, 0, 1)
	for _, link := range trackList {
		var rec *jsonw.Wrapper
		var e2 error
		if verbose {
			rec = link.GetPayloadJson()
		} else if rec, e2 = condenseRecord(link); e2 != nil {
			G.Log.Warning("In conversion to JSON: %s", e2.Error())
		}
		if e2 == nil {
			tmp = append(tmp, rec)
		}
	}

	ret := jsonw.NewArray(len(tmp))
	for i, r := range tmp {
		ret.SetIndex(i, r)
	}

	e.jsonResult = ret.MarshalPretty()
	return
}

func condenseRecord(l *libkb.TrackChainLink) (out *jsonw.Wrapper, err error) {
	var uid *libkb.UID
	var fp *libkb.PgpFingerprint
	var un string
	out = jsonw.NewDictionary()
	rp := l.RemoteKeyProofs()

	if uid, err = l.GetTrackedUid(); err != nil {
		return
	}

	if fp, err = l.GetTrackedPgpFingerprint(); err != nil {
		return
	}

	if un, err = l.GetTrackedUsername(); err != nil {
		return
	}

	out.SetKey("uid", jsonw.NewString(uid.String()))
	out.SetKey("key", jsonw.NewString(strings.ToUpper(fp.String())))
	out.SetKey("ctime", jsonw.NewInt64(l.GetCTime().Unix()))
	out.SetKey("username", jsonw.NewString(un))
	out.SetKey("proofs", rp)

	return
}

func (e *ListTrackingEngine) TableResult() []keybase_1.TrackEntry {
	return e.tableResult
}

func (e *ListTrackingEngine) JsonResult() string {
	return e.jsonResult
}
