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

func populateLink(mctx libkb.MetaContext, ret *keybase1.HiddenTeamChain, link sig3.Generic) (err error) {
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
		return nil
	}
	rkex, err := rotateKey.Export()
	if err != nil {
		return err
	}
	ret.Inner[q] = *rkex

	// For each PTK (right now we really only expect one - the Reader PTK),
	// update our maximum PTK generation
	for _, ptk := range rotateKey.PTKs() {
		max, ok := ret.LastPerTeamKeys[ptk.PTKType]
		if !ok || max < q {
			ret.LastPerTeamKeys[ptk.PTKType] = q
		}
		if ptk.PTKType == keybase1.PTKType_READER {
			ret.ReaderPerTeamKeys[ptk.Generation] = q
		}
	}

	return nil
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
	now := mctx.G().Clock().Now()
	inner := sig3.InnerLink{
		Ctime: sig3.TimeSec(now.Unix()),
		ClientInfo: &sig3.ClientInfo{
			Desc:    libkb.GoClientID,
			Version: libkb.Version,
		},
		MerkleRoot: sig3.MerkleRoot{
			Ctime: sig3.TimeSec(p.MerkleRoot.Ctime()),
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
			Time: keybase1.ToTime(now),
		},
	}
	return &bun, ratchet, nil
}

// LoaderPackage contains a snapshot of the hidden team chain, used during the process of loading a team.
// It additionally can have new chain links loaded from the server, since it might need to be queried
// in the process of loading the team as if the new links were already commited to the data store.
type LoaderPackage struct {
	id               keybase1.TeamID
	encKID           keybase1.KID
	lastMainChainGen keybase1.PerTeamKeyGeneration
	data             *keybase1.HiddenTeamChain
	newData          *keybase1.HiddenTeamChain
	merged           *keybase1.HiddenTeamChain
	lastRotator      *sig3.Signer
	links            []sig3.Generic
	isFresh          bool
}

func NewLoaderPackage(id keybase1.TeamID, e keybase1.KID, g keybase1.PerTeamKeyGeneration) *LoaderPackage {
	return &LoaderPackage{id: id, encKID: e, lastMainChainGen: g, isFresh: true}
}

func (l *LoaderPackage) Load(mctx libkb.MetaContext) (err error) {
	l.data, err = mctx.G().GetHiddenTeamChainManager().Load(mctx, l.id)
	return err
}

func (l *LoaderPackage) MerkleLoadArg(mctx libkb.MetaContext) (ret *libkb.LookupTeamHiddenArg, err error) {
	if l.data == nil {
		return nil, nil
	}
	tail := l.data.LastReaderPerTeamKey()
	if !tail.IsNil() {
		return &libkb.LookupTeamHiddenArg{LastKnownHidden: tail}, nil
	}
	if !l.encKID.IsNil() && l.lastMainChainGen > keybase1.PerTeamKeyGeneration(0) {
		return &libkb.LookupTeamHiddenArg{PTKEncryptionKID: l.encKID, PTKGeneration: l.lastMainChainGen}, nil
	}
	return nil, nil
}

func (l *LoaderPackage) SetIsFresh(b bool) {
	l.isFresh = b
}

func (l *LoaderPackage) IsFresh() bool {
	return l.isFresh
}

func (l *LoaderPackage) checkPrev(mctx libkb.MetaContext, first sig3.Generic) (err error) {
	q := first.Seqno()
	prev := first.Prev()
	if q == keybase1.Seqno(1) && prev != nil {
		return fmt.Errorf("bad link that had seqno=1 and non=nil prev")
	}
	if prev == nil {
		return nil
	}
	if l.data == nil {
		return fmt.Errorf("didn't get prior data and update was for a chain middle")
	}
	link, ok := l.data.Outer[q-1]
	if !ok {
		return fmt.Errorf("previous link wasn't found")
	}
	if !link.Eq(prev.Export()) {
		return fmt.Errorf("prev mismatch at %d", q)
	}
	return nil
}

func (l *LoaderPackage) checkExpectedHighSeqno(mctx libkb.MetaContext, links []sig3.Generic) (err error) {
	last := l.LastSeqno()
	max := l.MaxRatchet()
	if max <= last {
		return nil
	}
	if len(links) > 0 && links[len(links)-1].Seqno() >= max {
		return nil
	}
	return fmt.Errorf("Server promised a hidden chain up to %d, but never recevied; is it withholding?", max)
}

func (l *LoaderPackage) checkRatchet(mctx libkb.MetaContext, update *keybase1.HiddenTeamChain, ratchet keybase1.LinkTripleAndTime) (err error) {
	q := ratchet.Triple.Seqno
	link, ok := update.Outer[q]
	if ok && !link.Eq(ratchet.Triple.LinkID) {
		return fmt.Errorf("update data failed to match ratchet %+v", ratchet)
	}
	return nil
}

func (l *LoaderPackage) checkRatchets(mctx libkb.MetaContext, update *keybase1.HiddenTeamChain) (err error) {
	if l.data == nil {
		return nil
	}
	for _, r := range l.data.Ratchet.Flat() {
		err = l.checkRatchet(mctx, update, r)
		if err != nil {
			return err
		}
	}
	return nil
}

func (l *LoaderPackage) Update(mctx libkb.MetaContext, update []sig3.ExportJSON) (err error) {
	defer mctx.Trace(fmt.Sprintf("LoaderPackage#Update(%s)", l.id), func() error { return err })()

	var links []sig3.Generic
	links, err = importChain(mctx, update)
	if err != nil {
		return err
	}

	err = sig3.CheckLinkSequence(links)
	if err != nil {
		return err
	}

	err = l.checkExpectedHighSeqno(mctx, links)
	if err != nil {
		return err
	}

	if len(links) == 0 {
		mctx.Debug("short-circuting since no update")
		return nil
	}

	err = l.checkPrev(mctx, links[0])
	if err != nil {
		return err
	}

	data, err := l.toHiddenTeamChain(mctx, links)
	if err != nil {
		return err
	}

	err = l.checkRatchets(mctx, data)
	if err != nil {
		return err
	}

	err = l.storeData(data)
	if err != nil {
		return err
	}

	l.lastRotator = l.findLastRotator(mctx, links)
	return nil
}

func (l *LoaderPackage) findLastRotator(mctx libkb.MetaContext, links []sig3.Generic) *sig3.Signer {
	for i := len(links) - 1; i >= 0; i-- {
		link := links[i]
		if sig3.IsStubbed(link) {
			continue
		}
		rk, ok := link.(*sig3.RotateKey)
		if !ok {
			continue
		}
		inner := rk.Inner()
		if inner == nil {
			continue
		}
		return &inner.Signer
	}
	return nil
}

func (l *LoaderPackage) storeData(newData *keybase1.HiddenTeamChain) (err error) {
	l.newData = newData
	if l.data == nil {
		l.merged = newData
		return nil
	}
	tmp := l.data.DeepCopy()
	if newData != nil {
		_, err = tmp.Merge(*newData)
		if err != nil {
			return err
		}
	}
	l.merged = &tmp
	return nil
}

func (l *LoaderPackage) toHiddenTeamChain(mctx libkb.MetaContext, links []sig3.Generic) (ret *keybase1.HiddenTeamChain, err error) {
	ret = keybase1.NewHiddenTeamChain(l.id)
	ret.Public = l.id.IsPublic()
	for _, link := range links {
		err = populateLink(mctx, ret, link)
		if err != nil {
			return nil, err
		}
	}
	return ret, nil
}

func checkUpdateAgainstSeed(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem, update keybase1.HiddenTeamChainLink) (err error) {
	readerKey, ok := update.Ptk[keybase1.PTKType_READER]
	if !ok {
		// No reader key found in link, so no need to check it.
		return nil
	}
	gen := readerKey.Ptk.Gen
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
	if readerKey.Check.Version != keybase1.PerTeamSeedCheckVersion_V1 {
		return fmt.Errorf("can only handle seed check version 1; got %s", readerKey.Check.Version)
	}
	if !hash.Eq(readerKey.Check) {
		return fmt.Errorf("wrong seed check at generation %d", gen)
	}
	return nil
}

func (l *LoaderPackage) CheckUpdatesAgainstSeeds(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem) (err error) {
	if l.newData == nil {
		return nil
	}
	for _, update := range l.newData.Inner {
		err = checkUpdateAgainstSeed(mctx, seeds, update)
		if err != nil {
			return err
		}
	}
	return nil
}

func (l *LoaderPackage) LastSeqno() keybase1.Seqno {
	if l.data == nil {
		return keybase1.Seqno(0)
	}
	return l.data.Last
}

func (l *LoaderPackage) MaxRatchet() keybase1.Seqno {
	if l.data == nil {
		return keybase1.Seqno(0)
	}
	return l.data.Ratchet.Max()
}

func (l *LoaderPackage) HasReaderPerTeamKeyAtGeneration(gen keybase1.PerTeamKeyGeneration) bool {
	if l.merged == nil {
		return false
	}
	_, ok := l.merged.ReaderPerTeamKeys[gen]
	return ok
}

func (l *LoaderPackage) Commit(mctx libkb.MetaContext) error {
	if l.newData == nil {
		return nil
	}
	err := mctx.G().GetHiddenTeamChainManager().Advance(mctx, *l.newData)
	return err
}

func (l *LoaderPackage) ChainData() *keybase1.HiddenTeamChain {
	return l.merged
}

func (l *LoaderPackage) MaxReaderPerTeamKeyGeneration() keybase1.PerTeamKeyGeneration {
	if l.data == nil {
		return keybase1.PerTeamKeyGeneration(0)
	}
	return l.data.MaxReaderPerTeamKeyGeneration()
}

func (l *LoaderPackage) LastRotator(mctx libkb.MetaContext) (ret *keybase1.Signer) {
	if l.lastRotator == nil {
		return nil
	}
	tmp := l.lastRotator.Export()
	return &tmp
}
