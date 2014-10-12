package libkb

type SigChain struct {
	uid UID

	lastSeqno      int
	lastLink       LinkId
	chainLinks     []*ChainLink
	pgpFingerprint *PgpFingerprint

	loaded   bool
	verified bool

	// If we're loading a remote User but have some parts pre-loaded,
	// they will be available here as `base`
	base *SigChain
}

func NewEmptySigChain(uid UID) *SigChain {
	return &SigChain{uid, 0, nil, nil, nil, true, true, nil}
}

func NewSigChain(uid UID, seqno int, lastLink LinkId,
	f *PgpFingerprint, base *SigChain) *SigChain {
	return &SigChain{uid, seqno, lastLink, nil, f, false, false, base}
}

func reverse(list []*ChainLink) []*ChainLink {
	l := len(list)
	ret := make([]*ChainLink, l)
	for i := 0; i < l; i++ {
		ret[l-i-1] = list[i]
	}
	return ret
}

func (sc *SigChain) LoadFromServer() error {
	low := 0
	if sc.base != nil {
		low = sc.base.lastSeqno + 1
	}

	G.Log.Debug("+ Load SigChain from server (uid=%s, low=%d",
		string(sc.uid), low)

	res, err := G.API.Get(ApiArg{
		Endpoint:    "sig/get",
		NeedSession: false,
		Args: HttpArgs{
			"uid": S{string(sc.uid)},
			"low": I{low},
		},
	})

	if err != nil {
		return err
	}

	v := res.Body.AtKey("sigs")
	lim, err := v.Len()
	if err != nil {
		return err
	}

	G.Log.Debug("| Got back %d new entries", lim)

	links := make([]*ChainLink, lim, lim)
	for i := 0; i < lim; i++ {
		if link, err := LoadLinkFromServer(v.AtIndex(i)); err != nil {
			return err
		} else {
			links[i] = link
		}
	}
	sc.chainLinks = links

	G.Log.Debug("- Loaded SigChain")
	return nil
}

func (sc *SigChain) LoadFromStorage() error {
	if sc.loaded {
		return nil
	}

	G.Log.Debug("+ %s: loading signature chain", sc.uid)

	lim := sc.lastSeqno + 1
	links := make([]*ChainLink, lim, lim)
	i := lim - 1

	found := false
	good_key := true

	for curr := sc.lastLink; curr != nil && good_key; {
		G.Log.Debug("| loading link; curr=%s", curr.ToString())
		if link, err := LoadLinkFromStorage(curr); err != nil {
			return err
		} else if fp1, fp2 := sc.pgpFingerprint, link.GetPgpFingerprint(); fp1 != nil && !fp1.Eq(fp2) {
			// If we're loading a sigchain only for the given key, don't
			// keep loading once we see a key that looks wrong.
			good_key = false
			G.Log.Debug("| Stop loading at fp=%s (!= fp=%s)",
				fp1.ToString(), fp2.ToString())
		} else {
			links[i] = link
			i--
			found = true
			curr = link.Prev()
		}
	}
	if found {
		links = links[(i + 1):]
	} else {
		links = nil
	}

	sc.chainLinks = links

	G.Log.Debug("- %s: loaded signature chain", sc.uid)

	return nil
}

func (sc *SigChain) VerifyWithKey(key *PgpKeyBundle) error {
	return nil
}
