package libkb

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	"golang.org/x/crypto/nacl/secretbox"
	context "golang.org/x/net/context"
)

const PerUserKeySeedSize = 32

// A secretbox containg a seed encrypted for its successor generation
type PerUserKeyPrev string

type PerUserKeySeed [PerUserKeySeedSize]byte

func (s *PerUserKeySeed) DeriveSigningKey() (*NaclSigningKeyPair, error) {
	derived, err := DeriveFromSecret(*s, DeriveReasonPUKSigning)
	if err != nil {
		return nil, err
	}
	res, err := MakeNaclSigningKeyPairFromSecret(derived)
	return &res, err
}

func (s *PerUserKeySeed) DeriveDHKey() (*NaclDHKeyPair, error) {
	derived, err := DeriveFromSecret(*s, DeriveReasonPUKEncryption)
	if err != nil {
		return nil, err
	}
	res, err := MakeNaclDHKeyPairFromSecret(derived)
	return &res, err
}

// derivePrevKey derives the symmetric key used to secretbox the previous generation seed.
func (s *PerUserKeySeed) derivePrevKey() (res NaclSecretBoxKey, err error) {
	derived, err := DeriveFromSecret(*s, DeriveReasonPUKPrev)
	if err != nil {
		return res, err
	}
	return NaclSecretBoxKey(derived), err
}

func (s *PerUserKeySeed) IsBlank() bool {
	var blank PerUserKeySeed
	return (subtle.ConstantTimeCompare(s[:], blank[:]) == 1)
}

func NewPerUserKeyBox(contents PerUserKeySeed, receiverKey NaclDHKeyPair, senderKey NaclDHKeyPair, generation keybase1.PerUserKeyGeneration) (keybase1.PerUserKeyBox, error) {
	if contents.IsBlank() {
		return keybase1.PerUserKeyBox{}, errors.New("attempt to box blank per-user-key")
	}

	encInfo, err := receiverKey.Encrypt(contents[:], &senderKey)
	if err != nil {
		return keybase1.PerUserKeyBox{}, err
	}
	boxStr, err := PacketArmoredEncode(encInfo)
	if err != nil {
		return keybase1.PerUserKeyBox{}, err
	}

	return keybase1.PerUserKeyBox{
		Box:         boxStr,
		ReceiverKID: receiverKey.GetKID(),
		Generation:  generation,
	}, nil
}

// Returns base64 of a msgpack array of 3 items: [version, nonce, box]
// Does not do any derivation steps. Caller should pass symmetricKey derived with pukContextPrev.
func newPerUserKeyPrev(contents PerUserKeySeed, symmetricKey NaclSecretBoxKey) (PerUserKeyPrev, error) {
	if contents.IsBlank() {
		return "", errors.New("attempt to secretbox blank per-user-key")
	}

	const version = 1

	var nonce [NaclDHNonceSize]byte
	if nRead, err := rand.Read(nonce[:]); err != nil {
		return "", err
	} else if nRead != NaclDHNonceSize {
		return "", fmt.Errorf("Short random read: %d", nRead)
	}

	// secretbox
	sealed := secretbox.Seal(nil, contents[:], &nonce, (*[NaclSecretBoxKeySize]byte)(&symmetricKey))

	parts := []interface{}{version, nonce, sealed}

	// msgpack
	mh := codec.MsgpackHandle{WriteExt: true}
	var msgpacked []byte
	enc := codec.NewEncoderBytes(&msgpacked, &mh)
	err := enc.Encode(parts)
	if err != nil {
		return "", err
	}

	// b64
	return PerUserKeyPrev(base64.StdEncoding.EncodeToString(msgpacked)), nil
}

// Opens the output of NewPerUserKeyPrev
func openPerUserKeyPrev(sbox PerUserKeyPrev, symmetricKey NaclSecretBoxKey) (PerUserKeySeed, error) {
	var res PerUserKeySeed

	// decode b64
	msgpacked, err := base64.StdEncoding.DecodeString(string(sbox))
	if err != nil {
		return res, err
	}

	// decode msgpack
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(msgpacked, &mh)
	var parts struct {
		Version int
		Nonce   []byte
		Sealed  []byte
	}
	err = dec.Decode(&parts)
	if err != nil {
		return res, err
	}

	// check parts
	if parts.Version != 1 {
		return res, fmt.Errorf("per user key secret box version %v != 1", parts.Version)
	}

	if len(parts.Nonce) != NaclDHNonceSize {
		return res, fmt.Errorf("per user key secret box nonce length %v != %v",
			len(parts.Nonce), NaclDHNonceSize)
	}
	var nonce [NaclDHNonceSize]byte
	copy(nonce[:], parts.Nonce)

	expectedSealedLength := PerUserKeySeedSize + secretbox.Overhead
	if len(parts.Sealed) != expectedSealedLength {
		return res, fmt.Errorf("per user key secret box sealed length %v != %v", len(parts.Sealed), expectedSealedLength)
	}

	// open secretbox
	var symmetricKey2 [NaclSecretBoxKeySize]byte = symmetricKey
	contents, ok := secretbox.Open(nil, parts.Sealed, &nonce, &symmetricKey2)
	if !ok {
		return res, errors.New("per user key secret box open failed")
	}
	if len(contents) != PerUserKeySeedSize {
		return res, fmt.Errorf("per user key seed length %v != %v", len(contents), PerUserKeySeedSize)
	}
	return MakeByte32(contents), nil
}

type perUserKeyFull struct {
	seed   PerUserKeySeed
	sigKey *NaclSigningKeyPair
	encKey *NaclDHKeyPair
}

type perUserKeyMap map[keybase1.PerUserKeyGeneration]perUserKeyFull
type perUserKeySeqGenMap map[keybase1.Seqno]keybase1.PerUserKeyGeneration

// PerUserKeyring holds on to all versions of the per user key.
// Generation=0 should be nil, but all others should be present.
type PerUserKeyring struct {
	Contextified
	sync.Mutex
	uid         keybase1.UID
	generations perUserKeyMap
	// sigchain seqno when each key was introduced
	seqgen perUserKeySeqGenMap
}

// NewPerUserKeyring makes a new per-user-key keyring for a given UID.
func NewPerUserKeyring(g *GlobalContext, uid keybase1.UID) (*PerUserKeyring, error) {
	if uid.IsNil() {
		return nil, fmt.Errorf("NewPerUserKeyring called with nil uid")
	}
	return &PerUserKeyring{
		Contextified: NewContextified(g),
		uid:          uid,
		generations:  make(perUserKeyMap),
		seqgen:       make(perUserKeySeqGenMap),
	}, nil
}

func (s *PerUserKeyring) GetUID() keybase1.UID {
	return s.uid
}

// PrepareBoxForNewDevice encrypts the latest shared key seed for a new device.
// The returned box should be pushed to the server.
func (s *PerUserKeyring) PrepareBoxForNewDevice(ctx context.Context, receiverKey NaclDHKeyPair,
	senderKey NaclDHKeyPair) (box keybase1.PerUserKeyBox, err error) {
	s.Lock()
	defer s.Unlock()

	gen := s.currentGenerationLocked()
	if gen < 1 {
		return box, errors.New("PerUserKeyring#PrepareBoxForNewDevice no keys loaded")
	}
	full, ok := s.generations[gen]
	if !ok {
		return box, errors.New("PerUserKeyring#PrepareBoxForNewDevice missing entry for current generation")
	}
	box, err = NewPerUserKeyBox(full.seed, receiverKey, senderKey, gen)
	return box, err
}

// Encrypt seed for receiverKeys. Use senderKey to encrypt.
// Does not use the keyring at all. Attached for organizational purposes.
// Used when creating a new seed.
func (s *PerUserKeyring) PrepareBoxesForDevices(ctx context.Context, contents PerUserKeySeed,
	generation keybase1.PerUserKeyGeneration, receiverKeys []NaclDHKeyPair,
	senderKey GenericKey) (boxes []keybase1.PerUserKeyBox, err error) {
	// Do not lock self because we do not use self.

	if contents.IsBlank() {
		return nil, errors.New("attempt to box blank per-user-key")
	}

	senderKeyDH, ok := senderKey.(NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("Unexpected encryption key type: %T", senderKey)
	}

	for _, receiverKey := range receiverKeys {
		box, err := NewPerUserKeyBox(contents, receiverKey, senderKeyDH, generation)
		if err != nil {
			return nil, err
		}
		boxes = append(boxes, box)
	}
	return boxes, nil
}

// Prepares a prev secretbox containing generation n-1 encrypted for generation n.
// Asserts that the current generation is n-1.
// The `generation` parameter is n.
func (s *PerUserKeyring) PreparePrev(ctx context.Context, newSeed PerUserKeySeed,
	newGeneration keybase1.PerUserKeyGeneration) (PerUserKeyPrev, error) {
	s.Lock()
	defer s.Unlock()

	if newSeed.IsBlank() {
		return "", errors.New("attempt to prev with blank per-user-key")
	}

	currentGen := s.currentGenerationLocked()
	if currentGen == 0 {
		return "", errors.New("attempt to prepare per-user-key prev with no keys")
	}
	if currentGen != newGeneration-1 {
		return "", fmt.Errorf("incompatible prev generations %v != %v-1", currentGen, newGeneration)
	}

	symmetricKey, err := newSeed.derivePrevKey()
	if err != nil {
		return "", err
	}

	contents := s.generations[currentGen].seed

	return newPerUserKeyPrev(contents, symmetricKey)
}

// AddKey registers a full key locally.
func (s *PerUserKeyring) AddKey(ctx context.Context, generation keybase1.PerUserKeyGeneration,
	seqno keybase1.Seqno, seed PerUserKeySeed) error {
	s.Lock()
	defer s.Unlock()
	s.G().Log.CDebugf(ctx, "PerUserKeyring#AddKey(generation: %v, seqno:%v)", generation, seqno)

	if seed.IsBlank() {
		return errors.New("attempt to add blank per-user-key")
	}

	currentGen := s.currentGenerationLocked()

	if generation != currentGen+1 {
		return fmt.Errorf("cannot add key for non-next generation: %v != %v+1",
			generation, currentGen)
	}

	_, exists := s.generations[generation]
	if exists {
		return fmt.Errorf("AddKey duplicate for generation: %v", generation)
	}

	expanded, err := expandPerUserKey(seed)
	if err != nil {
		return err
	}

	s.generations[generation] = expanded.lower()
	s.seqgen[seqno] = generation

	return nil
}

func (s *PerUserKeyring) HasAnyKeys() bool {
	return s.CurrentGeneration() > 0
}

// CurrentGeneration returns what generation we're on. The version possible
// Version is 1. Version 0 implies no keys are available.
func (s *PerUserKeyring) CurrentGeneration() keybase1.PerUserKeyGeneration {
	s.Lock()
	defer s.Unlock()
	return s.currentGenerationLocked()
}

func (s *PerUserKeyring) currentGenerationLocked() keybase1.PerUserKeyGeneration {
	return keybase1.PerUserKeyGeneration(len(s.generations))
}

func (s *PerUserKeyring) GetLatestSigningKey(ctx context.Context) (*NaclSigningKeyPair, error) {
	s.Lock()
	defer s.Unlock()
	gen := s.currentGenerationLocked()
	if gen < 1 {
		return nil, errors.New("PerUserKeyring#GetLatestSigningKey no keys loaded")
	}
	key, found := s.generations[gen]
	if !found {
		return nil, fmt.Errorf("PerUserKeyring#GetLatestSigningKey no key for generation %v", gen)
	}
	return key.sigKey, nil
}

// Get the encryption key of a generation.
func (s *PerUserKeyring) GetEncryptionKeyByGeneration(ctx context.Context, gen keybase1.PerUserKeyGeneration) (*NaclDHKeyPair, error) {
	s.Lock()
	defer s.Unlock()

	return s.getEncryptionKeyByGenerationLocked(ctx, gen)
}

func (s *PerUserKeyring) getEncryptionKeyByGenerationLocked(ctx context.Context, gen keybase1.PerUserKeyGeneration) (*NaclDHKeyPair, error) {
	if gen < 1 {
		return nil, fmt.Errorf("PerUserKeyring#GetEncryptionKey bad generation number %v", gen)
	}
	key, found := s.generations[gen]
	if !found {
		return nil, fmt.Errorf("no encryption key for generation %v", gen)
	}
	return key.encKey, nil
}

// Get the encryption key at the user sigchain seqno.
func (s *PerUserKeyring) GetEncryptionKeyBySeqno(ctx context.Context, seqno keybase1.Seqno) (*NaclDHKeyPair, error) {
	s.Lock()
	defer s.Unlock()

	gen, ok := s.seqgen[seqno]
	if !ok {
		return nil, fmt.Errorf("no encrypted key for seqno %v", seqno)
	}
	return s.getEncryptionKeyByGenerationLocked(ctx, gen)
}

// GetEncryptionKeyByKID finds an encryption key that matches kid.
func (s *PerUserKeyring) GetEncryptionKeyByKID(ctx context.Context, kid keybase1.KID) (*NaclDHKeyPair, error) {
	s.Lock()
	defer s.Unlock()

	for _, key := range s.generations {
		if key.encKey.GetKID().Equal(kid) {
			return key.encKey, nil
		}
	}
	return nil, NotFoundError{Msg: fmt.Sprintf("no per-user encryption key found for KID %s", kid)}
}

// Sync our PerUserKeyring with the server. It will either add all new
// keys since our last update, or not at all if there was an error.
// Pass it a standard Go network context.
func (s *PerUserKeyring) Sync(ctx context.Context) (err error) {
	return s.syncAsConfiguredDevice(ctx, nil, nil)
}

// `lctx` and `upak` are optional
func (s *PerUserKeyring) SyncWithExtras(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys) (err error) {
	return s.syncAsConfiguredDevice(ctx, lctx, upak)
}

// `lctx` and `upak` are optional
func (s *PerUserKeyring) syncAsConfiguredDevice(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys) (err error) {
	uid, deviceID, _, _, activeDecryptionKey := s.G().ActiveDevice.AllFields()
	if !s.uid.Equal(uid) {
		return fmt.Errorf("UID changed on PerUserKeyring")
	}
	if deviceID.IsNil() {
		return fmt.Errorf("missing configured deviceID")
	}
	return s.sync(ctx, lctx, upak, deviceID, activeDecryptionKey)
}

// `lctx` and `upak` are optional
func (s *PerUserKeyring) SyncAsPaperKey(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID, decryptionKey GenericKey) (err error) {
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
func (s *PerUserKeyring) sync(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys, deviceID keybase1.DeviceID, decryptionKey GenericKey) (err error) {
	defer s.G().CTrace(ctx, "PerUserKeyring#sync", func() error { return err })()

	s.G().Log.CDebugf(ctx, "PerUserKeyring#sync(%v, %v)", lctx != nil, upak != nil)

	s.Lock()
	defer s.Unlock()

	box, prevs, err := s.fetchBoxesLocked(ctx, lctx, deviceID)
	if err != nil {
		return err
	}

	if upak == nil {
		upak, err = s.getUPAK(ctx, lctx, upak)
		if err != nil {
			return err
		}
	}

	checker := newPerUserKeyChecker(upak)
	newKeys, err := s.importLocked(ctx, box, prevs, decryptionKey, checker)
	if err != nil {
		return err

	}
	s.mergeLocked(newKeys, checker.seqgen)
	return nil
}

func (s *PerUserKeyring) getUPAK(ctx context.Context, lctx LoginContext, upak *keybase1.UserPlusAllKeys) (*keybase1.UserPlusAllKeys, error) {
	if upak != nil {
		return upak, nil
	}
	upakArg := NewLoadUserByUIDArg(ctx, s.G(), s.uid)
	upakArg.LoginContext = lctx
	upak, _, err := s.G().GetUPAKLoader().Load(upakArg)
	return upak, err
}

func (s *PerUserKeyring) mergeLocked(m perUserKeyMap, seqgen perUserKeySeqGenMap) (err error) {
	for k, v := range m {
		s.generations[k] = v
	}
	s.seqgen = seqgen
	return nil
}

type perUserKeySyncResp struct {
	Box    *keybase1.PerUserKeyBox `json:"box"`
	Prevs  []perUserKeyPrevResp    `json:"prevs"`
	Status AppStatus               `json:"status"`
}

func (s *perUserKeySyncResp) GetAppStatus() *AppStatus {
	return &s.Status
}

type perUserKeyPrevResp struct {
	Ctext      PerUserKeyPrev                `json:"ctext"`
	Generation keybase1.PerUserKeyGeneration `json:"generation"`
}

type byGeneration []perUserKeyPrevResp

func (m byGeneration) Len() int           { return len(m) }
func (m byGeneration) Swap(i, j int)      { m[i], m[j] = m[j], m[i] }
func (m byGeneration) Less(i, j int) bool { return m[i].Generation < m[j].Generation }

func (s *PerUserKeyring) fetchBoxesLocked(ctx context.Context, lctx LoginContext,
	deviceID keybase1.DeviceID) (box *keybase1.PerUserKeyBox, prevs []perUserKeyPrevResp, err error) {

	defer s.G().CTrace(ctx, "PerUserKeyring#fetchBoxesLocked", func() error { return err })()

	var sessionR SessionReader
	if lctx != nil {
		sessionR = lctx.LocalSession()
	}

	var resp perUserKeySyncResp
	err = s.G().API.GetDecode(APIArg{
		Endpoint: "key/fetch_per_user_key_secrets",
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
		return nil, nil, err
	}
	s.G().Log.CDebugf(ctx, "| Got back box:%v and prevs:%d from server", resp.Box != nil, len(resp.Prevs))

	return resp.Box, resp.Prevs, nil
}

// perUserKeyChecker checks the [secret]boxes returned from the server
// against the public keys advertised in the user's sigchain. As we import
// keys, we check them.  We check that the boxes were encryted with a
// valid device subkey (though it can be now revoked). And we check that the
// public keys corresponds to what was signed in as a per_user_key.
type perUserKeyChecker struct {
	allowedEncryptingKIDs map[keybase1.KID]bool
	expectedPUKSigKIDs    map[keybase1.PerUserKeyGeneration]keybase1.KID
	expectedPUKEncKIDs    map[keybase1.PerUserKeyGeneration]keybase1.KID
	latestGeneration      keybase1.PerUserKeyGeneration
	seqgen                perUserKeySeqGenMap
}

func newPerUserKeyChecker(upak *keybase1.UserPlusAllKeys) *perUserKeyChecker {
	ret := perUserKeyChecker{
		allowedEncryptingKIDs: make(map[keybase1.KID]bool),
		expectedPUKSigKIDs:    make(map[keybase1.PerUserKeyGeneration]keybase1.KID),
		expectedPUKEncKIDs:    make(map[keybase1.PerUserKeyGeneration]keybase1.KID),
		latestGeneration:      0,
		seqgen:                make(perUserKeySeqGenMap),
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
	for _, k := range upak.Base.PerUserKeys {
		ret.expectedPUKSigKIDs[keybase1.PerUserKeyGeneration(k.Gen)] = k.SigKID
		ret.expectedPUKEncKIDs[keybase1.PerUserKeyGeneration(k.Gen)] = k.EncKID
		gen := keybase1.PerUserKeyGeneration(k.Gen)
		ret.seqgen[k.Seqno] = gen
		if gen > ret.latestGeneration {
			ret.latestGeneration = gen
		}
	}

	return &ret
}

// checkPublic checks that a key matches the KIDs published by the user.
func (c *perUserKeyChecker) checkPublic(key importedPerUserKey, generation keybase1.PerUserKeyGeneration) error {
	// sig key
	if expectedSigKID, ok := c.expectedPUKSigKIDs[generation]; ok {
		if !expectedSigKID.SecureEqual(key.sigKey.GetKID()) {
			return fmt.Errorf("import per-user-key: wrong sigKID expected %v", expectedSigKID.String())
		}
	} else {
		return fmt.Errorf("import per-user-key: no sigKID for generation: %v", generation)
	}

	// enc key
	if expectedEncKID, ok := c.expectedPUKEncKIDs[generation]; ok {
		if !expectedEncKID.SecureEqual(key.encKey.GetKID()) {
			return fmt.Errorf("import per-user-key: wrong sigKID expected %v", expectedEncKID.String())
		}
	} else {
		return fmt.Errorf("import per-user-key: no sigKID for generation: %v", generation)
	}

	return nil
}

func (s *PerUserKeyring) importLocked(ctx context.Context,
	box *keybase1.PerUserKeyBox, prevs []perUserKeyPrevResp,
	decryptionKey GenericKey, checker *perUserKeyChecker) (ret perUserKeyMap, err error) {

	defer s.G().CTrace(ctx, "PerUserKeyring#importLocked", func() error { return err })()

	if box == nil && len(prevs) == 0 {
		// No new stuff, this keyring is up to date.
		return make(perUserKeyMap), nil
	}

	if box == nil {
		return nil, errors.New("per-user-key import nil box")
	}

	if box.Generation != checker.latestGeneration {
		return nil, fmt.Errorf("sync (%v) and checker (%v) disagree on generation", box.Generation, checker.latestGeneration)
	}

	sort.Sort(sort.Reverse(byGeneration(prevs)))

	var debugPrevGenList []string
	for _, prev := range prevs {
		debugPrevGenList = append(debugPrevGenList, fmt.Sprintf("%d", prev.Generation))
	}
	if len(debugPrevGenList) > 0 {
		s.G().Log.CDebugf(ctx, "PerUserKeyring#importLocked prevs:(%s)", strings.Join(debugPrevGenList, ","))
	}

	ret = make(perUserKeyMap)
	imp1, err := importPerUserKeyBox(box, decryptionKey, checker.latestGeneration, checker)
	if err != nil {
		return nil, err
	}
	ret[box.Generation] = imp1.lower()

	walkGeneration := box.Generation - 1
	walkKey := imp1.prevKey
	for _, prev := range prevs {
		if walkGeneration <= 0 {
			return nil, errors.New("per-user-key prev chain too long")
		}
		imp, err := importPerUserKeyPrev(walkGeneration, prev, walkKey, walkGeneration, checker)
		if err != nil {
			return nil, err
		}
		ret[walkGeneration] = imp.lower()

		walkGeneration--
		walkKey = imp.prevKey
	}

	return ret, nil
}

type importedPerUserKey struct {
	seed   PerUserKeySeed
	sigKey *NaclSigningKeyPair
	encKey *NaclDHKeyPair
	// Key used to decrypt the secretbox of the previous generation
	prevKey NaclSecretBoxKey
}

func (k *importedPerUserKey) lower() perUserKeyFull {
	return perUserKeyFull{
		seed:   k.seed,
		sigKey: k.sigKey,
		encKey: k.encKey,
	}
}

// Decrypt, expand, and check a per-user-key from a Box.
func importPerUserKeyBox(box *keybase1.PerUserKeyBox, decryptionKey GenericKey,
	wantedGeneration keybase1.PerUserKeyGeneration, checker *perUserKeyChecker) (*importedPerUserKey, error) {
	if box == nil {
		return nil, NewPerUserKeyImportError("per-user-key box nil")
	}
	if box.Generation != wantedGeneration {
		return nil, NewPerUserKeyImportError("bad generation returned: %d", box.Generation)
	}
	if !decryptionKey.GetKID().Equal(box.ReceiverKID) {
		return nil, NewPerUserKeyImportError("wrong encryption kid: %s", box.ReceiverKID.String())
	}
	rawKey, encryptingKID, err := decryptionKey.DecryptFromString(box.Box)
	if err != nil {
		return nil, err
	}
	if len(checker.allowedEncryptingKIDs) == 0 {
		return nil, NewPerUserKeyImportError("no allowed encrypting kids")
	}
	if !checker.allowedEncryptingKIDs[encryptingKID] {
		return nil, NewPerUserKeyImportError("unexpected encrypting kid: %s", encryptingKID)
	}
	seed, err := MakeByte32Soft(rawKey)
	if err != nil {
		return nil, NewPerUserKeyImportError("%s", err)
	}
	imp, err := expandPerUserKey(seed)
	if err != nil {
		return nil, NewPerUserKeyImportError("%s", err)
	}
	err = checker.checkPublic(imp, wantedGeneration)
	if err != nil {
		return nil, err
	}
	return &imp, nil
}

// Decrypt, expand, and check a per-user-key from a SecretBox.
func importPerUserKeyPrev(generation keybase1.PerUserKeyGeneration, prev perUserKeyPrevResp, decryptionKey NaclSecretBoxKey,
	wantedGeneration keybase1.PerUserKeyGeneration, checker *perUserKeyChecker) (*importedPerUserKey, error) {

	if generation != prev.Generation {
		return nil, fmt.Errorf("import per-user-key mismatched generation: %v != %v",
			generation, prev.Generation)
	}

	seed, err := openPerUserKeyPrev(prev.Ctext, decryptionKey)
	if err != nil {
		return nil, err
	}

	imp, err := expandPerUserKey(seed)
	if err != nil {
		return nil, err
	}

	err = checker.checkPublic(imp, generation)
	if err != nil {
		return nil, err
	}

	return &imp, nil
}

func expandPerUserKey(seed PerUserKeySeed) (res importedPerUserKey, err error) {
	sigKey, err := seed.DeriveSigningKey()
	if err != nil {
		return res, err
	}
	encKey, err := seed.DeriveDHKey()
	if err != nil {
		return res, err
	}
	prevKey, err := seed.derivePrevKey()
	if err != nil {
		return res, err
	}
	return importedPerUserKey{
		seed:    seed,
		sigKey:  sigKey,
		encKey:  encKey,
		prevKey: prevKey,
	}, nil
}
