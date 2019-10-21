package libkb

import (
	"fmt"
	"time"

	logger "github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/profiling"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type APITokener interface {
	Tokens() (session, csrf string)
}

type MetaContext struct {
	ctx          context.Context
	g            *GlobalContext
	loginContext LoginContext
	activeDevice *ActiveDevice
	apiTokener   APITokener
	uis          UIs
}

func (m MetaContext) Dump() {
	m.Debug("MetaContext#Dump:")
	if m.activeDevice != nil {
		m.Debug("- Local ActiveDevice:")
		m.activeDevice.Dump(m, "-- ")
	}
	m.Debug("- Global ActiveDevice:")
	m.g.ActiveDevice.Dump(m, "-- ")
	if m.loginContext != nil {
		m.Debug("- Login Context:")
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

func (m MetaContext) WithAPITokener(t APITokener) MetaContext {
	m.apiTokener = t
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

func (m MetaContext) Trace(msg string, f func() error) func() {
	return CTrace(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f)
}

func (m MetaContext) CTraceString(msg string, f func() string) func() {
	return CTraceString(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f)
}

func (m MetaContext) VTrace(lev VDebugLevel, msg string, f func() error) func() {
	return m.g.CVTrace(m.ctx, lev, msg, f)
}
func (m MetaContext) VTraceOK(lev VDebugLevel, msg string, f func() bool) func() {
	return m.g.CVTraceOK(m.ctx, lev, msg, f)
}

func (m MetaContext) VLogf(lev VDebugLevel, msg string, args ...interface{}) {
	m.g.VDL.CLogfWithAddedDepth(m.ctx, lev, 1, msg, args...)
}

func (m MetaContext) TraceTimed(msg string, f func() error) func() {
	return CTraceTimed(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f, m.G().Clock())
}
func (m MetaContext) TraceOK(msg string, f func() bool) func() {
	return CTraceOK(m.ctx, m.g.Log.CloneWithAddedDepth(1), msg, f)
}
func (m MetaContext) TimeBuckets() (MetaContext, *profiling.TimeBuckets) {
	var ret *profiling.TimeBuckets
	m.ctx, ret = m.G().CTimeBuckets(m.ctx)
	return m, ret
}
func (m MetaContext) TimeTracer(label string, enabled bool) profiling.TimeTracer {
	return m.G().CTimeTracer(m.Ctx(), label, enabled)
}

func (m MetaContext) Debug(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CDebugf(m.ctx, f, args...)
}
func (m MetaContext) Warning(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CWarningf(m.ctx, f, args...)
}
func (m MetaContext) Error(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CErrorf(m.ctx, f, args...)
}
func (m MetaContext) Info(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CInfof(m.ctx, f, args...)
}
func (m MetaContext) ExitTraceOK(msg string, f func() bool) func() {
	return func() { m.Debug("| %s -> %v", msg, f()) }
}

func (m MetaContext) ActiveDevice() *ActiveDevice {
	if m.activeDevice != nil {
		m.Debug("MetaContext#ActiveDevice: thread local")
		return m.activeDevice
	}
	m.Debug("MetaContext#ActiveDevice: global")
	return m.G().ActiveDevice
}

func (m MetaContext) NIST() (*NIST, error) {
	nist, uid, _, err := m.ActiveDevice().NISTAndUIDDeviceID(m.Ctx())
	if err != nil {
		return nil, err
	}
	if !uid.Equal(m.CurrentUID()) {
		m.Debug("MetaContext#NIST: Not returning nist, since for wrong UID: %s != %s", uid, m.CurrentUID())
		return nil, nil
	}
	return nist, nil
}

func NewMetaContextTODO(g *GlobalContext) MetaContext {
	return MetaContext{ctx: context.TODO(), g: g}
}
func NewMetaContextBackground(g *GlobalContext) MetaContext {
	return MetaContext{ctx: context.Background(), g: g}
}

func (m MetaContext) WithDelegatedIdentifyUI(u IdentifyUI) MetaContext {
	m.uis.IdentifyUI = u
	return m
}

func (m MetaContext) WithContext(ctx context.Context) MetaContext {
	m.ctx = ctx
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

func (m MetaContext) WithTimeBuckets() (MetaContext, *profiling.TimeBuckets) {
	ctx, tbs := m.G().CTimeBuckets(m.ctx)
	m.ctx = ctx
	return m, tbs
}

func (m MetaContext) EnsureCtx() MetaContext {
	if m.ctx == nil {
		m.ctx = context.Background()
		m.Debug("installing background context.Context")
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

func (m MetaContext) WithProvisioningKeyActiveDevice(d *DeviceWithKeys, uv keybase1.UserVersion) MetaContext {
	return m.WithActiveDevice(d.ToProvisioningKeyActiveDevice(m, uv))
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
	return m.WithNewProvisionalLoginContextForUserVersionAndUsername(u.ToUserVersion(), u.GetNormalizedName())
}

func (m MetaContext) WithNewProvisionalLoginContextForUserVersionAndUsername(uv keybase1.UserVersion, un NormalizedUsername) MetaContext {
	plc := newProvisionalLoginContextWithUserVersionAndUsername(m, uv, un)
	err := m.ActiveDevice().CopyCacheToLoginContextIfForUserVersion(m, plc, uv)
	if err != nil {
		m.Debug("WithNewProvisionalLoginContextForUserVersionAndUsername: error %+v", err)
	}
	return m.WithLoginContext(plc)
}

func (m MetaContext) CommitProvisionalLogin() MetaContext {
	m.Debug("MetaContext#CommitProvisionalLogin")
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

// SwitchUserNewConfig switches the global active "user" as far as the global
// config file is concerned.  It switches the user to a new user, and therefore
// you should specify the username, salt, and device ID for this user on this
// device. It will take out the global `switchUserMu` and also clear out the
// global ActiveDevice at the same time. We follow the same pattern here and
// elsewhere: atomically mutate the `current_user` of the config file as we set
// the global ActiveDevice.
func (m MetaContext) SwitchUserNewConfig(u keybase1.UID, n NormalizedUsername, salt []byte, d keybase1.DeviceID) error {
	return m.switchUserNewConfig(u, n, salt, d, nil)
}

func (m MetaContext) switchUserNewConfig(u keybase1.UID, n NormalizedUsername, salt []byte, d keybase1.DeviceID, ad *ActiveDevice) error {
	g := m.G()
	defer g.switchUserMu.Acquire(m, "switchUserNewConfig")()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	// Note that `true` here means that an existing user config entry will
	// be overwritten.
	if err := cw.SetUserConfig(NewUserConfig(u, n, salt, d), true /* overwrite */); err != nil {
		return err
	}
	// Clear stayLoggedOut, so that if the service restarts for any reason
	// we will know that we are logged in.
	if g.Env.GetStayLoggedOut() {
		if err := cw.SetStayLoggedOut(false); err != nil {
			return err
		}
	}
	return g.ActiveDevice.SetOrClear(m, ad)
}

// SwitchUserNewConfigActiveDevice creates a new config file stanza and an
// active device for the given user, all while holding the switchUserMu lock.
func (m MetaContext) SwitchUserNewConfigActiveDevice(uv keybase1.UserVersion, n NormalizedUsername, salt []byte, d keybase1.DeviceID, sigKey GenericKey, encKey GenericKey, deviceName string, keychainMode KeychainMode) error {
	ad := NewProvisionalActiveDevice(m, uv, d, sigKey, encKey, deviceName, keychainMode)
	return m.switchUserNewConfig(uv.Uid, n, salt, d, ad)
}

// SwitchUserNukeConfig removes the given username from the config file, and
// then switches to not having a current user (by clearing the ActiveDevice,
// etc). It does this in a critical section, holding switchUserMu.
func (m MetaContext) SwitchUserNukeConfig(n NormalizedUsername) error {
	g := m.G()
	defer g.switchUserMu.Acquire(m, "SwitchUserNukeConfig")()
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
		err := g.ActiveDevice.Clear()
		if err != nil {
			return err
		}
	}
	return nil
}

func (m MetaContext) SwitchUser(n NormalizedUsername) error {
	return m.SwitchUserToActiveDevice(n, nil)
}

func (m MetaContext) SwitchUserToActiveDevice(n NormalizedUsername, ad *ActiveDevice) (err error) {

	defer m.Trace(fmt.Sprintf("MetaContext#SwitchUserToActiveDevice(%s,ActiveDevice:%v)", n.String(), (ad != nil)), func() error { return err })()

	g := m.G()
	if n.IsNil() {
		return nil
	}
	if !n.IsValid() {
		return NewBadUsernameError(n.String())
	}
	defer g.switchUserMu.Acquire(m, "SwitchUserToActiveDevice %v", n)()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	err = cw.SwitchUser(n)
	if _, ok := err.(UserNotFoundError); ok {
		m.Debug("| No user %s found; clearing out config", n)
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
	defer g.switchUserMu.Acquire(m, "SwitchUserDeprovisionNukeConfig %v", username)()

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

// SetActiveOneshotDevice acquires the switchUserMu mutex, setting the active
// device to one that corresponds to the given UID and DeviceWithKeys, and also
// sets the config file to a temporary in-memory config (not writing to disk)
// to satisfy local requests for g.Env.*
func (m MetaContext) SwitchUserToActiveOneshotDevice(uv keybase1.UserVersion, nun NormalizedUsername, d *DeviceWithKeys) (err error) {
	defer m.Trace("MetaContext#SwitchUserToActiveOneshotDevice", func() error { return err })()

	g := m.G()
	defer g.switchUserMu.Acquire(m, "SwitchUserToActiveOneshotDevice")()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	ad := d.ToProvisioningKeyActiveDevice(m, uv)
	err = g.ActiveDevice.Copy(m, ad)
	if err != nil {
		return err
	}
	uc := NewOneshotUserConfig(uv.Uid, nun, nil, d.DeviceID())
	err = cw.SetUserConfig(uc, false)
	if err != nil {
		return err
	}
	return nil
}

// SwitchUserLoggedOut clears the active device and the current_user stanza of
// the config file, all while holding the switchUserMu
func (m MetaContext) SwitchUserLoggedOut() (err error) {
	defer m.Trace("MetaContext#SwitchUserLoggedOut", func() error { return err })()
	g := m.G()
	defer g.switchUserMu.Acquire(m, "SwitchUserLoggedOut")()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	err = g.ActiveDevice.Clear()
	if err != nil {
		return err
	}
	err = cw.SetUserConfig(nil, false)
	if err != nil {
		return err
	}
	return nil
}

// SetActiveDevice sets the active device to have the UserVersion, deviceID,
// sigKey, encKey and deviceName as specified, and does so while grabbing the
// global switchUser lock, since it should be sycnhronized with attempts to
// switch the global logged in user. It does not, however, change the
// `current_user` in the config file, or edit the global config file in any
// way.
func (m MetaContext) SetActiveDevice(uv keybase1.UserVersion, deviceID keybase1.DeviceID,
	sigKey, encKey GenericKey, deviceName string, keychainMode KeychainMode) error {
	g := m.G()
	defer g.switchUserMu.Acquire(m, "SetActiveDevice")()
	if !g.Env.GetUID().Equal(uv.Uid) {
		return NewUIDMismatchError("UID switched out from underneath provisioning process")
	}
	return g.ActiveDevice.Set(m, uv, deviceID, sigKey, encKey, deviceName, 0, keychainMode)
}

func (m MetaContext) SetSigningKey(uv keybase1.UserVersion, deviceID keybase1.DeviceID, sigKey GenericKey, deviceName string) error {
	g := m.G()
	defer g.switchUserMu.Acquire(m, "SetSigningKey")()
	return g.ActiveDevice.setSigningKey(g, uv, deviceID, sigKey, deviceName)
}

func (m MetaContext) SetEncryptionKey(uv keybase1.UserVersion, deviceID keybase1.DeviceID, encKey GenericKey) error {
	g := m.G()
	defer g.switchUserMu.Acquire(m, "SetEncryptionKey")()
	return g.ActiveDevice.setEncryptionKey(uv, deviceID, encKey)
}

// LogoutAndDeprovisionIfRevoked loads the user and checks if the current
// device keys have been revoked. If so, it calls Logout and then runs the
// ClearSecretsOnDeprovision
func (m MetaContext) LogoutAndDeprovisionIfRevoked() (err error) {
	m = m.WithLogTag("LOIR")

	defer m.Trace("GlobalContext#LogoutAndDeprovisionIfRevoked", func() error { return err })()

	if !m.ActiveDevice().Valid() {
		m.Debug("LogoutAndDeprovisionIfRevoked: skipping check (not logged in)")
		return nil
	}

	if m.G().Env.GetSkipLogoutIfRevokedCheck() {
		m.Debug("LogoutAndDeprovisionIfRevoked: skipping check (SkipLogoutIfRevokedCheck)")
		return nil
	}

	doLogout := false
	err = CheckCurrentUIDDeviceID(m)
	switch err.(type) {
	case nil:
		m.Debug("LogoutAndDeprovisionIfRevoked: current device ok")
	case DeviceNotFoundError:
		m.Debug("LogoutAndDeprovisionIfRevoked: device not found error; user was likely reset; calling logout (%s)", err)
		doLogout = true
	case KeyRevokedError:
		m.Debug("LogoutAndDeprovisionIfRevoked: key revoked error error; device was revoked; calling logout (%s)", err)
		doLogout = true
	default:
		m.Debug("LogoutAndDeprovisionIfRevoked: non-actionable error: %s", err)
	}

	if doLogout {
		username := m.G().Env.GetUsername()
		if err := m.LogoutWithOptions(LogoutOptions{KeepSecrets: false, Force: true}); err != nil {
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

func (m MetaContext) CurrentUserVersion() keybase1.UserVersion {
	if m.LoginContext() != nil {
		return m.LoginContext().GetUserVersion()
	}
	return m.ActiveDevice().UserVersion()
}

func (m MetaContext) HasAnySession() (ret bool) {
	defer m.TraceOK("MetaContext#HasAnySession", func() bool { return ret })()
	if m.LoginContext() != nil {
		ok, _ := m.LoginContext().LoggedInLoad()
		if ok {
			m.Debug("| has temporary login session")
			return true
		}
	}

	if m.ActiveDevice().Valid() {
		m.Debug("| has valid device")
		return true
	}

	return false
}

func (m MetaContext) SyncSecrets() (ss *SecretSyncer, err error) {
	defer m.Trace("MetaContext#SyncSecrets", func() error { return err })()
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
	defer m.Trace("MetaContext#SyncSecrets", func() error { return err })()
	return m.ActiveDevice().SyncSecretsForUID(m, u, false /* force */)
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
	defer m.Trace("MetaContext#Keyring", func() error { return err })()
	if m.LoginContext() != nil {
		return m.LoginContext().Keyring(m)
	}
	return m.ActiveDevice().Keyring(m)
}

var _ logger.ContextInterface = MetaContext{}

func (m MetaContext) UpdateContextToLoggerContext(c context.Context) logger.ContextInterface {
	return m.WithContext(c)
}
