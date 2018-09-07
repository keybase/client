// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"context"
	"strings"
	"sync"

	libkb "github.com/keybase/client/go/libkb"
)

type externalServices struct {
	sync.Mutex
	libkb.Contextified
	collection map[string]libkb.ServiceType
	loaded     bool
}

func NewExternalServices(g *libkb.GlobalContext) libkb.ExternalServicesCollector {
	e := &externalServices{
		Contextified: libkb.NewContextified(g),
		collection:   make(map[string]libkb.ServiceType),
	}

	staticServices := []libkb.ServiceType{
		DNSServiceType{},
		FacebookServiceType{},
		GithubServiceType{},
		HackerNewsServiceType{},
		RedditServiceType{},
		RooterServiceType{},
		TwitterServiceType{},
		WebServiceType{},
	}
	e.Lock()
	defer e.Unlock()
	for _, st := range staticServices {
		e.register(st)
	}
	return e
}

func (e *externalServices) register(st libkb.ServiceType) {
	for _, k := range st.AllStringKeys() {
		e.collection[k] = st
	}
}

func (e *externalServices) GetServiceType(s string) libkb.ServiceType {
	e.Lock()
	defer e.Unlock()
	e.loadDynamicProofServices()
	return e.collection[strings.ToLower(s)]
}

func (e *externalServices) ListProofCheckers(mode libkb.RunMode) []string {
	e.Lock()
	defer e.Unlock()
	e.loadDynamicProofServices()
	var ret []string
	for k, v := range e.collection {
		if useDevelProofCheckers || !v.IsDevelOnly() {
			ret = append(ret, k)
		}
	}
	return ret
}

func (e *externalServices) loadDynamicProofServices() {
	// TODO need to hook this into storage for dynamic configs, CORE-8655
	shouldRun := e.G().Env.GetFeatureFlags().Admin() || e.G().Env.GetRunMode() == libkb.DevelRunMode || e.G().Env.RunningInCI()

	if !shouldRun || e.loaded {
		return
	}

	loader := NullConfigLoader{}
	configs, err := loader.LoadAll()
	if err != nil {
		// TODO CORE-8655
		e.G().Log.CDebugf(context.TODO(), "unable to load configs: %v", err)
		return
	}
	for _, conf := range configs {
		e.register(NewDynamicProofServiceType(conf))
	}
	e.loaded = true
}
