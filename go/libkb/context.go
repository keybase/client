package libkb

import (
	context "golang.org/x/net/context"
)

type MetaContext struct {
	ctx          context.Context
	g            *GlobalContext
	loginContext LoginContext
	activeDevice *ActiveDevice
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
