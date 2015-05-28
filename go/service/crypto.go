package service

import (
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/crypto/nacl/box"
)

type CryptoHandler struct {
	*BaseHandler
	// Defaults to CryptoHandler.getSecretKey(), but overrideable
	// for testing.
	getSecretKeyFn func(secretKeyType libkb.SecretKeyType, sessionID int, reason string) (libkb.GenericKey, error)
}

func (c *CryptoHandler) getSecretKey(secretKeyType libkb.SecretKeyType, sessionID int, reason string) (libkb.GenericKey, error) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return nil, err
	}

	secretUI := c.getSecretUI(sessionID)
	signingKey, _, err := G.Keyrings.GetSecretKeyWithPrompt(nil, libkb.SecretKeyArg{
		Me:      me,
		KeyType: secretKeyType,
	}, secretUI, reason)
	return signingKey, err
}

func NewCryptoHandler(xp *rpc2.Transport) *CryptoHandler {
	c := &CryptoHandler{BaseHandler: NewBaseHandler(xp)}

	c.getSecretKeyFn = func(secretKeyType libkb.SecretKeyType, sessionID int, reason string) (libkb.GenericKey, error) {
		return c.getSecretKey(secretKeyType, sessionID, reason)
	}

	return c
}

func (c *CryptoHandler) SignED25519(arg keybase1.SignED25519Arg) (ret keybase1.ED25519SignatureInfo, err error) {
	signingKey, err := c.getSecretKeyFn(libkb.DeviceSigningKeyType, arg.SessionID, arg.Reason)
	if err != nil {
		return
	}

	kp, ok := signingKey.(libkb.NaclSigningKeyPair)
	if !ok || kp.Private == nil {
		err = libkb.KeyCannotSignError{}
		return
	}

	sig := *kp.Private.Sign(arg.Msg)
	publicKey := kp.Public
	ret = keybase1.ED25519SignatureInfo{
		Sig:       keybase1.ED25519Signature(sig),
		PublicKey: keybase1.ED25519PublicKey(publicKey),
	}
	return
}

func (c *CryptoHandler) UnboxTLFCryptKeyClientHalf(arg keybase1.UnboxTLFCryptKeyClientHalfArg) (tlfCryptKeyClientHalf keybase1.TLFCryptKeyClientHalf, err error) {
	encryptionKey, err := c.getSecretKeyFn(libkb.DeviceEncryptionKeyType, arg.SessionID, arg.Reason)
	if err != nil {
		return
	}

	kp, ok := encryptionKey.(libkb.NaclDHKeyPair)
	if !ok || kp.Private == nil {
		err = libkb.KeyCannotUnboxError{}
		return
	}

	decryptedData, ok := box.Open(nil, arg.EncryptedData, (*[24]byte)(&arg.Nonce), (*[32]byte)(&arg.PeersPublicKey), (*[32]byte)(kp.Private))
	if !ok {
		err = libkb.DecryptionError{}
		return
	}

	if len(decryptedData) != len(tlfCryptKeyClientHalf) {
		err = libkb.DecryptionError{}
		return
	}

	copy(tlfCryptKeyClientHalf[:], decryptedData)
	return
}
