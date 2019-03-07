// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

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
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"sync"

	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	triplesec "github.com/keybase/go-triplesec"
)

// DebugDumpKey is used only in debugging. For now it's not in
// use but we might need it in the future.
func DebugDumpKey(g *GlobalContext, name string, b []byte) {
	tmp, err := ioutil.TempFile(os.TempDir(), "dump-"+name)
	if err != nil {
		g.Log.Warning("Failed to dumpKey %s: %s", name, err)
		return
	}
	g.Log.Notice("DUMPKEY %s -> %s", name, tmp.Name())
	buf := bytes.NewBuffer(b)
	io.Copy(tmp, buf)
	tmp.Close()
}

type SKB struct {
	Priv SKBPriv           `codec:"priv"`
	Pub  []byte            `codec:"pub"`
	Type kbcrypto.AlgoType `codec:"type,omitempty"`

	decodedPub      GenericKey
	decryptedSecret GenericKey
	decryptedRaw    []byte // in case we need to reexport it

	uid keybase1.UID // UID that the key is for
	Contextified

	// TODO(akalin): Remove this in favor of making LKSec
	// Contextified (see
	// https://github.com/keybase/client/issues/329 ).
	newLKSecForTest func(clientHalf LKSecClientHalf) *LKSec

	sync.Mutex // currently only for uid
}

func NewSKB() *SKB {
	return &SKB{}
}

func NewSKBWithGlobalContext(g *GlobalContext) *SKB {
	return &SKB{Contextified: NewContextified(g)}
}

type SKBPriv struct {
	Data                 []byte `codec:"data"`
	Encryption           int    `codec:"encryption"`
	PassphraseGeneration int    `codec:"passphrase_generation,omitempty"`
}

func ToServerSKB(gc *GlobalContext, key GenericKey, tsec Triplesec, gen PassphraseGeneration) (ret *SKB, err error) {
	if pgp, ok := key.(*PGPKeyBundle); ok {
		return pgp.ToServerSKB(gc, tsec, gen)
	}
	return nil, errors.New("Only PGP keys can be encrypted for server sync")
}

func (key *PGPKeyBundle) ToServerSKB(gc *GlobalContext, tsec Triplesec, gen PassphraseGeneration) (ret *SKB, err error) {

	ret = NewSKBWithGlobalContext(gc)

	var pk, sk bytes.Buffer

	// Need to serialize Private first, because
	err = key.SerializePrivate(&sk)
	if err != nil {
		return
	}
	if tsec != nil {
		ret.Priv.Data, err = tsec.Encrypt(sk.Bytes())
		ret.Priv.Encryption = int(ClientTriplesecVersion)
		if err != nil {
			return
		}
	} else {
		ret.Priv.Data = sk.Bytes()
		ret.Priv.Encryption = 0
	}

	ret.Priv.PassphraseGeneration = int(gen)

	err = key.Entity.Serialize(&pk)
	if err != nil {
		return
	}
	ret.Pub = pk.Bytes()
	ret.Type = key.GetAlgoType()

	return
}

func (s *SKB) Dump() {
	if s == nil {
		s.G().Log.Debug("SKB Dump: skb is nil\n")
		return
	}
	s.G().Log.Debug("skb: %+v, uid = %s\n", s, s.uid)
}

func (s *SKB) newLKSec(pps *PassphraseStream) *LKSec {
	if s.newLKSecForTest != nil {
		return s.newLKSecForTest(pps.LksClientHalf())
	}
	if s.uid.IsNil() {
		panic("no uid set in skb")
	}
	return NewLKSec(pps, s.uid)
}

func (s *SKB) GetTagAndVersion() (kbcrypto.PacketTag, kbcrypto.PacketVersion) {
	return kbcrypto.TagP3skb, kbcrypto.KeybasePacketV1
}

func (s *SKB) ReadKey() (g GenericKey, err error) {
	switch {
	case IsPGPAlgo(s.Type):
		var w *Warnings
		g, w, err = ReadOneKeyFromBytes(s.Pub)
		w.Warn(s.G())
	case s.Type == kbcrypto.KIDNaclEddsa:
		g, err = ImportNaclSigningKeyPairFromBytes(s.Pub, nil)
	case s.Type == kbcrypto.KIDNaclDH:
		g, err = ImportNaclDHKeyPairFromBytes(s.Pub, nil)
	default:
		err = UnknownKeyTypeError{s.Type}
	}
	return
}

func (s *SKB) GetPubKey() (key GenericKey, err error) {
	if key = s.decodedPub; key == nil {
		key, err = s.ReadKey()
		s.decodedPub = key
	}
	return
}

func (s *SKB) VerboseDescription() (ret string, err error) {
	var key GenericKey
	key, err = s.GetPubKey()
	if err == nil && key != nil {
		ret = key.VerboseDescription()
	}
	return
}

func (s *SKB) HumanDescription(owner *User) (string, error) {
	key, err := s.GetPubKey()
	if err != nil {
		return "", err
	}

	if IsPGPAlgo(s.Type) {
		return s.pgpHumanDescription(key)
	}
	return s.devHumandDescription(owner, key)
}

func (s *SKB) pgpHumanDescription(key GenericKey) (string, error) {
	pgpKey, ok := key.(*PGPKeyBundle)
	if !ok {
		return "", kbcrypto.BadKeyError{Msg: "not pgp key despite skb algo type"}
	}

	return pgpKey.HumanDescription(), nil
}

func (s *SKB) devHumandDescription(owner *User, key GenericKey) (string, error) {
	ckf := owner.GetComputedKeyFamily()
	device, err := ckf.GetDeviceForKey(key)
	if err != nil {
		return "", err
	}
	if device == nil {
		return "", NoDeviceError{Reason: fmt.Sprintf("for key ID %s", key.GetKID())}
	}
	if device.Description == nil {
		return "", fmt.Errorf("no device description")
	}
	return fmt.Sprintf("Device %q", *device.Description), nil
}

func (s *SKB) RawUnlockedKey() []byte {
	return s.decryptedRaw
}

func (s *SKB) unlockSecretKeyFromSecretRetriever(m MetaContext, secretRetriever SecretRetriever) (key GenericKey, err error) {
	if key = s.decryptedSecret; key != nil {
		return
	}

	var unlocked []byte
	switch s.Priv.Encryption {
	case 0:
		unlocked = s.Priv.Data
	case LKSecVersion:
		unlocked, err = s.lksUnlockWithSecretRetriever(m, secretRetriever)
	default:
		err = kbcrypto.BadKeyError{Msg: fmt.Sprintf("Can't unlock secret from secret retriever with protection type %d", int(s.Priv.Encryption))}
	}

	if err == nil {
		key, err = s.parseUnlocked(unlocked)
	}
	return
}

func (s *SKB) UnlockSecretKey(m MetaContext, passphrase string, tsec Triplesec, pps *PassphraseStream, secretStorer SecretStorer) (key GenericKey, err error) {
	defer m.Trace("SKB#UnlockSecretKey", func() error { return err })()
	if key = s.decryptedSecret; key != nil {
		return key, nil
	}
	var unlocked []byte

	switch {
	case s.Priv.Encryption == 0:
		m.Debug("case: Unlocked")
		unlocked = s.Priv.Data
	case s.Priv.Encryption > 0 && s.Priv.Encryption < LKSecVersion:
		m.Debug("case: Triplesec")
		tsecIn := tsec
		if tsec == nil {
			tsec, err = s.G().NewTriplesec([]byte(passphrase), nil)
			if err != nil {
				return nil, err
			}
		}
		unlocked, err = s.tsecUnlock(tsec)
		if err != nil {
			return nil, err
		}
		if tsecIn == nil {
			m.Debug("Caching passphrase stream: tsec=%v, pps=%v", (tsec != nil), (pps != nil))
			m.ActiveDevice().CachePassphraseStream(NewPassphraseStreamCache(tsec, pps))
		}
	case s.Priv.Encryption == LKSecVersion:
		m.Debug("case: LKSec")
		ppsIn := pps
		if pps == nil {
			tsec, pps, err = UnverifiedPassphraseStream(m, s.uid, passphrase)
			if err != nil {
				return nil, fmt.Errorf("UnlockSecretKey: %s", err)
			}
		}
		unlocked, err = s.lksUnlock(m, pps, secretStorer)
		if err != nil {
			return nil, err
		}
		if ppsIn == nil {
			m.Debug("Caching passphrase stream: tsec=%v, pps=%v", (tsec != nil), (pps != nil))
			m.ActiveDevice().CachePassphraseStream(NewPassphraseStreamCache(tsec, pps))
		}
	default:
		err = kbcrypto.BadKeyError{Msg: fmt.Sprintf("Can't unlock secret with protection type %d", int(s.Priv.Encryption))}
		return nil, err
	}
	key, err = s.parseUnlocked(unlocked)
	return key, err
}

func (s *SKB) parseUnlocked(unlocked []byte) (key GenericKey, err error) {

	switch {
	case IsPGPAlgo(s.Type):
		var w *Warnings
		key, w, err = ReadOneKeyFromBytes(unlocked)
		w.Warn(s.G())
	case s.Type == kbcrypto.KIDNaclEddsa:
		key, err = ImportNaclSigningKeyPairFromBytes(s.Pub, unlocked)
	case s.Type == kbcrypto.KIDNaclDH:
		key, err = ImportNaclDHKeyPairFromBytes(s.Pub, unlocked)
	}

	if key == nil {
		err = kbcrypto.BadKeyError{Msg: "can't parse secret key after unlock"}
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

func (s *SKB) tsecUnlock(tsec Triplesec) ([]byte, error) {
	unlocked, err := tsec.Decrypt(s.Priv.Data)
	if err != nil {
		if _, ok := err.(triplesec.BadPassphraseError); ok {
			err = PassphraseError{}
		}
		return nil, err
	}
	return unlocked, nil
}

func (s *SKB) lksUnlock(m MetaContext, pps *PassphraseStream, secretStorer SecretStorer) (unlocked []byte, err error) {
	defer m.Trace("SKB#lksUnlock", func() error { return err })()
	m.Debug("| creating new lks")

	lks := s.newLKSec(pps)
	s.Lock()
	m.Debug("| setting uid in lks to %s", s.uid)
	lks.SetUID(s.uid)
	s.Unlock()
	var ppGen PassphraseGeneration
	unlocked, ppGen, _, err = lks.Decrypt(m, s.Priv.Data)
	if err != nil {
		return
	}
	pps.SetGeneration(ppGen)

	if secretStorer != nil {
		var secret LKSecFullSecret
		secret, err = lks.GetSecret(m)
		if err != nil {
			unlocked = nil
			return
		}
		// Ignore any errors storing the secret.
		storeSecretErr := secretStorer.StoreSecret(m, secret)
		if storeSecretErr != nil {
			m.Warning("StoreSecret error: %s", storeSecretErr)
		}
	}

	return
}

func (s *SKB) lksUnlockWithSecretRetriever(m MetaContext, secretRetriever SecretRetriever) (unlocked []byte, err error) {
	secret, err := secretRetriever.RetrieveSecret(m)
	if err != nil {
		return
	}
	if s.uid.IsNil() {
		panic("no uid set in skb")
	}
	lks := NewLKSecWithFullSecret(secret, s.uid)
	unlocked, _, _, err = lks.Decrypt(m, s.Priv.Data)

	return
}

func (s *SKB) SetUID(uid keybase1.UID) {
	s.G().Log.Debug("| Setting UID on SKB to %s", uid)
	s.Lock()
	s.uid = uid
	s.Unlock()
}

func (s *SKB) ArmoredEncode() (ret string, err error) {
	return kbcrypto.EncodePacketToArmoredString(s)
}

func (s *SKB) UnlockWithStoredSecret(m MetaContext, secretRetriever SecretRetriever) (ret GenericKey, err error) {
	defer m.Trace("SKB#UnlockWithStoredSecret()", func() error { return err })()
	if ret = s.decryptedSecret; ret != nil {
		return
	}
	return s.unlockSecretKeyFromSecretRetriever(m, secretRetriever)
}

var ErrUnlockNotPossible = errors.New("unlock not possible")

func (s *SKB) UnlockNoPrompt(m MetaContext, secretStore SecretStore) (ret GenericKey, err error) {
	defer m.Trace("SKB#UnlockNoPrompt", func() error { return err })()
	// already have decrypted secret?
	if s.decryptedSecret != nil {
		return s.decryptedSecret, nil
	}

	// try using the secret store:
	if secretStore != nil {
		key, err := s.unlockSecretKeyFromSecretRetriever(m, secretStore)
		m.Debug("| unlockSecretKeyFromSecretRetriever -> %s", ErrToOk(err))
		if err == nil {
			return key, nil
		}
		// fall through if we failed to unlock with retrieved secret...
	}

	// try using the passphrase stream cache
	pps, tsec := m.PassphraseStreamAndTriplesec()
	if tsec != nil || pps != nil {
		key, err := s.UnlockSecretKey(m, "", tsec, pps, nil)
		if err == nil {
			m.Debug("| Unlocked key with cached 3Sec and passphrase stream")
			return key, nil
		}
		if _, ok := err.(PassphraseError); !ok {
			// not a passphrase error
			return nil, err
		}
		// fall through if it's a passphrase error
	} else {
		m.Debug("| No 3Sec or PassphraseStream in UnlockNoPrompt")
	}

	// failed to unlock without prompting user for passphrase
	return nil, ErrUnlockNotPossible
}

func (s *SKB) unlockPrompt(m MetaContext, arg SecretKeyPromptArg, secretStore SecretStore, me *User) (ret GenericKey, err error) {
	defer m.Trace("SKB#unlockPrompt", func() error { return err })()

	// check to see if user has recently canceled an unlock prompt:
	// if lctx != nil, then don't bother as any prompts during login should be shown.
	if m.LoginContext() == nil && arg.UseCancelCache && m.ActiveDevice().SecretPromptCancelTimer().WasRecentlyCanceled(m) {
		m.Debug("prompt was recently canceled; skipping")
		return nil, SkipSecretPromptError{}
	}

	desc, err := s.HumanDescription(me)
	if err != nil {
		return nil, err
	}

	unlocker := func(pw string, storeSecret bool) (ret GenericKey, err error) {
		var secretStorer SecretStorer
		if storeSecret {
			secretStorer = secretStore
		}
		return s.UnlockSecretKey(m, pw, nil, nil, secretStorer)
	}

	keyUnlocker := NewKeyUnlocker(4, arg.Reason, desc, PassphraseTypeKeybase, (secretStore != nil), arg.SecretUI, unlocker)

	ret, err = keyUnlocker.Run(m)
	if err != nil {
		if _, ok := err.(InputCanceledError); ok && arg.UseCancelCache {
			// cache the cancel response in the account
			m.ActiveDevice().SecretPromptCancelTimer().SetNow(m)
		}
		return nil, err
	}
	return ret, nil
}

func (s *SKB) PromptAndUnlock(m MetaContext, arg SecretKeyPromptArg, secretStore SecretStore, me *User) (ret GenericKey, err error) {
	defer m.Trace(fmt.Sprintf("SKB#PromptAndUnlock(%s)", arg.Reason), func() error { return err })()

	// First try to unlock without prompting the user.
	ret, err = s.UnlockNoPrompt(m, secretStore)
	if err == nil {
		return ret, nil
	}
	if err != ErrUnlockNotPossible {
		return nil, err
	}

	// Prompt necessary:
	ret, err = s.unlockPrompt(m, arg, secretStore, me)
	return
}
