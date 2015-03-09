package engine

import (
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase_1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
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
	tableResult []keybase_1.UserSummary
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

func (e *ListTrackingEngine) linkPGPKeys(link *libkb.TrackChainLink) (res []keybase_1.PubKey) {
	keys, err := link.GetTrackedPgpKeys()
	if len(keys) == 0 {
		// older track statements won't have 'pgp_keys' section.
		var fp *libkb.PgpFingerprint
		fp, err = link.GetTrackedPgpFingerprint()
		if err != nil {
			G.Log.Warning("Bad track of %s: %s", link.ToDisplayString(), err.Error())
		}
		res = append(res, keybase_1.PubKey{KeyFingerprint: fp.String()})
	} else {
		for _, key := range keys {
			res = append(res, keybase_1.PubKey{KeyFingerprint: key.String()})
		}
	}

	return res

}

func (e *ListTrackingEngine) linkSocialProofs(link *libkb.TrackChainLink) (res []keybase_1.TrackProof) {
	for _, sb := range link.ToServiceBlocks() {
		if !sb.IsSocial() {
			continue
		}
		proofType, proofName := sb.ToKeyValuePair()
		res = append(res, keybase_1.TrackProof{
			ProofType: proofType,
			ProofName: proofName,
			IdString:  sb.ToIdString(),
		})
	}
	return res
}

func (e *ListTrackingEngine) linkWebProofs(link *libkb.TrackChainLink) (res []keybase_1.WebProof) {
	webp := make(map[string]*keybase_1.WebProof)
	for _, sb := range link.ToServiceBlocks() {
		if sb.IsSocial() {
			continue
		}
		proofType, proofName := sb.ToKeyValuePair()
		p, ok := webp[proofName]
		if !ok {
			p = &keybase_1.WebProof{Hostname: proofName}
			webp[proofName] = p
		}
		p.Protocols = append(p.Protocols, proofType)
	}
	for _, v := range webp {
		res = append(res, *v)
	}
	return res
}

func (e *ListTrackingEngine) runTable(trackList TrackList) (err error) {
	for _, link := range trackList {
		entry := keybase_1.UserSummary{
			Username:  link.ToDisplayString(),
			SigId:     link.GetSigId().ToDisplayString(true),
			TrackTime: link.GetCTime().Unix(),
		}
		entry.Proofs.PublicKeys = e.linkPGPKeys(link)
		entry.Proofs.Social = e.linkSocialProofs(link)
		entry.Proofs.Web = e.linkWebProofs(link)
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

func (e *ListTrackingEngine) TableResult() []keybase_1.UserSummary {
	return e.tableResult
}

func (e *ListTrackingEngine) JsonResult() string {
	return e.jsonResult
}
