package libkb

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"sync"
	"time"
)

//
// NIST = "Non-Interactive Session Token"
//
// If a client has an unlocked device key, it's able to sign a statement
// of its own creation, and present it to the server as a session key.
// Or, to save bandwidth, can just present the hash of a previously-accepted
// NIST token.
//
// Use NIST tokens rather than the prior generation of session tokens so that
// we're more responsive when we come back from backgrounding, etc.
//

// If we're within 5 minutes of expiration, generate a new NIST
const nistExpirationMargin = time.Minute * 5
const nistLifetime = 28 * time.Hour
const nistSessionIDLength = 16

type nistMode int
type sessionVersion int

const (
	nistVersion       sessionVersion = 34
	nistModeSignature nistMode       = 1
	nistModeHash      nistMode       = 2
)

type NISTFactory struct {
	Contextified
	sync.Mutex
	uid      keybase1.UID
	deviceID keybase1.DeviceID
	key      GenericKey // cached secret signing key
	nist     *NIST
}

type NISTToken []byte

func (n NISTToken) Bytes() []byte  { return []byte(n) }
func (n NISTToken) String() string { return base64.StdEncoding.EncodeToString(n.Bytes()) }
func (n NISTToken) Hash() []byte {
	tmp := sha256.Sum256(n.Bytes())
	return tmp[:]
}

type NIST struct {
	Contextified
	sync.RWMutex
	expiresAt time.Time
	failed    bool
	succeeded bool
	long      NISTToken
	short     NISTToken
}

func NewNISTFactory(g *GlobalContext, uid keybase1.UID, deviceID keybase1.DeviceID, key GenericKey) *NISTFactory {
	return &NISTFactory{
		Contextified: NewContextified(g),
		uid:          uid,
		deviceID:     deviceID,
		key:          key,
	}
}

func (f *NISTFactory) NIST(ctx context.Context) (ret *NIST, err error) {
	if f == nil {
		return nil, nil
	}

	f.Lock()
	defer f.Unlock()

	if f.nist == nil || f.nist.IsExpired() || f.nist.DidFail() {
		ret = newNIST(f.G())
		err = ret.generate(ctx, f.uid, f.deviceID, f.key)
		if err != nil {
			return nil, err
		}
		f.nist = ret
	}

	return f.nist, nil
}

func (n *NIST) IsExpired() bool {
	n.RLock()
	defer n.RUnlock()
	conservativeExpiration := n.expiresAt.Add(-nistExpirationMargin)
	return !conservativeExpiration.After(n.G().Clock().Now())
}

func (n *NIST) DidFail() bool {
	n.RLock()
	defer n.RUnlock()
	return n.failed
}

func (n *NIST) MarkFailure() {
	n.Lock()
	defer n.Unlock()
	n.failed = true
}

func (n *NIST) MarkSuccess() {
	n.Lock()
	defer n.Unlock()
	n.succeeded = true
}

func newNIST(g *GlobalContext) *NIST {
	return &NIST{Contextified: NewContextified(g)}
}

type nistPayload struct {
	_struct   bool `codec:",toarray"`
	Version   sessionVersion
	Mode      nistMode
	Hostname  string
	UID       []byte
	DeviceID  []byte
	KID       []byte
	Generated int64
	Lifetime  int64
	SessionID []byte
}

type nistSig struct {
	_struct bool `codec:",toarray"`
	Version sessionVersion
	Mode    nistMode
	Sig     []byte
	Payload nistPayloadShort
}

type nistPayloadShort struct {
	_struct   bool `codec:",toarray"`
	UID       []byte
	DeviceID  []byte
	Generated int64
	Lifetime  int64
	SessionID []byte
}

type nistHash struct {
	_struct bool `codec:",toarray"`
	Version sessionVersion
	Mode    nistMode
	Hash    []byte
}

func (h nistSig) pack() (NISTToken, error) {
	b, err := MsgpackEncode(h)
	if err != nil {
		return nil, err
	}
	return NISTToken(b), nil
}

func (h nistHash) pack() (NISTToken, error) {
	b, err := MsgpackEncode(h)
	if err != nil {
		return nil, err
	}
	return NISTToken(b), nil
}

func (n nistPayload) abbreviate() nistPayloadShort {
	return nistPayloadShort{
		UID:       n.UID,
		DeviceID:  n.DeviceID,
		Generated: n.Generated,
		Lifetime:  n.Lifetime,
		SessionID: n.SessionID,
	}
}

func (n *NIST) generate(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID, key GenericKey) (err error) {
	defer n.G().CTrace(ctx, "NIST#generate", func() error { return err })()

	n.Lock()
	defer n.Unlock()

	naclKey, ok := (key).(NaclSigningKeyPair)
	if !ok {
		return errors.New("cannot generate a NIST without a NaCl key")
	}

	generated := n.G().Clock().Now()
	expires := generated.Add(nistLifetime)

	payload := nistPayload{
		Version:   nistVersion,
		Mode:      nistModeSignature,
		Hostname:  CanonicalHost,
		UID:       uid.ToBytes(),
		Generated: generated.Unix(),
		Lifetime:  nistLifetime.Nanoseconds() / 1000000000,
		KID:       key.GetBinaryKID(),
	}
	payload.DeviceID, err = hex.DecodeString(string(deviceID))
	if err != nil {
		return err
	}
	payload.SessionID, err = RandBytes(nistSessionIDLength)
	if err != nil {
		return err
	}
	var sigInfo *NaclSigInfo
	var payloadPacked []byte
	payloadPacked, err = MsgpackEncode(payload)
	if err != nil {
		return err
	}
	sigInfo, err = naclKey.SignV2(payloadPacked, SignaturePrefixNIST)
	if err != nil {
		return err
	}

	var longTmp, shortTmp NISTToken

	longTmp, err = (nistSig{
		Version: nistVersion,
		Mode:    nistModeSignature,
		Sig:     sigInfo.Sig[:],
		Payload: payload.abbreviate(),
	}).pack()
	if err != nil {
		return err
	}

	shortTmp, err = (nistHash{
		Version: nistVersion,
		Mode:    nistModeHash,
		Hash:    longTmp.Hash(),
	}).pack()
	if err != nil {
		return err
	}

	n.long = longTmp
	n.short = shortTmp
	n.expiresAt = expires

	return nil
}

func (n *NIST) Token() NISTToken {
	n.RLock()
	defer n.RUnlock()
	if n.succeeded {
		return n.short
	}
	return n.long
}
