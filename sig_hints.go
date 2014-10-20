
package libkb

import (
	"github.com/keybase/go-jsonw"
)

type SigHint struct {
	sigId *SigId
	remoteId string
	apiUrl string
	humanUrl string
}

type SigHints struct {
	version int
	hints map[SigId]*SigHint
}

func NewSigHint(jw *jsonw.Wrapper) (sh *SigHint, err error) {
	sh = &SigHint{}
	sh.sigId, err = GetSigId(jw.AtKey("sig_id"), true)
	sh.remoteId, _ = jw.AtKey("remote_it").GetString()
	sh.apiUrl, _ = jw.AtKey("api_url").GetString()
	sh.humanUrl, _ = jw.AtKey("human_url").GetString()
	return
}

func NewSigHints(jw *jsonw.Wrapper) (sh *SigHints, err error) {
	var n int

	obj := SigHints{}

	if jw.IsNil() {
		sh = &obj
		return
	}

	jw.AtKey("version").GetIntVoid(&obj.version, &err)
	if err != nil {
		return
	}

	obj.hints = make(map[SigId]*SigHint)
	n, err = jw.AtKey("hints").Len()
	if err != nil {
		return
	}

	for i := 0; i < n; i++ {
		hint, tmpe := NewSigHint(jw.AtKey("hints").AtIndex(i))
		if tmpe != nil {
			G.Log.Warning("Bad SigHint Loaded: %s", tmpe.Error())
		} else {
			obj.hints[*hint.sigId] = hint
		}
	}

	sh = &obj
	return
}
