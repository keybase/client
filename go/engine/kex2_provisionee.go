// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"
	"time"

	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	jsonw "github.com/keybase/go-jsonw"
	"golang.org/x/net/context"
)

// Kex2Provisionee is an engine.
type Kex2Provisionee struct {
	libkb.Contextified
	device       *libkb.Device
	secret       kex2.Secret
	secretCh     chan kex2.Secret
	eddsa        libkb.NaclKeyPair
	dh           libkb.NaclKeyPair
	deviceEKSeed keybase1.Bytes32
	uid          keybase1.UID
	username     string
	sessionToken keybase1.SessionToken
	csrfToken    keybase1.CsrfToken
	pps          keybase1.PassphraseStream
	lks          *libkb.LKSec
	kex2Cancel   func()
	mctx         libkb.MetaContext
	v1Only       bool // only support protocol v1 (for testing)
}

// Kex2Provisionee implements kex2.Provisionee, libkb.UserBasic,
// and libkb.SessionReader interfaces.
var _ kex2.Provisionee = (*Kex2Provisionee)(nil)
var _ libkb.UserBasic = (*Kex2Provisionee)(nil)
var _ libkb.SessionReader = (*Kex2Provisionee)(nil)

// NewKex2Provisionee creates a Kex2Provisionee engine.
func NewKex2Provisionee(g *libkb.GlobalContext, device *libkb.Device, secret kex2.Secret) *Kex2Provisionee {
	return &Kex2Provisionee{
		Contextified: libkb.NewContextified(g),
		device:       device,
		secret:       secret,
		secretCh:     make(chan kex2.Secret),
	}
}

// Name is the unique engine name.
func (e *Kex2Provisionee) Name() string {
	return "Kex2Provisionee"
}

// GetPrereqs returns the engine prereqs.
func (e *Kex2Provisionee) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *Kex2Provisionee) GetLKSec() *libkb.LKSec {
	return e.lks
}

// RequiredUIs returns the required UIs.
func (e *Kex2Provisionee) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.ProvisionUIKind,
	}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *Kex2Provisionee) SubConsumers() []libkb.UIConsumer {
	return nil
}

type kex2LogContext struct {
	log logger.Logger
}

func (k kex2LogContext) Debug(format string, args ...interface{}) {
	k.log.Debug(format, args...)
}

func newKex2LogContext(g *libkb.GlobalContext) kex2LogContext {
	return kex2LogContext{g.Log}
}

// Run starts the engine.
func (e *Kex2Provisionee) Run(m libkb.MetaContext) error {
	m.G().LocalSigchainGuard().Set(m.Ctx(), "Kex2Provisionee")
	defer m.G().LocalSigchainGuard().Clear(m.Ctx(), "Kex2Provisionee")

	// check device struct:
	if len(e.device.Type) == 0 {
		return errors.New("provisionee device requires Type to be set")
	}
	if e.device.ID.IsNil() {
		return errors.New("provisionee device requires ID to be set")
	}

	if m.LoginContext() == nil {
		return errors.New("Kex2Provisionee needs LoginContext set in engine.Context")
	}

	if len(e.secret) == 0 {
		panic("empty secret")
	}

	m, e.kex2Cancel = m.WithContextCancel()
	defer e.kex2Cancel()

	// The MetaContext m is needed in some of the kex2 functions. Make sure to do that
	// after we've added a cancelation above.
	e.mctx = m

	karg := kex2.KexBaseArg{
		Ctx:           m.Ctx(),
		LogCtx:        newKex2LogContext(m.G()),
		Mr:            libkb.NewKexRouter(m.G()),
		DeviceID:      e.device.ID,
		Secret:        e.secret,
		SecretChannel: e.secretCh,
		Timeout:       60 * time.Minute,
	}
	parg := kex2.ProvisioneeArg{
		KexBaseArg:  karg,
		Provisionee: e,
	}
	return kex2.RunProvisionee(parg)
}

// Cancel cancels the kex2 run if it is running.
func (e *Kex2Provisionee) Cancel() {
	if e.kex2Cancel == nil {
		return
	}
	e.kex2Cancel()
}

// AddSecret inserts a received secret into the provisionee's
// secret channel.
func (e *Kex2Provisionee) AddSecret(s kex2.Secret) {
	e.secretCh <- s
}

// GetLogFactory implements GetLogFactory in kex2.Provisionee.
func (e *Kex2Provisionee) GetLogFactory() rpc.LogFactory {
	return rpc.NewSimpleLogFactory(e.G().Log, nil)
}

// HandleHello implements HandleHello in kex2.Provisionee.
func (e *Kex2Provisionee) HandleHello(_ context.Context, harg keybase1.HelloArg) (res keybase1.HelloRes, err error) {
	m := e.mctx
	defer m.CTrace("Kex2Provisionee#HandleHello", func() error { return err })()
	e.pps = harg.Pps
	res, err = e.handleHello(m, harg.Uid, harg.Token, harg.Csrf, harg.SigBody)
	return res, err
}

func (e *Kex2Provisionee) handleHello(m libkb.MetaContext, uid keybase1.UID, token keybase1.SessionToken, csrf keybase1.CsrfToken, sigBody string) (res keybase1.HelloRes, err error) {

	// save parts of the hello arg for later:
	e.uid = uid
	e.sessionToken = token
	e.csrfToken = csrf

	jw, err := jsonw.Unmarshal([]byte(sigBody))
	if err != nil {
		return res, err
	}

	// need the username later:
	e.username, err = jw.AtPath("body.key.username").GetString()
	if err != nil {
		return res, err
	}

	e.eddsa, err = libkb.GenerateNaclSigningKeyPair()
	if err != nil {
		return res, err
	}

	e.dh, err = libkb.GenerateNaclDHKeyPair()
	if err != nil {
		return res, err
	}

	ekLib := e.G().GetEKLib()
	if ekLib != nil {
		e.deviceEKSeed, err = ekLib.NewEphemeralSeed()
		if err != nil {
			return res, err
		}
	}

	if err = e.addDeviceSibkey(m, jw); err != nil {
		return res, err
	}

	if err = e.reverseSig(jw); err != nil {
		return res, err
	}

	out, err := jw.Marshal()
	if err != nil {
		return res, err
	}

	return keybase1.HelloRes(out), err
}

// HandleHello2 implements HandleHello2 in kex2.Provisionee.
func (e *Kex2Provisionee) HandleHello2(_ context.Context, harg keybase1.Hello2Arg) (res keybase1.Hello2Res, err error) {
	m := e.mctx
	defer m.CTrace("Kex2Provisionee#HandleHello2()", func() error { return err })()
	var res1 keybase1.HelloRes
	res1, err = e.handleHello(m, harg.Uid, harg.Token, harg.Csrf, harg.SigBody)
	if err != nil {
		return res, err
	}
	res.SigPayload = res1
	res.EncryptionKey = e.dh.GetKID()
	ekLib := e.G().GetEKLib()
	if ekLib != nil {
		ekPair := ekLib.DeriveDeviceDHKey(e.deviceEKSeed)
		res.DeviceEkKID = ekPair.GetKID()
	}
	return res, err
}

func (e *Kex2Provisionee) HandleDidCounterSign2(_ context.Context, arg keybase1.DidCounterSign2Arg) (err error) {
	mctx := e.mctx
	defer mctx.CTrace("Kex2Provisionee#HandleDidCounterSign2()", func() error { return err })()
	var ppsBytes []byte
	ppsBytes, _, err = e.dh.DecryptFromString(arg.PpsEncrypted)
	if err != nil {
		mctx.CDebugf("| Failed to decrypt pps: %s", err)
		return err
	}
	err = libkb.MsgpackDecode(&e.pps, ppsBytes)
	if err != nil {
		mctx.CDebugf("| Failed to unpack pps: %s", err)
		return err
	}
	return e.handleDidCounterSign(mctx, arg.Sig, arg.PukBox, arg.UserEkBox)
}

// HandleDidCounterSign implements HandleDidCounterSign in
// kex2.Provisionee interface.
func (e *Kex2Provisionee) HandleDidCounterSign(_ context.Context, sig []byte) (err error) {
	return e.handleDidCounterSign(e.mctx, sig, nil, nil)
}

func (e *Kex2Provisionee) handleDidCounterSign(m libkb.MetaContext, sig []byte, perUserKeyBox *keybase1.PerUserKeyBox, userEKBox *keybase1.UserEkBoxed) (err error) {

	defer m.CTrace("Kex2Provisionee#handleDidCounterSign()", func() error { return err })()

	// load self user (to load merkle root)
	m.CDebugf("| running for username %s", e.username)
	loadArg := libkb.NewLoadUserArgWithMetaContext(m).WithName(e.username)
	_, err = libkb.LoadUser(loadArg)
	if err != nil {
		return err
	}

	// decode sig
	decSig, err := e.decodeSig(sig)
	if err != nil {
		return err
	}

	// make a keyproof for the dh key, signed w/ e.eddsa
	dhSig, dhSigID, err := e.dhKeyProof(e.dh, decSig.eldestKID, decSig.seqno, decSig.linkID)
	if err != nil {
		return err
	}

	// create the key args for eddsa, dh keys
	eddsaArgs, err := makeKeyArgs(decSig.sigID, sig, libkb.DelegationTypeSibkey, e.eddsa, decSig.eldestKID, decSig.signingKID)
	if err != nil {
		return err
	}
	dhArgs, err := makeKeyArgs(dhSigID, []byte(dhSig), libkb.DelegationTypeSubkey, e.dh, decSig.eldestKID, e.eddsa.GetKID())
	if err != nil {
		return err
	}

	// logged in, so save the login state to temporary config file
	err = e.saveLoginState()
	if err != nil {
		return err
	}

	// push the LKS server half
	if err = e.pushLKSServerHalf(m); err != nil {
		return err
	}

	// save device keys locally
	if err = e.saveKeys(m); err != nil {
		return err
	}

	// Finish the ephemeral key generation -- create a deviceEKStatement and
	// prepare the boxMetadata for posting if we received a valid userEKBox
	deviceEKStatement, deviceEKStatementSig, userEKBoxMetadata, err := e.ephemeralKeygen(m, userEKBox)
	if err != nil {
		return err
	}

	// post the key sigs to the api server
	if err = e.postSigs(eddsaArgs, dhArgs, perUserKeyBox, userEKBoxMetadata, deviceEKStatementSig); err != nil {
		return err
	}

	// cache the device keys in memory
	if err = e.cacheKeys(m); err != nil {
		return err
	}

	// store the ephemeralkeys, if any. If this fails after we have posted the
	// client will no not have access to the userEK it was just reboxed for
	// unfortunately. Without any EKs, the normal generation machinery will
	// take over and they will make a new userEK
	return e.storeEKs(m, deviceEKStatement, userEKBox)
}

// saveLoginState stores the user's login state. The user config
// file is stored in a temporary location, since we're usually in a
// "config file transaction" at this point.
func (e *Kex2Provisionee) saveLoginState() error {
	lctx := e.mctx.LoginContext()
	if err := lctx.LoadLoginSession(e.username); err != nil {
		return err
	}
	return lctx.SaveState(string(e.sessionToken), string(e.csrfToken), libkb.NewNormalizedUsername(e.username), e.uid, e.device.ID)
}

type decodedSig struct {
	sigID      keybase1.SigID
	linkID     libkb.LinkID
	seqno      int
	eldestKID  keybase1.KID
	signingKID keybase1.KID
}

func (e *Kex2Provisionee) decodeSig(sig []byte) (*decodedSig, error) {
	body, err := base64.StdEncoding.DecodeString(string(sig))
	if err != nil {
		return nil, err
	}
	packet, err := libkb.DecodePacket(body)
	if err != nil {
		return nil, err
	}
	naclSig, ok := packet.Body.(*libkb.NaclSigInfo)
	if !ok {
		return nil, libkb.UnmarshalError{T: "Nacl signature"}
	}
	jw, err := jsonw.Unmarshal(naclSig.Payload)
	if err != nil {
		return nil, err
	}
	res := decodedSig{
		sigID:  libkb.ComputeSigIDFromSigBody(body),
		linkID: libkb.ComputeLinkID(naclSig.Payload),
	}
	res.seqno, err = jw.AtKey("seqno").GetInt()
	if err != nil {
		return nil, err
	}
	seldestKID, err := jw.AtPath("body.key.eldest_kid").GetString()
	if err != nil {
		return nil, err
	}
	res.eldestKID = keybase1.KIDFromString(seldestKID)
	ssigningKID, err := jw.AtPath("body.key.kid").GetString()
	if err != nil {
		return nil, err
	}
	res.signingKID = keybase1.KIDFromString(ssigningKID)

	return &res, nil
}

// GetName implements libkb.UserBasic interface.
func (e *Kex2Provisionee) GetName() string {
	return e.username
}

// GetUID implements libkb.UserBasic interface.
func (e *Kex2Provisionee) GetUID() keybase1.UID {
	return e.uid
}

// APIArgs implements libkb.SessionReader interface.
func (e *Kex2Provisionee) APIArgs() (token, csrf string) {
	return string(e.sessionToken), string(e.csrfToken)
}

// Invalidate implements libkb.SessionReader interface.
func (e *Kex2Provisionee) Invalidate() {
	e.sessionToken = ""
	e.csrfToken = ""
}

// IsLoggedIn implements libkb.SessionReader interface.  For the
// sake of kex2 provisionee, we are logged in because we have a
// session token.
func (e *Kex2Provisionee) IsLoggedIn() bool {
	return true
}

// Logout implements libkb.SessionReader interface.  Noop.
func (e *Kex2Provisionee) Logout() error {
	return nil
}

// Device returns the new device struct.
func (e *Kex2Provisionee) Device() *libkb.Device {
	return e.device
}

func (e *Kex2Provisionee) addDeviceSibkey(m libkb.MetaContext, jw *jsonw.Wrapper) error {
	if e.device.Description == nil {
		// should not get in here with change to login_provision.go
		// deviceWithType that is prompting for device name before
		// starting this engine, but leaving the code here just
		// as a safety measure.

		m.CDebugf("kex2 provisionee: device name (e.device.Description) is nil. It should be set by caller.")
		m.CDebugf("kex2 provisionee: proceeding to prompt user for device name, but figure out how this happened...")

		// need user to get existing device names
		loadArg := libkb.NewLoadUserArgWithMetaContext(m).WithName(e.username)
		user, err := libkb.LoadUser(loadArg)
		if err != nil {
			return err
		}
		existingDevices, err := user.DeviceNames()
		if err != nil {
			m.CDebugf("proceeding despite error getting existing device names: %s", err)
		}

		e.G().Log.Debug("kex2 provisionee: prompting for device name")
		arg := keybase1.PromptNewDeviceNameArg{
			ExistingDevices: existingDevices,
		}
		name, err := m.UIs().ProvisionUI.PromptNewDeviceName(m.Ctx(), arg)
		if err != nil {
			return err
		}
		e.device.Description = &name
		m.CDebugf("kex2 provisionee: got device name: %q", name)
	}

	s := libkb.DeviceStatusActive
	e.device.Status = &s
	e.device.Kid = e.eddsa.GetKID()
	dw, err := e.device.Export(libkb.LinkType(libkb.DelegationTypeSibkey))
	if err != nil {
		return err
	}
	jw.SetValueAtPath("body.device", dw)

	return jw.SetValueAtPath("body.sibkey.kid", jsonw.NewString(e.eddsa.GetKID().String()))
}

func (e *Kex2Provisionee) reverseSig(jw *jsonw.Wrapper) error {
	// need to set reverse_sig to nil before making reverse sig:
	if err := jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewNil()); err != nil {
		return err
	}

	sig, _, _, err := libkb.SignJSON(jw, e.eddsa)
	if err != nil {
		return err
	}

	// put the signature in reverse_sig
	return jw.SetValueAtPath("body.sibkey.reverse_sig", jsonw.NewString(sig))
}

// postSigs takes the HTTP args for the signing key and encrypt
// key and posts them to the api server.
func (e *Kex2Provisionee) postSigs(signingArgs, encryptArgs *libkb.HTTPArgs, perUserKeyBox *keybase1.PerUserKeyBox,
	userEKBoxMetadata *keybase1.UserEkBoxMetadata, deviceEKStatementSig string) error {
	payload := make(libkb.JSONPayload)
	payload["sigs"] = []map[string]string{firstValues(signingArgs.ToValues()), firstValues(encryptArgs.ToValues())}

	// Post the per-user-secret encrypted for the provisionee device by the provisioner.
	if perUserKeyBox != nil {
		libkb.AddPerUserKeyServerArg(payload, perUserKeyBox.Generation, []keybase1.PerUserKeyBox{*perUserKeyBox}, nil)
	}

	if userEKBoxMetadata != nil { // if we don't have a userEKBox, we won't make a deviceEKStatement
		payload["device_eks"] = map[string]string{string(e.device.ID): deviceEKStatementSig}
		payload["user_ek_rebox"] = *userEKBoxMetadata
	}

	arg := libkb.APIArg{
		Endpoint:    "key/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
		SessionR:    e,
	}

	_, err := e.G().API.PostJSON(arg)
	return err
}

func makeKeyArgs(sigID keybase1.SigID, sig []byte, delType libkb.DelegationType, key libkb.GenericKey, eldestKID, signingKID keybase1.KID) (*libkb.HTTPArgs, error) {
	pub, err := key.Encode()
	if err != nil {
		return nil, err
	}
	args := libkb.HTTPArgs{
		"sig_id_base":     libkb.S{Val: sigID.ToString(false)},
		"sig_id_short":    libkb.S{Val: sigID.ToShortID()},
		"sig":             libkb.S{Val: string(sig)},
		"type":            libkb.S{Val: string(delType)},
		"is_remote_proof": libkb.B{Val: false},
		"public_key":      libkb.S{Val: pub},
		"eldest_kid":      libkb.S{Val: eldestKID.String()},
		"signing_kid":     libkb.S{Val: signingKID.String()},
	}
	return &args, nil
}

func (e *Kex2Provisionee) dhKeyProof(dh libkb.GenericKey, eldestKID keybase1.KID, seqno int, linkID libkb.LinkID) (sig string, sigID keybase1.SigID, err error) {
	delg := libkb.Delegator{
		ExistingKey:    e.eddsa,
		NewKey:         dh,
		DelegationType: libkb.DelegationTypeSubkey,
		Expire:         libkb.NaclDHExpireIn,
		EldestKID:      eldestKID,
		Device:         e.device,
		Seqno:          keybase1.Seqno(seqno) + 1,
		PrevLinkID:     linkID,
		SigningUser:    e,
		Contextified:   libkb.NewContextified(e.G()),
	}

	jw, err := libkb.KeyProof(delg)
	if err != nil {
		return "", "", err
	}

	e.G().Log.Debug("dh key proof: %s", jw.MarshalPretty())

	dhSig, dhSigID, _, err := libkb.SignJSON(jw, e.eddsa)
	if err != nil {
		return "", "", err
	}

	return dhSig, dhSigID, nil

}

func (e *Kex2Provisionee) pushLKSServerHalf(m libkb.MetaContext) error {
	// make new lks
	ppstream := libkb.NewPassphraseStream(e.pps.PassphraseStream)
	ppstream.SetGeneration(libkb.PassphraseGeneration(e.pps.Generation))
	e.lks = libkb.NewLKSec(ppstream, e.uid, e.G())
	e.lks.GenerateServerHalf()

	// make client half recovery
	chrKID := e.dh.GetKID()
	chrText, err := e.lks.EncryptClientHalfRecovery(e.dh)
	if err != nil {
		return err
	}

	err = libkb.PostDeviceLKS(m.Ctx(), m.G(), e, e.device.ID, e.device.Type, e.lks.GetServerHalf(), e.lks.Generation(), chrText, chrKID)
	if err != nil {
		return err
	}

	// Sync the LKS stuff back from the server, so that subsequent
	// attempts to use public key login will work.
	err = m.LoginContext().RunSecretSyncer(e.uid)
	if err != nil {
		return err
	}

	// Cache the passphrase stream.  Note that we don't have the triplesec
	// portion of the stream cache, and that the only bytes in ppstream
	// are the lksec portion (no pwhash, eddsa, dh).  Currently passes
	// all tests with this situation and code that uses those portions
	// looks to be ok.
	m.LoginContext().CreateStreamCache(nil, ppstream)

	return nil
}

// saveKeys writes the device keys to LKSec.
func (e *Kex2Provisionee) saveKeys(m libkb.MetaContext) error {
	_, err := libkb.WriteLksSKBToKeyring(m, e.eddsa, e.lks)
	if err != nil {
		return err
	}
	_, err = libkb.WriteLksSKBToKeyring(m, e.dh, e.lks)
	if err != nil {
		return err
	}
	return nil
}

func (e *Kex2Provisionee) ephemeralKeygen(m libkb.MetaContext, userEKBox *keybase1.UserEkBoxed) (deviceEKStatement keybase1.DeviceEkStatement, deviceEKStatementSig string, userEKBoxMetadata *keybase1.UserEkBoxMetadata, err error) {
	defer m.CTrace("ephemeralKeygen", func() error { return err })()

	if userEKBox == nil { // We will create EKs after provisioning in the normal way
		m.CDebugf("userEKBox nil, no ephemeral keys created during provisioning")
		return deviceEKStatement, deviceEKStatementSig, nil, nil
	}

	ekLib := e.G().GetEKLib()
	if ekLib == nil {
		m.CDebugf("ekLib missing from G. Aborting ephemeralKeygen")
		return deviceEKStatement, deviceEKStatementSig, nil, nil
	}

	signingKey, err := e.SigningKey()
	if err != nil {
		return deviceEKStatement, deviceEKStatementSig, nil, err
	}

	deviceEKStatement, deviceEKStatementSig, err = ekLib.SignedDeviceEKStatementFromSeed(m.Ctx(), userEKBox.DeviceEkGeneration, e.deviceEKSeed, signingKey, []keybase1.DeviceEkMetadata{})
	if err != nil {
		return deviceEKStatement, deviceEKStatementSig, nil, err
	}

	userEKBoxMetadata = &keybase1.UserEkBoxMetadata{
		Box:                 userEKBox.Box,
		RecipientDeviceID:   e.device.ID,
		RecipientGeneration: userEKBox.DeviceEkGeneration,
	}

	return deviceEKStatement, deviceEKStatementSig, userEKBoxMetadata, err
}

// cacheKeys caches the device keys in the Account object.
func (e *Kex2Provisionee) cacheKeys(m libkb.MetaContext) (err error) {
	defer m.CTrace("Kex2Provisionee.cacheKeys", func() error { return err })()
	if e.eddsa == nil {
		return errors.New("cacheKeys called, but eddsa key is nil")
	}
	if e.dh == nil {
		return errors.New("cacheKeys called, but dh key is nil")
	}

	if err = m.LoginContext().SetCachedSecretKey(libkb.SecretKeyArg{KeyType: libkb.DeviceSigningKeyType}, e.eddsa, e.device); err != nil {
		return err
	}

	return m.LoginContext().SetCachedSecretKey(libkb.SecretKeyArg{KeyType: libkb.DeviceEncryptionKeyType}, e.dh, e.device)
}

func (e *Kex2Provisionee) storeEKs(m libkb.MetaContext, deviceEKStatement keybase1.DeviceEkStatement, userEKBox *keybase1.UserEkBoxed) (err error) {
	defer m.CTrace("Kex2Provisionee.storeEKs", func() error { return err })()
	ekLib := e.G().GetEKLib()
	if ekLib == nil || !ekLib.ShouldRun(m.Ctx()) {
		return nil
	}
	if userEKBox == nil {
		m.CDebugf("userEKBox nil, no ephemeral keys to store")
		return nil
	}

	deviceEKStorage := m.G().GetDeviceEKStorage()
	metadata := deviceEKStatement.CurrentDeviceEkMetadata
	err = deviceEKStorage.Put(m.Ctx(), metadata.Generation, keybase1.DeviceEk{
		Seed:     e.deviceEKSeed,
		Metadata: metadata,
	})
	if err != nil {
		return err
	}

	userEKBoxStorage := m.G().GetUserEKBoxStorage()
	return userEKBoxStorage.Put(m.Ctx(), userEKBox.Metadata.Generation, *userEKBox)
}

func (e *Kex2Provisionee) SigningKey() (libkb.GenericKey, error) {
	if e.eddsa == nil {
		return nil, errors.New("provisionee missing signing key")
	}
	return e.eddsa, nil
}

func (e *Kex2Provisionee) EncryptionKey() (libkb.NaclDHKeyPair, error) {
	if e.dh == nil {
		return libkb.NaclDHKeyPair{}, errors.New("provisionee missing encryption key")
	}
	ret, ok := e.dh.(libkb.NaclDHKeyPair)
	if !ok {
		return libkb.NaclDHKeyPair{}, fmt.Errorf("provisionee encryption key unexpected type %T", e.dh)
	}
	return ret, nil
}

func firstValues(vals url.Values) map[string]string {
	res := make(map[string]string)
	for k, v := range vals {
		res[k] = v[0]
	}
	return res
}
