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

	triplesec "github.com/keybase/go-triplesec"
	"golang.org/x/crypto/openpgp"
)

type SKB struct {
	Priv SKBPriv `codec:"priv"`
	Pub  []byte  `codec:"pub"`
	Type int     `codec:"type,omitempty"`

	decodedPub      GenericKey
	decryptedSecret GenericKey
	decryptedRaw    []byte // in case we need to reexport it

	uid *UID // UID that the key is for
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
		g, err = ImportNaclSigningKeyPairFromBytes(p.Pub, nil)
	case p.Type == KID_NACL_DH:
		g, err = ImportNaclDHKeyPairFromBytes(p.Pub, nil)
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

func (p *SKB) UnlockSecretKey(passphrase string, tsec *triplesec.Cipher, pps PassphraseStream) (key GenericKey, err error) {
	if key = p.decryptedSecret; key != nil {
		return
	}
	var unlocked []byte

	switch p.Priv.Encryption {
	case 0:
		unlocked = p.Priv.Data
	case int(triplesec.Version):
		if tsec == nil {
			tsec, err = triplesec.NewCipher([]byte(passphrase), nil)
			if err != nil {
				return key, err
			}
		}
		unlocked, err = p.tsecUnlock(tsec)
	case LKSecVersion:
		pps_in := pps
		if pps == nil {
			tsec, pps, err = G.LoginState.GetUnverifiedPassphraseStream(passphrase)
		}
		if unlocked, err = p.lksUnlock(pps); err == nil && pps_in == nil {
			G.LoginState.SetPassphraseStream(tsec, pps)
		}
	default:
		err = BadKeyError{fmt.Sprintf("Can't unlock secret with protection type %d", int(p.Priv.Encryption))}
	}
	if err == nil {
		key, err = p.parseUnlocked(unlocked)
	}
	return
}

func (s *SKB) parseUnlocked(unlocked []byte) (key GenericKey, err error) {

	switch {
	case IsPgpAlgo(s.Type) || s.Type == 0:
		key, err = ReadOneKeyFromBytes(unlocked)
	case s.Type == KID_NACL_EDDSA:
		key, err = ImportNaclSigningKeyPairFromBytes(s.Pub, unlocked)
	case s.Type == KID_NACL_DH:
		key, err = ImportNaclDHKeyPairFromBytes(s.Pub, unlocked)
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

func (p *SKB) lksUnlock(pps PassphraseStream) ([]byte, error) {
	lks := NewLKSec(pps.LksClientHalf())
	lks.SetUID(p.uid)
	unlocked, err := lks.Decrypt(p.Priv.Data)
	if err != nil {
		return nil, err
	}
	return unlocked, nil
}

type SKBKeyringFile struct {
	filename string
	Blocks   []*SKB
	fpIndex  map[PgpFingerprint]*SKB
	kidIndex map[string]*SKB
	dirty    bool
}

func NewSKBKeyringFile(n string) *SKBKeyringFile {
	return &SKBKeyringFile{
		filename: n,
		Blocks:   make([]*SKB, 0, 1),
		fpIndex:  make(map[PgpFingerprint]*SKB),
		kidIndex: make(map[string]*SKB),
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
			if len(ska.KeyQuery) > 0 && !KeyMatchesQuery(key, ska.KeyQuery) {
				G.Log.Debug("| Skipped, doesn't match query=%s", ska.KeyQuery)
			} else if ska.PGPOnly && !IsPGP(key) {
				G.Log.Debug("| Skipped, wasn't a PGP key but we required it")
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
	} else {
		return ret, nil
	}
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

func (p *SKB) PromptAndUnlock(reason string, which string, ui SecretUI) (ret GenericKey, err error) {

	G.Log.Debug("+ PromptAndUnlock(%s,%s)", reason, which)
	defer func() {
		G.Log.Debug("- PromptAndUnlock -> %s", ErrToOk(err))
	}()

	if ret = p.decryptedSecret; ret != nil {
		return
	}

	tsec := G.LoginState.GetCachedTriplesec()
	pps := G.LoginState.GetCachedPassphraseStream()
	if tsec != nil || pps != nil {
		ret, err = p.UnlockSecretKey("", tsec, pps)
		if err == nil {
			G.Log.Debug("| Unlocked key with cached 3Sec and passphrase stream")
			return
		}
		if _, ok := err.(PassphraseError); !ok {
			return
		}
		// if it's a passphrase error, fall through...
	} else {
		G.Log.Debug("| No 3Sec or PassphraseStream in PromptAndUnlock")
	}

	var desc string
	if desc, err = p.VerboseDescription(); err != nil {
		return
	}

	unlocker := func(pw string) (ret GenericKey, err error) {
		return p.UnlockSecretKey(pw, nil, nil)
	}

	return KeyUnlocker{
		Tries:    4,
		Reason:   reason,
		KeyDesc:  desc,
		Unlocker: unlocker,
		Which:    which,
		Ui:       ui,
	}.Run()
}

func (p *SKBKeyringFile) PushAndSave(skb *SKB, lui LogUI) (err error) {
	if err = p.Push(skb); err == nil {
		err = p.Save(lui)
	}
	return
}
