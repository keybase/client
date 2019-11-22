package hidden

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"

	"github.com/pkg/errors"

	"github.com/keybase/client/go/blindtree"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/merkletree2"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
	"github.com/keybase/go-jsonw"
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

	// Because this link isn't stubbed, we can bump the `LastFull` field
	// forward if it's one more than previous. ret.LastFull will start at 0
	// so this should work for the first link.
	if ret.LastFull+1 == q {
		ret.LastFull = q
	}

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
			{
				AppkeyDerivationVersion: sig3.AppkeyDerivationXOR,
				Generation:              p.Gen,
				SeedCheck:               *checkPostImage,
				EncryptionKID:           p.NewEncryptionKey.GetBinaryKID(),
				SigningKID:              p.NewSigningKey.GetBinaryKID(),
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
		return sig3.NewKeyPair(*signing.Private, g.GetBinaryKID()), nil
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

func ProcessHiddenResponseFunc(m libkb.MetaContext, teamID keybase1.TeamID, apiRes *libkb.APIRes, blindRootHashBytes []byte) (hiddenResp *libkb.MerkleHiddenResponse, err error) {
	if CheckFeatureGateForSupport(m, teamID, false /* isWrite */) != nil {
		m.Debug("Skipped ProcessHiddenResponseFunc as the feature flag is off (%v)", err)
		return &libkb.MerkleHiddenResponse{RespType: libkb.MerkleHiddenResponseTypeFLAGOFF}, nil
	}

	payloadStr, err := apiRes.Body.AtKey("root").AtKey("payload_json").GetString()
	if err != nil {
		return nil, errors.Wrap(err, "error selecting payload")
	}
	payload, err := jsonw.Unmarshal([]byte(payloadStr))
	if err != nil {
		return nil, errors.Wrap(err, "error unmarshaling payload")
	}
	hiddenRootHashStr, err := payload.AtKey("body").AtKey("blind_merkle_root_hash").GetString()
	if err != nil {
		m.Debug("blind tree root not found in the main tree: %v", err)
		// TODO: Y2K-770 Until the root of the blind tree starts getting
		// included in the main tree, we can get such root from the server as an
		// additional parameter and assume the server is honest.
		hiddenRootHashStr, err = apiRes.Body.AtKey("last_blind_root_hash").GetString()
		if err != nil {
			return &libkb.MerkleHiddenResponse{RespType: libkb.MerkleHiddenResponseTypeNONE}, nil
		}
		m.Debug("the server is providing a blind tree root which is not included in the main tree. We trust the server on this as the blind tree is an experimental feature.")
	}
	hiddenRootHashBytes, err := hex.DecodeString(hiddenRootHashStr)
	if err != nil {
		return nil, err
	}

	return ParseAndVerifyCommittedHiddenLinkID(m, teamID, apiRes, merkletree2.Hash(hiddenRootHashBytes))
}

func ParseAndVerifyCommittedHiddenLinkID(m libkb.MetaContext, teamID keybase1.TeamID, apiRes *libkb.APIRes, blindHash merkletree2.Hash) (hiddenResp *libkb.MerkleHiddenResponse, err error) {
	verif := merkletree2.NewMerkleProofVerifier(blindtree.GetCurrentBlindTreeConfig())

	encValWithProofBase64, err := apiRes.Body.AtKey("enc_value_with_proof").GetString()
	if err != nil {
		return &libkb.MerkleHiddenResponse{RespType: libkb.MerkleHiddenResponseTypeNONE}, nil
	}
	encValWithProofBytes, err := base64.StdEncoding.DecodeString(encValWithProofBase64)
	if err != nil {
		return nil, errors.Wrap(err, "error decoding encValWithProof from b64")
	}
	var resp merkletree2.GetValueWithProofResponse
	if err := msgpack.Decode(&resp, encValWithProofBytes); err != nil {
		return nil, errors.Wrap(err, "error decoding encValWithProof")
	}

	lastHiddenSeqnoInt, err := apiRes.Body.AtKey("last_hidden_seqno").GetInt()
	if err != nil {
		return nil, err
	}
	lastHiddenSeqno := keybase1.Seqno(lastHiddenSeqnoInt)

	proof := resp.Proof
	eVal := resp.Value
	key := merkletree2.Key(teamID.ToBytes())

	// if the leaf is not in there, expect an exclusion proof.
	if eVal == nil {
		err := verif.VerifyExclusionProof(m, key, &proof, blindHash)
		if err != nil {
			return nil, err
		}

		return &libkb.MerkleHiddenResponse{
			RespType:            libkb.MerkleHiddenResponseTypeABSENCEPROOF,
			UncommittedSeqno:    lastHiddenSeqno,
			CommittedHiddenTail: nil,
		}, nil
	}

	var leaf blindtree.BlindMerkleValue
	if err := msgpack.Decode(&leaf, eVal); err != nil {
		return nil, err
	}
	if err := verif.VerifyInclusionProof(m, merkletree2.KeyValuePair{Key: key, Value: leaf}, &proof, blindHash); err != nil {
		return nil, err
	}
	switch leaf.ValueType {
	case blindtree.ValueTypeTeamV1:
		leaf := leaf.InnerValue.(blindtree.TeamV1Value)
		tail, found := leaf.Tails[keybase1.SeqType_TEAM_PRIVATE_HIDDEN]
		if !found {
			return nil, fmt.Errorf("The leaf contained in the apiRes does not contain a hidden chain tail: %+v", leaf)
		}
		return &libkb.MerkleHiddenResponse{
			RespType:            libkb.MerkleHiddenResponseTypeOK,
			UncommittedSeqno:    lastHiddenSeqno,
			CommittedHiddenTail: &tail,
		}, nil
	case blindtree.ValueTypeEmpty:
		// We had an empty leaf but we verified its inclusion proof.
		return &libkb.MerkleHiddenResponse{
			RespType:            libkb.MerkleHiddenResponseTypeABSENCEPROOF,
			UncommittedSeqno:    lastHiddenSeqno,
			CommittedHiddenTail: nil,
		}, nil
	default:
		return nil, fmt.Errorf("Invalid leaf type: %v", leaf)
	}
}
