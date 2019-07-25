package libkb

import (
	"fmt"
	"io/ioutil"

	"github.com/buger/jsonparser"
	"github.com/keybase/client/go/jsonparserw"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func LoadUPAKLite(arg LoadUserArg) (ret *keybase1.UPKLiteV1AllIncarnations, err error) {
	uid := arg.uid
	m := arg.m

	user, err := LoadUserFromServer(m, uid, nil)
	if err != nil {
		return nil, err
	}
	leaf, err := lookupMerkleLeaf(m, uid, false, nil, MerkleOpts{NoServerPolling: false})
	if err != nil {
		return nil, err
	}
	loader := NewHighSigChainLoader(m, user, leaf)
	highChain, err := loader.Load()
	if err != nil {
		return nil, err
	}
	return buildUPKLiteAllIncarnations(m, user, leaf, highChain)
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
	MetaContextified
	uid        keybase1.UID
	username   NormalizedUsername
	chainLinks ChainLinks
	// for a locally delegated key
	localCki *ComputedKeyInfos
	// For a user who has never done a reset, this is 1.
	currentSubchainStart keybase1.Seqno
	prevSubchains        []ChainLinks
}

const UPKLiteMinorVersionCurrent = keybase1.UPKLiteMinorVersion_V0

func NewHighSigChainLoader(m MetaContext, user *User, leaf *MerkleUserLeaf) *HighSigChainLoader {
	hsc := HighSigChain{
		MetaContextified: NewMetaContextified(m),
		uid:              user.GetUID(),
		username:         user.GetNormalizedName(),
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
	if err != nil {
		return nil, err
	}
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
		SessionType: APISessionTypeOPTIONAL,
		Args:        HTTPArgs{"uid": S{Val: hsc.uid.String()}},
	}
	resp, finisher, err := m.G().API.GetResp(m, apiArg)
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
	defer m.Trace("HighSigChain.VerifyChain", func() error { return err })()

	for i := len(hsc.chainLinks) - 1; i >= 0; i-- {
		curr := hsc.chainLinks[i]
		m.VLogf(VLog1, "| verify high chain link %d (%s)", curr.GetSeqno(), curr.id)
		if err = curr.VerifyLink(); err != nil {
			return err
		}
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
		if i > 0 {
			prev := hsc.chainLinks[i-1]
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

func (hsc *HighSigChain) verifySigsAndComputeKeysCurrent(m MetaContext, eldest keybase1.KID, ckf *ComputedKeyFamily) (linksConsumed int, err error) {
	// this is the case immediately after a reset
	if ckf.kf == nil || eldest.IsNil() {
		m.VLogf(VLog1, "UPAKLite short-circuit verifySigsAndComputeKeysCurrent, since no Key available")
		hsc.localCki = NewComputedKeyInfos(hsc.G())
		ckf.cki = hsc.localCki
		return 0, err
	}

	var links ChainLinks
	links, err = cropToRightmostSubchain(m, hsc.chainLinks, eldest, hsc.uid)
	if err != nil {
		return 0, err
	}
	if len(links) == 0 {
		// actually, not sure how this can happen without eldest being nil
		m.VLogf(VLog1, "Empty chain after we limited to eldest %s", eldest)
		hsc.localCki = NewComputedKeyInfos(hsc.G())
		ckf.cki = hsc.localCki
		return 0, nil
	}

	hsc.currentSubchainStart = links[0].GetSeqno()
	m.VLogf(VLog1, "UPAKLite verifying current chain starting at %d", int(hsc.currentSubchainStart))
	_, ckf.cki, err = verifySubchain(m, hsc.username, *ckf.kf, links)
	return len(links), err
}

func (hsc *HighSigChain) VerifySigsAndComputeKeys(m MetaContext, eldest keybase1.KID, ckf *ComputedKeyFamily) (cached bool, err error) {
	username := hsc.username
	uid := hsc.uid
	hsc.currentSubchainStart = 0

	// current
	linksConsumed, err := hsc.verifySigsAndComputeKeysCurrent(m, eldest, ckf)
	if err != nil || ckf.kf == nil {
		return false, err
	}

	//historical
	historicalLinks := hsc.chainLinks.omittingNRightmostLinks(linksConsumed)
	if len(historicalLinks) > 0 {
		m.VLogf(VLog1, "After consuming %d links, there are %d historical links left",
			linksConsumed, len(historicalLinks))
		// errors are ignored from this method in full sigchain loads also, because we'd rather
		// not block current behavior from a failure in here.
		_, prevSubchains, _ := verifySigsAndComputeKeysHistorical(m, uid, username, historicalLinks, *ckf.kf)
		hsc.prevSubchains = prevSubchains
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

func extractDeviceKeys(cki *ComputedKeyInfos) *map[keybase1.KID]keybase1.PublicKeyV2NaCl {
	deviceKeys := make(map[keybase1.KID]keybase1.PublicKeyV2NaCl)
	if cki != nil {
		for kid := range cki.Infos {
			if !KIDIsPGP(kid) {
				deviceKeys[kid] = cki.exportDeviceKeyV2(kid)
			}
		}
	}
	return &deviceKeys
}

func buildUPKLiteAllIncarnations(m MetaContext, user *User, leaf *MerkleUserLeaf, hsc *HighSigChain) (ret *keybase1.UPKLiteV1AllIncarnations, err error) {
	// build the current UPKLiteV1
	uid := user.GetUID()
	name := user.GetName()
	status := user.GetStatus()
	eldestSeqno := hsc.currentSubchainStart
	deviceKeys := extractDeviceKeys(hsc.GetComputedKeyInfos())
	currentUpk := keybase1.UPKLiteV1{
		Uid:         uid,
		Username:    name,
		EldestSeqno: eldestSeqno,
		Status:      status,
		DeviceKeys:  *deviceKeys,
		Reset:       nil,
	}

	// build the historical (aka PastIncarnations) UPKLiteV1s
	var previousUpks []keybase1.UPKLiteV1
	resetMap := make(map[int](*keybase1.ResetSummary))
	if resets := leaf.resets; resets != nil {
		for _, l := range resets.chain {
			tmp := l.Summarize()
			resetMap[int(l.ResetSeqno)] = &tmp
		}
	}
	for idx, subchain := range hsc.prevSubchains {
		latestLink := subchain[len(subchain)-1]
		eldestSeqno = subchain[0].GetSeqno()
		reset := resetMap[idx+1]
		if reset != nil {
			reset.EldestSeqno = eldestSeqno
		}
		prevDeviceKeys := extractDeviceKeys(latestLink.cki)
		prevUpk := keybase1.UPKLiteV1{
			Uid:         uid,
			Username:    name,
			EldestSeqno: eldestSeqno,
			Status:      status,
			DeviceKeys:  *prevDeviceKeys,
			Reset:       reset,
		}
		previousUpks = append(previousUpks, prevUpk)
	}

	// Collect the link IDs (that is, the hashes of the signature inputs) from all chainlinks.
	linkIDs := map[keybase1.Seqno]keybase1.LinkID{}
	for _, link := range hsc.chainLinks {
		linkIDs[link.GetSeqno()] = link.LinkID().Export()
	}

	final := keybase1.UPKLiteV1AllIncarnations{
		Current:          currentUpk,
		PastIncarnations: previousUpks,
		SeqnoLinkIDs:     linkIDs,
		MinorVersion:     UPKLiteMinorVersionCurrent,
	}
	ret = &final
	return ret, err
}

func (hsc HighSigChain) GetComputedKeyInfos() (cki *ComputedKeyInfos) {
	cki = hsc.localCki
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
