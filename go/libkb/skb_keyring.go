package libkb

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"sync"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
)

type SKBKeyringFile struct {
	Contextified
	sync.Mutex
	username NormalizedUsername
	filename string
	Blocks   []*SKB
	fpIndex  map[PGPFingerprint]*SKB
	kidIndex map[keybase1.KID]*SKB
	dirty    bool
}

func NewSKBKeyringFile(g *GlobalContext, un NormalizedUsername) *SKBKeyringFile {
	return &SKBKeyringFile{
		Contextified: NewContextified(g),
		username:     un,
		filename:     g.SKBFilenameForUser(un),
		fpIndex:      make(map[PGPFingerprint]*SKB),
		kidIndex:     make(map[keybase1.KID]*SKB),
		dirty:        false,
	}
}

func (k *SKBKeyringFile) Load() (err error) {
	k.Lock()
	defer k.Unlock()
	return k.loadLocked()
}

func (k *SKBKeyringFile) Username() NormalizedUsername {
	return k.username
}

func (k *SKBKeyringFile) IsForUsername(un NormalizedUsername) bool {
	return k.username.Eq(un)
}

func (k *SKBKeyringFile) MTime() (mtime time.Time, err error) {
	k.Lock()
	defer k.Unlock()
	var fi os.FileInfo
	fi, err = os.Stat(k.filename)
	if err != nil {
		return mtime, err
	}
	return fi.ModTime(), err
}

func (k *SKBKeyringFile) MarkDirty() {
	k.Lock()
	defer k.Unlock()
	k.dirty = true
}

type skbPacket struct {
	skb SKB
}

func (s *skbPacket) CodecEncodeSelf(e *codec.Encoder) {
	panic("skbPacket.CodecEncodeSelf unexpectedly called")
}

func (s *skbPacket) CodecDecodeSelf(d *codec.Decoder) {
	err := DecodePacket(d, TagP3skb, &s.skb)
	if err != nil {
		panic(err)
	}
}

func decodeSKBPacketList(r io.Reader, g *GlobalContext) ([]*SKB, error) {
	ch := codecHandle()
	decoder := codec.NewDecoder(r, ch)

	var packets []skbPacket
	err := decoder.Decode(&packets)
	if err != nil {
		return nil, err
	}

	skbs := make([]*SKB, len(packets))
	for i, s := range packets {
		s.skb.SetGlobalContext(g)
		skbs[i] = &s.skb
	}
	return skbs, nil
}

func (k *SKBKeyringFile) loadLocked() (err error) {
	k.G().Log.Debug("+ Loading SKB keyring: %s", k.filename)

	file, err := os.OpenFile(k.filename, os.O_RDONLY, 0)
	if err != nil {
		if os.IsNotExist(err) {
			k.G().Log.Debug("| Keybase secret keyring doesn't exist: %s", k.filename)
		} else {
			k.G().Log.Warning("Error opening %s: %s", k.filename, err)

			MobilePermissionDeniedCheck(k.G(), err, fmt.Sprintf("skb keyring: %s", k.filename))
		}
		return err
	}
	defer func() {
		closeErr := file.Close()
		if err == nil {
			err = closeErr
		}
	}()

	stream := base64.NewDecoder(base64.StdEncoding, file)
	skbs, err := decodeSKBPacketList(stream, k.G())
	if err != nil {
		return err
	}

	k.Blocks = skbs

	k.G().Log.Debug("- Loaded SKB keyring: %s -> %s", k.filename, ErrToOk(err))
	return nil
}

func (k *SKBKeyringFile) addToIndexLocked(g GenericKey, b *SKB) {
	if g == nil {
		return
	}
	if fp := GetPGPFingerprintFromGenericKey(g); fp != nil {
		k.fpIndex[*fp] = b
	}
	k.kidIndex[g.GetKID()] = b
}

func (k *SKBKeyringFile) Index() (err error) {
	k.Lock()
	defer k.Unlock()
	return k.indexLocked()
}

func (k *SKBKeyringFile) indexLocked() (err error) {
	for _, b := range k.Blocks {
		var key GenericKey
		key, err = b.GetPubKey()
		if err != nil {
			return
		}
		// Last-writer wins!
		k.addToIndexLocked(key, b)
	}
	k.G().Log.Debug("| Indexed %d secret keys", len(k.Blocks))
	return
}

func (k *SKBKeyringFile) SearchWithComputedKeyFamily(ckf *ComputedKeyFamily, ska SecretKeyArg) []*SKB {
	k.Lock()
	defer k.Unlock()

	var kid keybase1.KID
	k.G().Log.Debug("+ SKBKeyringFile.SearchWithComputedKeyFamily")
	defer func() {
		var res string
		if kid.Exists() {
			res = kid.String()
		} else {
			res = "<nil>"
		}
		k.G().Log.Debug("- SKBKeyringFile.SearchWithComputedKeyFamily -> %s\n", res)
	}()
	k.G().Log.Debug("| Searching %d possible blocks", len(k.Blocks))
	var blocks []*SKB
	for i := len(k.Blocks) - 1; i >= 0; i-- {
		k.G().Log.Debug("| trying key index# -> %d", i)
		if key, err := k.Blocks[i].GetPubKey(); err == nil && key != nil {
			kid = key.GetKID()
			active := ckf.GetKeyRole(kid)
			k.G().Log.Debug("| Checking KID: %s -> %d", kid, int(active))
			if !ska.KeyType.nonDeviceKeyMatches(key) {
				k.G().Log.Debug("| Skipped, doesn't match type=%s", ska.KeyType)
			} else if !KeyMatchesQuery(key, ska.KeyQuery, ska.ExactMatch) {
				k.G().Log.Debug("| Skipped, doesn't match query=%s", ska.KeyQuery)

			} else if active != DLGSibkey {
				k.G().Log.Debug("| Skipped, active=%d", int(active))
			} else {
				blocks = append(blocks, k.Blocks[i])
			}
		} else {
			k.G().Log.Debug("| failed --> %v", err)
		}
	}
	return blocks
}

func (k *SKBKeyringFile) PushAndSave(skb *SKB) error {
	k.Lock()
	defer k.Unlock()
	if err := k.pushLocked(skb); err != nil {
		return err
	}
	return k.saveLocked()
}

func (k *SKBKeyringFile) HasPGPKeys() bool {
	k.Lock()
	defer k.Unlock()
	return len(k.fpIndex) > 0
}

func (k *SKBKeyringFile) AllPGPBlocks() ([]*SKB, error) {
	k.Lock()
	defer k.Unlock()
	var pgpBlocks []*SKB
	for _, block := range k.Blocks {
		k, err := block.GetPubKey()
		if err != nil {
			return nil, err
		}
		if fp := GetPGPFingerprintFromGenericKey(k); fp != nil {
			pgpBlocks = append(pgpBlocks, block)
		}
	}
	return pgpBlocks, nil
}

func (k *SKBKeyringFile) RemoveAllPGPBlocks() error {
	k.Lock()
	defer k.Unlock()
	var blocks []*SKB
	for _, block := range k.Blocks {
		k, err := block.GetPubKey()
		if err != nil {
			return err
		}
		if fp := GetPGPFingerprintFromGenericKey(k); fp == nil {
			blocks = append(blocks, block)
		}
	}
	k.Blocks = blocks
	k.fpIndex = make(map[PGPFingerprint]*SKB)
	k.kidIndex = make(map[keybase1.KID]*SKB)
	k.indexLocked()
	k.dirty = true

	return nil
}

func (k *SKBKeyringFile) Push(skb *SKB) error {
	k.Lock()
	defer k.Unlock()
	return k.pushLocked(skb)
}

func (k *SKBKeyringFile) pushLocked(skb *SKB) error {
	key, err := skb.GetPubKey()
	if err != nil {
		return fmt.Errorf("Failed to get pubkey: %s", err)
	}
	k.dirty = true
	k.Blocks = append(k.Blocks, skb)
	k.addToIndexLocked(key, skb)
	return nil
}

func (k *SKBKeyringFile) Save() error {
	k.Lock()
	defer k.Unlock()
	return k.saveLocked()
}

func (k *SKBKeyringFile) saveLocked() error {
	if !k.dirty {
		k.G().Log.Debug("SKBKeyringFile: saveLocked %s: not dirty, so skipping save", k.filename)
		return nil
	}
	if err := MakeParentDirs(k.G().Log, k.filename); err != nil {
		k.G().Log.Debug("SKBKeyringFile: saveLocked %s: failed to make parent dirs: %s", k.filename, err)
		return err
	}
	k.G().Log.Debug("SKBKeyringFile: saveLocked %s: dirty, safe saving", k.filename)
	if err := SafeWriteToFile(k.G().Log, k, 0); err != nil {
		k.G().Log.Debug("SKBKeyringFile: saveLocked %s: SafeWriteToFile error: %s", k.filename, err)
		return err
	}
	k.dirty = false
	k.G().Log.Debug("SKBKeyringFile: saveLocked success for %s", k.filename)
	return nil
}

func (k *SKBKeyringFile) LookupByFingerprint(fp PGPFingerprint) *SKB {
	k.Lock()
	defer k.Unlock()
	ret, ok := k.fpIndex[fp]
	if !ok {
		ret = nil
	}
	return ret
}

// FindSecretKey will, given a list of KIDs, find the first one in the
// list that has a corresponding secret key in the keyring file.
func (k *SKBKeyringFile) FindSecretKey(kids []keybase1.KID) (ret *SKB) {
	k.Lock()
	defer k.Unlock()
	for _, kid := range kids {
		if ret = k.lookupByKidLocked(kid); ret != nil {
			return
		}
	}
	return
}

func (k *SKBKeyringFile) LookupByKid(kid keybase1.KID) *SKB {
	k.Lock()
	defer k.Unlock()
	return k.lookupByKidLocked(kid)
}

func (k *SKBKeyringFile) lookupByKidLocked(kid keybase1.KID) *SKB {
	ret, ok := k.kidIndex[kid]
	if !ok {
		ret = nil
	}
	return ret
}

func (k *SKBKeyringFile) LoadAndIndex() error {
	k.Lock()
	defer k.Unlock()
	err := k.loadLocked()
	if err == nil {
		err = k.indexLocked()
	}
	return err
}

// GetFilename is only called from within Save(), so it's called
// with a lock. Needs to be called GetFilename() to meet the interface
// required by SafeSaveToFile
func (k *SKBKeyringFile) GetFilename() string { return k.filename }

// WriteTo is similar to GetFilename described just above in terms of
// locking discipline.
func (k *SKBKeyringFile) WriteTo(w io.Writer) (int64, error) {
	k.G().Log.Debug("+ SKBKeyringFile WriteTo")
	defer k.G().Log.Debug("- SKBKeyringFile WriteTo")
	packets := make([]*KeybasePacket, len(k.Blocks))
	var err error
	for i, b := range k.Blocks {
		if packets[i], err = NewKeybasePacket(b); err != nil {
			return 0, err
		}
	}
	b64 := base64.NewEncoder(base64.StdEncoding, w)
	defer b64.Close()

	encoder := codec.NewEncoder(b64, codecHandle())
	if err = encoder.Encode(packets); err != nil {
		k.G().Log.Warning("Encoding problem: %s", err)
		return 0, err
	}

	// explicitly check for error on Close:
	if err := b64.Close(); err != nil {
		k.G().Log.Warning("SKBKeyringFile: WriteTo b64.Close() error: %s", err)
		return 0, err
	}
	k.G().Log.Debug("SKBKeyringFile: b64 stream closed successfully")

	return 0, nil
}

func (k *SKBKeyringFile) Bug3964Repair(m MetaContext, lks *LKSec, dkm DeviceKeyMap) (ret *SKBKeyringFile, serverHalfSet *LKSecServerHalfSet, err error) {
	defer m.CTrace("SKBKeyringFile#Bug3964Repair", func() error { return err })()

	var newBlocks []*SKB
	var hitBug3964 bool

	m.CDebugf("| # of blocks=%d", len(k.Blocks))

	for i, b := range k.Blocks {

		if b.Priv.Data == nil {
			m.CDebugf("| Null private data at block=%d", i)
			newBlocks = append(newBlocks, b)
			continue
		}

		if b.Priv.Encryption != LKSecVersion {
			m.CDebugf("| Skipping non-LKSec encryption (%d) at block=%d", b.Priv.Encryption, i)
			newBlocks = append(newBlocks, b)
			continue
		}

		var decryption, reencryption []byte
		var badMask LKSecServerHalf
		decryption, badMask, err = lks.decryptForBug3964Repair(m, b.Priv.Data, dkm)
		if err != nil {
			m.CDebugf("| Decryption failed at block=%d; keeping as is (%s)", i, err)
			newBlocks = append(newBlocks, b)
			continue
		}

		if badMask.IsNil() {
			m.CDebugf("| Nil badmask at block=%d", i)
			newBlocks = append(newBlocks, b)
			continue
		}

		hitBug3964 = true
		m.CDebugf("| Hit bug 3964 at SKB block=%d", i)
		if serverHalfSet == nil {
			serverHalfSet = NewLKSecServerHalfSet()
		}
		serverHalfSet.Add(badMask)

		reencryption, err = lks.Encrypt(m, decryption)
		if err != nil {
			m.CDebugf("| reencryption bug at block=%d", i)
			return nil, nil, err
		}

		newSKB := &SKB{
			Contextified: NewContextified(m.G()),
			Pub:          b.Pub,
			Type:         b.Type,
			Priv: SKBPriv{
				Encryption:           b.Priv.Encryption,
				PassphraseGeneration: b.Priv.PassphraseGeneration,
				Data:                 reencryption,
			},
		}

		newBlocks = append(newBlocks, newSKB)
	}
	if !hitBug3964 {
		return nil, nil, nil
	}

	ret = NewSKBKeyringFile(k.G(), k.username)
	ret.dirty = true
	ret.Blocks = newBlocks

	err = ret.Index()
	if err != nil {
		return nil, nil, err
	}

	return ret, serverHalfSet, nil
}
