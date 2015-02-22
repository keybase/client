package libkb

import (
	"encoding/hex"
	jsonw "github.com/keybase/go-jsonw"
)

// Delegator
//
// Delegates authority to another key.
//

type Delegator struct {

	// Set these fields
	NewKey            GenericKey
	ExistingKey       GenericKey
	EldestKID         KID
	Me                *User
	Sibkey            bool
	Expire            int
	Device            *Device
	RevSig            *ReverseSig
	ServerHalf        []byte
	EncodedPrivateKey string

	// Internal fields
	pushType     string
	isEldest     bool
	signingKey   GenericKey
	sig          string
	sigId        *SigId
	merkleTriple MerkleTriple
}

func (d Delegator) getSigningKID() KID { return d.signingKey.GetKid() }

func (d Delegator) getExistingKID() KID {
	if d.ExistingKey == nil {
		return nil
	} else {
		return d.ExistingKey.GetKid()
	}
}

// Sometime our callers don't set Sibkey=true for eldest keys, so
// we workaround that here.
func (d Delegator) IsSibkey() bool { return d.Sibkey || d.isEldest }

// GetMerkleTriple gets the new MerkleTriple that came about as a result
// of performing the key delegation.
func (d Delegator) GetMerkleTriple() MerkleTriple { return d.merkleTriple }

func (d *Delegator) checkArgs() (err error) {

	if d.NewKey == nil {
		err = NoSecretKeyError{}
		return
	}

	if d.signingKey = d.ExistingKey; d.signingKey != nil {
	} else if d.signingKey, _ = d.Me.GetDeviceSibkey(); d.signingKey != nil {
	} else {
		d.signingKey = d.NewKey
		d.isEldest = true
	}

	if d.EldestKID != nil || d.isEldest {
	} else if fokid := d.Me.GetEldestFOKID(); fokid == nil || fokid.Kid == nil {
		err = NoEldestKeyError{}
		return err
	} else {
		d.EldestKID = fokid.Kid
	}

	return nil
}

// Run the Delegator, performing all necessary internal operations.  Return err
// on failure and nil on success.
func (d *Delegator) Run() (err error) {
	var jw *jsonw.Wrapper
	var linkid LinkId

	if err = d.checkArgs(); err != nil {
		return
	}

	if jw, d.pushType, err = d.Me.KeyProof(*d); err != nil {
		return
	}

	if d.sig, d.sigId, linkid, err = SignJson(jw, d.signingKey); err != nil {
		return err
	}

	if err = d.post(); err != nil {
		return
	}

	if err = d.updateLocalState(linkid); err != nil {
		return
	}
	return nil
}

func (d *Delegator) updateLocalState(linkid LinkId) (err error) {
	d.Me.SigChainBump(linkid, d.sigId)
	d.merkleTriple = MerkleTriple{linkId: linkid, sigId: d.sigId}

	return d.Me.localDelegateKey(d.NewKey, d.sigId, d.getExistingKID(), d.IsSibkey())
}

func (d Delegator) post() (err error) {
	var pub string
	if pub, err = d.NewKey.Encode(); err != nil {
		return
	}

	hargs := HttpArgs{
		"sig_id_base":     S{Val: d.sigId.ToString(false)},
		"sig_id_short":    S{Val: d.sigId.ToShortId()},
		"sig":             S{Val: d.sig},
		"type":            S{Val: d.pushType},
		"is_remote_proof": B{Val: false},
		"public_key":      S{Val: pub},
		"server_half":     S{Val: hex.EncodeToString(d.ServerHalf)},
	}
	if d.isEldest {
		hargs["is_primary"] = I{Val: 1}
	} else {
		hargs["eldest_kid"] = d.EldestKID
		hargs["signing_kid"] = d.getSigningKID()
	}
	if len(d.EncodedPrivateKey) > 0 {
		hargs["private_key"] = S{Val: d.EncodedPrivateKey}
	}

	G.Log.Debug("Post NewKey: %v", hargs)
	_, err = G.API.Post(ApiArg{
		Endpoint:    "key/add",
		NeedSession: true,
		Args:        hargs,
	})
	return err
}
