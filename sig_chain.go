package libkb

type SigChain struct {
	uid UID

	lastSeqno  int
	lastLink   LinkId
	chainLinks []*ChainLink

	loaded   bool
	verified bool
}

func NewEmptySigChain(uid UID) *SigChain {
	return &SigChain{uid, 0, nil, nil, true, true}
}

func NewSigChain(uid UID, seqno int, lastLink LinkId) *SigChain {
	return &SigChain{uid, seqno, lastLink, nil, false, false}
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

	links := make([]*ChainLink, 10)

	for curr := sc.lastLink; curr != nil; {
		G.Log.Debug("| loading link; curr=%s", curr.ToString())
		if link, err := LoadLinkFromStorage(curr); err != nil {
			return err
		} else {
			links = append(links, link)
			curr = link.Prev()
		}
	}
	sc.chainLinks = reverse(links)

	G.Log.Debug("- %s: loaded signature chain", sc.uid)

	return nil
}
