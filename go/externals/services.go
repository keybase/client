// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"fmt"
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

	nonGenericServiceTypes := []libkb.ServiceType{
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
	for _, st := range nonGenericServiceTypes {
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
	e.loadGenericServices()
	return e.collection[strings.ToLower(s)]
}

func (e *externalServices) ListProofCheckers(mode libkb.RunMode) []string {
	e.Lock()
	defer e.Unlock()
	e.loadGenericServices()
	var ret []string
	for k, v := range e.collection {
		if useDevelProofCheckers || !v.IsDevelOnly() {
			ret = append(ret, k)
		}
	}
	return ret
}

func (e *externalServices) loadGenericServices() {
	// TODO need to hook this into storage for generic configs
	shouldRun := e.G().Env.GetFeatureFlags().Admin() || e.G().Env.GetRunMode() == libkb.DevelRunMode || e.G().Env.RunningInCI()

	if !shouldRun || e.loaded {
		return
	}

	loader := NullConfigLoader{}
	configs, err := loader.LoadAll()
	if err != nil {
		// TODO we probably don't want it to work this way..
		panic(fmt.Sprintf("Unable to load proofs: %v", err))
	}
	for _, conf := range configs {
		e.register(NewGenericServiceType(conf))
	}
	e.loaded = true
}
