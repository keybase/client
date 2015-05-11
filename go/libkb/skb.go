package libkb

//
// Code for encoding and decoding SKB-formatted keys. Also works for decoding
// general Keybase Packet types, but we only have SKB at present.
//
// SKB = "Secret Key Bundle", which contains an unencrypted public key and
// and encrypted secret key.
//

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"sync"

	triplesec "github.com/keybase/go-triplesec"
	"golang.org/x/crypto/openpgp"
)

type SKB struct {
	Priv SKBPriv  `codec:"priv"`
	Pub  []byte   `codec:"pub"`
	Type AlgoType `codec:"type,omitempty"`

	decodedPub      GenericKey
	decryptedSecret GenericKey
	decryptedRaw    []byte // in case we need to reexport it

	uid *UID // UID that the key is for
	Contextified

	// TODO(akalin): Remove this in favor of making LKSec
	// Contextified (see
	// https://github.com/keybase/client/issues/329 ).
	newLKSecForTest func(clientHalf []byte) *LKSec

	sync.Mutex // currently only for uid
}

type SKBPriv struct {
	Data       []byte `codec:"data"`
	Encryption int    `codec:"encryption"`
}

func (key *PgpKeyBundle) ToSKB(tsec *triplesec.Cipher) (ret *SKB, err error) {

	ret = &SKB{}

	var pk, sk bytes.Buffer

	// Need to serialize Private first, because
	err = (*openpgp.Entity)(key).SerializePrivate(&sk, nil)
	if err != nil {
		return
	}
	if tsec != nil {
		ret.Priv.Data, err = tsec.Encrypt(sk.Bytes())
		ret.Priv.Encryption = int(triplesec.Version) // Version 3 is the current TripleSec version
		if err != nil {
			return
		}
	} else {
		ret.Priv.Data = sk.Bytes()
		ret.Priv.Encryption = 0
	}

	err = (*openpgp.Entity)(key).Serialize(&pk)
	if err != nil {
		return
	}
	ret.Pub = pk.Bytes()
	ret.Type = key.GetAlgoType()

	return
}

func (key *PgpKeyBundle) ToLksSKB(lks *LKSec) (ret *SKB, err error) {
	if lks == nil {
		return nil, fmt.Errorf("nil lks")
	}
	var pk, sk bytes.Buffer

	err = (*openpgp.Entity)(key).SerializePrivate(&sk, nil)
	if err != nil {
		return nil, err
	}

	ret = &SKB{}
	ret.Priv.Data, err = lks.Encrypt(sk.Bytes())
	if err != nil {
		return nil, err
	}
	ret.Priv.Encryption = LKSecVersion

	err = (*openpgp.Entity)(key).Serialize(&pk)
	if err != nil {
		return nil, err
	}
	ret.Pub = pk.Bytes()
	ret.Type = key.GetAlgoType()

	return ret, nil
}

func (s *SKB) newLKSec(clientHalf []byte) *LKSec {
	if s.newLKSecForTest != nil {
		return s.newLKSecForTest(clientHalf)
	}
	return NewLKSec(clientHalf, s.G())
}

func (p *SKB) ToPacket() (ret *KeybasePacket, err error) {
	ret = &KeybasePacket{
		Version: KEYBASE_PACKET_V1,
		Tag:     TAG_P3SKB, // Keybase tags starts at 513 (OpenPGP are 0-30)
	}
	ret.Body = p
	err = ret.HashMe()
	return
}

func (p *SKB) ReadKey() (g GenericKey, err error) {
	switch {
	case IsPgpAlgo(p.Type) || p.Type == 0:
		g, err = ReadOneKeyFromBytes(p.Pub)
	case p.Type == KID_NACL_EDDSA:
		g, err = ImportNaclSigningKeyPairFromBytes(p.Pub, nil, p.G())
	case p.Type == KID_NACL_DH:
		g, err = ImportNaclDHKeyPairFromBytes(p.Pub, nil, p.G())
	default:
		err = UnknownKeyTypeError{p.Type}
	}
	return
}

func (p *SKB) GetPubKey() (key GenericKey, err error) {
	if key = p.decodedPub; key == nil {
		key, err = p.ReadKey()
		p.decodedPub = key
	}
	return
}

func (p *SKB) VerboseDescription() (ret string, err error) {
	var key GenericKey
	key, err = p.GetPubKey()
	if err == nil && key != nil {
		ret = key.VerboseDescription()
	}
	return
}

func (p *SKB) RawUnlockedKey() []byte {
	return p.decryptedRaw
}

func (s *SKB) unlockSecretKeyFromSecretRetriever(secretRetriever SecretRetriever) (key GenericKey, err error) {
	if key = s.decryptedSecret; key != nil {
		return
	}

	var unlocked []byte
	switch s.Priv.Encryption {
	case 0:
		unlocked = s.Priv.Data
	case LKSecVersion:
		unlocked, err = s.lksUnlockWithSecretRetriever(secretRetriever)
	default:
		err = BadKeyError{fmt.Sprintf("Can't unlock secret from secret retriever with protection type %d", int(s.Priv.Encryption))}
	}

	if err == nil {
		key, err = s.parseUnlocked(unlocked)
	}
	return
}

// unverifiedPassphraseStream takes a passphrase as a parameter and
// also the salt from the Account and computes a Triplesec and
// a passphrase stream.  It's not verified through a Login.
func (s *SKB) unverifiedPassphraseStream(passphrase string) (tsec *triplesec.Cipher, ret PassphraseStream, err error) {
	var salt []byte
	s.G().LoginState().LoginSession(func(ls *LoginSession) {
		salt, err = ls.Salt()
	}, "skb - salt")
	if err != nil {
		return nil, nil, err
	}
	return StretchPassphrase(passphrase, salt)
}

func (s *SKB) UnlockSecretKey(passphrase string, tsec *triplesec.Cipher, pps PassphraseStream, secretStorer SecretStorer, lksPreload *LKSec) (key GenericKey, err error) {
	if key = s.decryptedSecret; key != nil {
		return
	}
	var unlocked []byte

	switch s.Priv.Encryption {
	case 0:
		unlocked = s.Priv.Data
	case int(triplesec.Version):
		if tsec == nil {
			tsec, err = triplesec.NewCipher([]byte(passphrase), nil)
			if err != nil {
				return nil, err
			}
		}
		unlocked, err = s.tsecUnlock(tsec)
	case LKSecVersion:
		pps_in := pps
		if pps == nil {
			tsec, pps, err = s.unverifiedPassphraseStream(passphrase)
			if err != nil {
				return nil, fmt.Errorf("UnlockSecretKey: %s", err)
			}
		}
		if unlocked, err = s.lksUnlock(pps, secretStorer, lksPreload); err == nil && pps_in == nil {
			// the unverified tsec, pps has been verified, so cache it:
			s.G().LoginState().Account(func(a *Account) {
				a.CreateStreamCache(tsec, pps)
			}, "skb - UnlockSecretKey - CreateStreamCache")
		}
	default:
		err = BadKeyError{fmt.Sprintf("Can't unlock secret with protection type %d", int(s.Priv.Encryption))}
	}
	if err == nil {
		key, err = s.parseUnlocked(unlocked)
	}
	return
}

func (s *SKB) parseUnlocked(unlocked []byte) (key GenericKey, err error) {

	switch {
	case IsPgpAlgo(s.Type) || s.Type == 0:
		key, err = ReadOneKeyFromBytes(unlocked)
	case s.Type == KID_NACL_EDDSA:
		key, err = ImportNaclSigningKeyPairFromBytes(s.Pub, unlocked, s.G())
	case s.Type == KID_NACL_DH:
		key, err = ImportNaclDHKeyPairFromBytes(s.Pub, unlocked, s.G())
	}

	if key == nil {
		err = BadKeyError{"can't parse secret key after unlock"}
	}
	if err != nil {
		return
	}

	if err = key.CheckSecretKey(); err == nil {
		s.decryptedRaw = unlocked
		s.decryptedSecret = key
	}
	return
}

func (p *SKB) tsecUnlock(tsec *triplesec.Cipher) ([]byte, error) {
	unlocked, err := tsec.Decrypt(p.Priv.Data)
	if err != nil {
		if _, ok := err.(triplesec.BadPassphraseError); ok {
			err = PassphraseError{}
		}
		return nil, err
	}
	return unlocked, nil
}

func (p *SKB) lksUnlock(pps PassphraseStream, secretStorer SecretStorer, lks *LKSec) (unlocked []byte, err error) {
	if lks == nil {
		p.G().Log.Info("creating new lks")
		lks = p.newLKSec(pps.LksClientHalf())
		p.Lock()
		lks.SetUID(p.uid)
		p.Unlock()
	}
	unlocked, err = lks.Decrypt(p.Priv.Data)
	if err != nil {
		return
	}

	if secretStorer != nil {
		var secret []byte
		secret, err = lks.GetSecret()
		if err != nil {
			unlocked = nil
			return
		}
		// Ignore any errors storing the secret.
		_ = secretStorer.StoreSecret(secret)
	}

	return
}

func (s *SKB) lksUnlockWithSecretRetriever(secretRetriever SecretRetriever) (unlocked []byte, err error) {
	secret, err := secretRetriever.RetrieveSecret()
	if err != nil {
		return
	}
	lks := NewLKSecWithFullSecret(secret, s.G())
	return lks.Decrypt(s.Priv.Data)
}

func (p *SKB) SetUID(uid *UID) {
	G.Log.Debug("| Setting UID on SKB to %s", uid)
	p.Lock()
	p.uid = uid
	p.Unlock()
}

type SKBKeyringFile struct {
	filename string
	Blocks   []*SKB
	fpIndex  map[PgpFingerprint]*SKB
	kidIndex map[KIDMapKey]*SKB
	dirty    bool
}

func NewSKBKeyringFile(n string) *SKBKeyringFile {
	return &SKBKeyringFile{
		filename: n,
		Blocks:   make([]*SKB, 0, 1),
		fpIndex:  make(map[PgpFingerprint]*SKB),
		kidIndex: make(map[KIDMapKey]*SKB),
		dirty:    false,
	}
}

func (k *SKBKeyringFile) Load() (err error) {
	G.Log.Debug("+ Loading SKB keyring: %s", k.filename)
	var packets KeybasePackets
	var file *os.File
	if file, err = os.OpenFile(k.filename, os.O_RDONLY, 0); err == nil {
		stream := base64.NewDecoder(base64.StdEncoding, file)
		packets, err = DecodePackets(stream)
		tmp := file.Close()
		if err == nil && tmp != nil {
			err = tmp
		}
	}

	if err != nil {
		if os.IsNotExist(err) {
			G.Log.Debug("| Keybase secret keyring doesn't exist: %s", k.filename)
		} else {
			G.Log.Warning("Error opening %s: %s", k.filename, err.Error())
		}

	} else if err == nil {
		k.Blocks, err = packets.ToListOfSKBs()
	}

	G.Log.Debug("- Loaded SKB keyring: %s -> %s", k.filename, ErrToOk(err))
	return
}

func (k *SKBKeyringFile) addToIndex(g GenericKey, b *SKB) {
	if g == nil {
		return
	}
	if fp := g.GetFingerprintP(); fp != nil {
		k.fpIndex[*fp] = b
	}
	k.kidIndex[g.GetKid().ToMapKey()] = b
}

func (k *SKBKeyringFile) Index() (err error) {
	for _, b := range k.Blocks {
		var key GenericKey
		key, err = b.GetPubKey()
		if err != nil {
			return
		}
		// Last-writer wins!
		k.addToIndex(key, b)
	}
	G.Log.Debug("| Indexed %d secret keys", len(k.Blocks))
	return
}

func (k SKBKeyringFile) SearchWithComputedKeyFamily(ckf *ComputedKeyFamily, ska SecretKeyArg) *SKB {
	var kid KID
	G.Log.Debug("+ SKBKeyringFile.SearchWithComputedKeyFamily")
	defer func() {
		var res string
		if kid != nil {
			res = kid.String()
		} else {
			res = "<nil>"
		}
		G.Log.Debug("- SKBKeyringFile.SearchWithComputedKeyFamily -> %s\n", res)
	}()
	G.Log.Debug("| Searching %d possible blocks", len(k.Blocks))
	for i := len(k.Blocks) - 1; i >= 0; i-- {
		G.Log.Debug("| trying key index# -> %d", i)
		if key, err := k.Blocks[i].GetPubKey(); err == nil && key != nil {
			kid = key.GetKid()
			active := ckf.GetKeyRole(kid)
			G.Log.Debug("| Checking KID: %s -> %d", kid, int(active))
			if !ska.KeyType.nonDeviceKeyMatches(key) {
				G.Log.Debug("| Skipped, doesn't match type=%s", ska.KeyType)
			} else if !KeyMatchesQuery(key, ska.KeyQuery) {
				G.Log.Debug("| Skipped, doesn't match query=%s", ska.KeyQuery)

			} else if active != DLG_SIBKEY {
				G.Log.Debug("| Skipped, active=%d", int(active))
			} else {
				return k.Blocks[i]
			}
		} else {
			G.Log.Debug("| failed --> %v", err)
		}
	}
	return nil
}

func (k SKBKeyringFile) LookupByFingerprint(fp PgpFingerprint) *SKB {
	ret, ok := k.fpIndex[fp]
	if !ok {
		ret = nil
	}
	return ret
}

// FindSecretKey will, given a list of KIDs, find the first one in the
// list that has a corresponding secret key in the keyring file.
func (f SKBKeyringFile) FindSecretKey(kids []KID) (ret *SKB) {
	for _, kid := range kids {
		if ret = f.LookupByKid(kid); ret != nil {
			return
		}
	}
	return
}

func (f SKBKeyringFile) LookupByKid(k KID) *SKB {
	ret, ok := f.kidIndex[k.ToMapKey()]
	if !ok {
		ret = nil
	}
	return ret
}

func (k *SKBKeyringFile) LoadAndIndex() error {
	err := k.Load()
	if err == nil {
		err = k.Index()
	}
	return err
}

func (p KeybasePacket) ToSKB() (*SKB, error) {
	ret, ok := p.Body.(*SKB)
	if !ok {
		return nil, UnmarshalError{"SKB"}
	}
	return ret, nil
}

func (s *SKB) ArmoredEncode() (ret string, err error) {
	return PacketArmoredEncode(s)
}

func (f *SKBKeyringFile) Push(skb *SKB) error {
	k, err := skb.GetPubKey()
	if err != nil {
		return fmt.Errorf("Failed to get pubkey: %s", err.Error())
	}
	f.dirty = true
	f.Blocks = append(f.Blocks, skb)
	f.addToIndex(k, skb)
	return nil
}

func (f SKBKeyringFile) GetFilename() string { return f.filename }

func (f SKBKeyringFile) WriteTo(w io.Writer) (int64, error) {
	G.Log.Debug("+ WriteTo")
	packets := make(KeybasePackets, len(f.Blocks))
	var err error
	for i, b := range f.Blocks {
		if packets[i], err = b.ToPacket(); err != nil {
			return 0, err
		}
	}
	b64 := base64.NewEncoder(base64.StdEncoding, w)
	if err = packets.EncodeTo(b64); err != nil {
		G.Log.Warning("Encoding problem: %s", err.Error())
		return 0, err
	}
	G.Log.Debug("- WriteTo")
	b64.Close()
	return 0, nil
}

func (f *SKBKeyringFile) Save(lui LogUI) error {
	if !f.dirty {
		return nil
	}
	err := SafeWriteToFile(*f)
	if err == nil {
		f.dirty = false
		lui.Info("Updated keyring %s", f.filename)
	}
	return err
}

func (p KeybasePackets) ToListOfSKBs() (ret []*SKB, err error) {
	ret = make([]*SKB, len(p))
	for i, e := range p {
		if k, ok := e.Body.(*SKB); ok {
			ret[i] = k
		} else {
			err = fmt.Errorf("Bad SKB sequence; got packet of wrong type")
			ret = nil
			break
		}
	}
	return
}

func (s *SKB) UnlockWithStoredSecret(secretRetriever SecretRetriever) (ret GenericKey, err error) {
	s.G().Log.Debug("+ UnlockWithStoredSecret()")
	defer func() {
		s.G().Log.Debug("- UnlockWithStoredSecret -> %s", ErrToOk(err))
	}()

	if ret = s.decryptedSecret; ret != nil {
		return
	}

	return s.unlockSecretKeyFromSecretRetriever(secretRetriever)
}

func (s *SKB) PromptAndUnlock(reason, which string, secretStore SecretStore, ui SecretUI, scr StreamCacheReader, lksPreload *LKSec) (ret GenericKey, err error) {
	s.G().Log.Debug("+ PromptAndUnlock(%s,%s)", reason, which)
	defer func() {
		s.G().Log.Debug("- PromptAndUnlock -> %s", ErrToOk(err))
	}()

	if ret = s.decryptedSecret; ret != nil {
		return
	}

	if secretStore != nil {
		ret, err = s.unlockSecretKeyFromSecretRetriever(secretStore)
		s.G().Log.Debug("| unlockSecretKeyFromSecretRetriever -> %s", ErrToOk(err))
		if err == nil {
			return
		}
		// Just fall through if we failed to unlock with
		// retrieved secret.
		err = nil
	}

	var tsec *triplesec.Cipher
	var pps PassphraseStream
	if scr != nil {
		tsec = scr.Triplesec()
		pps = scr.PassphraseStream()
	} else {
		s.G().LoginState().StreamCache(func(sc *StreamCache) {
			tsec = sc.Triplesec()
			pps = sc.PassphraseStream()
		}, "skb - PromptAndUnlock - tsec, pps")
	}
	if tsec != nil || pps != nil {
		ret, err = s.UnlockSecretKey("", tsec, pps, nil, lksPreload)
		if err == nil {
			s.G().Log.Debug("| Unlocked key with cached 3Sec and passphrase stream")
			return
		}
		if _, ok := err.(PassphraseError); !ok {
			return
		}
		// if it's a passphrase error, fall through...
	} else {
		s.G().Log.Debug("| No 3Sec or PassphraseStream in PromptAndUnlock")
	}

	var desc string
	if desc, err = s.VerboseDescription(); err != nil {
		return
	}

	unlocker := func(pw string, storeSecret bool) (ret GenericKey, err error) {
		var secretStorer SecretStorer
		if storeSecret {
			secretStorer = secretStore
		}
		return s.UnlockSecretKey(pw, nil, nil, secretStorer, nil)
	}

	return KeyUnlocker{
		Tries:          4,
		Reason:         reason,
		KeyDesc:        desc,
		Which:          which,
		UseSecretStore: secretStore != nil,
		Unlocker:       unlocker,
		Ui:             ui,
	}.Run()
}

func (p *SKBKeyringFile) PushAndSave(skb *SKB, lui LogUI) (err error) {
	if err = p.Push(skb); err == nil {
		err = p.Save(lui)
	}
	return
}
