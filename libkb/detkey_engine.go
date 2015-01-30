package libkb

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"github.com/agl/ed25519"
	"golang.org/x/crypto/nacl/box"
)

type DetKeyEngine struct {
	me         *User
	signingKey GenericKey
}

func NewDetKeyEngine(me *User, signingKey GenericKey) *DetKeyEngine {
	return &DetKeyEngine{me: me, signingKey: signingKey}
}

func (d *DetKeyEngine) Run(eddsaSeed, dhSeed []byte) error {
	if err := d.eddsa(eddsaSeed); err != nil {
		return err
	}
	if err := d.dh(dhSeed); err != nil {
		return err
	}
	return nil
}

func (d *DetKeyEngine) eddsa(seed []byte) error {
	xseed, serverHalf, err := d.serverSeed(seed)
	if err != nil {
		return err
	}
	pub, priv, err := ed25519.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return err
	}

	G.Log.Info("detkey[eddsa] serverHalf: %x", serverHalf)
	G.Log.Info("detkey[eddsa] pub:        %x", *pub)
	G.Log.Info("detkey[eddsa] priv:       %x", *priv)

	var key NaclSigningKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &NaclSigningKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	return d.push(key, serverHalf, NACL_EDDSA_EXPIRE_IN)
}

func (d *DetKeyEngine) dh(seed []byte) error {
	xseed, serverHalf, err := d.serverSeed(seed)
	if err != nil {
		return err
	}
	pub, priv, err := box.GenerateKey(bytes.NewBuffer(xseed))
	if err != nil {
		return err
	}

	G.Log.Info("detkey[dh] serverHalf: %x", serverHalf)
	G.Log.Info("detkey[dh] pub:        %x", *pub)
	G.Log.Info("detkey[dh] priv:       %x", *priv)

	/*
		key, err := ImportNaclDHKeyPairFromBytes((*pub)[:], (*priv)[:])
		if err != nil {
			return err
		}
	*/
	var key NaclDHKeyPair
	copy(key.Public[:], (*pub)[:])
	key.Private = &NaclDHKeyPrivate{}
	copy(key.Private[:], (*priv)[:])

	return d.push(key, serverHalf, NACL_DH_EXPIRE_IN)
}

func (d *DetKeyEngine) serverSeed(seed []byte) (newseed, serverHalf []byte, err error) {
	serverHalf, err = RandBytes(len(seed))
	if err != nil {
		return
	}
	newseed = make([]byte, len(seed))
	XORBytes(newseed, seed, serverHalf)
	return newseed, serverHalf, nil
}

func (d *DetKeyEngine) push(key GenericKey, serverHalf []byte, expire int) error {
	jw, err := d.me.KeyProof(key, d.signingKey, "sibkey", expire, nil)
	if err != nil {
		fmt.Printf("keyproof err: %q\n", err)
		return err
	}
	sig, sigid, linkid, err := SignJson(jw, key)

	/*
		pubkey, err := key.Encode()
		if err != nil {
			fmt.Printf("key encode err: %q\n", err)
			return err
		}
	*/

	// save it to local keyring:
	_, err = WriteP3SKBToKeyring(key, nil, G.UI.GetLogUI())
	if err != nil {
		fmt.Printf("write keyring err: %q\n", err)
		return err
	}

	/*
		args := HttpArgs{
			"sig_id_base":  S{sigid.ToString(false)},
			"sig_id_short": S{sigid.ToShortId()},
			"sig":          S{sig},
			"public_key":   S{pubkey},
			"is_primary":   I{1},
			"server_half":  S{hex.EncodeToString(serverHalf)},
		}

		_, err = G.API.Post(ApiArg{
			Endpoint:    "key/add",
			NeedSession: true,
			Args:        args,
		})
		if err != nil {
			fmt.Printf("api post err: %q\n", err)
			return err
		}
	*/
	arg := PostNewKeyArg{
		Sig:        sig,
		Id:         *sigid,
		Type:       "sibkey",
		PublicKey:  key,
		SigningKey: d.signingKey,
		PrimaryKey: d.signingKey,
		ServerHalf: hex.EncodeToString(serverHalf),
	}
	fmt.Printf("PostNewKeyArg:\n%+v\n", arg)
	if err := PostNewKey(arg); err != nil {
		return err
	}

	d.me.sigChain.Bump(MerkleTriple{linkId: linkid, sigId: sigid})
	return nil
}
