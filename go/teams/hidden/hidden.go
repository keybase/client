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

type GenerateKeyRotationParams struct {
	TeamID           keybase1.TeamID
	IsPublic         bool
	IsImplicit       bool
	MerkleRoot       *libkb.MerkleRoot
	Me               libkb.UserForSignatures
	SigningKey       libkb.GenericKey
	MainPrev         keybase1.LinkTriple
	HiddenPrev       *keybase1.LinkTriple
	Gen              keybase1.PerTeamKeyGeneration
	NewSigningKey    libkb.NaclSigningKeyPair
	NewEncryptionKey libkb.NaclDHKeyPair
	Check            keybase1.PerTeamSeedCheck
}

func GenerateKeyRotation(mctx libkb.MetaContext, p GenerateKeyRotationParams) (ret *libkb.SigMultiItem, ratchet *keybase1.HiddenTeamChainRatchet, err error) {

	s3, ratchet, err := generateKeyRotationSig3(mctx, p)
	if err != nil {
		return nil, nil, err
	}

	sigMultiItem := &libkb.SigMultiItem{
		SigningKID: p.SigningKey.GetKID(),
		Type:       "team.rotate_key_hidden",
		SeqType:    sig3.ChainTypeTeamPrivateHidden,
		TeamID:     p.TeamID,
		Sig3: &libkb.Sig3{
			Inner: s3.Inner,
			Outer: s3.Outer,
			Sig:   s3.Sig,
		},
		PublicKeys: &libkb.SigMultiItemPublicKeys{
			Encryption: p.NewEncryptionKey.GetKID(),
			Signing:    p.NewSigningKey.GetKID(),
		},
		Version: 3,
	}

	return sigMultiItem, ratchet, nil
}

func generateKeyRotationSig3(mctx libkb.MetaContext, p GenerateKeyRotationParams) (ret *sig3.ExportJSON, ratchet *keybase1.HiddenTeamChainRatchet, err error) {

	outer := sig3.OuterLink{}
	if p.HiddenPrev != nil {
		outer.Seqno = p.HiddenPrev.Seqno + 1
		if !p.HiddenPrev.LinkID.IsNil() {
			tmp, err := sig3.ImportLinkID(p.HiddenPrev.LinkID)
			if err != nil {
				return nil, nil, err
			}
			outer.Prev = tmp
		}
	} else {
		outer.Seqno = keybase1.Seqno(1)
	}
	tmp, err := sig3.ImportTail(p.MainPrev)
	if err != nil {
		return nil, nil, err
	}
	rsq := p.MerkleRoot.Seqno()
	if rsq == nil {
		return nil, nil, fmt.Errorf("cannot work with a nil merkle root seqno")
	}
	teamIDimport, err := sig3.ImportTeamID(p.TeamID)
	if err != nil {
		return nil, nil, err
	}
	now := keybase1.ToTime(mctx.G().Clock().Now())
	inner := sig3.InnerLink{
		Ctime: now,
		ClientInfo: &sig3.ClientInfo{
			Desc:    libkb.GoClientID,
			Version: libkb.Version,
		},
		MerkleRoot: sig3.MerkleRoot{
			Ctime: p.MerkleRoot.CtimeMsec(),
			Hash:  p.MerkleRoot.HashMeta(),
			Seqno: *rsq,
		},
		ParentChain: *tmp,
		Signer: sig3.Signer{
			UID:         sig3.ImportUID(p.Me.GetUID()),
			KID:         sig3.ImportKID(p.SigningKey.GetKID()),
			EldestSeqno: p.Me.GetEldestSeqno(),
		},
		Team: &sig3.Team{
			TeamID:     *teamIDimport,
			IsPublic:   p.IsPublic,
			IsImplicit: p.IsImplicit,
		},
	}
	checkPostImage, err := p.Check.Hash()
	if err != nil {
		return nil, nil, err
	}
	rkb := sig3.RotateKeyBody{
		PTKs: []sig3.PerTeamKey{
			sig3.PerTeamKey{
				AppkeyDerivationVersion: sig3.AppkeyDerivationXOR,
				Generation:              p.Gen,
				SeedCheck:               *checkPostImage,
				EncryptionKID:           sig3.KID(p.NewEncryptionKey.GetBinaryKID()),
				SigningKID:              sig3.KID(p.NewSigningKey.GetBinaryKID()),
				PTKType:                 keybase1.PTKType_READER,
			},
		},
	}

	keyPair := func(g libkb.GenericKey) (*sig3.KeyPair, error) {
		signing, ok := g.(libkb.NaclSigningKeyPair)
		if !ok {
			return nil, fmt.Errorf("bad key pair, wrong type: %T", g)
		}
		if signing.Private == nil {
			return nil, fmt.Errorf("bad key pair, got null private key")
		}
		return sig3.NewKeyPair(*signing.Private, sig3.KID(g.GetBinaryKID())), nil
	}

	rk := sig3.NewRotateKey(outer, inner, rkb)
	outerKeyPair, err := keyPair(p.SigningKey)
	if err != nil {
		return nil, nil, err
	}
	innerKeyPair, err := keyPair(p.NewSigningKey)
	if err != nil {
		return nil, nil, err
	}

	sig, err := rk.Sign(*outerKeyPair, []sig3.KeyPair{*innerKeyPair})
	if err != nil {
		return nil, nil, err
	}
	bun, err := sig.Export()
	if err != nil {
		return nil, nil, err
	}
	outerHash, err := outer.Hash()
	if err != nil {
		return nil, nil, err
	}
	ratchet = &keybase1.HiddenTeamChainRatchet{
		Self: &keybase1.LinkTripleAndTime{
			Triple: keybase1.LinkTriple{
				Seqno:   outer.Seqno,
				SeqType: sig3.ChainTypeTeamPrivateHidden,
				LinkID:  outerHash.Export(),
			},
			Time: now,
		},
	}
	return &bun, ratchet, nil
}
