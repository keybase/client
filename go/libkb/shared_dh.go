package libkb

import (
	"errors"
	"fmt"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

func NewSharedDHSecretKeyBox(innerKey NaclDHKeyPair, receiverKey NaclDHKeyPair, senderKey NaclDHKeyPair, generation keybase1.SharedDHKeyGeneration) (keybase1.SharedDHSecretKeyBox, error) {
	_, secret, err := innerKey.ExportPublicAndPrivate()
	if err != nil {
		return keybase1.SharedDHSecretKeyBox{}, err
	}

	encInfo, err := receiverKey.Encrypt(secret, &senderKey)
	if err != nil {
		return keybase1.SharedDHSecretKeyBox{}, err
	}
	boxStr, err := PacketArmoredEncode(encInfo)
	if err != nil {
		return keybase1.SharedDHSecretKeyBox{}, err
	}

	return keybase1.SharedDHSecretKeyBox{
		Box:         boxStr,
		ReceiverKID: receiverKey.GetKID(),
		Generation:  generation,
	}, nil
}

type sharedDHSecretKeyBoxesResp struct {
	Boxes  []keybase1.SharedDHSecretKeyBox `json:"boxes"`
	Status AppStatus                       `json:"status"`
}

func (s *sharedDHSecretKeyBoxesResp) GetAppStatus() *AppStatus {
	return &s.Status
}

// SharedDHKeyMap is a map of Generation numbers to
// DH private keys, for decrypting data.
type SharedDHKeyMap map[keybase1.SharedDHKeyGeneration]NaclDHKeyPair

// SharedDHKeyring holds on to all versions of the Shared DH key.
// Generation=0 should be nil, but all others should be present.
type SharedDHKeyring struct {
	Contextified
	sync.Mutex
	uid         keybase1.UID
	generations SharedDHKeyMap
}

// NewSharedDHKeyring makes a new SharedDH keyring for a given UID.
func NewSharedDHKeyring(g *GlobalContext, uid keybase1.UID) (*SharedDHKeyring, error) {
	if uid.IsNil() {
		return nil, fmt.Errorf("NewSharedDHKeyring called with nil uid")
	}
	return &SharedDHKeyring{
		Contextified: NewContextified(g),
		uid:          uid,
		generations:  make(SharedDHKeyMap),
	}, nil
}

func (s *SharedDHKeyring) GetUID() keybase1.UID {
	return s.uid
}

// PrepareBoxesForNewDevice encrypts all known shared keys for receiverKey.
// Used for giving keys to a new device.
// The result boxes will be pushed to the server.
func (s *SharedDHKeyring) PrepareBoxesForNewDevice(ctx context.Context, receiverKey NaclDHKeyPair, senderKey NaclDHKeyPair) (boxes []keybase1.SharedDHSecretKeyBox, err error) {
	s.Lock()
	defer s.Unlock()

	for generation, fullSharedDHKey := range s.generations {
		box, err := NewSharedDHSecretKeyBox(fullSharedDHKey, receiverKey, senderKey, generation)
		if err != nil {
			return nil, err
		}
		boxes = append(boxes, box)
	}

	s.G().Log.CDebugf(ctx, "SharedDHKeyring#PrepareBoxesForNewDevice(%s -> %s) -> %s boxes",
		senderKey.GetKID(), receiverKey.GetKID(), len(boxes))
	return boxes, nil
}

// Encrypt fullSharedDHKey for receiverKeys. Use senderKey to encrypt.
// Does not use the keyring at all. Attached for organizational purposes.
// Used when creating a new key after revocation
func (s *SharedDHKeyring) PrepareBoxesForDevices(ctx context.Context, fullSharedDHKey NaclDHKeyPair,
	generation keybase1.SharedDHKeyGeneration, receiverKeys []NaclDHKeyPair,
	senderKey NaclDHKeyPair) (boxes []keybase1.SharedDHSecretKeyBox, err error) {
	for _, receiverKey := range receiverKeys {
		box, err := NewSharedDHSecretKeyBox(fullSharedDHKey, receiverKey, senderKey, generation)
		if err != nil {
			return nil, err
		}
		boxes = append(boxes, box)
	}
	return boxes, nil
}

func (s *SharedDHKeyring) HasAnyKeys() bool {
	return s.CurrentGeneration() > 0
}

// CurrentGeneration returns what generation we're on. The version possible
// Version is 1. Version 0 implies no keys are available.
func (s *SharedDHKeyring) CurrentGeneration() keybase1.SharedDHKeyGeneration {
	s.Lock()
	defer s.Unlock()
	return s.currentGenerationLocked()
}

func (s *SharedDHKeyring) currentGenerationLocked() keybase1.SharedDHKeyGeneration {
	return keybase1.SharedDHKeyGeneration(len(s.generations))
}

func (s *SharedDHKeyring) SharedDHKey(ctx context.Context, g keybase1.SharedDHKeyGeneration) *NaclDHKeyPair {
	s.Lock()
	defer s.Unlock()
	key, found := s.generations[g]
	s.G().Log.CDebugf(ctx, "SharedDHKeyring#SharedDHKey %s -> %s", g, found)
	if !found {
		return nil
	}
	return &key
}

// AddKey registers a full key locally.
func (s *SharedDHKeyring) AddKey(ctx context.Context,
	generation keybase1.SharedDHKeyGeneration, key NaclDHKeyPair) error {

	s.Lock()
	defer s.Unlock()
	if key.IsNil() {
		return errors.New("AddKey nil key")
	}
	if !key.CanDecrypt() {
		return errors.New("AddKey key cannot decrypt")
	}
	_, exists := s.generations[generation]
	if exists {
		return fmt.Errorf("AddKey duplicate for generation: %v", generation)
	}
	s.generations[generation] = key
	return nil
}

// Clone makes a deep copy of this DH keyring.
func (s *SharedDHKeyring) Clone() (*SharedDHKeyring, error) {
	s.Lock()
	defer s.Unlock()
	ret, err := NewSharedDHKeyring(s.G(), s.uid)
	if err != nil {
		return nil, err
	}
	ret.mergeLocked(s.generations)
	return ret, nil
}

// Update will take the existing SharedDHKeyring, and return an updated
// copy, that will be synced with the server's version of our SharedDHKeyring.
func (s *SharedDHKeyring) Update(ctx context.Context) (ret *SharedDHKeyring, err error) {
	ret, err = s.Clone()
	if err != nil {
		return nil, err
	}
	err = ret.Sync(ctx)
	return ret, err
}

// Sync our SharedDHKeyring with the server. It will either add all new
// Secret boxes since our last update, or not at all if there was an error.
// Pass it a standard Go network context.
func (s *SharedDHKeyring) Sync(ctx context.Context) (err error) {
	return s.syncAsConfiguredDevice(ctx, nil, nil)
}

// `lctx` and `upak` are optional
func (s *SharedDHKeyring) SyncWithExtras(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys) (err error) {
	return s.syncAsConfiguredDevice(ctx, lctx, upak)
}

// `lctx` and `upak` are optional
func (s *SharedDHKeyring) syncAsConfiguredDevice(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys) (err error) {
	uid, deviceID, _, activeDecryptionKey := s.G().ActiveDevice.AllFields()
	if !s.uid.Equal(uid) {
		return fmt.Errorf("UID changed on SharedDHKeyring")
	}
	if deviceID.IsNil() {
		return fmt.Errorf("missing configured deviceID")
	}
	return s.sync(ctx, lctx, upak, deviceID, activeDecryptionKey)
}

// `lctx` and `upak` are optional
func (s *SharedDHKeyring) SyncAsPaperKey(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID, decryptionKey GenericKey) (err error) {
	if deviceID.IsNil() {
		return fmt.Errorf("missing deviceID")
	}
	// Note this `== nil` check might not work, as it might be a typed nil.
	if decryptionKey == nil {
		return fmt.Errorf("missing decryption key")
	}
	return s.sync(ctx, lctx, upak, deviceID, decryptionKey)
}

// `lctx` and `upak` are optional
func (s *SharedDHKeyring) sync(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID, decryptionKey GenericKey) (err error) {
	defer s.G().CTrace(ctx, "SharedDHKeyring#sync", func() error { return err })()

	s.G().Log.CDebugf(ctx, "SharedDHKeyring#sync(%v, %v)", lctx != nil, upak != nil)

	s.Lock()
	defer s.Unlock()

	boxes, err := s.fetchBoxesLocked(ctx, lctx, deviceID)
	if err != nil {
		return err
	}

	if upak == nil {
		upak, err = s.getUPAK(ctx, lctx, upak)
		if err != nil {
			return err
		}
	}

	newKeys, err := s.importLocked(ctx, boxes, decryptionKey, newSharedDHChecker(upak))
	if err != nil {
		return err

	}
	s.mergeLocked(newKeys)
	return nil
}

func (s *SharedDHKeyring) getUPAK(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys) (*keybase1.UserPlusAllKeys, error) {
	if upak != nil {
		return upak, nil
	}
	upakArg := NewLoadUserByUIDArg(ctx, s.G(), s.uid)
	upakArg.LoginContext = lctx
	upak, _, err := s.G().GetUPAKLoader().Load(upakArg)
	return upak, err
}

func (s *SharedDHKeyring) mergeLocked(m SharedDHKeyMap) (err error) {
	for k, v := range m {
		s.generations[k] = v.Clone()
	}
	return nil
}

func (s *SharedDHKeyring) fetchBoxesLocked(ctx context.Context, lctx LoginContext, deviceID keybase1.DeviceID) (ret []keybase1.SharedDHSecretKeyBox, err error) {
	defer s.G().CTrace(ctx, "SharedDHKeyring#fetchBoxesLocked", func() error { return err })()

	var sessionR SessionReader
	if lctx != nil {
		sessionR = lctx.LocalSession()
	}

	var resp sharedDHSecretKeyBoxesResp
	err = s.G().API.GetDecode(APIArg{
		Endpoint: "key/fetch_shared_dh_secrets",
		Args: HTTPArgs{
			"generation": I{int(s.currentGenerationLocked())},
			"device_id":  S{deviceID.String()},
		},
		SessionType: APISessionTypeREQUIRED,
		SessionR:    sessionR,
		RetryCount:  5, // It's pretty bad to fail this, so retry.
		NetContext:  ctx,
	}, &resp)
	if err != nil {
		return nil, err
	}
	ret = resp.Boxes
	s.G().Log.CDebugf(ctx, "| Got back %d boxes from server", len(ret))
	return ret, nil
}

// sharedDHChecker checks the secret boxes returned from the server
// against the public keys advertised in the user's sigchain. As we import
// keys, we check them against these two maps.  In particular, we check that
// the box was encryted with a valid device Box key (though it can be now revoked).
// And we check that the public key corresponds to what was signed in as a
// shared_dh_key.
type sharedDHChecker struct {
	allowedEncryptingKIDs map[keybase1.KID]bool
	expectedSharedDHKIDs  map[keybase1.SharedDHKeyGeneration]keybase1.KID
}

func newSharedDHChecker(upak *keybase1.UserPlusAllKeys) *sharedDHChecker {
	ret := sharedDHChecker{
		allowedEncryptingKIDs: make(map[keybase1.KID]bool),
		expectedSharedDHKIDs:  make(map[keybase1.SharedDHKeyGeneration]keybase1.KID),
	}
	isEncryptionKey := func(k keybase1.PublicKey) bool {
		return !k.IsSibkey && k.PGPFingerprint == ""
	}
	for _, r := range upak.Base.RevokedDeviceKeys {
		if isEncryptionKey(r.Key) {
			ret.allowedEncryptingKIDs[r.Key.KID] = true
		}
	}
	for _, k := range upak.Base.DeviceKeys {
		if isEncryptionKey(k) {
			ret.allowedEncryptingKIDs[k.KID] = true
		}
	}
	for _, k := range upak.Base.SharedDHKeys {
		ret.expectedSharedDHKIDs[keybase1.SharedDHKeyGeneration(k.Gen)] = k.Kid
	}
	return &ret
}

func importSharedDHKey(box *keybase1.SharedDHSecretKeyBox, activeDecryptionKey GenericKey, wantedGeneration keybase1.SharedDHKeyGeneration, checker *sharedDHChecker) (ret *NaclDHKeyPair, err error) {
	if box.Generation != wantedGeneration {
		return nil, SharedDHImportError{fmt.Sprintf("bad generation returned: %d", box.Generation)}
	}
	if !activeDecryptionKey.GetKID().Equal(box.ReceiverKID) {
		return nil, SharedDHImportError{fmt.Sprintf("wrong encryption kid: %s", box.ReceiverKID.String())}
	}
	rawKey, encryptingKID, err := activeDecryptionKey.DecryptFromString(box.Box)
	if err != nil {
		return nil, err
	}
	if len(checker.allowedEncryptingKIDs) == 0 {
		return nil, SharedDHImportError{fmt.Sprintf("no allowed encrypting kids")}
	}
	if !checker.allowedEncryptingKIDs[encryptingKID] {
		return nil, SharedDHImportError{fmt.Sprintf("unexpected encrypting kid: %s", encryptingKID)}
	}
	key, err := MakeNaclDHKeyPairFromSecretBytes(rawKey)
	if err != nil {
		return nil, err
	}
	expectedKID, found := checker.expectedSharedDHKIDs[box.Generation]
	if !found {
		// This error can mean the SDH keyring is behind and should be synced.
		return nil, SharedDHImportError{fmt.Sprintf("No known SDH generation: %d", box.Generation)}
	}
	if !expectedKID.Equal(key.GetKID()) {
		return nil, SharedDHImportError{fmt.Sprintf("Wrong public key for gen=%d; %s != %s", box.Generation, expectedKID, key.GetKID())}
	}

	return &key, nil
}

func (s *SharedDHKeyring) importLocked(ctx context.Context, boxes []keybase1.SharedDHSecretKeyBox, decryptionKey GenericKey, checker *sharedDHChecker) (ret SharedDHKeyMap, err error) {
	defer s.G().CTrace(ctx, "SharedDHKeyring#importLocked", func() error { return err })()

	ret = make(SharedDHKeyMap)
	nxt := s.currentGenerationLocked() + 1
	for _, box := range boxes {
		naclDHKey, err := importSharedDHKey(&box, decryptionKey, nxt, checker)
		if err != nil {
			return nil, err
		}
		ret[nxt] = *naclDHKey
		nxt++
	}
	return ret, nil
}
