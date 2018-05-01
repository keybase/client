package libkb

import (
	"fmt"
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

func NewMetaContext(ctx context.Context, g *GlobalContext) MetaContext {
	return MetaContext{ctx: ctx, g: g}
}

func (m MetaContext) WithLoginContext(l LoginContext) MetaContext {
	m.loginContext = l
	return m
}

func (m MetaContext) WithActiveDevice(a *ActiveDevice) MetaContext {
	m.activeDevice = a
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

func (m MetaContext) CDebugf(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CDebugf(m.ctx, f, args...)
}
func (m MetaContext) CWarningf(f string, args ...interface{}) {
	m.g.Log.CloneWithAddedDepth(1).CWarningf(m.ctx, f, args...)
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
