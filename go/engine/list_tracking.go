package engine

import (
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
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
	JSON    bool
	Verbose bool
	Filter  string
}

type ListTrackingEngine struct {
	arg         *ListTrackingEngineArg
	tableResult []keybase1.UserSummary
	jsonResult  string
	libkb.Contextified
}

func NewListTrackingEngine(arg *ListTrackingEngineArg, g *libkb.GlobalContext) *ListTrackingEngine {
	return &ListTrackingEngine{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

func (e *ListTrackingEngine) Name() string {
	return "ListTracking"
}

func (e *ListTrackingEngine) Prereqs() Prereqs { return Prereqs{} }

func (e *ListTrackingEngine) RequiredUIs() []libkb.UIKind { return []libkb.UIKind{} }

func (e *ListTrackingEngine) SubConsumers() []libkb.UIConsumer { return nil }

func (e *ListTrackingEngine) Run(ctx *Context) (err error) {
	user, err := libkb.LoadMe(libkb.NewLoadUserArg(e.G()))

	if err != nil {
		return
	}

	var trackList TrackList
	trackList = user.IDTable().GetTrackList()

	trackList, err = filterRxx(trackList, e.arg.Filter)
	if err != nil {
		return
	}

	sort.Sort(trackList)

	if e.arg.JSON {
		err = e.runJSON(trackList, e.arg.Verbose)
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

func (e *ListTrackingEngine) linkPGPKeys(link *libkb.TrackChainLink) (res []keybase1.PublicKey) {
	trackedKeys, err := link.GetTrackedKeys()
	if err != nil {
		e.G().Log.Warning("Bad track of %s: %s", link.ToDisplayString(), err)
		return res
	}

	for _, trackedKey := range trackedKeys {
		res = append(res, keybase1.PublicKey{PGPFingerprint: trackedKey.Fingerprint.String()})
	}
	return res
}

func (e *ListTrackingEngine) linkSocialProofs(link *libkb.TrackChainLink) (res []keybase1.TrackProof) {
	for _, sb := range link.ToServiceBlocks() {
		if !sb.IsSocial() {
			continue
		}
		proofType, proofName := sb.ToKeyValuePair()
		res = append(res, keybase1.TrackProof{
			ProofType: proofType,
			ProofName: proofName,
			IdString:  sb.ToIDString(),
		})
	}
	return res
}

func (e *ListTrackingEngine) linkWebProofs(link *libkb.TrackChainLink) (res []keybase1.WebProof) {
	webp := make(map[string]*keybase1.WebProof)
	for _, sb := range link.ToServiceBlocks() {
		if sb.IsSocial() {
			continue
		}
		proofType, proofName := sb.ToKeyValuePair()
		p, ok := webp[proofName]
		if !ok {
			p = &keybase1.WebProof{Hostname: proofName}
			webp[proofName] = p
		}
		p.Protocols = append(p.Protocols, proofType)
	}
	for _, v := range webp {
		res = append(res, *v)
	}
	return res
}

func (e *ListTrackingEngine) runTable(trackList TrackList) error {
	for _, link := range trackList {
		uid, err := link.GetTrackedUID()
		if err != nil {
			return err
		}
		entry := keybase1.UserSummary{
			Username:     link.ToDisplayString(),
			SigIDDisplay: link.GetSigID().ToDisplayString(true),
			TrackTime:    keybase1.ToTime(link.GetCTime()),
			Uid:          keybase1.UID(uid),
		}
		entry.Proofs.PublicKeys = e.linkPGPKeys(link)
		entry.Proofs.Social = e.linkSocialProofs(link)
		entry.Proofs.Web = e.linkWebProofs(link)
		e.tableResult = append(e.tableResult, entry)
	}
	return nil
}

func (e *ListTrackingEngine) runJSON(trackList TrackList, verbose bool) error {
	var tmp []*jsonw.Wrapper
	for _, link := range trackList {
		var rec *jsonw.Wrapper
		var e2 error
		if verbose {
			rec = link.GetPayloadJSON()
		} else if rec, e2 = condenseRecord(link); e2 != nil {
			e.G().Log.Warning("In conversion to JSON: %s", e2)
		}
		if e2 == nil {
			tmp = append(tmp, rec)
		}
	}

	ret := jsonw.NewArray(len(tmp))
	for i, r := range tmp {
		if err := ret.SetIndex(i, r); err != nil {
			return err
		}
	}

	e.jsonResult = ret.MarshalPretty()
	return nil
}

func condenseRecord(l *libkb.TrackChainLink) (*jsonw.Wrapper, error) {
	uid, err := l.GetTrackedUID()
	if err != nil {
		return nil, err
	}

	trackedKeys, err := l.GetTrackedKeys()
	if err != nil {
		return nil, err
	}
	fpsDisplay := make([]string, len(trackedKeys))
	for i, trackedKey := range trackedKeys {
		fpsDisplay[i] = strings.ToUpper(trackedKey.Fingerprint.String())
	}

	un, err := l.GetTrackedUsername()
	if err != nil {
		return nil, err
	}

	rp := l.RemoteKeyProofs()

	out := jsonw.NewDictionary()
	out.SetKey("uid", libkb.UIDWrapper(uid))
	out.SetKey("keys", jsonw.NewString(strings.Join(fpsDisplay, ", ")))
	out.SetKey("ctime", jsonw.NewInt64(l.GetCTime().Unix()))
	out.SetKey("username", jsonw.NewString(un))
	out.SetKey("proofs", rp)

	return out, nil
}

func (e *ListTrackingEngine) TableResult() []keybase1.UserSummary {
	return e.tableResult
}

func (e *ListTrackingEngine) JSONResult() string {
	return e.jsonResult
}
