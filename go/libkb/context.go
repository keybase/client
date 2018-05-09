package libkb

import (
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"time"
)

type MetaContext struct {
	ctx          context.Context
	g            *GlobalContext
	loginContext LoginContext
	activeDevice *ActiveDevice
	uis          UIs
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
		return m.activeDevice
	}
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

func (m MetaContext) CommitProvisionalLogin() MetaContext {
	lctx := m.loginContext
	// For now, simply propagate the PassphraseStreamCache and Session
	// back into login state. Eventually we're going to move it
	// into G or ActiveDevice.
	m.loginContext = nil
	if lctx != nil {
		m.G().LoginState().Account(func(a *Account) {
			a.streamCache = lctx.PassphraseStreamCache()
			a.localSession = lctx.LocalSession()
		}, "CommitProvisionalLogin")
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

func NewMetaContextified(m MetaContext) MetaContextified {
	return MetaContextified{m: m}
}

// SwitchUserNewConfig switches the global active "user" as far as the global config file is concerned.
// It switches the user to a new user, and therefore you should specify the username, salt, and device ID
// for this user on this device. It will take out the global `switchUserMu` and also clear out the
// global ActiveDevice at the same time. We follow the same pattern here and elsewhere: atomically
// mutate the `current_user` of the config file as we set the global ActiveDevice.
func (m MetaContext) SwitchUserNewConfig(u keybase1.UID, n NormalizedUsername, salt []byte, d keybase1.DeviceID) error {
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
	g.ActiveDevice.Clear(nil)
	return nil
}

// SwitchUser switches the globally active configured user to the given username. In the same atomic
// critical section, it clears out the global ActiveDevice.
func (m MetaContext) SwitchUser(n NormalizedUsername) error {
	g := m.G()
	if n.IsNil() {
		return nil
	}
	if err := n.CheckValid(); err != nil {
		return err
	}
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	err := cw.SwitchUser(n)
	if _, ok := err.(UserNotFoundError); ok {
		m.CDebugf("| No user %s found; clearing out config", n)
		err = nil
	}
	if err != nil {
		return err
	}
	g.ActiveDevice.Clear(nil)
	return nil
}

// SetDeviceIDWithRegistration sets the DeviceID for a user's config section during
// device registration. It atomically clears out the global ActiveDevice, since the ActiveDevice
// should be nil if the deviceID for the current user is unset (as it was jus before the call).
func (m MetaContext) SetDeviceIDWithinRegistration(d keybase1.DeviceID) error {
	g := m.G()
	g.switchUserMu.Lock()
	defer g.switchUserMu.Unlock()
	cw := g.Env.GetConfigWriter()
	if cw == nil {
		return NoConfigWriterError{}
	}
	err := cw.SetDeviceID(d)
	if err != nil {
		return err
	}
	g.ActiveDevice.Clear(nil)
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
