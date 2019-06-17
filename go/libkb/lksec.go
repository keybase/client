// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/crypto/nacl/secretbox"
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
	deviceID   keybase1.DeviceID
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

func NewLKSec(pps *PassphraseStream, uid keybase1.UID) *LKSec {
	return NewLKSecWithDeviceID(pps, uid, keybase1.DeviceID(""))
}

func NewLKSecWithDeviceID(pps *PassphraseStream, uid keybase1.UID, deviceID keybase1.DeviceID) *LKSec {
	res := &LKSec{
		uid:      uid,
		deviceID: deviceID,
	}

	if pps != nil {
		res.clientHalf = pps.LksClientHalf()
		res.ppGen = pps.Generation()
	}
	return res
}

func NewLKSecWithClientHalf(clientHalf LKSecClientHalf, ppgen PassphraseGeneration, uid keybase1.UID) *LKSec {
	return &LKSec{
		clientHalf: clientHalf,
		ppGen:      ppgen,
		uid:        uid,
	}
}

func NewLKSecWithFullSecret(secret LKSecFullSecret, uid keybase1.UID) *LKSec {
	return &LKSec{
		secret: secret,
		ppGen:  PassphraseGeneration(-1),
		uid:    uid,
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

func (s *LKSec) Load(m MetaContext) (err error) {
	defer m.Trace("LKSec::Load()", func() error { return err })()

	if !s.secret.IsNil() {
		m.Debug("| Short-circuit; we already know the full secret")
		return nil
	}

	if s.clientHalf.IsNil() {
		err = fmt.Errorf("client half not set")
		return err
	}

	if err = s.LoadServerHalf(m); err != nil {
		return err
	}

	s.SetFullSecret(m)
	return nil
}

func (s *LKSec) SetFullSecret(m MetaContext) {
	m.Debug("| Making XOR'ed secret key for Local Key Security (LKS)")
	s.secret = s.serverHalf.ComputeFullSecret(s.clientHalf)
}

func (s *LKSec) LoadServerHalf(m MetaContext) (err error) {
	defer m.Trace("LKSec::LoadServerHalf()", func() error { return err })()

	if !s.serverHalf.IsNil() {
		m.Debug("| short-circuit: already have serverHalf")
		return nil
	}
	_, err = s.LoadServerDetails(m)
	return err
}

func (s *LKSec) LoadServerDetails(m MetaContext) (ret DeviceKeyMap, err error) {
	defer m.Trace("LKSec#LoadServerDetails", func() error { return err })()

	devid := s.deviceID
	if devid.IsNil() {
		devid = m.G().Env.GetDeviceIDForUID(s.uid)
	}
	if devid.IsNil() {
		return ret, fmt.Errorf("lksec load: no device id set, thus can't fetch server half")
	}

	if ret, err = s.apiServerHalf(m, devid); err != nil {
		m.Debug("apiServerHalf(%s) error: %s", devid, err)
		return ret, err
	}
	if s.serverHalf.IsNil() {
		return ret, fmt.Errorf("after apiServerHalf(%s), serverHalf still empty", devid)
	}

	return ret, nil
}

func (s *LKSec) GetSecret(m MetaContext) (secret LKSecFullSecret, err error) {
	defer m.Trace("LKsec:GetSecret()", func() error { return err })()
	if err = s.Load(m); err != nil {
		return secret, err
	}
	secret = s.secret
	return secret, nil
}

func (s *LKSec) Encrypt(m MetaContext, src []byte) (res []byte, err error) {
	defer m.Trace("LKsec:Encrypt()", func() error { return err })()
	if err = s.Load(m); err != nil {
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

func (s *LKSec) attemptBug3964Recovery(m MetaContext, data []byte, nonce *[24]byte) (res []byte, gen PassphraseGeneration, erroneousMask LKSecServerHalf, err error) {
	ss, err := s.loadSecretSyncer(m)
	if err != nil {
		return nil, 0, LKSecServerHalf{}, err
	}
	devices := ss.AllDevices()
	res, serverHalf, err := s.tryAllDevicesForBug3964Recovery(m, devices, data, nonce)
	return res, s.ppGen, serverHalf, err
}

func (s *LKSec) tryAllDevicesForBug3964Recovery(m MetaContext, devices DeviceKeyMap, data []byte, nonce *[24]byte) (res []byte, erroneousMask LKSecServerHalf, err error) {

	// This logline is asserted in testing in bug_3964_repairman_test
	defer m.Trace("LKSec#tryAllDevicesForBug3964Recovery()", func() error { return err })()

	for devid, dev := range devices {

		// This logline is asserted in testing in bug_3964_repairman_test
		m.Debug("| Trying Bug 3964 Recovery w/ device %q {id: %s, lks: %s...}", dev.Description, devid, dev.LksServerHalf[0:8])

		serverHalf, err := dev.ToLKSec()
		if err != nil {
			m.Debug("| Failed with error: %s\n", err)
			continue
		}
		fs := s.secret.bug3964Remask(serverHalf)
		res, ok := secretbox.Open(nil, data, nonce, fs.f)

		if ok {
			// This logline is asserted in testing in bug_3964_repairman_test
			m.Debug("| Success")
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

func (s *LKSec) Decrypt(m MetaContext, src []byte) (res []byte, gen PassphraseGeneration, erroneousMask LKSecServerHalf, err error) {
	// This logline is asserted in testing in bug_3964_repairman_test
	defer m.Trace("LKSec#Decrypt()", func() error { return err })()

	if err = s.Load(m); err != nil {
		return nil, 0, LKSecServerHalf{}, err
	}
	var ok bool
	data, nonce := splitCiphertext(src)
	res, ok = secretbox.Open(nil, data, nonce, s.secret.f)
	if !ok {
		m.Debug("secretbox.Open failed: attempting recovery")
		return s.attemptBug3964Recovery(m, data, nonce)
	}

	return res, s.ppGen, LKSecServerHalf{}, nil
}

func (s *LKSec) decryptForBug3964Repair(m MetaContext, src []byte, dkm DeviceKeyMap) (res []byte, erroneousMask LKSecServerHalf, err error) {
	defer m.Trace("LKSec#decryptForBug3964Repair()", func() error { return err })()
	data, nonce := splitCiphertext(src)
	res, ok := secretbox.Open(nil, data, nonce, s.secret.f)
	if ok {
		m.Debug("| Succeeded with intended mask")
		return res, LKSecServerHalf{}, nil
	}
	return s.tryAllDevicesForBug3964Recovery(m, dkm, data, nonce)
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

func (s *LKSec) loadSecretSyncer(m MetaContext) (ss *SecretSyncer, err error) {
	return m.SyncSecrets()
}

func (s *LKSec) apiServerHalf(m MetaContext, devid keybase1.DeviceID) (dkm DeviceKeyMap, err error) {
	var dev DeviceKey
	ss, err := s.loadSecretSyncer(m)
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
func NewLKSecForEncrypt(m MetaContext, ui SecretUI, uid keybase1.UID) (ret *LKSec, err error) {
	m = m.WithUIs(UIs{SecretUI: ui})
	pps, err := GetPassphraseStreamStored(m)
	if err != nil {
		return nil, err
	}
	ret = NewLKSec(pps, uid)
	return ret, nil
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
func (s *LKSec) ToSKB(m MetaContext, key GenericKey) (ret *SKB, err error) {
	defer m.Trace("LKSec#ToSKB", func() error { return err })()
	if s == nil {
		return nil, errors.New("nil lks")
	}
	ret = NewSKBWithGlobalContext(m.G())

	var publicKey RawPublicKey
	var privateKey RawPrivateKey

	publicKey, privateKey, err = key.ExportPublicAndPrivate()
	if err != nil {
		return nil, err
	}

	ret.Priv.Data, err = s.Encrypt(m, []byte(privateKey))
	if err != nil {
		return nil, err
	}
	ret.Priv.Encryption = LKSecVersion
	ret.Priv.PassphraseGeneration = int(s.Generation())
	ret.Pub = []byte(publicKey)
	ret.Type = key.GetAlgoType()
	ret.uid = s.uid
	return ret, nil
}

func WriteLksSKBToKeyring(m MetaContext, k GenericKey, lks *LKSec) (skb *SKB, err error) {
	defer m.Trace("WriteLksSKBToKeyring", func() error { return err })()
	skb, err = lks.ToSKB(m, k)
	if err != nil {
		return nil, fmt.Errorf("k.ToLksSKB() error: %s", err)
	}
	if err = skbPushAndSave(m, skb); err != nil {
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
