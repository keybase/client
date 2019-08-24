// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"encoding/hex"
	"fmt"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// Delegator
//
// Delegates authority to another key.
//

type Delegator struct {
	Contextified

	// Set these fields
	NewKey               GenericKey
	ExistingKey          GenericKey
	EldestKID            keybase1.KID
	Me                   *User
	Expire               int
	Device               *Device
	RevSig               string
	ServerHalf           []byte
	EncodedPrivateKey    string
	Ctime                int64
	DelegationType       DelegationType
	Aggregated           bool // During aggregation we skip some steps (posting, updating some state)
	PerUserKeyGeneration keybase1.PerUserKeyGeneration
	MerkleRoot           *MerkleRoot

	// Optional precalculated values used by KeyProof
	Seqno       keybase1.Seqno // kex2 HandleDidCounterSign needs to sign subkey without a user but we know what the last seqno was
	PrevLinkID  LinkID         // kex2 HandleDidCounterSign calculates previous link id without a user
	SigningUser UserBasic      // kex2 doesn't have a full user, but does have basic user info

	// Internal fields
	proof        *ProofMetadataRes
	sig          string
	sigID        keybase1.SigID
	linkID       LinkID
	merkleTriple MerkleTriple
	postArg      APIArg
}

func (d Delegator) getSigningKID() keybase1.KID { return d.GetSigningKey().GetKID() }

func (d Delegator) getExistingKID() (kid keybase1.KID) {
	if d.ExistingKey == nil {
		return
	}
	return d.ExistingKey.GetKID()
}

func (d Delegator) getMerkleHashMeta() (ret keybase1.HashMeta) {
	if d.MerkleRoot == nil {
		return ret
	}
	return d.MerkleRoot.ShortHash().ExportToHashMeta()
}

func (d Delegator) GetSigningKey() GenericKey {
	if d.ExistingKey != nil {
		return d.ExistingKey
	}
	return d.NewKey
}

func (d Delegator) IsSibkeyOrEldest() bool {
	return d.DelegationType == DelegationTypeSibkey || d.DelegationType == DelegationTypeEldest
}

func (d Delegator) IsEldest() bool { return d.DelegationType == DelegationTypeEldest }

// GetMerkleTriple gets the new MerkleTriple that came about as a result
// of performing the key delegation.
func (d Delegator) GetMerkleTriple() MerkleTriple { return d.merkleTriple }

func (d *Delegator) CheckArgs(m MetaContext) (err error) {

	defer m.Trace("Delegator#CheckArgs", func() error { return err })()

	if d.DelegationType == "" {
		err = MissingDelegationTypeError{}
	}

	if d.NewKey == nil {
		err = NoSecretKeyError{}
		return
	}

	if d.ExistingKey != nil {
		m.Debug("| Picked passed-in signing key")
	} else {
		m.Debug("| Picking new key for an eldest self-sig")
		d.DelegationType = DelegationTypeEldest
	}

	if d.EldestKID.Exists() || d.IsEldest() {
	} else if kid := d.Me.GetEldestKID(); kid.IsNil() {
		err = NoSigChainError{}
		return err
	} else {
		d.EldestKID = kid
	}

	m.Debug("| Picked key %s for signing", d.getSigningKID())

	return nil
}

// LoadSigningKey can be called before Run() to load the signing key into
// the delegator. This will check the given key first, then a device Key if we have one,
// and otherwise will leave the signing key unset so that we will set it
// as the eldest key on upload.
// m.LoginContext can be nil.
func (d *Delegator) LoadSigningKey(m MetaContext, ui SecretUI) (err error) {
	defer m.Trace("Delegator#LoadSigningKey", func() error { return err })()

	if d.ExistingKey != nil {
		m.Debug("| Was set ahead of time")
		return nil
	}

	if d.Me == nil {
		d.Me, err = LoadMe(NewLoadUserPubOptionalArg(d.G()))
		if err != nil {
			return err
		}
		if d.Me == nil {
			m.Debug("| Me didn't load")
			return nil
		}
	}

	if !d.Me.HasActiveKey() {
		m.Debug("| PGPKeyImportEngine: no active key found, so assuming set of eldest key")
		return nil
	}

	arg := SecretKeyPromptArg{
		Ska: SecretKeyArg{
			Me:      d.Me,
			KeyType: DeviceSigningKeyType,
		},
		SecretUI: ui,
		Reason:   "sign new key",
	}
	d.ExistingKey, err = m.G().Keyrings.GetSecretKeyWithPrompt(m, arg)

	return err
}

// Run the Delegator, performing all necessary internal operations.  Return err
// on failure and nil on success.
func (d *Delegator) Run(m MetaContext) (err error) {
	var jw *jsonw.Wrapper
	defer m.Trace("Delegator#Run", func() error { return err })()

	if err = d.CheckArgs(m); err != nil {
		return err
	}

	d.MerkleRoot = m.G().MerkleClient.LastRoot(m)

	// We'll need to generate two proofs, so set the Ctime
	// so that we get the same time both times
	d.Ctime = m.G().Clock().Now().Unix()

	// For a sibkey signature, we first sign the blob with the
	// sibkey, and then embed that signature for the delegating key
	if d.DelegationType == DelegationTypeSibkey {
		if jw, err = KeyProof(m, *d); err != nil {
			m.Debug("| Failure in intermediate KeyProof()")
			return err
		}

		if d.RevSig, _, _, err = SignJSON(jw, d.NewKey); err != nil {
			m.Debug("| Failure in intermediate SignJson()")
			return err
		}
	}

	if m.G().LocalDb == nil {
		panic("should have a local DB")
	}

	proof, err := KeyProof2(m, *d)
	if err != nil {
		m.Debug("| Failure in KeyProof2()")
		return err
	}

	return d.SignAndPost(m, proof)
}

func (d *Delegator) SignAndPost(m MetaContext, proof *ProofMetadataRes) (err error) {
	d.proof = proof
	if d.sig, d.sigID, d.linkID, err = SignJSON(proof.J, d.GetSigningKey()); err != nil {
		m.Debug("| Failure in SignJson()")
		return err
	}
	if err = d.post(m); err != nil {
		m.Debug("| Failure in post()")
		return err
	}
	if err = d.updateLocalState(d.linkID); err != nil {
		return err
	}
	return nil
}

func (d *Delegator) isHighDelegator() bool {
	return d.DelegationType == DelegationTypeEldest ||
		d.DelegationType == DelegationTypeSibkey ||
		d.DelegationType == DelegationTypePGPUpdate
}

func (d *Delegator) updateLocalState(linkID LinkID) (err error) {
	d.Me.SigChainBump(linkID, d.sigID, d.isHighDelegator())
	d.merkleTriple = MerkleTriple{LinkID: linkID, SigID: d.sigID}
	return d.Me.localDelegateKey(d.NewKey, d.sigID, d.getExistingKID(), d.IsSibkeyOrEldest(), d.IsEldest(), d.getMerkleHashMeta(), keybase1.Seqno(0))
}

func (d *Delegator) post(m MetaContext) (err error) {
	var pub string
	if pub, err = d.NewKey.Encode(); err != nil {
		return
	}

	hargs := HTTPArgs{
		"sig_id_base":     S{Val: d.sigID.ToString(false)},
		"sig_id_short":    S{Val: d.sigID.ToShortID()},
		"sig":             S{Val: d.sig},
		"type":            S{Val: string(d.DelegationType)},
		"is_remote_proof": B{Val: false},
		"public_key":      S{Val: pub},
	}

	if len(string(d.ServerHalf)) > 0 {
		hargs["server_half"] = S{Val: hex.EncodeToString(d.ServerHalf)}
	}

	if d.DelegationType == DelegationTypePGPUpdate {
		hargs["is_update"] = B{Val: true}
	}

	if d.IsEldest() {
		hargs["is_primary"] = I{Val: 1}
		hargs["new_eldest"] = B{Val: true}
		hargs["signing_kid"] = S{Val: d.NewKey.GetKID().String()}
	} else {
		hargs["eldest_kid"] = d.EldestKID
		hargs["signing_kid"] = d.getSigningKID()
	}
	if len(d.EncodedPrivateKey) > 0 {
		hargs["private_key"] = S{Val: d.EncodedPrivateKey}
	}

	arg := APIArg{
		Endpoint:    "key/add",
		SessionType: APISessionTypeREQUIRED,
		Args:        hargs,
	}
	if d.Aggregated {
		d.postArg = arg
		// Don't post to the server. DelegatorAggregator will do that.
		return nil
	}
	_, err = m.G().API.Post(m, arg)
	if err != nil {
		return err
	}
	if d.Me == nil {
		return fmt.Errorf("delegator missing 'me' info")
	}
	if d.proof == nil {
		return fmt.Errorf("delegator missing proof seqno")
	}
	return MerkleCheckPostedUserSig(m, d.Me.GetUID(), d.proof.Seqno, d.linkID)
}
