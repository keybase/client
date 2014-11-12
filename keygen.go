package libkb

import (
	"crypto/rsa"
	"golang.org/x/crypto/openpgp"
	"golang.org/x/crypto/openpgp/errors"
	"golang.org/x/crypto/openpgp/packet"
)

//
// General Strategy:
//
//   1. Use AGL's NewEntity() with a keybase UID to generate a new
//      key.  Or maybe go with a 2-subkey configuration.
//   2. Triplesec the result and write to ~/.config/keybase/keys.3s
//   3. Sign a signature link.
//   4. Upload public and signature to server (optionally upload private)
//   5. Change local DB and rewrite user to reflect what we just uploaded
//

type NewKeyArg struct {
	UserId      *packet.UserId
	Config      *packet.Config
	PrimaryBits int
	SubkeyBits  int
}

// NewEntity returns an Entity that contains a fresh RSA/RSA keypair with a
// single identity composed of the given full name, comment and email, any of
// which may be empty but must not contain any of "()<>\x00".
// If config is nil, sensible defaults will be used.
func NewPgpKeyBundle(arg NewKeyArg) (*PgpKeyBundle, error) {
	currentTime := arg.Config.Now()

	if arg.UserId == nil {
		return nil, errors.InvalidArgumentError("UserId field was nil")
	}
	masterPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.PrimaryBits)
	if err != nil {
		return nil, err
	}
	encryptingPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.SubkeyBits)
	if err != nil {
		return nil, err
	}
	signingPriv, err := rsa.GenerateKey(arg.Config.Random(), arg.SubkeyBits)
	if err != nil {
		return nil, err
	}

	e := &openpgp.Entity{
		PrimaryKey: packet.NewRSAPublicKey(currentTime, &masterPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, masterPriv),
		Identities: make(map[string]*openpgp.Identity),
	}
	isPrimaryId := true
	e.Identities[arg.UserId.Id] = &openpgp.Identity{
		Name:   arg.UserId.Name,
		UserId: arg.UserId,
		SelfSignature: &packet.Signature{
			CreationTime: currentTime,
			SigType:      packet.SigTypePositiveCert,
			PubKeyAlgo:   packet.PubKeyAlgoRSA,
			Hash:         arg.Config.Hash(),
			IsPrimaryId:  &isPrimaryId,
			FlagsValid:   true,
			FlagSign:     true,
			FlagCertify:  true,
			IssuerKeyId:  &e.PrimaryKey.KeyId,
		},
	}

	e.Subkeys = make([]openpgp.Subkey, 2)
	e.Subkeys[0] = openpgp.Subkey{
		PublicKey:  packet.NewRSAPublicKey(currentTime, &encryptingPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, encryptingPriv),
		Sig: &packet.Signature{
			CreationTime:              currentTime,
			SigType:                   packet.SigTypeSubkeyBinding,
			PubKeyAlgo:                packet.PubKeyAlgoRSA,
			Hash:                      arg.Config.Hash(),
			FlagsValid:                true,
			FlagEncryptStorage:        true,
			FlagEncryptCommunications: true,
			IssuerKeyId:               &e.PrimaryKey.KeyId,
		},
	}
	e.Subkeys[0].PublicKey.IsSubkey = true
	e.Subkeys[0].PrivateKey.IsSubkey = true

	e.Subkeys[1] = openpgp.Subkey{
		PublicKey:  packet.NewRSAPublicKey(currentTime, &signingPriv.PublicKey),
		PrivateKey: packet.NewRSAPrivateKey(currentTime, signingPriv),
		Sig: &packet.Signature{
			CreationTime: currentTime,
			SigType:      packet.SigTypeSubkeyBinding,
			PubKeyAlgo:   packet.PubKeyAlgoRSA,
			Hash:         arg.Config.Hash(),
			FlagsValid:   true,
			FlagSign:     true,
			IssuerKeyId:  &e.PrimaryKey.KeyId,
		},
	}
	e.Subkeys[1].PublicKey.IsSubkey = true
	e.Subkeys[1].PrivateKey.IsSubkey = true

	return (*PgpKeyBundle)(e), nil
}

// SerializePrivate serializes an Entity, including private key material, to
