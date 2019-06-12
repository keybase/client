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

func checkSeed(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem, rotateKey *sig3.RotateKey) (err error) {

	readerKey := rotateKey.ReaderKey()
	if readerKey == nil {
		// No reader key found in link, so no need to check it.
		return nil
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

func (u *Update) checkSeedSequence(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem) (err error) {
	for _, rotate := range u.rotates {
		err := checkSeed(mctx, seeds, rotate)
		if err != nil {
			return err
		}
	}
	return nil
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
	}

	return nil
}

func (u *Update) toHiddenTeamChain(mctx libkb.MetaContext) (ret *keybase1.HiddenTeamChain, err error) {
	ret = keybase1.NewHiddenTeamChain(u.id)
	ret.Public = u.id.IsPublic()
	for _, link := range u.links {
		err = populateLink(mctx, ret, link)
		if err != nil {
			return nil, err
		}
	}
	return ret, nil
}

type Update struct {
	id        keybase1.TeamID
	links     []sig3.Generic
	maxRotate keybase1.PerTeamKeyGeneration
	rotates   map[keybase1.PerTeamKeyGeneration](*sig3.RotateKey)
	ratchet   keybase1.Seqno
}

func newUpdate(id keybase1.TeamID, links []sig3.Generic, ratchet keybase1.Seqno) (ret *Update, err error) {
	ret = &Update{
		id:      id,
		links:   links,
		rotates: make(map[keybase1.PerTeamKeyGeneration](*sig3.RotateKey)),
		ratchet: ratchet,
	}
	for _, link := range links {
		err := ret.populate(link)
		if err != nil {
			return nil, err
		}
	}
	return ret, nil
}

func (u *Update) populate(link sig3.Generic) (err error) {
	if sig3.IsStubbed(link) {
		return nil
	}
	rotateKey, ok := link.(*sig3.RotateKey)
	if !ok {
		return nil
	}
	readerKey := rotateKey.ReaderKey()
	if readerKey == nil {
		return nil
	}
	u.rotates[readerKey.Generation] = rotateKey
	if u.maxRotate < readerKey.Generation {
		u.maxRotate = readerKey.Generation
	}
	return nil
}

func (u *Update) LastChainGen() keybase1.PerTeamKeyGeneration {
	if u == nil {
		return keybase1.PerTeamKeyGeneration(0)
	}
	return u.maxRotate
}

func (u *Update) HasPerTeamKeyAtGeneration(g keybase1.PerTeamKeyGeneration) bool {
	if u == nil {
		return false
	}
	_, ret := u.rotates[g]
	return ret
}

func PrepareUpdate(mctx libkb.MetaContext, id keybase1.TeamID, ratchet keybase1.Seqno, update []sig3.ExportJSON) (ret *Update, err error) {
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
	ret, err = newUpdate(id, links, ratchet)
	return ret, err
}

func (u *Update) Commit(mctx libkb.MetaContext, seeds map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKeySeedItem) (data *keybase1.HiddenTeamChain, signer *keybase1.Signer, err error) {

	err = u.checkSeedSequence(mctx, seeds)
	if err != nil {
		return nil, nil, err
	}
	var update *keybase1.HiddenTeamChain
	update, err = u.toHiddenTeamChain(mctx)
	if err != nil {
		return nil, nil, err
	}
	err = mctx.G().GetHiddenTeamChainManager().Advance(mctx, sig3.ExportToPrevLinkTriple(u.links[0]), *update, u.ratchet)
	if err != nil {
		return nil, nil, err
	}
	if tail := update.Tail(); tail != nil {
		signer = &tail.Signer
	}
	return update, signer, nil
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

// LoadPackage contains a snapshot of the hidden team chain, used during the process of loading a team.
// It additionally can have new chain links loaded from the server, since it might need to be queried
// in the process of loading the team as if the new links were already commited to the data store.
type LoaderPackage struct {
	id               keybase1.TeamID
	encKID           keybase1.KID
	lastMainChainGen keybase1.PerTeamKeyGeneration
	data             *keybase1.HiddenTeamChain
}

func NewLoaderPackage(id keybase1.TeamID, e keybase1.KID, g keybase1.PerTeamKeyGeneration) *LoaderPackage {
	return &LoaderPackage{id: id, encKID: e, lastMainChainGen: g}
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
