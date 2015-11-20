package libkbfs

import (
	"time"

	"github.com/keybase/client/go/client"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-framed-msgpack-rpc"
	"golang.org/x/net/context"
)

// CryptoClient implements the Crypto interface by sending RPCs to the
// keybase daemon to perform signatures using the device's current
// signing key.
type CryptoClient struct {
	CryptoCommon
	client     keybase1.CryptoClient
	shutdownFn func()
}

var _ Crypto = (*CryptoClient)(nil)

// NewCryptoClient constructs a new CryptoClient.
func NewCryptoClient(config Config, kbCtx *libkb.GlobalContext, log logger.Logger) *CryptoClient {
	c := &CryptoClient{
		CryptoCommon: CryptoCommon{
			codec: config.Codec(),
			log:   log,
		},
	}
	conn := NewSharedKeybaseConnection(kbCtx, config, c)
	c.client = keybase1.CryptoClient{Cli: conn.GetClient()}
	c.shutdownFn = conn.Shutdown
	return c
}

// newCryptoClientWithClient should only be used for testing.
func newCryptoClientWithClient(codec Codec, client keybase1.GenericClient,
	log logger.Logger) *CryptoClient {
	return &CryptoClient{
		CryptoCommon: CryptoCommon{
			codec: codec,
			log:   log,
		},
		client: keybase1.CryptoClient{Cli: client},
	}
}

// OnConnect implements the ConnectionHandler interface.
func (c *CryptoClient) OnConnect(ctx context.Context,
	conn *Connection, _ keybase1.GenericClient,
	server *rpc.Server) error {
	err := server.Register(client.NewSecretUIProtocol(libkb.G))
	if err != nil {
		if _, ok := err.(rpc.AlreadyRegisteredError); !ok {
			return err
		}
	}
	return nil
}

// OnConnectError implements the ConnectionHandler interface.
func (c *CryptoClient) OnConnectError(err error, wait time.Duration) {
	c.log.Warning("CryptoClient: connection error: %q; retrying in %s",
		err, wait)
}

// OnDoCommandError implements the ConnectionHandler interface.
func (c *CryptoClient) OnDoCommandError(err error, wait time.Duration) {
	c.log.Warning("CryptoClient: docommand error: %q; retrying in %s",
		err, wait)
}

// OnDisconnected implements the ConnectionHandler interface.
func (c *CryptoClient) OnDisconnected() {
	c.log.Warning("CryptoClient is disconnected")
}

// ShouldThrottle implements the ConnectionHandler interface.
func (c *CryptoClient) ShouldThrottle(err error) bool {
	return false
}

// Sign implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Sign(ctx context.Context, msg []byte) (
	sigInfo SignatureInfo, err error) {
	defer func() {
		c.log.CDebugf(ctx, "Signed %d-byte message with %s: err=%v", len(msg),
			sigInfo, err)
	}()

	ed25519SigInfo, err := c.client.SignED25519(ctx, keybase1.SignED25519Arg{
		SessionID: 0,
		Msg:       msg,
		Reason:    "to use kbfs",
	})
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

// SignToString implements the Crypto interface for CryptoClient.
func (c *CryptoClient) SignToString(ctx context.Context, msg []byte) (
	signature string, err error) {
	defer func() {
		c.log.CDebugf(ctx, "Signed %d-byte message: err=%v", len(msg), err)
	}()
	signature, err = c.client.SignToString(ctx, keybase1.SignToStringArg{
		SessionID: 0,
		Msg:       msg,
		Reason:    "KBFS Authentication",
	})
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

	decryptedClientHalf, err := c.client.UnboxBytes32(ctx, keybase1.UnboxBytes32Arg{
		SessionID:        0,
		EncryptedBytes32: encryptedData,
		Nonce:            nonce,
		PeersPublicKey:   keybase1.BoxPublicKey(publicKey.PublicKey),
		Reason:           "to use kbfs",
	})
	if err != nil {
		return
	}

	clientHalf = TLFCryptKeyClientHalf{decryptedClientHalf}
	return
}

// Shutdown implements the Crypto interface for CryptoClient.
func (c *CryptoClient) Shutdown() {
	if c.shutdownFn != nil {
		c.shutdownFn()
	}
}
