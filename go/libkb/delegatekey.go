package libkb

import (
	"encoding/hex"
	"time"

	keybase1 "github.com/keybase/client/protocol/go"
	jsonw "github.com/keybase/go-jsonw"
)

// Delegator
//
// Delegates authority to another key.
//

type Delegator struct {
	Contextified

	// Set these fields
	NewKey            GenericKey
	ExistingKey       GenericKey
	EldestKID         keybase1.KID
	Me                *User
	Expire            int
	Device            *Device
	RevSig            string
	ServerHalf        []byte
	EncodedPrivateKey string
	Ctime             int64
	DelegationType    DelegationType
	Aggregated        bool // During aggregation we skip some steps (posting, updating some state)

	// Internal fields
	sig          string
	sigID        keybase1.SigID
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

func (d Delegator) GetSigningKey() GenericKey {
	if d.ExistingKey != nil {
		return d.ExistingKey
	}
	return d.NewKey
}

func (d Delegator) IsSibkeyOrEldest() bool {
	return d.DelegationType == SibkeyType || d.DelegationType == EldestType
}

func (d Delegator) IsEldest() bool { return d.DelegationType == EldestType }

// GetMerkleTriple gets the new MerkleTriple that came about as a result
// of performing the key delegation.
func (d Delegator) GetMerkleTriple() MerkleTriple { return d.merkleTriple }

func (d *Delegator) CheckArgs() (err error) {

	G.Log.Debug("+ Delegator::checkArgs()")

	if d.NewKey == nil {
		err = NoSecretKeyError{}
		return
	}

	if d.DelegationType == "" {
		err = MissingDelegationTypeError{}
	}

	if d.ExistingKey != nil {
		G.Log.Debug("| Picked passed-in signing key")
	} else {
		G.Log.Debug("| Picking new key for an eldest self-sig")
		d.DelegationType = EldestType
	}

	if d.EldestKID.Exists() || d.IsEldest() {
	} else if kid := d.Me.GetEldestKID(); kid.IsNil() {
		err = NoEldestKeyError{}
		return err
	} else {
		d.EldestKID = kid
	}

	G.Log.Debug("| Picked key %s for signing", d.getSigningKID())
	G.Log.Debug("- Delegator::checkArgs()")

	return nil
}

// LoadSigningKey can be called before Run() to load the signing key into
// the delegator. This will check the given key first, then a device Key if we have one,
// and otherwise will leave the signing key unset so that we will set it
// as the eldest key on upload.
// lctx can be nil.
func (d *Delegator) LoadSigningKey(lctx LoginContext, ui SecretUI) (err error) {

	G.Log.Debug("+ Delegator::LoadSigningKey")
	defer func() {
		G.Log.Debug("+ Delegator::LoadSigningKey -> %s, (found=%v)", ErrToOk(err), (d.GetSigningKey() != nil))
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

	d.ExistingKey, _, err = d.G().Keyrings.GetSecretKeyWithPrompt(lctx, SecretKeyArg{
		Me:      d.Me,
		KeyType: DeviceSigningKeyType,
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
	if d.DelegationType == SibkeyType {
		if jw, err = d.Me.KeyProof(*d); err != nil {
			G.Log.Debug("| Failure in intermediate KeyProof()")
			return err
		}

		if d.RevSig, _, _, err = SignJSON(jw, d.NewKey); err != nil {
			G.Log.Debug("| Failure in intermediate SignJson()")
			return err
		}
	}

	if jw, err = d.Me.KeyProof(*d); err != nil {
		G.Log.Debug("| Failure in KeyProof()")
		return
	}

	return d.SignAndPost(lctx, jw)
}

func (d *Delegator) SignAndPost(lctx LoginContext, jw *jsonw.Wrapper) (err error) {

	var linkid LinkID

	if d.sig, d.sigID, linkid, err = SignJSON(jw, d.GetSigningKey()); err != nil {
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

func (d *Delegator) updateLocalState(linkid LinkID) (err error) {
	d.Me.SigChainBump(linkid, d.sigID)
	d.merkleTriple = MerkleTriple{LinkID: linkid, SigID: d.sigID}

	return d.Me.localDelegateKey(d.NewKey, d.sigID, d.getExistingKID(), d.IsSibkeyOrEldest(), d.IsEldest())
}

func (d *Delegator) post(lctx LoginContext) (err error) {
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

	if d.DelegationType == PGPUpdateType {
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

	G.Log.Debug("Post NewKey: %v", hargs)
	arg := APIArg{
		Endpoint:     "key/add",
		NeedSession:  true,
		Args:         hargs,
		Contextified: NewContextified(d.G()),
	}
	if lctx != nil {
		arg.SessionR = lctx.LocalSession()
	}

	if d.Aggregated {
		d.postArg = arg
		return nil
	}
	_, err = d.G().API.Post(arg)

	return err
}
