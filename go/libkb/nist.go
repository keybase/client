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
func (n NISTToken) ShortHash() []byte {
	return n.Hash()[0:nistShortHashLen]
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
		err = ret.generate(ctx, f.uid, f.deviceID, f.key)
		if err != nil {
			return nil, err
		}
		f.nist = ret
		f.G().Log.CDebugf(ctx, "| NISTFactory#NIST: Installing new NIST; expiresAt: %s", f.nist.expiresAt)
	}

	return f.nist, nil
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
	b, err := msgpack.Encode(h)
	if err != nil {
		return nil, err
	}
	return NISTToken(b), nil
}

func (h nistHash) pack() (NISTToken, error) {
	b, err := msgpack.Encode(h)
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

	var generated time.Time

	// For some tests we ignore the clock in n.G().Clock() and just use the standard
	// time.Now() clock, because otherwise, the server would start to reject our
	// NISTs.
	if n.G().Env.UseTimeClockForNISTs() {
		generated = time.Now()
	} else {
		generated = n.G().Clock().Now()
	}

	expires := generated.Add(nistLifetime)

	payload := nistPayload{
		Version:   nistVersion,
		Mode:      nistModeSignature,
		Hostname:  CanonicalHost,
		UID:       uid.ToBytes(),
		Generated: generated.Unix(),
		Lifetime:  durationToSeconds(nistLifetime),
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
	sigInfo, err = naclKey.SignV2(payloadPacked, kbcrypto.SignaturePrefixNIST)
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
		Hash:    longTmp.ShortHash(),
	}).pack()
	if err != nil {
		return err
	}

	n.long = longTmp
	n.short = shortTmp
	n.expiresAt = ForceWallClock(expires)

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
