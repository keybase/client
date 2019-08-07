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
			_, found := ret.ReaderPerTeamKeys[ptk.Generation]
			if found {
				return newRepeatPTKGenerationError(ptk.Generation, "clashes another hidden link")
			}
			ret.ReaderPerTeamKeys[ptk.Generation] = q
		}
	}
	ret.MerkleRoots[q] = link.Inner().MerkleRoot.Export()

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
	Admin            *sig3.ChainLocation
}

// GenerateKeyRotation generates and signs a new sig3 KeyRotation. The result can be passed to
// sig/multi.json and stored along with other sig1, sig2 or sig3 signatures in an atomic transaction.
func GenerateKeyRotation(mctx libkb.MetaContext, p GenerateKeyRotationParams) (ret *libkb.SigMultiItem, ratchets *keybase1.HiddenTeamChainRatchetSet, err error) {

	s3, ratchets, err := generateKeyRotationSig3(mctx, p)
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

	return sigMultiItem, ratchets, nil
}

func generateKeyRotationSig3(mctx libkb.MetaContext, p GenerateKeyRotationParams) (ret *sig3.ExportJSON, ratchets *keybase1.HiddenTeamChainRatchetSet, err error) {

	outer := sig3.OuterLink{}
	if p.HiddenPrev != nil {
		outer.Seqno = p.HiddenPrev.Seqno + 1
		if p.HiddenPrev.LinkID.IsNil() {
			return nil, nil, NewGenerateError("unexpected nil prev")
		}
		tmp, err := sig3.ImportLinkID(p.HiddenPrev.LinkID)
		if err != nil {
			return nil, nil, err
		}
		outer.Prev = tmp
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
			Admin:      p.Admin,
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
	ratchets = &keybase1.HiddenTeamChainRatchetSet{}
	ratchets.Add(keybase1.RatchetType_SELF,
		keybase1.LinkTripleAndTime{
			Triple: keybase1.LinkTriple{
				Seqno:   outer.Seqno,
				SeqType: sig3.ChainTypeTeamPrivateHidden,
				LinkID:  outerHash.Export(),
			},
			Time: keybase1.ToTime(now),
		},
	)
	return &bun, ratchets, nil
}

func CheckFeatureGateForSupportWithRotationType(mctx libkb.MetaContext, teamID keybase1.TeamID, isWrite bool, rt keybase1.RotationType) (ret keybase1.RotationType, err error) {
	if rt == keybase1.RotationType_VISIBLE {
		return rt, nil
	}
	ok, err := checkFeatureGateForSupport(mctx, teamID, isWrite)
	if err != nil {
		return rt, err
	}

	switch {
	case rt == keybase1.RotationType_CLKR && !ok:
		return keybase1.RotationType_VISIBLE, nil
	case rt == keybase1.RotationType_CLKR && ok:
		return keybase1.RotationType_HIDDEN, nil

	case rt == keybase1.RotationType_HIDDEN && ok:
		return keybase1.RotationType_HIDDEN, nil
	case rt == keybase1.RotationType_HIDDEN && !ok:
		return keybase1.RotationType_HIDDEN, NewHiddenRotationNotSupportedError(teamID)

	default:
		return keybase1.RotationType_HIDDEN, fmt.Errorf("unhandled case")
	}
}

type rawSupport struct {
	Status  libkb.AppStatus `json:"status"`
	Support bool            `json:"support"`
}

func (r *rawSupport) GetAppStatus() *libkb.AppStatus {
	return &r.Status
}

func featureGateForTeamFromServer(mctx libkb.MetaContext, teamID keybase1.TeamID, isWrite bool) (ok bool, err error) {
	arg := libkb.NewAPIArg("team/supports_hidden_chain")
	arg.SessionType = libkb.APISessionTypeREQUIRED
	arg.Args = libkb.HTTPArgs{
		"id": libkb.S{Val: string(teamID)},
	}
	var raw rawSupport
	err = mctx.G().API.GetDecode(mctx, arg, &raw)
	if err != nil {
		return false, err
	}
	return raw.Support, nil
}

func checkFeatureGateForSupport(mctx libkb.MetaContext, teamID keybase1.TeamID, isWrite bool) (ok bool, err error) {
	admin := mctx.G().FeatureFlags.Enabled(mctx, libkb.FeatureCheckForHiddenChainSupport)
	runmode := mctx.G().Env.GetRunMode()
	if runmode != libkb.ProductionRunMode {
		return true, nil
	}
	if runmode == libkb.ProductionRunMode && !admin {
		return false, nil
	}
	return featureGateForTeamFromServer(mctx, teamID, isWrite)
}

func CheckFeatureGateForSupport(mctx libkb.MetaContext, teamID keybase1.TeamID, isWrite bool) (err error) {
	ok, err := checkFeatureGateForSupport(mctx, teamID, isWrite)
	if err != nil {
		return err
	}
	if !ok {
		return NewHiddenRotationNotSupportedError(teamID)
	}
	return nil
}
