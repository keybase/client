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

// GenerateKeyRotationParams are for generating a sig3 KeyRotation to store on the hidden team chain.
// Fill in all parameters of the struct (there were too many to pass as a list)
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

// GenerateKeyRotation generates and signs a new sig3 KeyRotation. The result can be passed to
// sig/mutli.json and stored along with other sig1, sig2 or sig3 signatures in an atomic transaction.
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
		return nil, nil, NewGenerateError("cannot work with a nil merkle root seqno")
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
			return nil, NewGenerateError("bad key pair, wrong type: %T", g)
		}
		if signing.Private == nil {
			return nil, NewGenerateError("bad key pair, got null private key")
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
	outer = sig.Outer
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
	links            []sig3.Generic
	isFresh          bool
}

// NewLoaderPackage creates an object used to load the hidden team chain along with the
// slow or fast team loader. It manages internal state during the loading process. Pass an
// encryption KID from the main chain for authentication purposes, that we can prove to the server
// that we've previously seen data for this team (and therefor we're allowed to know whether or not
// the team has a hidden chain (but nothing more)).
func NewLoaderPackage(id keybase1.TeamID, e keybase1.KID, g keybase1.PerTeamKeyGeneration) *LoaderPackage {
	return &LoaderPackage{id: id, encKID: e, lastMainChainGen: g, isFresh: true}
}

// Load in data from storage for this chain. We're going to make a deep copy so that
// we don't worry about mutating the object in the storage layer's memory LRU.
func (l *LoaderPackage) Load(mctx libkb.MetaContext) (err error) {
	tmp, err := mctx.G().GetHiddenTeamChainManager().Load(mctx, l.id)
	if err != nil {
		return err
	}
	if tmp == nil {
		return nil
	}
	cp := tmp.DeepCopy()
	l.data = &cp
	return err
}

// MerkleLoadArg is the argument to pass to merkle/path.json so that the state of the hidden
// chain can be queried along with the main team chain. If we've ever loaded this chain, we pass
// up the last known chain tail and the server replies with a bit saying whether it's the latest
// or not (this save the server from having to auth us and check if we're in the team). If we've
// never loaded the hidden chain for this team, we pass up a team encryption KID from the team's
// main chain, to prove we had access to it. The server returns one bit in that case, saying
// whether or not the team chain exists.
func (l *LoaderPackage) MerkleLoadArg(mctx libkb.MetaContext) (ret *libkb.LookupTeamHiddenArg, err error) {
	if tail := l.lastReaderPerTeamKeyLinkID(); !tail.IsNil() {
		return &libkb.LookupTeamHiddenArg{LastKnownHidden: tail}, nil
	}
	if !l.encKID.IsNil() && l.lastMainChainGen > keybase1.PerTeamKeyGeneration(0) {
		return &libkb.LookupTeamHiddenArg{PTKEncryptionKID: l.encKID, PTKGeneration: l.lastMainChainGen}, nil
	}
	return nil, nil
}

func (l *LoaderPackage) lastReaderPerTeamKeyLinkID() (ret keybase1.LinkID) {
	if l.data == nil {
		return ret
	}
	return l.data.LastReaderPerTeamKeyLinkID()
}

// SetIsFresh sets the fresh bit, which says that preloaded version of the hidden chain is the
// most up-to-date. By default, this bit is set to true, but we can turn it off if the merkle/path.json
// endpoint tells us otherwise.
func (l *LoaderPackage) SetIsFresh(b bool) {
	l.isFresh = b
}

// IsFresh returns false only if someone called SetIsFresh(false).
func (l *LoaderPackage) IsFresh() bool {
	return l.isFresh
}

func (l *LoaderPackage) checkPrev(mctx libkb.MetaContext, first sig3.Generic) (err error) {
	q := first.Seqno()
	prev := first.Prev()
	if q == keybase1.Seqno(1) && prev != nil {
		return NewLoaderError("bad link that had seqno=1 and non=nil prev")
	}
	if prev == nil {
		return nil
	}
	if l.data == nil {
		return NewLoaderError("didn't get prior data and update was for a chain middle")
	}
	link, ok := l.data.Outer[q-1]
	if !ok {
		return NewLoaderError("previous link wasn't found")
	}
	if !link.Eq(prev.Export()) {
		return NewLoaderError("prev mismatch at %d", q)
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
	return NewLoaderError("Server promised a hidden chain up to %d, but never recevied; is it withholding?", max)
}

func (l *LoaderPackage) checkRatchet(mctx libkb.MetaContext, update *keybase1.HiddenTeamChain, ratchet keybase1.LinkTripleAndTime) (err error) {
	q := ratchet.Triple.Seqno
	link, ok := update.Outer[q]
	if ok && !link.Eq(ratchet.Triple.LinkID) {
		return NewLoaderError("update data failed to match ratchet %+v v %s", ratchet, link)
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

// Update combines the preloaded data with any downloaded updates from the server, and stores
// the result local to this object.
func (l *LoaderPackage) Update(mctx libkb.MetaContext, update []sig3.ExportJSON) (err error) {
	defer mctx.Trace(fmt.Sprintf("LoaderPackage#Update(%s)", l.id), func() error { return err })()

	var data *keybase1.HiddenTeamChain
	data, err = l.updatePrecheck(mctx, update)
	if err != nil {
		return err
	}
	err = l.storeData(mctx, data)
	if err != nil {
		return err
	}
	return nil
}

func (l *LoaderPackage) updatePrecheck(mctx libkb.MetaContext, update []sig3.ExportJSON) (ret *keybase1.HiddenTeamChain, err error) {
	var links []sig3.Generic
	links, err = importChain(mctx, update)
	if err != nil {
		return nil, err
	}

	err = sig3.CheckLinkSequence(links)
	if err != nil {
		return nil, err
	}

	err = l.checkExpectedHighSeqno(mctx, links)
	if err != nil {
		return nil, err
	}

	if len(links) == 0 {
		mctx.Debug("short-circuting since no update")
		return nil, nil
	}

	err = l.checkPrev(mctx, links[0])
	if err != nil {
		return nil, err
	}

	data, err := l.toHiddenTeamChain(mctx, links)
	if err != nil {
		return nil, err
	}

	err = l.checkRatchets(mctx, data)
	if err != nil {
		return nil, err
	}

	return data, nil
}

func (l *LoaderPackage) lastRotator(mctx libkb.MetaContext, typ keybase1.PTKType) *keybase1.Signer {
	if l.data == nil {
		return nil
	}
	last, ok := l.data.LastPerTeamKeys[typ]
	if !ok {
		return nil
	}
	inner, ok := l.data.Inner[last]
	if !ok {
		return nil
	}
	return &inner.Signer
}

// LastReaderKeyRotator returns a signer object that signifies the last KID/UID pair to sign
// a reader PTK into this chain.
func (l *LoaderPackage) LastReaderKeyRotator(mctx libkb.MetaContext) *keybase1.Signer {
	return l.lastRotator(mctx, keybase1.PTKType_READER)
}

func (l *LoaderPackage) storeData(mctx libkb.MetaContext, newData *keybase1.HiddenTeamChain) (err error) {
	l.newData = newData
	if l.data == nil {
		l.data = newData
		return nil
	}
	if newData != nil {
		_, err = l.data.Merge(*newData)
		if err != nil {
			return err
		}
	}
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
		return NewLoaderError("seed at generation %d wasn't found", gen)
	}
	if seed.Check == nil {
		return NewLoaderError("seed check at generation %d was nil", gen)
	}
	hash, err := seed.Check.Hash()
	if err != nil {
		return err
	}
	if readerKey.Check.Version != keybase1.PerTeamSeedCheckVersion_V1 {
		return NewLoaderError("can only handle seed check version 1; got %s", readerKey.Check.Version)
	}
	if !hash.Eq(readerKey.Check) {
		return NewLoaderError("wrong seed check at generation %d", gen)
	}
	return nil
}

// CheckUpdatesAgainstSeeds checks the update inside this loader package against unverified team seeds. It
// enforces equality and will error out if not. Through this check, a client can convince itself that the
// recent keyers knew the old keys.
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

// LastSeqno returns the last seqno when the preloaded sequence and the update are taken together.
func (l *LoaderPackage) LastSeqno() keybase1.Seqno {
	if l.data == nil {
		return keybase1.Seqno(0)
	}
	return l.data.Last
}

// MaxRatchet returns the greatest sequence number across all ratchets in the loaded data and also
// in the data from the recent update from the server.
func (l *LoaderPackage) MaxRatchet() keybase1.Seqno {
	if l.data == nil {
		return keybase1.Seqno(0)
	}
	return l.data.Ratchet.Max()
}

// HasReaderPerTeamKeyAtGeneration returns true if the LoaderPackage has a sigchain entry for
// the PTK at the given generation. Whether in the preloaded data or the udpate.
func (l *LoaderPackage) HasReaderPerTeamKeyAtGeneration(gen keybase1.PerTeamKeyGeneration) bool {
	if l.data == nil {
		return false
	}
	_, ok := l.data.ReaderPerTeamKeys[gen]
	return ok
}

// Commit the update from the server to main HiddenTeamChain storage.
func (l *LoaderPackage) Commit(mctx libkb.MetaContext) error {
	if l.newData == nil {
		return nil
	}
	err := mctx.G().GetHiddenTeamChainManager().Advance(mctx, *l.newData)
	return err
}

// ChainData returns the merge of the preloaded hidden chain data and the recently downloaded chain update.
func (l *LoaderPackage) ChainData() *keybase1.HiddenTeamChain {
	return l.data
}

// MaxReaderTeamKeyGeneration returns the highest Reader PTK generation from the preloaded and hidden
// data.
func (l *LoaderPackage) MaxReaderPerTeamKeyGeneration() keybase1.PerTeamKeyGeneration {
	if l.data == nil {
		return keybase1.PerTeamKeyGeneration(0)
	}
	return l.data.MaxReaderPerTeamKeyGeneration()
}
