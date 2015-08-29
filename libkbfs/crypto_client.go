package libkbfs

import (
	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/protocol/go"
	"github.com/maxtaco/go-framed-msgpack-rpc/rpc2"
	"golang.org/x/net/context"
)

// CryptoClient implements the Crypto interface by sending RPCs to the
// keybase daemon to perform signatures using the device's current
// signing key.
type CryptoClient struct {
	CryptoCommon
	ctx    *libkb.GlobalContext
	client keybase1.GenericClient
}

var _ Crypto = (*CryptoClient)(nil)

// NewCryptoClient constructs a new CryptoClient.
func NewCryptoClient(config Config, ctx *libkb.GlobalContext) (
	*CryptoClient, error) {
	_, xp, err := ctx.GetSocket()
	if err != nil {
		return nil, err
	}

	srv := rpc2.NewServer(xp, libkb.WrapError)

	protocols := []rpc2.Protocol{
		client.NewSecretUIProtocol(),
	}

	for _, p := range protocols {
		if err := srv.Register(p); err != nil {
			if _, ok := err.(rpc2.AlreadyRegisteredError); !ok {
				return nil, err
			}
		}
	}

	client := rpc2.NewClient(xp, libkb.UnwrapError)
	return newCryptoClientWithClient(config, ctx, client), nil
}

// newCryptoClientWithClient should only be used for testing.
func newCryptoClientWithClient(config Config, ctx *libkb.GlobalContext,
	client keybase1.GenericClient) *CryptoClient {
	return &CryptoClient{
		CryptoCommon{config.Codec(), config.MakeLogger("")}, ctx, client}
}

// Sign implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Sign(ctx context.Context, msg []byte) (
	sigInfo SignatureInfo, err error) {
	defer func() {
		c.log.CDebugf(ctx, "Signed %d-byte message with %s: err=%v", len(msg),
			sigInfo, err)
	}()

	var ed25519SigInfo keybase1.ED25519SignatureInfo
	f := func() error {
		cc := keybase1.CryptoClient{Cli: c.client}
		var err error
		ed25519SigInfo, err = cc.SignED25519(keybase1.SignED25519Arg{
			SessionID: 0,
			Msg:       msg,
			Reason:    "to use kbfs",
		})
		return err
	}
	err = runUnlessCanceled(ctx, f)
	if err != nil {
		return
	}

	sigInfo = SignatureInfo{
		Version:      SigED25519,
		Signature:    ed25519SigInfo.Sig[:],
		VerifyingKey: VerifyingKey{libkb.NaclSigningKeyPublic(ed25519SigInfo.PublicKey).GetKID()},
	}
	return
}

// DecryptTLFCryptKeyClientHalf implements the Crypto interface for
// CryptoClient.
func (c *CryptoClient) DecryptTLFCryptKeyClientHalf(ctx context.Context,
	publicKey TLFEphemeralPublicKey,
	encryptedClientHalf EncryptedTLFCryptKeyClientHalf) (
	clientHalf TLFCryptKeyClientHalf, err error) {
	if encryptedClientHalf.Version != EncryptionSecretbox {
		err = UnknownEncryptionVer{encryptedClientHalf.Version}
		return
	}

	var encryptedData keybase1.EncryptedBytes32
	if len(encryptedClientHalf.EncryptedData) != len(encryptedData) {
		err = libkb.DecryptionError{}
		return
	}
	copy(encryptedData[:], encryptedClientHalf.EncryptedData)

	var nonce keybase1.BoxNonce
	if len(encryptedClientHalf.Nonce) != len(nonce) {
		err = InvalidNonceError{encryptedClientHalf.Nonce}
		return
	}
	copy(nonce[:], encryptedClientHalf.Nonce)

	var decryptedClientHalf keybase1.Bytes32
	f := func() error {
		cc := keybase1.CryptoClient{Cli: c.client}
		var err error
		decryptedClientHalf, err = cc.UnboxBytes32(keybase1.UnboxBytes32Arg{
			SessionID:        0,
			EncryptedBytes32: encryptedData,
			Nonce:            nonce,
			PeersPublicKey:   keybase1.BoxPublicKey(publicKey.PublicKey),
			Reason:           "to use kbfs",
		})
		return err
	}
	err = runUnlessCanceled(ctx, f)
	if err != nil {
		return
	}

	clientHalf = TLFCryptKeyClientHalf{decryptedClientHalf}
	return
}
