package libkb

import (
	"fmt"
	"io/ioutil"

	"github.com/buger/jsonparser"
	"github.com/keybase/client/go/jsonparserw"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func LoadUPAKLite(arg LoadUserArg) (ret *keybase1.UpkLiteV1AllIncarnations, err error) {
	uid := arg.uid
	m := arg.m

	leaf, err := lookupMerkleLeaf(m, uid, false, nil)
	if err != nil {
		return nil, err
	}
	user, err := LoadUserFromServer(m, uid, nil)
	if err != nil {
		return nil, err
	}
	loader := NewHighSigChainLoader(m, user, leaf)
	highChain, err := loader.Load()
	if err != nil {
		return nil, err
	}
	return highChain.ToUPAKLite(user)
}

type HighSigChainLoader struct {
	MetaContextified
	user      *User
	leaf      *MerkleUserLeaf
	chain     *HighSigChain
	chainType *ChainType
	links     ChainLinks
	ckf       ComputedKeyFamily
	dirtyTail *MerkleTriple
}

type HighSigChain struct {
	Contextified
	uid        keybase1.UID
	username   NormalizedUsername
	chainLinks ChainLinks
}

func NewHighSigChainLoader(m MetaContext, user *User, leaf *MerkleUserLeaf) *HighSigChainLoader {
	hsc := HighSigChain{
		uid:      user.GetUID(),
		username: user.GetNormalizedName(),
	}
	loader := HighSigChainLoader{
		user:             user,
		leaf:             leaf,
		chain:            &hsc,
		chainType:        PublicChain,
		MetaContextified: NewMetaContextified(m),
	}
	loader.ckf.kf = user.GetKeyFamily()
	return &loader
}

func (l *HighSigChainLoader) Load() (ret *HighSigChain, err error) {
	// request new links (and the unverified tail) from the server
	// and put them into the highSigChain
	err = l.LoadFromServer()
	if err != nil {
		return nil, err
	}
	// verify the chain
	err = l.chain.VerifyChain(l.M())
	if err != nil {
		return nil, err
	}
	// compute keys
	err = l.VerifySigsAndComputeKeys()

	return l.chain, nil
}

func (l *HighSigChainLoader) selfUID() (uid keybase1.UID) {
	// for now let's always assume this isn't applicable, because there's
	// no distinction for loading yourself
	return uid
}

func (l *HighSigChainLoader) LoadFromServer() (err error) {
	srv := l.GetMerkleTriple()
	l.dirtyTail, err = l.chain.LoadFromServer(l.M(), srv, l.selfUID())
	return err
}

func (hsc *HighSigChain) LoadFromServer(m MetaContext, t *MerkleTriple, selfUID keybase1.UID) (dirtyTail *MerkleTriple, err error) {
	// get the high sigs from the server
	// ------------------
	m, tbs := m.WithTimeBuckets()

	apiArg := APIArg{
		Endpoint:    "sig/get_high",
		SessionType: APISessionTypeREQUIRED,
		Args:        HTTPArgs{"uid": S{Val: hsc.uid.String()}},
		MetaContext: m,
	}
	resp, finisher, err := m.G().API.GetResp(apiArg)
	if err != nil {
		return nil, err
	}
	if finisher != nil {
		defer finisher()
	}
	recordFin := tbs.Record("HighSigChain.LoadFromServer.ReadAll")
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		recordFin()
		return nil, err
	}
	recordFin()

	// parse the response
	// ------------------
	if val, err := jsonparserw.GetInt(body, "status", "code"); err == nil {
		if keybase1.StatusCode(val) == keybase1.StatusCode_SCDeleted {
			return nil, UserDeletedError{}
		}
	}
	var links ChainLinks
	var lastLink *ChainLink

	jsonparserw.ArrayEach(body, func(value []byte, dataType jsonparser.ValueType, offset int, inErr error) {
		var link *ChainLink

		parentSigChain := &SigChain{} // because we don't want the cache to use these
		link, err = ImportLinkFromServer(m, parentSigChain, value, selfUID)
		links = append(links, link)
		lastLink = link
	}, "sigs")
	foundTail, err := lastLink.checkAgainstMerkleTree(t)
	if err != nil {
		return nil, err
	}
	if !foundTail {
		err = fmt.Errorf("Last link is not the tail")
		return nil, err
	}
	dirtyTail = lastLink.ToMerkleTriple()

	hsc.chainLinks = links
	return dirtyTail, err
}

func (hsc *HighSigChain) VerifyChain(m MetaContext) (err error) {
	m.CDebugf("+ HighSigChain#VerifyChain()")
	defer func() {
		m.CDebugf("- HighSigChain#VerifyChain() -> %s", ErrToOk(err))
	}()

	for i := len(hsc.chainLinks) - 1; i >= 0; i-- {
		curr := hsc.chainLinks[i]
		m.VLogf(VLog1, "| verify high chain link %d (%s)", curr.GetSeqno(), curr.id)
		if err = curr.VerifyLink(); err != nil {
			return err
		}
		if i > 0 {
			prev := hsc.chainLinks[i-1]
			var expectedPrevID LinkID
			var expectedPrevSeqno keybase1.Seqno
			if curr.GetHighSkip() != nil {
				expectedPrevSeqno = curr.GetHighSkip().Seqno
				expectedPrevID = curr.GetHighSkip().Hash
			} else {
				// fallback to normal prevs if the link doesn't have a high_skip
				expectedPrevSeqno = curr.GetSeqno() - 1
				expectedPrevID = curr.GetPrev()
			}
			if i == 0 && (expectedPrevSeqno != 0 || expectedPrevID != nil) {
				return ChainLinkPrevHashMismatchError{
					fmt.Sprintf("The first link should have 0,nil for it's expected previous. It had %d, %s", expectedPrevSeqno, expectedPrevID),
				}
			}
			if !prev.id.Eq(expectedPrevID) {
				return ChainLinkPrevHashMismatchError{fmt.Sprintf("Chain mismatch at seqno=%d", curr.GetSeqno())}
			}
			if prev.GetSeqno() != expectedPrevSeqno {
				return ChainLinkWrongSeqnoError{fmt.Sprintf("Chain seqno mismatch at seqno=%d (previous=%d)", curr.GetSeqno(), prev.GetSeqno())}
			}
		}
		if err = curr.CheckNameAndID(hsc.username, hsc.uid); err != nil {
			return err
		}
		// this isn't being used for anything right now, but it might be useful
		// if we ever want to do caching, especially as it can be distinguished
		// from the other field, chainVerified
		curr.highChainVerified = true
	}
	return nil
}

func (l *HighSigChainLoader) VerifySigsAndComputeKeys() (err error) {
	_, err = l.chain.VerifySigsAndComputeKeys(l.M(), l.leaf.eldest, &l.ckf)
	return err
}

func (hsc *HighSigChain) VerifySigsAndComputeKeys(m MetaContext, eldest keybase1.KID, ckf *ComputedKeyFamily) (cached bool, err error) {
	un := hsc.username
	_, ckf.cki, err = verifySubchain(m, un, *ckf.kf, hsc.chainLinks)
	if err != nil {
		return false, err
	}
	return false, nil
}

func (l *HighSigChainLoader) GetMerkleTriple() (ret *MerkleTriple) {
	// leaf is what the server said was the leaf for the user
	if l.leaf != nil {
		ret = l.chainType.GetMerkleTriple(l.leaf)
	}
	return ret
}

func (hsc HighSigChain) ToUPAKLite(user *User) (ret *keybase1.UpkLiteV1AllIncarnations, err error) {
	// this method probably shouldn't be on the Highsigchain, but should instead be
	// a top level thing that takes one. this is easier for now.
	kf := user.GetKeyFamily()
	uid := user.GetUID()
	name := user.GetName()
	status := user.GetStatus()

	eldestSeqno := hsc.chainLinks[0].GetSeqno()
	cki := hsc.GetComputedKeyInfos()

	deviceKeys := make(map[keybase1.KID]keybase1.PublicKeyV2NaCl)
	pgpSummaries := make(map[keybase1.KID]keybase1.PublicKeyV2PGPSummary)
	if cki != nil {
		for kid := range cki.Infos {
			if KIDIsPGP(kid) {
				pgpSummaries[kid] = cki.exportPGPKeyV2(kid, kf)
			} else {
				deviceKeys[kid] = cki.exportDeviceKeyV2(kid)
			}
		}
	}

	current := keybase1.UpkLiteV1{
		Uid:         uid,
		Username:    name,
		EldestSeqno: eldestSeqno,
		Status:      status,
		DeviceKeys:  deviceKeys,
	}

	final := keybase1.UpkLiteV1AllIncarnations{
		Current: current,
	}
	ret = &final
	return ret, err
}

func (hsc HighSigChain) GetComputedKeyInfos() (cki *ComputedKeyInfos) {
	if cki == nil {
		if l := last(hsc.chainLinks); l != nil {
			if l.cki == nil {
				hsc.G().Log.Debug("GetComputedKeyInfos: l.cki is nil")
			}
			cki = l.cki
		}
	}
	return cki
}
