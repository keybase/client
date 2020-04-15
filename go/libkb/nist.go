package libkb

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"github.com/keybase/client/go/kbcrypto"
	"github.com/keybase/client/go/msgpack"
	"github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
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

// If we're within 26 hours of expiration, generate a new NIST;
const nistExpirationMargin = 26 * time.Hour // I.e., half of the lifetime
const nistLifetime = 52 * time.Hour         // A little longer than 2 days.
const nistSessionIDLength = 16
const nistShortHashLen = 19
const nistWebAuthTokenLifetime = 24 * time.Hour // website tokens expire in a day

type nistType int
type nistMode int
type sessionVersion int

const (
	nistVersion             sessionVersion = 34
	nistVersionWebAuthToken sessionVersion = 35
	nistModeSignature       nistMode       = 1
	nistModeHash            nistMode       = 2
	nistClient              nistType       = 0
	nistWebAuthToken        nistType       = 1
)

func (t nistType) sessionVersion() sessionVersion {
	if t == nistClient {
		return nistVersion
	}
	return nistVersionWebAuthToken
}

func (t nistType) lifetime() time.Duration {
	if t == nistClient {
		return nistLifetime
	}
	return nistWebAuthTokenLifetime
}

func (t nistType) signaturePrefix() kbcrypto.SignaturePrefix {
	if t == nistClient {
		return kbcrypto.SignaturePrefixNIST
	}
	return kbcrypto.SignaturePrefixNISTWebAuthToken
}

func (t nistType) encoding() *base64.Encoding {
	if t == nistClient {
		return base64.StdEncoding
	}
	return base64.RawURLEncoding
}

type NISTFactory struct {
	Contextified
	sync.Mutex
	uid                keybase1.UID
	deviceID           keybase1.DeviceID
	key                GenericKey // cached secret signing key
	nist               *NIST
	lastSuccessfulNIST *NIST
}

type NISTToken struct {
	b        []byte
	nistType nistType
}

func (n NISTToken) Bytes() []byte  { return n.b }
func (n NISTToken) String() string { return n.nistType.encoding().EncodeToString(n.Bytes()) }
func (n NISTToken) Hash() []byte {
	tmp := sha256.Sum256(n.Bytes())
	return tmp[:]
}
func (n NISTToken) ShortHash() []byte {
	return n.Hash()[0:nistShortHashLen]
}

type NIST struct {
	Contextified
	sync.RWMutex
	expiresAt time.Time
	failed    bool
	succeeded bool
	long      *NISTToken
	short     *NISTToken
	nistType  nistType
}

func NewNISTFactory(g *GlobalContext, uid keybase1.UID, deviceID keybase1.DeviceID, key GenericKey) *NISTFactory {
	return &NISTFactory{
		Contextified: NewContextified(g),
		uid:          uid,
		deviceID:     deviceID,
		key:          key,
	}
}

func (f *NISTFactory) UID() keybase1.UID {
	if f == nil {
		return keybase1.UID("")
	}

	f.Lock()
	defer f.Unlock()
	return f.uid
}

func (f *NISTFactory) NIST(ctx context.Context) (ret *NIST, err error) {
	if f == nil {
		return nil, nil
	}

	f.Lock()
	defer f.Unlock()

	makeNew := true

	if f.nist == nil {
		f.G().Log.CDebugf(ctx, "| NISTFactory#NIST: nil NIST, making new one")
	} else if f.nist.DidFail() {
		f.G().Log.CDebugf(ctx, "| NISTFactory#NIST: NIST previously failed, so we'll make a new one")
	} else {
		if f.nist.DidSucceed() {
			f.lastSuccessfulNIST = f.nist
		}

		valid, until := f.nist.IsStillValid()
		if valid {
			f.G().Log.CDebugf(ctx, "| NISTFactory#NIST: returning existing NIST (expires conservatively in %s, expiresAt: %s)", until, f.nist.expiresAt)
			makeNew = false
		} else {
			f.G().Log.CDebugf(ctx, "| NISTFactory#NIST: NIST expired (conservatively) %s ago, making a new one (expiresAt: %s)", -until, f.nist.expiresAt)
		}
	}

	if makeNew {
		ret = newNIST(f.G())
		var lastSuccessfulNISTShortHash []byte
		if f.lastSuccessfulNIST != nil {
			lastSuccessfulNISTShortHash = f.lastSuccessfulNIST.long.ShortHash()
		}
		err = ret.generate(ctx, f.uid, f.deviceID, f.key, nistClient, lastSuccessfulNISTShortHash)
		if err != nil {
			return nil, err
		}
		f.nist = ret
		f.G().Log.CDebugf(ctx, "| NISTFactory#NIST: Installing new NIST; expiresAt: %s", f.nist.expiresAt)
	}

	return f.nist, nil
}

func (f *NISTFactory) GenerateWebAuthToken(ctx context.Context) (ret *NIST, err error) {
	ret = newNIST(f.G())
	err = ret.generate(ctx, f.uid, f.deviceID, f.key, nistWebAuthToken, nil)
	return ret, err
}

func durationToSeconds(d time.Duration) int64 {
	return int64(d / time.Second)
}

func (n *NIST) IsStillValid() (bool, time.Duration) {
	n.RLock()
	defer n.RUnlock()
	now := ForceWallClock(n.G().Clock().Now())
	diff := n.expiresAt.Sub(now) - nistExpirationMargin
	return (diff > 0), diff
}

func (n *NIST) IsExpired() bool {
	isValid, _ := n.IsStillValid()
	return !isValid
}

func (n *NIST) DidSucceed() bool {
	n.RLock()
	defer n.RUnlock()
	return n.succeeded
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
	_struct   bool `codec:",toarray"` //nolint
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
	_struct bool `codec:",toarray"` //nolint
	Version sessionVersion
	Mode    nistMode
	Sig     []byte
	Payload nistPayloadShort
}

type nistPayloadShort struct {
	_struct     bool `codec:",toarray"` //nolint
	UID         []byte
	DeviceID    []byte
	Generated   int64
	Lifetime    int64
	SessionID   []byte
	OldNISTHash []byte
}

type nistHash struct {
	_struct bool `codec:",toarray"` //nolint
	Version sessionVersion
	Mode    nistMode
	Hash    []byte
}

func (h nistSig) pack(t nistType) (*NISTToken, error) {
	b, err := msgpack.Encode(h)
	if err != nil {
		return nil, err
	}
	return &NISTToken{b: b, nistType: t}, nil
}

func (h nistHash) pack(t nistType) (*NISTToken, error) {
	b, err := msgpack.Encode(h)
	if err != nil {
		return nil, err
	}
	return &NISTToken{b: b, nistType: t}, nil
}

func (n nistPayload) abbreviate(lastSuccessfulNISTShortHash []byte) nistPayloadShort {
	short := nistPayloadShort{
		UID:         n.UID,
		DeviceID:    n.DeviceID,
		Generated:   n.Generated,
		Lifetime:    n.Lifetime,
		SessionID:   n.SessionID,
		OldNISTHash: lastSuccessfulNISTShortHash,
	}
	return short
}

func (n *NIST) generate(ctx context.Context, uid keybase1.UID, deviceID keybase1.DeviceID, key GenericKey, typ nistType, lastSuccessfulShortHash []byte) (err error) {
	defer n.G().CTrace(ctx, "NIST#generate", &err)()

	n.Lock()
	defer n.Unlock()

	naclKey, ok := (key).(NaclSigningKeyPair)
	if !ok {
		return errors.New("cannot generate a NIST without a NaCl key")
	}

	var generated time.Time

	// For some tests we ignore the clock in n.G().Clock() and just use the standard
	// time.Now() clock, because otherwise, the server would start to reject our
	// NISTs.
	if n.G().Env.UseTimeClockForNISTs() {
		generated = time.Now()
	} else {
		generated = n.G().Clock().Now()
	}

	lifetime := typ.lifetime()
	expires := generated.Add(lifetime)
	version := typ.sessionVersion()

	payload := nistPayload{
		Version:   version,
		Mode:      nistModeSignature,
		Hostname:  CanonicalHost,
		UID:       uid.ToBytes(),
		Generated: generated.Unix(),
		Lifetime:  durationToSeconds(lifetime),
		KID:       key.GetBinaryKID(),
	}
	n.G().Log.CDebugf(ctx, "NIST: uid=%s; kid=%s; deviceID=%s", uid, key.GetKID().String(), deviceID)
	payload.DeviceID, err = hex.DecodeString(string(deviceID))
	if err != nil {
		return err
	}
	payload.SessionID, err = RandBytes(nistSessionIDLength)
	if err != nil {
		return err
	}
	var sigInfo kbcrypto.NaclSigInfo
	var payloadPacked []byte
	payloadPacked, err = msgpack.Encode(payload)
	if err != nil {
		return err
	}
	sigInfo, err = naclKey.SignV2(payloadPacked, typ.signaturePrefix())
	if err != nil {
		return err
	}

	var longTmp, shortTmp *NISTToken

	long := nistSig{
		Version: version,
		Mode:    nistModeSignature,
		Sig:     sigInfo.Sig[:],
		Payload: payload.abbreviate(lastSuccessfulShortHash),
	}

	longTmp, err = (long).pack(typ)
	if err != nil {
		return err
	}

	shortTmp, err = (nistHash{
		Version: version,
		Mode:    nistModeHash,
		Hash:    longTmp.ShortHash(),
	}).pack(typ)
	if err != nil {
		return err
	}

	n.long = longTmp
	n.short = shortTmp
	n.expiresAt = ForceWallClock(expires)
	n.nistType = typ

	return nil
}

func (n *NIST) Token() *NISTToken {
	n.RLock()
	defer n.RUnlock()
	if n.succeeded {
		return n.short
	}
	return n.long
}
