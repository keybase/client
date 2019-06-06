package hidden

import (
	"fmt"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
)

func importChain(mctx libkb.MetaContext, raw []sig3.ExportJSON) (ret []sig3.Generic, err error) {
	ret = make([]sig3.Generic, 0, len(raw))
	for _, s := range raw {
		g, err := s.Import()
		if err != nil {
			return nil, err
		}
		ret = append(ret, g)
	}
	return ret, nil
}

func toReaderKey(g sig3.Generic) (rotateKey *sig3.RotateKey, readerKey *sig3.PerTeamKey, err error) {
	if sig3.IsStubbed(g) {
		return nil, nil, nil
	}
	rotateKey, ok := g.(*sig3.RotateKey)
	if !ok {
		return nil, nil, fmt.Errorf("got bad sig3.Generic back (%T)", g)
	}
	readerKey = rotateKey.ReaderKey()
	if readerKey == nil {
		return nil, nil, fmt.Errorf("no reader key found in link")
	}
	return rotateKey, readerKey, nil
}

func checkSeed(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem, link sig3.Generic) (err error) {

	if sig3.IsStubbed(link) {
		return nil
	}
	rotateKey, ok := link.(*sig3.RotateKey)
	if !ok {
		return fmt.Errorf("got bad sig3.Generic back (%T)", link)
	}

	readerKey := rotateKey.ReaderKey()
	if readerKey == nil {
		return fmt.Errorf("no reader key found in link")
	}

	gen := readerKey.Generation
	seed, ok := seeds[gen]
	if !ok {
		return fmt.Errorf("seed at generation %d wasn't found", gen)
	}
	if seed.Check == nil {
		return fmt.Errorf("seed check at generation %d was nil", gen)
	}
	hash, err := seed.Check.Hash()
	if err != nil {
		return err
	}
	if !hash.Eq(readerKey.SeedCheck) {
		return fmt.Errorf("wrong seed check at generation %d", gen)
	}
	return nil
}

func checkSeedSequence(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem, links []sig3.Generic) (err error) {
	for _, link := range links {
		err := checkSeed(mctx, seeds, link)
		if err != nil {
			return err
		}
	}
	return nil
}

func populateLink(mctx libkb.MetaContext, ret *keybase1.HiddenTeamChainData, link sig3.Generic) (err error) {
	hsh, err := sig3.Hash(link)
	if err != nil {
		return err
	}
	q := link.Seqno()
	ret.Outer[q] = hsh.Export()
	if q > ret.Last {
		ret.Last = q
	}
	if sig3.IsStubbed(link) {
		return nil
	}
	rotateKey, ok := link.(*sig3.RotateKey)
	if !ok {
		return fmt.Errorf("got bad sig3.Generic back (%T)", link)
	}

	rkex, err := rotateKey.Export()
	if err != nil {
		return err
	}
	ret.Inner[q] = *rkex
	return nil
}

func toHiddenTeamChainData(mctx libkb.MetaContext, id keybase1.TeamID, links []sig3.Generic) (ret *keybase1.HiddenTeamChainData, err error) {
	ret = &keybase1.HiddenTeamChainData{
		ID:     id,
		Public: id.IsPublic(),
		Last:   keybase1.Seqno(0),
		Outer:  make(map[keybase1.Seqno]keybase1.LinkID),
		Inner:  make(map[keybase1.Seqno]keybase1.HiddenTeamChainLink),
	}
	for _, link := range links {
		err = populateLink(mctx, ret, link)
		if err != nil {
			return nil, err
		}
	}
	return ret, nil
}

func ProcessUpdate(mctx libkb.MetaContext, id keybase1.TeamID, ratchet keybase1.Seqno, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem, update []sig3.ExportJSON) (ret *keybase1.HiddenTeamChainData, err error) {
	if len(update) == 0 {
		return nil, nil
	}
	links, err := importChain(mctx, update)
	if err != nil {
		return nil, err
	}
	err = sig3.CheckLinkSequence(links)
	if err != nil {
		return nil, err
	}
	err = checkSeedSequence(mctx, seeds, links)
	if err != nil {
		return nil, err
	}
	ret, err = toHiddenTeamChainData(mctx, id, links)
	if err != nil {
		return nil, err
	}
	err = mctx.G().GetHiddenTeamChainManager().Advance(mctx, sig3.ExportToPrevLinkTriple(links[0]), *ret, ratchet)
	if err != nil {
		return nil, err
	}
	return ret, nil
}

func GenerateKeyRotation(mctx libkb.MetaContext, teamID keybase1.TeamID, isPublic bool, isImplicit bool, mr *libkb.MerkleRoot, me libkb.UserForSignatures, key libkb.GenericKey, mainPrev keybase1.LinkTriple, hiddenPrev *keybase1.LinkTriple, sk libkb.NaclSigningKeyPair, ek libkb.NaclDHKeyPair, check keybase1.PerTeamSeedCheck) (bun *sig3.ExportJSON, err error) {
	outer := sig3.OuterLink{}
	if hiddenPrev != nil {
		outer.Seqno = hiddenPrev.Seqno + 1
		if !hiddenPrev.LinkID.IsNil() {
			tmp, err := sig3.ImportLinkID(hiddenPrev.LinkID)
			if err != nil {
				return nil, err
			}
			outer.Prev = tmp
		}
	}
	tmp, err := sig3.ImportTail(mainPrev)
	if err != nil {
		return nil, err
	}
	rsq := mr.Seqno()
	if rsq == nil {
		return nil, fmt.Errorf("cannot work with a nil merkle root seqno")
	}
	teamIDimport, err := sig3.ImportTeamID(teamID)
	if err != nil {
		return nil, err
	}
	inner := sig3.InnerLink{
		MerkleRoot: sig3.MerkleRoot{
			Ctime: mr.CtimeMsec(),
			Hash:  mr.HashMeta(),
			Seqno: *rsq,
		},
		ParentChain: *tmp,
		Signer: sig3.Signer{
			UID:         sig3.ImportUID(me.GetUID()),
			KID:         sig3.ImportKID(key.GetKID()),
			EldestSeqno: me.GetEldestSeqno(),
		},
		Team: &sig3.Team{
			TeamID:     *teamIDimport,
			IsPublic:   isPublic,
			IsImplicit: isImplicit,
		},
		ClientInfo: makeClientInfo(),
	}

	return nil, fmt.Errorf("unimplemented %+v", inner)
}

func makeClientInfo() *sig3.ClientInfo {
	return &sig3.ClientInfo{
		Desc:    libkb.GoClientID,
		Version: libkb.Version,
	}
}
