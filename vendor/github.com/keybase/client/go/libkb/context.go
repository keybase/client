package libkb

import (
	"fmt"
	"time"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type MetaContext struct {
	ctx          context.Context
	g            *GlobalContext
	loginContext LoginContext
	activeDevice *ActiveDevice
	uis          UIs
}

func (m MetaContext) Dump() {
	m.CDebugf("MetaContext#Dump:")
	if m.activeDevice != nil {
		m.CDebugf("- Local ActiveDevice:")
		m.activeDevice.Dump(m, "-- ")
	}
	m.CDebugf("- Global ActiveDevice:")
	m.g.ActiveDevice.Dump(m, "-- ")
	if m.loginContext != nil {
		m.CDebugf("- Login Context:")
		m.loginContext.Dump(m, "-- ")
	}
}

func NewMetaContext(ctx context.Context, g *GlobalContext) MetaContext {
	return MetaContext{ctx: ctx, g: g}
}

func (m MetaContext) WithLoginContext(l LoginContext) MetaContext {
	m.loginContext = l
	return m
}

func (m MetaContext) WithCtx(c context.Context) MetaContext {
	m.ctx = c
	return m
}

func (m MetaContext) G() *GlobalContext {
	return m.g
}

func (m MetaContext) Ctx() context.Context {
	return m.ctx
}

func (m MetaContext) LoginContext() LoginContext {
	return m.loginContext
}

func (m MetaContext) CTrace(msg string, f func() error) func() {
	return CTrace(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f)
}

func (m MetaContext) CVTrace(lev VDebugLevel, msg string, f func() error) func() {
	return m.g.CVTrace(m.ctx, lev, msg, f)
}

func (m MetaContext) VLogf(lev VDebugLevel, msg string, args ...interface{}) {
	m.g.VDL.CLogfWithAddedDepth(m.ctx, lev, 1, msg, args...)
}

func (m MetaContext) CTraceTimed(msg string, f func() error) func() {
	return CTraceTimed(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f, m.G().Clock())
}
func (m MetaContext) CTraceOK(msg string, f func() bool) func() {
	return CTraceOK(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f)
}

func (m MetaContext) CDebugf(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CDebugf(m.ctx, f, args...)
}
func (m MetaContext) CWarningf(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CWarningf(m.ctx, f, args...)
}
func (m MetaContext) CErrorf(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CErrorf(m.ctx, f, args...)
}
func (m MetaContext) CInfof(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CInfof(m.ctx, f, args...)
}

func (m MetaContext) ActiveDevice() *ActiveDevice {
	if m.activeDevice != nil {
		m.CDebugf("MetaContext#ActiveDevice: thread local")
		return m.activeDevice
	}
	m.CDebugf("MetaContext#ActiveDevice: global")
	return m.G().ActiveDevice
}

func NewMetaContextTODO(g *GlobalContext) MetaContext {
	return MetaContext{ctx: context.TODO(), g: g}
}
func NewMetaContextBackground(g *GlobalContext) MetaContext {
	return MetaContext{ctx: context.Background(), g: g}
}

func (m MetaContext) WithDelegatedIdentifyUI(u IdentifyUI) MetaContext {
	m.uis.IdentifyUI = u
	m.uis.IdentifyUIIsDelegated = true
	return m
}

func (m MetaContext) WithContextCancel() (MetaContext, func()) {
	var f func()
	m.ctx, f = context.WithCancel(m.ctx)
	return m, f
}

func (m MetaContext) BackgroundWithCancel() (MetaContext, func()) {
	var f func()
	m.ctx, f = context.WithCancel(context.Background())
	return m, f
}

func (m MetaContext) BackgroundWithLogTags() MetaContext {
	m.ctx = CopyTagsToBackground(m.ctx)
	return m
}

func (m MetaContext) WithTimeout(timeout time.Duration) (MetaContext, func()) {
	var f func()
	m.ctx, f = context.WithTimeout(m.ctx, timeout)
	return m, f
}

func (m MetaContext) WithLogTag(k string) MetaContext {
	m.ctx = WithLogTag(m.ctx, k)
	return m
}

func (m MetaContext) EnsureCtx() MetaContext {
	if m.ctx == nil {
		m.ctx = context.Background()
		m.CDebugf("installing background context.Context")
	}
	return m
}

func (m MetaContext) WithSecretUI(u SecretUI) MetaContext {
	m.uis.SecretUI = u
	return m
}

func (m MetaContext) WithLogUI(u LogUI) MetaContext {
	m.uis.LogUI = u
	return m
}

func (m MetaContext) WithPgpUI(u PgpUI) MetaContext {
	m.uis.PgpUI = u
	return m
}

func (m MetaContext) WithIdentifyUI(u IdentifyUI) MetaContext {
	m.uis.IdentifyUI = u
	return m
}

func (m MetaContext) WithGPGUI(u GPGUI) MetaContext {
	m.uis.GPGUI = u
	return m
}

func (m MetaContext) WithSaltpackUI(s SaltpackUI) MetaContext {
	m.uis.SaltpackUI = s
	return m
}

func (m MetaContext) UIs() UIs {
	return m.uis
}

func (m MetaContext) WithUIs(u UIs) MetaContext {
	m.uis = u
	return m
}

func (m MetaContext) WithActiveDevice(a *ActiveDevice) MetaContext {
	m.activeDevice = a
	return m
}

func (m MetaContext) WithPaperKeyActiveDevice(d *DeviceWithKeys, u keybase1.UID) MetaContext {
	return m.WithActiveDevice(d.ToPaperKeyActiveDevice(m, u))
}

func (m MetaContext) WithGlobalActiveDevice() MetaContext {
	m.activeDevice = nil
	return m
}

func (m MetaContext) SecretKeyPromptArg(ska SecretKeyArg, reason string) SecretKeyPromptArg {
	return SecretKeyPromptArg{
		SecretUI: m.uis.SecretUI,
		Ska:      ska,
		Reason:   reason,
	}
}

func (m MetaContext) WithNewProvisionalLoginContext() MetaContext {
	return m.WithLoginContext(newProvisionalLoginContext(m))
}

func (m MetaContext) WithNewProvisionalLoginContextForUser(u *User) MetaContext {
	return m.WithNewProvisionalLoginContextForUIDAndUsername(u.GetUID(), u.GetNormalizedName())
}

func (m MetaContext) WithNewProvisionalLoginContextForUIDAndUsername(uid keybase1.UID, un NormalizedUsername) MetaContext {
	plc := newProvisionalLoginContextWithUIDAndUsername(m, uid, un)
	m.ActiveDevice().CopyCacheToLoginContextIfForUID(m, plc, uid)
	return m.WithLoginContext(plc)
}

func (m MetaContext) CommitProvisionalLogin() MetaContext {
	m.CDebugf("MetaContext#CommitProvisionalLogin")
	lctx := m.loginContext
	m.loginContext = nil
	if lctx != nil {
		if ppsc := lctx.PassphraseStreamCache(); ppsc != nil {
			m.ActiveDevice().CachePassphraseStream(ppsc)
		}
	}
	return m
}

type UIs struct {
	GPGUI       GPGUI
	LogUI       LogUI
	LoginUI     LoginUI
	SecretUI    SecretUI
	IdentifyUI  IdentifyUI
	PgpUI       PgpUI
	ProveUI     ProveUI
	ProvisionUI ProvisionUI
	SaltpackUI  SaltpackUI

	// Usually set to `NONE`, meaning none specified.
	// But if we know it, specify the end client type here
	// since some things like GPG shell-out work differently
	// depending.
	ClientType keybase1.ClientType

	// Special-case flag for identifyUI -- if it's been delegated
	// to the electron UI, then it's rate-limitable
	IdentifyUIIsDelegated bool

	SessionID int
}

func (e UIs) HasUI(kind UIKind) bool {
	switch kind {
	case GPGUIKind:
		return e.GPGUI != nil
	case LogUIKind:
		return e.LogUI != nil
	case LoginUIKind:
		return e.LoginUI != nil
	case SecretUIKind:
		return e.SecretUI != nil
	case IdentifyUIKind:
		return e.IdentifyUI != nil
	case PgpUIKind:
		return e.PgpUI != nil
	case ProveUIKind:
		return e.ProveUI != nil
	case ProvisionUIKind:
		return e.ProvisionUI != nil
	case SaltpackUIKind:
		return e.SaltpackUI != nil
	}
	panic(fmt.Sprintf("unhandled kind: %d", kind))
}

type MetaContextified struct {
	m MetaContext
}

func (m MetaContextified) M() MetaContext {
	return m.m
}

func (m MetaContextified) G() *GlobalContext {
	return m.m.g
}

func NewMetaContextified(m MetaContext) MetaContextified {
	return MetaContextified{m: m}
}

// SwitchUserNewConfig switches the global active "user" as far as the global config file is concerned.
// It switches the user to a new user, and therefore you should specify the username, salt, and device ID
// for this user on this device. It will take out the global `switchUserMu` and also clear out the
// global ActiveDevice at the same time. We follow the same pattern here and elsewhere: atomically
// mutate the `current_user` of the config file as we set the global ActiveDevice.
func (m MetaContext) SwitchUserNewConfig(u keybase1.UID, n NormalizedUsername, salt []byte, d keybase1.DeviceID) error {
	return m.switchUserNewConfig(u, n, salt, d, nil)
}

func (m MetaContext) switchUserNewConfig(u keybase1.UID, n NormalizedUsername, salt []byte, d keybase1.DeviceID, ad *ActiveDevice) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	// Note that `true` here means that an existing user config entry will
	// be overwritten.
	err := cw.SetUserConfig(NewUserConfig(u, n, salt, d), true /* overwrite */)
	if err != nil {
		return err
	}
	g.ActiveDevice.SetOrClear(m, ad)
	return nil
}

// SwitchUserNewConfigActiveDevice creates a new config file stanza and an active device
// for the given user, all while holding the switchUserMu lock.
func (m MetaContext) SwitchUserNewConfigActiveDevice(u keybase1.UID, n NormalizedUsername, salt []byte, d keybase1.DeviceID, sigKey GenericKey, encKey GenericKey, deviceName string) error {
	ad := NewProvisionalActiveDevice(m, u, d, sigKey, encKey, deviceName)
	return m.switchUserNewConfig(u, n, salt, d, ad)
}

// SwitchUserNukeConfig removes the given username from the config file, and then switches
// to not having a current user (by clearing the ActiveDevice, etc). It does this in a critical
// section, holding switchUserMu.
func (m MetaContext) SwitchUserNukeConfig(n NormalizedUsername) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	cr := g.Env.GetConfig()
	if cw == nil {
		return NoConfigWriterError{}
	}
	if cr == nil {
		return NoConfigFileError{}
	}
	uid := cr.GetUIDForUsername(n)
	err := cw.NukeUser(n)
	if err != nil {
		return err
	}
	if g.ActiveDevice.UID().Equal(uid) {
		g.ActiveDevice.Clear(nil)
	}
	return nil
}

func (m MetaContext) SwitchUser(n NormalizedUsername) error {
	return m.SwitchUserToActiveDevice(n, nil)
}

func (m MetaContext) SwitchUserToActiveDevice(n NormalizedUsername, ad *ActiveDevice) (err error) {

	defer m.CTrace(fmt.Sprintf("MetaContext#SwitchUserToActiveDevice(%s,ActiveDevice:%v)", n.String(), (ad != nil)), func() error { return err })()

	g := m.G()
	if n.IsNil() {
		return nil
	}
	if err = n.CheckValid(); err != nil {
		return err
	}
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	err = cw.SwitchUser(n)
	if _, ok := err.(UserNotFoundError); ok {
		m.CDebugf("| No user %s found; clearing out config", n)
		err = nil
	}
	if err != nil {
		return err
	}
	err = g.ActiveDevice.SetOrClear(m, ad)
	if err != nil {
		return err
	}
	m.CommitProvisionalLogin()

	return nil
}

func (m MetaContext) SwitchUserDeprovisionNukeConfig(username NormalizedUsername) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()

	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	if err := cw.NukeUser(username); err != nil {
		return err
	}

	// The config entries we just nuked could still be in memory. Clear them.
	return cw.SetUserConfig(nil, true /* overwrite; ignored */)
}

// SetActiveOneshotDevice acquires the switchUserMu mutex, setting the active device
// to one that corresponds to the given UID and DeviceWithKeys, and also sets the config
// file to a temporary in-memory config (not writing to disk) to satisfy local requests for
// g.Env.*
func (m MetaContext) SwitchUserToActiveOneshotDevice(uid keybase1.UID, nun NormalizedUsername, d *DeviceWithKeys) (err error) {
	defer m.CTrace("MetaContext#SwitchUserToActiveOneshotDevice", func() error { return err })()

	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	ad := d.ToPaperKeyActiveDevice(m, uid)
	err = g.ActiveDevice.Copy(m, ad)
	if err != nil {
		return err
	}
	uc := NewOneshotUserConfig(uid, nun, nil, d.DeviceID())
	err = cw.SetUserConfig(uc, false)
	if err != nil {
		return err
	}
	return nil
}

// SiwtchUserLoggedOut clears the active device and the current_user stanza
// of the config file, all while holding the switchUserMu
func (m MetaContext) SwitchUserLoggedOut() (err error) {
	defer m.CTrace("MetaContext#SwitchUserLoggedOut", func() error { return err })()
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	g.ActiveDevice.Clear(nil)
	err = cw.SetUserConfig(nil, false)
	if err != nil {
		return err
	}
	return nil
}

// SetActiveDevice sets the active device to have the UID, deviceID, sigKey, encKey and deviceName
// as specified, and does so while grabbing the global switchUser lock, since it should be sycnhronized
// with attempts to switch the global logged in user. It does not, however, change the `current_user`
// in the config file, or edit the global config file in any way.
func (m MetaContext) SetActiveDevice(uid keybase1.UID, deviceID keybase1.DeviceID, sigKey, encKey GenericKey, deviceName string) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	if !g.Env.GetUID().Equal(uid) {
		return NewUIDMismatchError("UID switched out from underneath provisioning process")
	}
	err := g.ActiveDevice.Set(m, uid, deviceID, sigKey, encKey, deviceName)
	if err != nil {
		return err
	}
	return nil
}

func (m MetaContext) SetSigningKey(uid keybase1.UID, deviceID keybase1.DeviceID, sigKey GenericKey, deviceName string) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	return g.ActiveDevice.setSigningKey(g, nil, uid, deviceID, sigKey, deviceName)
}

func (m MetaContext) SetEncryptionKey(uid keybase1.UID, deviceID keybase1.DeviceID, encKey GenericKey) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	return g.ActiveDevice.setEncryptionKey(nil, uid, deviceID, encKey)
}

// LogoutAndDeprovisionIfRevoked loads the user and checks if the current
// device keys have been revoked. If so, it calls Logout and then runs the
// ClearSecretsOnDeprovision
func (m MetaContext) LogoutAndDeprovisionIfRevoked() (err error) {
	m = m.WithLogTag("LOIR")

	defer m.CTrace("GlobalContext#LogoutAndDeprovisionIfRevoked", func() error { return err })()

	if !m.ActiveDevice().Valid() {
		m.CDebugf("LogoutAndDeprovisionIfRevoked: skipping check (not logged in)")
		return nil
	}

	if m.G().Env.GetSkipLogoutIfRevokedCheck() {
		m.CDebugf("LogoutAndDeprovisionIfRevoked: skipping check (SkipLogoutIfRevokedCheck)")
		return nil
	}

	doLogout := false
	err = CheckCurrentUIDDeviceID(m)
	switch err.(type) {
	case nil:
		m.CDebugf("LogoutAndDeprovisionIfRevoked: current device ok")
	case DeviceNotFoundError:
		m.CDebugf("LogoutAndDeprovisionIfRevoked: device not found error; user was likely reset; calling logout (%s)", err)
		doLogout = true
	case KeyRevokedError:
		m.CDebugf("LogoutAndDeprovisionIfRevoked: key revoked error error; device was revoked; calling logout (%s)", err)
		doLogout = true
	default:
		m.CDebugf("LogoutAndDeprovisionIfRevoked: non-actionable error: %s", err)
	}

	if doLogout {
		username := m.G().Env.GetUsername()
		if err := m.G().Logout(); err != nil {
			return err
		}
		return ClearSecretsOnDeprovision(m, username)
	}

	return nil
}

func (m MetaContext) PassphraseStream() *PassphraseStream {
	if m.LoginContext() != nil {
		if m.LoginContext().PassphraseStreamCache() == nil {
			return nil
		}
		return m.LoginContext().PassphraseStreamCache().PassphraseStream()
	}
	return m.ActiveDevice().PassphraseStream()
}

func (m MetaContext) PassphraseStreamAndTriplesec() (*PassphraseStream, Triplesec) {
	var ppsc *PassphraseStreamCache
	if m.LoginContext() != nil {
		ppsc = m.LoginContext().PassphraseStreamCache()
	} else {
		ppsc = m.ActiveDevice().PassphraseStreamCache()
	}
	if ppsc == nil {
		return nil, nil
	}
	return ppsc.PassphraseStreamAndTriplesec()
}

func (m MetaContext) TriplesecAndGeneration() (ret Triplesec, ppgen PassphraseGeneration) {
	var pps *PassphraseStream
	pps, ret = m.PassphraseStreamAndTriplesec()
	if pps == nil {
		return nil, ppgen
	}
	ppgen = pps.Generation()
	if ppgen.IsNil() {
		return nil, ppgen
	}
	return ret, ppgen
}

func (m MetaContext) CurrentUsername() NormalizedUsername {
	if m.LoginContext() != nil {
		return m.LoginContext().GetUsername()
	}
	return m.ActiveDevice().Username(m)
}

func (m MetaContext) CurrentUID() keybase1.UID {
	if m.LoginContext() != nil {
		return m.LoginContext().GetUID()
	}
	return m.ActiveDevice().UID()
}

func (m MetaContext) HasAnySession() (ret bool) {
	defer m.CTraceOK("MetaContext#HasAnySession", func() bool { return ret })()
	if m.LoginContext() != nil {
		ok, _ := m.LoginContext().LoggedInLoad()
		if ok {
			m.CDebugf("| has temporary login session")
			return true
		}
	}

	if m.ActiveDevice().Valid() {
		m.CDebugf("| has valid device")
		return true
	}

	return false
}

func (m MetaContext) SyncSecrets() (ss *SecretSyncer, err error) {
	defer m.CTrace("MetaContext#SyncSecrets", func() error { return err })()
	if m.LoginContext() != nil {
		err = m.LoginContext().RunSecretSyncer(m, keybase1.UID(""))
		if err != nil {
			return nil, err
		}
		return m.LoginContext().SecretSyncer(), nil
	}
	return m.ActiveDevice().SyncSecrets(m)
}

func (m MetaContext) SyncSecretsForUID(u keybase1.UID) (ss *SecretSyncer, err error) {
	defer m.CTrace("MetaContext#SyncSecrets", func() error { return err })()
	return m.ActiveDevice().SyncSecretsForUID(m, u)
}

func (m MetaContext) ProvisionalSessionArgs() (token string, csrf string) {
	if m.LoginContext() == nil {
		return "", ""
	}
	sess := m.LoginContext().LocalSession()
	if sess == nil || !sess.IsValid() {
		return "", ""
	}
	return sess.token, sess.csrf
}

func (m MetaContext) Keyring() (ret *SKBKeyringFile, err error) {
	defer m.CTrace("MetaContext#Keyring", func() error { return err })()
	if m.LoginContext() != nil {
		return m.LoginContext().Keyring(m)
	}
	return m.ActiveDevice().Keyring(m)
}
