// Copyright 2017 Keybase, Inc. All rights reserved. Use of
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

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	triplesec "github.com/keybase/go-triplesec"
)

// DebugDumpKey is used only in debugging. For now it's now in
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
	Priv SKBPriv  `codec:"priv"`
	Pub  []byte   `codec:"pub"`
	Type AlgoType `codec:"type,omitempty"`

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

func NewSKB(gc *GlobalContext) *SKB {
	return &SKB{Contextified: NewContextified(gc)}
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

	ret = NewSKB(gc)

	var pk, sk bytes.Buffer

	// Need to serialize Private first, because
	err = key.SerializePrivate(&sk)
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
	return NewLKSec(pps, s.uid, s.G())
}

func (s *SKB) ToPacket() (ret *KeybasePacket, err error) {
	return NewKeybasePacket(s, TagP3skb, KeybasePacketV1)
}

func (s *SKB) ReadKey() (g GenericKey, err error) {
	switch {
	case IsPGPAlgo(s.Type):
		var w *Warnings
		g, w, err = ReadOneKeyFromBytes(s.Pub)
		w.Warn(s.G())
	case s.Type == KIDNaclEddsa:
		g, err = ImportNaclSigningKeyPairFromBytes(s.Pub, nil)
	case s.Type == KIDNaclDH:
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
		return "", BadKeyError{Msg: "not pgp key despite skb algo type"}
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

func (s *SKB) unlockSecretKeyFromSecretRetriever(lctx LoginContext, secretRetriever SecretRetriever) (key GenericKey, err error) {
	if key = s.decryptedSecret; key != nil {
		return
	}

	var unlocked []byte
	switch s.Priv.Encryption {
	case 0:
		unlocked = s.Priv.Data
	case LKSecVersion:
		unlocked, err = s.lksUnlockWithSecretRetriever(lctx, secretRetriever)
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
//
// question: why is this a member of SKB?
//
func (s *SKB) unverifiedPassphraseStream(lctx LoginContext, passphrase string) (tsec Triplesec, ret *PassphraseStream, err error) {
	var salt []byte
	username := s.G().Env.GetUsername().String()
	if lctx != nil {
		if len(username) > 0 {
			err = lctx.LoadLoginSession(username)
			if err != nil {
				return nil, nil, err
			}
		}
		salt, err = lctx.LoginSession().Salt()
	} else {
		aerr := s.G().LoginState().Account(func(a *Account) {
			if len(username) > 0 {
				err = a.LoadLoginSession(username)
				if err != nil {
					return
				}
			}
			salt, err = a.LoginSession().Salt()
		}, "skb - salt")
		if aerr != nil {
			return nil, nil, aerr
		}
	}
	if err != nil {
		return nil, nil, err
	}
	return StretchPassphrase(s.G(), passphrase, salt)
}

func (s *SKB) UnlockSecretKey(lctx LoginContext, passphrase string, tsec Triplesec, pps *PassphraseStream, secretStorer SecretStorer) (key GenericKey, err error) {
	if key = s.decryptedSecret; key != nil {
		return
	}
	var unlocked []byte

	switch s.Priv.Encryption {
	case 0:
		unlocked = s.Priv.Data
	case int(triplesec.Version):
		if tsec == nil {
			tsec, err = s.G().NewTriplesec([]byte(passphrase), nil)
			if err != nil {
				return nil, err
			}
		}
		unlocked, err = s.tsecUnlock(tsec)
	case LKSecVersion:
		ppsIn := pps
		if pps == nil {
			tsec, pps, err = s.unverifiedPassphraseStream(lctx, passphrase)
			if err != nil {
				return nil, fmt.Errorf("UnlockSecretKey: %s", err)
			}
		}
		unlocked, err = s.lksUnlock(lctx, pps, secretStorer)
		if err == nil && ppsIn == nil {
			// the unverified tsec, pps has been verified, so cache it:
			if lctx != nil {
				lctx.CreateStreamCache(tsec, pps)
			} else {
				aerr := s.G().LoginState().Account(func(a *Account) {
					a.CreateStreamCache(tsec, pps)
				}, "skb - UnlockSecretKey - CreateStreamCache")
				if aerr != nil {
					return nil, aerr
				}
			}
		} else {
			s.G().Log.Debug("| not caching passphrase stream: err = %v, ppsIn == nil? %v", err, ppsIn == nil)
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
	case IsPGPAlgo(s.Type):
		var w *Warnings
		key, w, err = ReadOneKeyFromBytes(unlocked)
		w.Warn(s.G())
	case s.Type == KIDNaclEddsa:
		key, err = ImportNaclSigningKeyPairFromBytes(s.Pub, unlocked)
	case s.Type == KIDNaclDH:
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

func (s *SKB) lksUnlock(lctx LoginContext, pps *PassphraseStream, secretStorer SecretStorer) (unlocked []byte, err error) {
	s.G().Log.Debug("+ SKB:lksUnlock")
	defer func() {
		s.G().Log.Debug("- SKB:lksUnlock -> %s", ErrToOk(err))
	}()
	s.G().Log.Debug("| creating new lks")

	lks := s.newLKSec(pps)
	s.Lock()
	s.G().Log.Debug("| setting uid in lks to %s", s.uid)
	lks.SetUID(s.uid)
	s.Unlock()
	var ppGen PassphraseGeneration
	unlocked, ppGen, _, err = lks.Decrypt(lctx, s.Priv.Data)
	if err != nil {
		return
	}
	pps.SetGeneration(ppGen)

	if secretStorer != nil {
		var secret LKSecFullSecret
		secret, err = lks.GetSecret(lctx)
		if err != nil {
			unlocked = nil
			return
		}
		// Ignore any errors storing the secret.
		storeSecretErr := secretStorer.StoreSecret(secret)
		if storeSecretErr != nil {
			s.G().Log.Warning("StoreSecret error: %s", storeSecretErr)
		}
	}

	return
}

func (s *SKB) lksUnlockWithSecretRetriever(lctx LoginContext, secretRetriever SecretRetriever) (unlocked []byte, err error) {
	secret, err := secretRetriever.RetrieveSecret()
	if err != nil {
		return
	}
	if s.uid.IsNil() {
		panic("no uid set in skb")
	}
	lks := NewLKSecWithFullSecret(secret, s.uid, s.G())
	unlocked, _, _, err = lks.Decrypt(nil, s.Priv.Data)

	// if unlock was successful, lks can be saved in the account:
	if err == nil && lctx != nil {
		lctx.SetLKSec(lks)
	}

	return
}

func (s *SKB) SetUID(uid keybase1.UID) {
	s.G().Log.Debug("| Setting UID on SKB to %s", uid)
	s.Lock()
	s.uid = uid
	s.Unlock()
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

func (p KeybasePackets) ToListOfSKBs() ([]*SKB, error) {
	ret := make([]*SKB, len(p))
	for i, e := range p {
		k, ok := e.Body.(*SKB)
		if !ok {
			return nil, fmt.Errorf("Bad SKB sequence; got packet of wrong type %T", e.Body)
		}
		ret[i] = k
	}
	return ret, nil
}

func (s *SKB) UnlockWithStoredSecret(lctx LoginContext, secretRetriever SecretRetriever) (ret GenericKey, err error) {
	s.G().Log.Debug("+ UnlockWithStoredSecret()")
	defer func() {
		s.G().Log.Debug("- UnlockWithStoredSecret -> %s", ErrToOk(err))
	}()

	if ret = s.decryptedSecret; ret != nil {
		return
	}

	return s.unlockSecretKeyFromSecretRetriever(lctx, secretRetriever)
}

var ErrUnlockNotPossible = errors.New("unlock not possible")

func (s *SKB) UnlockNoPrompt(lctx LoginContext, secretStore SecretStore) (GenericKey, error) {
	// already have decrypted secret?
	if s.decryptedSecret != nil {
		return s.decryptedSecret, nil
	}

	// try using the secret store:
	if secretStore != nil {
		key, err := s.unlockSecretKeyFromSecretRetriever(lctx, secretStore)
		s.G().Log.Debug("| unlockSecretKeyFromSecretRetriever -> %s", ErrToOk(err))
		if err == nil {
			return key, nil
		}
		// fall through if we failed to unlock with retrieved secret...
	}

	// try using the passphrase stream cache
	var tsec Triplesec
	var pps *PassphraseStream
	if lctx != nil {
		tsec = lctx.PassphraseStreamCache().Triplesec()
		pps = lctx.PassphraseStreamCache().PassphraseStream()
	} else {
		s.G().LoginState().PassphraseStreamCache(func(sc *PassphraseStreamCache) {
			tsec = sc.Triplesec()
			pps = sc.PassphraseStream()
		}, "skb - UnlockNoPrompt - tsec, pps")
	}

	if tsec != nil || pps != nil {
		key, err := s.UnlockSecretKey(lctx, "", tsec, pps, nil)
		if err == nil {
			s.G().Log.Debug("| Unlocked key with cached 3Sec and passphrase stream")
			return key, nil
		}
		if _, ok := err.(PassphraseError); !ok {
			// not a passphrase error
			return nil, err
		}
		// fall through if it's a passphrase error
	} else {
		s.G().Log.Debug("| No 3Sec or PassphraseStream in UnlockNoPrompt")
	}

	// failed to unlock without prompting user for passphrase
	return nil, ErrUnlockNotPossible
}

func (s *SKB) unlockPrompt(arg SecretKeyPromptArg, secretStore SecretStore, me *User) (GenericKey, error) {
	// check to see if user has recently canceled an unlock prompt:
	// if lctx != nil, then don't bother as any prompts during login should be shown.
	if arg.LoginContext == nil && arg.UseCancelCache {
		var skip bool
		s.G().LoginState().Account(func(a *Account) {
			skip = a.SkipSecretPrompt()
		}, "SKB - unlockPrompt")
		if skip {
			return nil, SkipSecretPromptError{}
		}
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
		return s.UnlockSecretKey(arg.LoginContext, pw, nil, nil, secretStorer)
	}

	keyUnlocker := NewKeyUnlocker(s.G(), 4, arg.Reason, desc, PassphraseTypeKeybase, (secretStore != nil), arg.SecretUI, unlocker)

	key, err := keyUnlocker.Run()
	if err != nil {
		if _, ok := err.(InputCanceledError); ok && arg.UseCancelCache {
			// cache the cancel response in the account
			s.G().LoginState().Account(func(a *Account) {
				a.SecretPromptCanceled()
			}, "SKB - unlockPrompt - input canceled")
		}
		return nil, err
	}
	return key, nil
}

func (s *SKB) PromptAndUnlock(arg SecretKeyPromptArg, secretStore SecretStore, me *User) (ret GenericKey, err error) {
	s.G().Log.Debug("+ PromptAndUnlock(%s)", arg.Reason)
	defer func() {
		s.G().Log.Debug("- PromptAndUnlock -> %s", ErrToOk(err))
	}()

	// First try to unlock without prompting the user.
	ret, err = s.UnlockNoPrompt(arg.LoginContext, secretStore)
	if err == nil {
		return
	}
	if err != ErrUnlockNotPossible {
		return
	}

	// Prompt necessary:
	ret, err = s.unlockPrompt(arg, secretStore, me)
	return
}
