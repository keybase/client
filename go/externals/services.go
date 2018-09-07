// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"context"
	"strings"
	"sync"

	libkb "github.com/keybase/client/go/libkb"
)

type proofServices struct {
	sync.Mutex
	libkb.Contextified
	collection map[string]libkb.ServiceType
	loaded     bool
}

func NewProofServices(g *libkb.GlobalContext) libkb.ExternalServicesCollector {
	p := &proofServices{
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
	p.Lock()
	defer p.Unlock()
	for _, st := range staticServices {
		p.register(st)
	}
	return p
}

func (p *proofServices) register(st libkb.ServiceType) {
	for _, k := range st.AllStringKeys() {
		p.collection[k] = st
	}
}

func (p *proofServices) GetServiceType(s string) libkb.ServiceType {
	p.Lock()
	defer p.Unlock()
	p.loadParamProofServices()
	return p.collection[strings.ToLower(s)]
}

func (p *proofServices) ListProofCheckers(mode libkb.RunMode) []string {
	p.Lock()
	defer p.Unlock()
	p.loadParamProofServices()
	var ret []string
	for k, v := range p.collection {
		if useDevelProofCheckers || !v.IsDevelOnly() {
			ret = append(ret, k)
		}
	}
	return ret
}

func (p *proofServices) loadParamProofServices() {
	// TODO need to hook this into storage for parameterized configs, CORE-8655
	shouldRun := p.G().Env.GetFeatureFlags().Admin() || p.G().Env.GetRunMode() == libkb.DevelRunMode || p.G().Env.RunningInCI()

	if !shouldRun || p.loaded {
		return
	}

	loader := NullConfigLoader{}
	proofTypes, err := loader.LoadAll()
	if err != nil {
		// TODO CORE-8655
		p.G().Log.CDebugf(context.TODO(), "unable to load configs: %v", err)
		return
	}
	for _, params := range proofTypes {
		p.register(NewParamProofServiceType(params))
	}
	p.loaded = true
}
