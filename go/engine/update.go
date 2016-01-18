// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"
	"runtime"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/keybase/client/go/updater"
	"github.com/keybase/client/go/updater/sources"
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
	update, err := updr.Update(ctx, u.options.Force, true)
	if err != nil {
		return
	}
	u.Result = update
	return
}

func NewDefaultUpdater(g *libkb.GlobalContext) *updater.Updater {
	options := DefaultUpdaterOptions(g)
	if options == nil {
		g.Log.Info("No updater available for this environment")
		return nil
	}
	source := DefaultUpdateSource(g)
	if source == nil {
		g.Log.Info("No updater source available for this environment")
		return nil
	}
	return updater.NewUpdater(*options, source, g.Env, g.Log)
}

func DefaultUpdateSource(g *libkb.GlobalContext) sources.UpdateSource {
	u, _ := NewUpdateSource(g, sources.DefaultUpdateSourceName())
	return u
}

func NewUpdateSourceFromString(g *libkb.GlobalContext, name string) (sources.UpdateSource, error) {
	sourceName := sources.UpdateSourceNameFromString(name, sources.ErrorSource)
	return NewUpdateSource(g, sourceName)
}

// The https cert won't work with dots (.) in bucket name, so use alternate URI
const PrereleaseURI = "https://s3.amazonaws.com/prerelease.keybase.io"

func NewUpdateSource(g *libkb.GlobalContext, sourceName sources.UpdateSourceName) (sources.UpdateSource, error) {
	switch sourceName {
	case sources.KeybaseSource:
		return sources.NewKeybaseUpdateSource(g.Log, g.API, g.Env.GetRunMode()), nil
	case sources.RemoteSource:
		return sources.NewRemoteUpdateSource(g.Log, g.Env.GetRunMode(), ""), nil
	case sources.PrereleaseSource:
		return sources.NewRemoteUpdateSource(g.Log, g.Env.GetRunMode(), PrereleaseURI), nil
	}
	return nil, fmt.Errorf("Invalid update source: %s", string(sourceName))
}

// DefaultUpdaterOptions returns update config for this environment
func DefaultUpdaterOptions(g *libkb.GlobalContext) *keybase1.UpdateOptions {
	ret := &keybase1.UpdateOptions{
		Version:  libkb.VersionString(),
		Channel:  "main", // The default channel
		Platform: runtime.GOOS,
		Source:   string(sources.DefaultUpdateSourceName()),
	}
	switch {
	case runtime.GOOS == "darwin" && g.Env.GetRunMode() == libkb.ProductionRunMode:
		ret.DestinationPath = "/Applications/Keybase.app"
	}
	return ret
}
