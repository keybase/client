// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"io"
	"runtime"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"github.com/keybase/go-updater"
	"github.com/keybase/go-updater/sources"
	"github.com/keybase/saltpack"
)

type UpdateEngine struct {
	libkb.Contextified
	options keybase1.UpdateOptions
	Result  *keybase1.Update
}

func NewUpdateEngine(g *libkb.GlobalContext, options keybase1.UpdateOptions) *UpdateEngine {
	return &UpdateEngine{
		Contextified: libkb.NewContextified(g),
		options:      options,
	}
}

func (u *UpdateEngine) Name() string {
	return "Updater"
}

func (u *UpdateEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (u *UpdateEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.UpdateUIKind,
	}
}

func (u *UpdateEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

func (u *UpdateEngine) Run(ctx *Context) (err error) {
	u.G().Log.Debug("+ UpdateEngine Run")
	defer func() {
		u.G().Log.Debug("- UpdateEngine Run")
	}()

	source, err := NewUpdateSourceFromString(u.G(), u.options.Source)
	if err != nil {
		return
	}

	updr := updater.NewUpdater(u.options, source, u.G().Env, u.G().Log)
	update, err := updr.Update(NewUpdaterEngineContext(u.G(), ctx), u.options.Force, true)
	if err != nil {
		return
	}

	u.Result = update
	return
}

type UpdaterContext struct {
	g   *libkb.GlobalContext
	ctx *Context
}

func NewUpdaterContext(g *libkb.GlobalContext) UpdaterContext {
	return UpdaterContext{g: g}
}

func NewUpdaterEngineContext(g *libkb.GlobalContext, ctx *Context) UpdaterContext {
	return UpdaterContext{g: g, ctx: ctx}
}

func (u UpdaterContext) GetUpdateUI() (updater.UpdateUI, error) {
	if u.ctx != nil {
		return u.ctx.GetUpdateUI()
	}
	if u.g.UIRouter != nil {
		return u.g.UIRouter.GetUpdateUI()
	}
	ui := u.g.UI.GetUpdateUI()
	return ui, nil
}

func (u UpdaterContext) AfterUpdateApply(willRestart bool, force bool) error {
	if err := AfterUpdateApply(u.g, willRestart, force); err != nil {
		// Errors on after update apply shouldn't be fatal
		u.g.Log.Warning("Error in after update apply: %s", err)
	}
	return nil
}

func (u UpdaterContext) Verify(r io.Reader, signature string) error {
	checkSender := func(key saltpack.SigningPublicKey) error {
		kid := libkb.SigningPublicKeyToKeybaseKID(key)
		u.g.Log.Info("Signed by %s", kid)
		validKIDs := u.g.Env.GetCodeSigningKIDs()
		if len(validKIDs) == 0 {
			u.g.Log.Warning("No codesigning keys to verify")
			return nil
		}
		if kid.IsIn(validKIDs) {
			u.g.Log.Debug("Valid KID")
			return nil
		}
		return fmt.Errorf("Unknown signer KID: %s", kid)
	}
	err := libkb.SaltpackVerifyDetached(u.g, r, []byte(signature), checkSender)
	if err != nil {
		return fmt.Errorf("Error verifying signature: %s", err)
	}
	return nil
}

func NewDefaultUpdater(g *libkb.GlobalContext) *updater.Updater {
	options := DefaultUpdaterOptions(g)
	source := DefaultUpdateSource(g)
	if source == nil {
		g.Log.Info("No updater source available for this environment")
		return nil
	}
	return updater.NewUpdater(options, source, g.Env, g.Log)
}

func DefaultUpdateSource(g *libkb.GlobalContext) sources.UpdateSource {
	u, err := NewUpdateSource(g, sources.DefaultUpdateSourceName())
	if err != nil {
		g.Log.Errorf("Invalid update source: %s", err)
	}
	return u
}

func NewUpdateSourceFromString(g *libkb.GlobalContext, name string) (sources.UpdateSource, error) {
	sourceName := sources.UpdateSourceNameFromString(name, sources.ErrorSource)
	return NewUpdateSource(g, sourceName)
}

// The https cert won't work with dots (.) in bucket name, so use alternate URI
const PrereleaseURI = "https://s3.amazonaws.com/prerelease.keybase.io"

func NewUpdateSource(g *libkb.GlobalContext, sourceName sources.UpdateSourceName) (sources.UpdateSource, error) {
	channel := ""
	if g.Env.IsAdmin() {
		// Use test channel if admin (this gets updates immediately after building
		channel = "test"
	}

	switch sourceName {
	case sources.KeybaseSource:
		return sources.NewKeybaseUpdateSource(g.Log, g.API, g.Env.GetRunMode(), channel), nil
	case sources.RemoteSource:
		return sources.NewRemoteUpdateSource(g.Log), nil
	case sources.PrereleaseSource:
		return sources.NewRemoteUpdateSourceForOptions(g.Log, PrereleaseURI, runtime.GOOS, string(g.Env.GetRunMode()), channel), nil
	case sources.LocalSource:
		return sources.NewLocalUpdateSource(g.Log), nil
	}
	return nil, fmt.Errorf("Invalid update source: %s", string(sourceName))
}

// DefaultUpdaterOptions returns update config for this environment
func DefaultUpdaterOptions(g *libkb.GlobalContext) keybase1.UpdateOptions {
	updateOptions := keybase1.UpdateOptions{
		Version:  libkb.VersionString(),
		Platform: runtime.GOOS,
		Source:   string(sources.DefaultUpdateSourceName()),
	}

	url := g.Env.GetUpdateURL()
	if url != "" {
		updateOptions.URL = url
		updateOptions.Source = string(sources.RemoteSource)
	}

	switch {
	case runtime.GOOS == "darwin" && g.Env.GetRunMode() == libkb.ProductionRunMode:
		updateOptions.DestinationPath = "/Applications/Keybase.app"
	}
	return updateOptions
}
