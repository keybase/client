package libkb

import (
	"encoding/hex"
	"time"

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
	ExistingFOKID     *FOKID
	EldestKID         KID
	Me                *User
	Sibkey            bool
	Expire            int
	Device            *Device
	RevSig            string
	ServerHalf        []byte
	EncodedPrivateKey string
	Ctime             int64
	PushType          string

	// Internal fields
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
	}
	return d.ExistingKey.GetKid()
}

func (d Delegator) GetExistingKeyFOKID() (ret *FOKID) {
	if d.ExistingKey != nil {
		ret = GenericKeyToFOKID(d.ExistingKey).P()
	} else {
		ret = d.ExistingFOKID
	}
	return ret
}

// Sometime our callers don't set Sibkey=true for eldest keys, so
// we workaround that here.
func (d Delegator) IsSibkey() bool { return d.Sibkey || d.isEldest }

// GetMerkleTriple gets the new MerkleTriple that came about as a result
// of performing the key delegation.
func (d Delegator) GetMerkleTriple() MerkleTriple { return d.merkleTriple }

func (d *Delegator) CheckArgs() (err error) {

	G.Log.Debug("+ Delegator::checkArgs()")

	if d.NewKey == nil {
		err = NoSecretKeyError{}
		return
	}

	if d.signingKey = d.ExistingKey; d.signingKey != nil {
		G.Log.Debug("| Picked passed-in signing key")
	} else {
		G.Log.Debug("| Picking new key for an eldest self-sig")
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

	G.Log.Debug("| Picked key %s for signing", d.signingKey.GetKid())
	G.Log.Debug("- Delegator::checkArgs()")

	return nil
}

// LoadSigningKey can be called before Run() to load the signing key into
// the delegator. This will check the given key first, then a device Key if we have one,
// and otherwise will leave the signing key unset so that we will set it
// as the eldest key on upload.
func (d *Delegator) LoadSigningKey(ui SecretUI) (err error) {

	G.Log.Debug("+ Delegator::LoadSigningKey")
	defer func() {
		G.Log.Debug("+ Delegator::LoadSigningKey -> %s, (found=%v)", ErrToOk(err), (d.signingKey != nil))
	}()

	if d.ExistingKey != nil {
		G.Log.Debug("| Was set ahead of time")
		return
	}

	if d.Me == nil {
		d.Me, err = LoadMe(LoadUserArg{PublicKeyOptional: true})
		if err != nil {
			return
		} else if d.Me == nil {
			G.Log.Debug("| Me didn't load")
			return
		}
	}

	if !d.Me.HasActiveKey() {
		G.Log.Debug("| PGPKeyImportEngine: no active key found, so assuming set of eldest key")
		return
	}

	d.ExistingKey, _, err = G.Keyrings.GetSecretKeyWithPrompt(SecretKeyArg{
		Me:      d.Me,
		KeyType: AnySecretKeyType,
	}, ui, "sign new key")

	return err
}

// Run the Delegator, performing all necessary internal operations.  Return err
// on failure and nil on success.
func (d *Delegator) Run(lctx LoginContext) (err error) {
	var jw *jsonw.Wrapper

	G.Log.Debug("+ Delegator.Run()")
	defer func() {
		G.Log.Debug("- Delegator.Run() -> %s", ErrToOk(err))
	}()

	if err = d.CheckArgs(); err != nil {
		return
	}

	// We'll need to generate two proofs, so set the Ctime
	// so that we get the same time both times
	d.Ctime = time.Now().Unix()

	// For a sibkey signature, we first sign the blob with the
	// sibkey, and then embed that signature for the delegating key
	if d.Sibkey {
		if jw, _, err = d.Me.KeyProof(*d); err != nil {
			G.Log.Debug("| Failure in intermediate KeyProof()")
			return err
		}

		if d.RevSig, _, _, err = SignJson(jw, d.NewKey); err != nil {
			G.Log.Debug("| Failure in intermediate SignJson()")
			return err
		}
	}

	if jw, d.PushType, err = d.Me.KeyProof(*d); err != nil {
		G.Log.Debug("| Failure in KeyProof()")
		return
	}

	return d.SignAndPost(lctx, jw)
}

func (d *Delegator) SignAndPost(lctx LoginContext, jw *jsonw.Wrapper) (err error) {

	var linkid LinkId

	if d.sig, d.sigId, linkid, err = SignJson(jw, d.signingKey); err != nil {
		G.Log.Debug("| Failure in SignJson()")
		return err
	}

	if err = d.post(lctx); err != nil {
		G.Log.Debug("| Failure in post()")
		return
	}

	if err = d.updateLocalState(linkid); err != nil {
		return
	}

	return nil
}

func (d *Delegator) updateLocalState(linkid LinkId) (err error) {
	d.Me.SigChainBump(linkid, d.sigId)
	d.merkleTriple = MerkleTriple{LinkId: linkid, SigId: d.sigId}

	return d.Me.localDelegateKey(d.NewKey, d.sigId, d.getExistingKID(), d.IsSibkey(), d.isEldest)
}

func (d Delegator) post(lctx LoginContext) (err error) {
	var pub string
	if pub, err = d.NewKey.Encode(); err != nil {
		return
	}

	hargs := HttpArgs{
		"sig_id_base":     S{Val: d.sigId.ToString(false)},
		"sig_id_short":    S{Val: d.sigId.ToShortId()},
		"sig":             S{Val: d.sig},
		"type":            S{Val: d.PushType},
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
	arg := ApiArg{
		Endpoint:    "key/add",
		NeedSession: true,
		Args:        hargs,
	}
	if lctx != nil {
		arg.SessionR = lctx.LocalSession()
	}
	_, err = G.API.Post(arg)
	return err
}
