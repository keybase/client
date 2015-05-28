package service

import (
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
)

type CryptoHandler struct {
	*BaseHandler
	// Defaults to CryptoHandler.getDeviceSigningKey(), but
	// overrideable for testing.
	getDeviceSigningKeyFn func(sessionID int, reason string) (libkb.GenericKey, error)
}

func (c *CryptoHandler) getDeviceSigningKey(sessionID int, reason string) (libkb.GenericKey, error) {
	me, err := libkb.LoadMe(libkb.LoadUserArg{})
	if err != nil {
		return nil, err
	}

	secretUI := c.getSecretUI(sessionID)
	signingKey, _, err := G.Keyrings.GetSecretKeyWithPrompt(nil, libkb.SecretKeyArg{
		Me:      me,
		KeyType: libkb.DeviceSigningKeyType,
	}, secretUI, reason)
	return signingKey, err
}

func NewCryptoHandler(xp *rpc2.Transport) *CryptoHandler {
	c := &CryptoHandler{BaseHandler: NewBaseHandler(xp)}

	c.getDeviceSigningKeyFn = func(sessionID int, reason string) (libkb.GenericKey, error) {
		return c.getDeviceSigningKey(sessionID, reason)
	}

	return c
}

func (c *CryptoHandler) SignED25519(arg keybase1.SignED25519Arg) (ret keybase1.ED25519SignatureInfo, err error) {
	signingKey, err := c.getDeviceSigningKeyFn(arg.SessionID, arg.Reason)
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
	ctx := &engine.Context{
		SecretUI: c.getSecretUI(arg.SessionID),
	}
	eng := engine.NewCryptoDecryptTLFEngine(G, arg.EncryptedData, arg.Nonce, arg.PeersPublicKey, arg.Reason)
	if err = engine.RunEngine(eng, ctx); err != nil {
		return
	}
	tlfCryptKeyClientHalf = eng.GetTLFCryptKeyClientHalf()
	return
}
