// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
	"strings"
)

const LKSecVersion = 100
const LKSecLen = 32

type LKSecClientHalf struct {
	c *[LKSecLen]byte
}

func (c LKSecClientHalf) IsNil() bool {
	return c.c == nil
}

func (c LKSecClientHalf) Bytes() []byte {
	if c.c == nil {
		return nil
	}
	return c.c[:]
}

type LKSecServerHalf struct {
	s *[LKSecLen]byte
}

func (s LKSecServerHalf) IsNil() bool {
	return s.s == nil
}

func (s LKSecServerHalf) Bytes() []byte {
	if s.s == nil {
		return nil
	}
	return s.s[:]
}

type LKSecFullSecret struct {
	f *[LKSecLen]byte
}

type LKSecMask struct {
	m *[LKSecLen]byte
}

func (f LKSecFullSecret) IsNil() bool {
	return f.f == nil
}

func (f LKSecFullSecret) Bytes() []byte {
	if f.f == nil {
		return nil
	}
	return f.f[:]
}

func NewLKSecServerHalfFromHex(s string) (ret LKSecServerHalf, err error) {
	var b []byte
	b, err = hex.DecodeString(s)
	if err != nil {
		return ret, err
	}
	if len(b) != LKSecLen {
		err = fmt.Errorf("Wrong LKSec server length: %d != %d", len(b), LKSecLen)
		return ret, err
	}
	var v [LKSecLen]byte
	copy(v[:], b)
	ret = LKSecServerHalf{s: &v}
	return ret, nil
}

func newLKSecFullSecretFromBytes(b []byte) (ret LKSecFullSecret, err error) {
	if len(b) != LKSecLen {
		err = fmt.Errorf("Wrong LKSecFullSecret len: %d != %d", len(b), LKSecLen)
		return ret, err
	}
	var v [LKSecLen]byte
	copy(v[:], b)
	ret = LKSecFullSecret{f: &v}
	return ret, nil
}

func NewLKSecClientHalfFromBytes(b []byte) (ret LKSecClientHalf, err error) {
	if len(b) != LKSecLen {
		err = fmt.Errorf("Wrong LKSecClientHalf len: %d != %d", len(b), LKSecLen)
		return ret, err
	}
	var v [LKSecLen]byte
	copy(v[:], b)
	ret = LKSecClientHalf{c: &v}
	return ret, nil
}

func (f LKSecFullSecret) Equal(f2 LKSecFullSecret) bool {
	if f.IsNil() {
		return false
	}
	if f2.IsNil() {
		return false
	}
	return hmac.Equal(f.f[:], f2.f[:])
}

func (c LKSecClientHalf) Equal(c2 LKSecClientHalf) bool {
	if c.IsNil() {
		return false
	}
	if c2.IsNil() {
		return false
	}
	return hmac.Equal(c.c[:], c2.c[:])
}

func (s LKSecServerHalf) EncodeToHex() string {
	if s.IsNil() {
		return ""
	}
	return hex.EncodeToString(s.s[:])
}

func (m LKSecMask) IsNil() bool {
	return m.m == nil
}

func (m LKSecMask) EncodeToHex() string {
	if m.IsNil() {
		return ""
	}
	return hex.EncodeToString(m.m[:])
}

func NewLKSecServerHalfZeros() LKSecServerHalf {
	var z [LKSecLen]byte
	return LKSecServerHalf{s: &z}
}

type LKSec struct {
	serverHalf LKSecServerHalf
	clientHalf LKSecClientHalf
	secret     LKSecFullSecret
	ppGen      PassphraseGeneration
	uid        keybase1.UID
	Contextified
}

func xorBytes(x *[LKSecLen]byte, y *[LKSecLen]byte) *[LKSecLen]byte {
	var ret [LKSecLen]byte
	for i := 0; i < LKSecLen; i++ {
		ret[i] = x[i] ^ y[i]
	}
	return &ret
}

func (s LKSecServerHalf) ComputeFullSecret(c LKSecClientHalf) LKSecFullSecret {
	return LKSecFullSecret{f: xorBytes(s.s, c.c)}
}

func (s LKSecServerHalf) ComputeClientHalf(f LKSecFullSecret) LKSecClientHalf {
	return LKSecClientHalf{c: xorBytes(s.s, f.f)}
}

func (f LKSecFullSecret) bug3964Remask(s LKSecServerHalf) LKSecFullSecret {
	return LKSecFullSecret{f: xorBytes(s.s, f.f)}
}

func (c LKSecClientHalf) ComputeMask(c2 LKSecClientHalf) LKSecMask {
	if c.IsNil() || c2.IsNil() {
		return LKSecMask{}
	}
	return LKSecMask{m: xorBytes(c.c, c2.c)}
}

func NewLKSec(pps *PassphraseStream, uid keybase1.UID, gc *GlobalContext) *LKSec {
	res := &LKSec{
		uid:          uid,
		Contextified: NewContextified(gc),
	}

	if pps != nil {
		res.clientHalf = pps.LksClientHalf()
		res.ppGen = pps.Generation()
	}
	return res
}

func NewLKSecWithClientHalf(clientHalf LKSecClientHalf, ppgen PassphraseGeneration, uid keybase1.UID, gc *GlobalContext) *LKSec {
	return &LKSec{
		clientHalf:   clientHalf,
		ppGen:        ppgen,
		uid:          uid,
		Contextified: NewContextified(gc),
	}
}

func NewLKSecWithFullSecret(secret LKSecFullSecret, uid keybase1.UID, gc *GlobalContext) *LKSec {
	return &LKSec{
		secret:       secret,
		ppGen:        PassphraseGeneration(-1),
		uid:          uid,
		Contextified: NewContextified(gc),
	}
}

func (s *LKSec) CorruptedFullSecretForBug3964Testing(srv LKSecServerHalf) LKSecFullSecret {
	return s.FullSecret().bug3964Remask(srv)
}

func (s *LKSec) SetUID(u keybase1.UID) {
	s.uid = u
}

func (s *LKSec) SetClientHalf(b LKSecClientHalf) {
	s.clientHalf = b
}

func (s *LKSec) SetServerHalf(b LKSecServerHalf) {
	s.serverHalf = b
}

// Generation returns the passphrase generation that this local key security
// object is derived from.
func (s LKSec) Generation() PassphraseGeneration {
	return s.ppGen
}

func (s *LKSec) GenerateServerHalf() error {
	if s.clientHalf.IsNil() {
		return errors.New("Can't generate server half without a client half")
	}
	if !s.serverHalf.IsNil() {
		return nil
	}
	var v [LKSecLen]byte
	var n int
	var err error
	if n, err = rand.Read(v[:]); err != nil {
		return err
	}
	if n != LKSecLen {
		return fmt.Errorf("short random read; wanted %d bytes but only got %d", LKSecLen, n)
	}
	s.serverHalf = LKSecServerHalf{s: &v}
	return nil
}

func (s *LKSec) GetServerHalf() LKSecServerHalf {
	return s.serverHalf
}

func (s *LKSec) Load(lctx LoginContext) (err error) {
	s.G().Log.Debug("+ LKSec::Load()")
	defer func() {
		s.G().Log.Debug("- LKSec::Load() -> %s", ErrToOk(err))
	}()

	if !s.secret.IsNil() {
		s.G().Log.Debug("| Short-circuit; we already know the full secret")
		return nil
	}

	if s.clientHalf.IsNil() {
		err = fmt.Errorf("client half not set")
		return err
	}

	if err = s.LoadServerHalf(lctx); err != nil {
		return err
	}

	s.SetFullSecret()
	return nil
}

func (s *LKSec) SetFullSecret() {
	s.G().Log.Debug("| Making XOR'ed secret key for Local Key Security (LKS)")
	s.secret = s.serverHalf.ComputeFullSecret(s.clientHalf)
}

func (s *LKSec) LoadServerHalf(lctx LoginContext) (err error) {
	s.G().Log.Debug("+ LKSec::LoadServerHalf()")
	defer func() {
		s.G().Log.Debug("- LKSec::LoadServerHalf() -> %s", ErrToOk(err))
	}()

	if !s.serverHalf.IsNil() {
		s.G().Log.Debug("| short-circuit: already have serverHalf")
		return nil
	}
	_, err = s.LoadServerDetails(lctx)
	return err
}

func (s *LKSec) LoadServerDetails(lctx LoginContext) (ret DeviceKeyMap, err error) {
	defer s.G().Trace("LKSec#LoadServerDetails", func() error { return err })()

	devid := s.G().Env.GetDeviceIDForUID(s.uid)
	if devid.IsNil() {
		return ret, fmt.Errorf("lksec load: no device id set, thus can't fetch server half")
	}

	if ret, err = s.apiServerHalf(lctx, devid); err != nil {
		s.G().Log.Debug("apiServerHalf(%s) error: %s", devid, err)
		return ret, err
	}
	if s.serverHalf.IsNil() {
		return ret, fmt.Errorf("after apiServerHalf(%s), serverHalf still empty", devid)
	}

	return ret, nil
}

func (s *LKSec) GetSecret(lctx LoginContext) (secret LKSecFullSecret, err error) {
	s.G().Log.Debug("+ LKsec:GetSecret()")
	defer func() {
		s.G().Log.Debug("- LKSec::GetSecret() -> %s", ErrToOk(err))
	}()

	if err = s.Load(lctx); err != nil {
		return
	}

	secret = s.secret
	return
}

func (s *LKSec) Encrypt(src []byte) (res []byte, err error) {
	s.G().Log.Debug("+ LKsec:Encrypt()")
	defer func() {
		s.G().Log.Debug("- LKSec::Encrypt() -> %s", ErrToOk(err))
	}()

	if err = s.Load(nil); err != nil {
		return nil, err
	}
	var nonce []byte
	nonce, err = RandBytes(24)
	if err != nil {
		return nil, err
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	box := secretbox.Seal(nil, src, &fnonce, s.secret.f)

	ret := append(nonce, box...)
	return ret, nil
}

func (s *LKSec) attemptBug3964Recovery(lctx LoginContext, data []byte, nonce *[24]byte) (res []byte, gen PassphraseGeneration, erroneousMask LKSecServerHalf, err error) {
	ss, err := s.loadSecretSyncer(lctx)
	if err != nil {
		return nil, 0, LKSecServerHalf{}, err
	}
	devices := ss.AllDevices()
	res, serverHalf, err := s.tryAllDevicesForBug3964Recovery(devices, data, nonce)
	return res, s.ppGen, serverHalf, err
}

func (s *LKSec) tryAllDevicesForBug3964Recovery(devices DeviceKeyMap, data []byte, nonce *[24]byte) (res []byte, erroneousMask LKSecServerHalf, err error) {

	// This logline is asserted in testing in bug_3964_repairman_test
	defer s.G().Trace("LKSec#tryAllDevicesForBug3964Recovery()", func() error { return err })()

	for devid, dev := range devices {

		// This logline is asserted in testing in bug_3964_repairman_test
		s.G().Log.Debug("| Trying Bug 3964 Recovery w/ device %q {id: %s, lks: %s...}", dev.Description, devid, dev.LksServerHalf[0:8])

		serverHalf, err := dev.ToLKSec()
		if err != nil {
			s.G().Log.Debug("| Failed with error: %s\n", err)
			continue
		}
		fs := s.secret.bug3964Remask(serverHalf)
		res, ok := secretbox.Open(nil, data, nonce, fs.f)

		if ok {
			// This logline is asserted in testing in bug_3964_repairman_test
			s.G().Log.Debug("| Success")
			return res, serverHalf, nil
		}
	}

	err = PassphraseError{"failed to open secretbox"}
	return nil, LKSecServerHalf{}, err
}

func splitCiphertext(src []byte) ([]byte, *[24]byte) {
	var nonce [24]byte
	copy(nonce[:], src[0:24])
	data := src[24:]
	return data, &nonce
}

func (s *LKSec) Decrypt(lctx LoginContext, src []byte) (res []byte, gen PassphraseGeneration, erroneousMask LKSecServerHalf, err error) {
	// This logline is asserted in testing in bug_3964_repairman_test
	defer s.G().Trace("LKSec#Decrypt()", func() error { return err })()

	if err = s.Load(lctx); err != nil {
		return nil, 0, LKSecServerHalf{}, err
	}
	var ok bool
	data, nonce := splitCiphertext(src)
	res, ok = secretbox.Open(nil, data, nonce, s.secret.f)
	if !ok {
		return s.attemptBug3964Recovery(lctx, data, nonce)
	}

	return res, s.ppGen, LKSecServerHalf{}, nil
}

func (s *LKSec) decryptForBug3964Repair(src []byte, dkm DeviceKeyMap) (res []byte, erroneousMask LKSecServerHalf, err error) {
	defer s.G().Trace("LKSec#decryptForBug3964Repair()", func() error { return err })()
	data, nonce := splitCiphertext(src)
	res, ok := secretbox.Open(nil, data, nonce, s.secret.f)
	if ok {
		s.G().Log.Debug("| Succeeded with intended mask")
		return res, LKSecServerHalf{}, nil
	}
	return s.tryAllDevicesForBug3964Recovery(dkm, data, nonce)
}

func (s *LKSec) ComputeClientHalf() (ret LKSecClientHalf, err error) {
	if !s.clientHalf.IsNil() {
		return s.clientHalf, nil
	}
	if s.serverHalf.IsNil() {
		return ret, errors.New("LKSec: tried to compute client half, but no server half loaded")
	}
	if s.secret.IsNil() {
		return ret, errors.New("LKSec: tried to compute client half, but no full secret loaded")
	}
	return s.serverHalf.ComputeClientHalf(s.secret), nil
}

func (s *LKSec) loadSecretSyncer(lctx LoginContext) (ss *SecretSyncer, err error) {
	if lctx != nil {
		if err := lctx.RunSecretSyncer(s.uid); err != nil {
			return nil, err
		}
		return lctx.SecretSyncer(), nil
	}
	aerr := s.G().LoginState().Account(func(a *Account) {
		if err = RunSyncer(a.SecretSyncer(), s.uid, a.LoggedIn(), a.LocalSession()); err != nil {
			return
		}
		ss = a.SecretSyncer()
	}, "LKSec#loadSecretSyncer")
	if aerr != nil {
		return nil, aerr
	}
	return ss, err
}

func (s *LKSec) apiServerHalf(lctx LoginContext, devid keybase1.DeviceID) (dkm DeviceKeyMap, err error) {
	var dev DeviceKey
	ss, err := s.loadSecretSyncer(lctx)
	if err != nil {
		return dkm, err
	}
	dev, err = ss.FindDevice(devid)
	if err != nil {
		return dkm, err
	}

	s.serverHalf, err = dev.ToLKSec()
	if err != nil {
		return dkm, err
	}
	s.ppGen = dev.PPGen
	return ss.AllDevices(), nil
}

// NewLKSForEncrypt gets a verified passphrase stream, and returns
// an LKS that works for encryption.
func NewLKSecForEncrypt(ui SecretUI, uid keybase1.UID, gc *GlobalContext) (ret *LKSec, err error) {
	var pps *PassphraseStream
	if pps, err = gc.LoginState().GetPassphraseStream(ui); err != nil {
		return
	}
	ret = NewLKSec(pps, uid, gc)
	return
}

// EncryptClientHalfRecovery takes the client half of the LKS secret
// and encrypts it for the given key.  This is for recovery of passphrases
// on device recovery operations.
func (s *LKSec) EncryptClientHalfRecovery(key GenericKey) (string, error) {
	if s.clientHalf.IsNil() {
		return "", errors.New("Nil LKS Client Half")
	}
	return key.EncryptToString(s.clientHalf.Bytes(), nil)
}

// ToSKB exports a generic key with the given LKSec to a SecretKeyBundle,
// performing all necessary encryption.
func (s *LKSec) ToSKB(key GenericKey) (ret *SKB, err error) {
	if s == nil {
		return nil, errors.New("nil lks")
	}
	ret = NewSKB(s.G())

	var publicKey RawPublicKey
	var privateKey RawPrivateKey

	publicKey, privateKey, err = key.ExportPublicAndPrivate()
	if err != nil {
		return nil, err
	}

	ret.Priv.Data, err = s.Encrypt([]byte(privateKey))
	if err != nil {
		return nil, err
	}
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.PassphraseGeneration = int(s.Generation())
	ret.Pub = []byte(publicKey)
	ret.Type = key.GetAlgoType()
	return ret, nil
}

func WriteLksSKBToKeyring(g *GlobalContext, k GenericKey, lks *LKSec, lctx LoginContext) (*SKB, error) {
	skb, err := lks.ToSKB(k)
	if err != nil {
		return nil, fmt.Errorf("k.ToLksSKB() error: %s", err)
	}
	if err := skbPushAndSave(g, skb, lctx); err != nil {
		return nil, err
	}
	return skb, nil
}

func (s *LKSec) FullSecret() LKSecFullSecret {
	if !s.secret.IsNil() {
		return s.secret
	}
	if s.serverHalf.IsNil() || s.clientHalf.IsNil() {
		return LKSecFullSecret{}
	}
	return s.serverHalf.ComputeFullSecret(s.clientHalf)
}

func (s LKSec) ServerHalf() LKSecServerHalf {
	return s.serverHalf
}

func (s LKSec) ClientHalf() LKSecClientHalf {
	return s.clientHalf
}

type LKSecServerHalfSet struct {
	index map[[LKSecLen]byte]bool
}

func NewLKSecServerHalfSet() *LKSecServerHalfSet {
	return &LKSecServerHalfSet{
		index: make(map[[LKSecLen]byte]bool),
	}
}

func (l *LKSecServerHalfSet) Add(s LKSecServerHalf) {
	if !s.IsNil() {
		l.index[*s.s] = true
	}
}

func (l *LKSecServerHalfSet) EncodeToHexList() string {
	var s []string
	for k := range l.index {
		s = append(s, hex.EncodeToString(k[:]))
	}
	return strings.Join(s, ",")
}
