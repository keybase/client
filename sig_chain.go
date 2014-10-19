package libkb

import (
	"fmt"
)

type SigChain struct {
	uid      UID
	username string

	lastSeqno      int
	lastLink       LinkId
	chainLinks     []*ChainLink
	pgpFingerprint *PgpFingerprint

	fromStorage   bool
	chainVerified bool
	sigVerified   bool
	idVerified    bool
	fromServer    bool
	dirty         bool

	// If we're loading a remote User but have some parts pre-loaded,
	// they will be available here as `base`
	base *SigChain
}

func NewEmptySigChain(uid UID, username string) *SigChain {
	return &SigChain{
		uid:            uid,
		username:       username,
		lastSeqno:      0,
		lastLink:       nil,
		chainLinks:     nil,
		pgpFingerprint: nil,
		fromStorage:    false,
		chainVerified:  true,
		sigVerified:    true,
		idVerified:     false,
		fromServer:     false,
		dirty:          false,
		base:           nil,
	}
}

func (sc SigChain) Len() int {
	return len(sc.chainLinks)
}

func NewSigChain(uid UID, username string, seqno int, lastLink LinkId,
	f *PgpFingerprint, base *SigChain) *SigChain {
	return &SigChain{
		uid:            uid,
		username:       username,
		lastSeqno:      seqno,
		lastLink:       lastLink,
		chainLinks:     nil,
		pgpFingerprint: f,
		fromStorage:    false,
		chainVerified:  false,
		sigVerified:    false,
		idVerified:     false,
		fromServer:     false,
		dirty:          true,
		base:           base,
	}
}

func reverse(list []*ChainLink) []*ChainLink {
	l := len(list)
	ret := make([]*ChainLink, l)
	for i := 0; i < l; i++ {
		ret[l-i-1] = list[i]
	}
	return ret
}

func (sc *SigChain) LoadFromServer(t *MerkleTriple) error {

	low := 0
	if sc.base != nil {
		low = sc.base.lastSeqno + 1
	}

	G.Log.Debug("+ Load SigChain from server (uid=%s, low=%d)",
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

	found_tail := false

	G.Log.Debug("| Got back %d new entries", lim)

	links := make([]*ChainLink, lim, lim)
	for i := 0; i < lim; i++ {
		var link *ChainLink
		var err error
		if link, err = LoadLinkFromServer(sc, v.AtIndex(i)); err != nil {
			return err
		}
		links[i] = link
		if found_tail || t == nil {
			continue
		}
		if found_tail, err = link.checkAgainstMerkleTree(t); err != nil {
			return err
		}
	}

	if t != nil && !found_tail {
		return fmt.Errorf("Failed to reach seqno=%d in server response",
			int(t.seqno))
	}

	sc.chainLinks = links
	sc.fromServer = true
	sc.fromStorage = false
	sc.dirty = true

	G.Log.Debug("- Loaded SigChain")
	return nil
}

func (sc *SigChain) LoadFromStorage() error {
	if sc.fromStorage {
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
		if link, err := LoadLinkFromStorage(sc, curr); err != nil {
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
			curr = link.GetPrev()
		}
	}
	if found {
		links = links[(i + 1):]
	} else {
		links = nil
	}

	sc.chainLinks = links

	G.Log.Debug("- %s: loaded signature chain", sc.uid)
	sc.fromStorage = true
	sc.dirty = false

	return nil
}

func (sc *SigChain) VerifyChainLinks() error {
	if sc.chainVerified {
		return nil
	}

	var prev *LinkId

	for _, link := range sc.chainLinks {
		if err := link.VerifyHash(); err != nil {
			return err
		}
		if prev != nil && !prev.Eq(link.GetPrev()) {
			return fmt.Errorf("Chain mismatch at seqno=%d", link.GetSeqno())
		}
		id := link.id
		prev = &id
	}

	sc.chainVerified = true
	return nil
}

func (sc SigChain) GetPrevId() LinkId {
	if len(sc.chainLinks) == 0 {
		return nil
	} else {
		return sc.chainLinks[0].GetPrev()
	}
}

func (sc SigChain) GetLastId() LinkId {
	l := len(sc.chainLinks)
	if l == 0 {
		return nil
	} else {
		return sc.chainLinks[l-1].id
	}
}

func (sc SigChain) GetLastLinkRecursive() *ChainLink {
	l := len(sc.chainLinks)
	if l > 0 {
		return sc.chainLinks[l-1]
	} else if sc.base != nil {
		return sc.base.GetLastLinkRecursive()
	} else {
		return nil
	}
}

// Flatten the potentially recursive structure into single
// chain.  It's ok to be recursive here, since likely the depth
// is only 1.  But we can revisit this.
func (sc *SigChain) Flatten() {
	if sc.base != nil {
		sc.base.Flatten()
		sc.fromServer = sc.base.fromServer
		sc.chainLinks = append(sc.base.chainLinks, sc.chainLinks...)
		sc.base = nil
	}
}

func (sc *SigChain) FlattenAndPrune() {
	sc.Flatten()
	sc.Prune()
}

func (sc *SigChain) Prune() {
	if sc.pgpFingerprint != nil && sc.chainLinks != nil {
		fp := *sc.pgpFingerprint

		i := len(sc.chainLinks) - 1

		for ; i >= 0; i-- {
			link := sc.chainLinks[i]
			if !link.MatchFingerprint(fp) {
				i++
				break
			}
		}
		sc.chainLinks = sc.chainLinks[i:]
	}
}

func (sc *SigChain) Store() error {
	if sc.base != nil {
		if err := sc.base.Store(); err != nil {
			return err
		}
	}

	// If we loaded this chain from storage, no need to store it again
	if !sc.dirty {
		return nil
	}

	if sc.chainLinks != nil {
		for _, link := range sc.chainLinks {
			if err := link.Store(); err != nil {
				return err
			}
		}
	}

	sc.dirty = false
	return nil
}

func (sc *SigChain) verifyId(fp PgpFingerprint) (good bool, searched bool) {

	var fp_mismatch, search, ok bool

	if sc.chainLinks != nil {
		for i := len(sc.chainLinks) - 1; i >= 0; i-- {
			cl := sc.chainLinks[i]
			if !cl.MatchFingerprint(fp) {
				fp_mismatch = true
				break
			}
			search = true
			if ok = cl.MatchUidAndUsername(sc.uid, sc.username); ok {
				return true, true
			}
		}
	}

	if !fp_mismatch && sc.base != nil {
		ok, search = sc.base.verifyId(fp)
		if ok {
			return true, true
		}
	}

	return false, search
}

func (sc *SigChain) VerifyId(key *PgpKeyBundle) error {

	if sc.idVerified {
		return nil
	}

	fp := key.GetFingerprint()

	good, searched := sc.verifyId(fp)
	if good {
		sc.idVerified = true
		return nil
	}

	if !searched && key.FindKeybaseUsername(sc.username) {
		sc.idVerified = true
		return nil
	}

	return fmt.Errorf("No proof of UID %s for user %s w/ key %s",
		string(sc.uid), sc.username, fp.ToString())
}

func (sc *SigChain) VerifyWithKey(key *PgpKeyBundle) (cached bool, err error) {

	cached = false
	G.Log.Debug("+ VerifyWithKey for user %s", sc.uid)

	if sc.sigVerified {
		cached = true
		return
	}

	if err = sc.VerifyChain(); err != nil {
		return
	}

	if err = sc.VerifyId(key); err != nil {
		return
	}

	if last := sc.GetLastLinkRecursive(); last != nil {
		cached, err = last.VerifySig(*key)
	}

	if err == nil {
		sc.sigVerified = true
	}

	G.Log.Debug("- VerifyWithKey for user %s -> %v", sc.uid, (err == nil))

	return
}

func (sc *SigChain) VerifyChain() error {

	G.Log.Debug("+ VerifyChain() for %s", sc.uid)

	if sc.chainVerified {
		return nil
	}

	var err error

	if err = sc.VerifyChainLinks(); err != nil {
		return err
	}

	if sc.base != nil {
		if err = sc.base.VerifyChainLinks(); err != nil {
			return err
		}
		if !sc.GetPrevId().Eq(sc.base.GetLastId()) {
			return fmt.Errorf("Stored chain doesn't match fetched chain for %s",
				sc.uid)
		}
	}

	sc.chainVerified = true
	G.Log.Debug("- VerifyChain() for %s", sc.uid)
	return nil
}
