package libkb

type CurrentStatus struct {
	configured        bool
	registered        bool
	loggedIn          bool
	publicKeySelected bool
	hasPrivateKey     bool
}

func GetCurrentStatus() (res CurrentStatus, err error) {
	if cr := G.Env.GetConfig(); cr == nil {
	} else {
		res.configured = true
		if u := cr.GetUid(); u != nil {
			res.registered = true
		}
		res.loggedIn, err = G.Session.LoadAndCheck()
		if fp := G.Env.GetPgpFingerprint(); fp != nil {
			res.publicKeySelected = true
		}
	}
	return
}
