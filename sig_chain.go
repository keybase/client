package libkb

type SigChain struct {
	uid UID

	lastSeqno      int
	lastLink       LinkId
	chainLinks     []*ChainLink
	pgpFingerprint *PgpFingerprint

	loaded   bool
	verified bool
}

func NewEmptySigChain(uid UID) *SigChain {
	return &SigChain{uid, 0, nil, nil, nil, true, true}
}

func NewSigChain(uid UID, seqno int, lastLink LinkId,
	f *PgpFingerprint) *SigChain {
	return &SigChain{uid, seqno, lastLink, nil, f, false, false}
}

func reverse(list []*ChainLink) []*ChainLink {
	l := len(list)
	ret := make([]*ChainLink, l)
	for i := 0; i < l; i++ {
		ret[l-i-1] = list[i]
	}
	return ret
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
