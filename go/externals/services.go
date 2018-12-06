// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SupportedVersion is which version of ParamProofs is supported by this client.
const SupportedVersion int = 1

// staticProofServies are only used for testing or for basic assertion
// validation
type staticProofServices struct {
	externalServices map[string]libkb.ServiceType
}

func newStaticProofServices() libkb.ExternalServicesCollector {
	staticServices := getStaticProofServices()
	p := staticProofServices{
		externalServices: make(map[string]libkb.ServiceType),
	}
	p.register(staticServices)
	return &p
}

func (p *staticProofServices) register(services []libkb.ServiceType) {
	for _, st := range services {
		if !useDevelProofCheckers && st.IsDevelOnly() {
			continue
		}
		for _, k := range st.AllStringKeys() {
			p.externalServices[k] = st
		}
	}
}

func (p *staticProofServices) GetServiceType(s string) libkb.ServiceType {
	return p.externalServices[strings.ToLower(s)]
}

func (p *staticProofServices) ListProofCheckers() []string {
	var ret []string
	for k := range p.externalServices {
		ret = append(ret, k)
	}
	return ret
}

func (p *staticProofServices) ListServicesThatAcceptNewProofs() []string {
	var ret []string
	for k, v := range p.externalServices {
		if v.CanMakeNewProofs() {
			ret = append(ret, k)
		}
	}
	return ret
}

// Contains both the statically known services and loads the configurations for
// known services from the server
type proofServices struct {
	sync.Mutex
	libkb.Contextified
	externalServices map[string]libkb.ServiceType
	loaded           bool
}

func NewProofServices(g *libkb.GlobalContext) libkb.ExternalServicesCollector {
	return newProofServices(g)
}

func newProofServices(g *libkb.GlobalContext) *proofServices {
	p := &proofServices{
		Contextified:     libkb.NewContextified(g),
		externalServices: make(map[string]libkb.ServiceType),
	}

	staticServices := getStaticProofServices()
	p.Lock()
	defer p.Unlock()
	p.registerServiceTypes(staticServices)
	return p
}

func (p *proofServices) registerServiceTypes(services []libkb.ServiceType) {
	for _, st := range services {
		if !useDevelProofCheckers && st.IsDevelOnly() {
			continue
		}
		for _, k := range st.AllStringKeys() {
			p.externalServices[k] = st
		}
	}
}

func (p *proofServices) GetServiceType(s string) libkb.ServiceType {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs()
	return p.externalServices[strings.ToLower(s)]
}

func (p *proofServices) ListProofCheckers() []string {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs()
	var ret []string
	for k := range p.externalServices {
		ret = append(ret, k)
	}
	return ret
}

func (p *proofServices) ListServicesThatAcceptNewProofs() []string {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs()
	var ret []string
	for k, v := range p.externalServices {
		if v.CanMakeNewProofs() {
			ret = append(ret, k)
		}
	}
	return ret
}

func (p *proofServices) loadServiceConfigs() {
	// TODO Remove with CORE-8969
	shouldRun := p.G().Env.GetFeatureFlags().Admin() || p.G().Env.GetRunMode() == libkb.DevelRunMode || p.G().Env.RunningInCI()

	if !shouldRun {
		return
	}

	mctx := libkb.NewMetaContext(context.TODO(), p.G())
	entry, err := p.G().GetParamProofStore().GetLatestEntry(mctx)
	if err != nil {
		p.G().Log.CDebugf(context.TODO(), "unable to load paramproofs: %v", err)
		return
	}
	proofConfigs, displayConfigs, err := p.parseServiceConfigs(entry)
	if err != nil {
		p.G().Log.CDebugf(context.TODO(), "unable to parse paramproofs: %v", err)
		return
	}
	services := []libkb.ServiceType{}
	for _, config := range proofConfigs {
		services = append(services, NewGenericSocialProofServiceType(config))
	}
	p.registerServiceTypes(services)
	for _, config := range displayConfigs {
		if service, ok := p.externalServices[config.Key]; ok {
			service.SetDisplayConfig(config)
		}
	}
}

type proofServicesT struct {
	Services []keybase1.ExternalServiceConfig `json:"services"`
}

func (p *proofServices) parseServiceConfigs(entry keybase1.MerkleStoreEntry) (proofConfigs []*GenericSocialProofConfig, displayConfigs []*keybase1.ServiceDisplayConfig, err error) {
	b := []byte(entry.Entry)
	services := proofServicesT{}

	if err := json.Unmarshal(b, &services); err != nil {
		return nil, nil, err
	}

	for _, service := range services.Services {
		if service.Config != nil {
			// Do some basic validation of what we parsed
			validConf, err := NewGenericSocialProofConfig(p.G(), *service.Config)
			if err != nil {
				p.G().Log.CDebugf(context.TODO(), "Unable to validate config for %s: %v", service.Config.DisplayName, err)
				continue
			}
			proofConfigs = append(proofConfigs, validConf)
		}
		if service.Display != nil {
			if service.Config != nil && service.Config.Domain != service.Display.Key {
				p.G().Log.CDebugf(context.TODO(), "Invalid display config, key mismatch %s != %s", service.Config.Domain, service.Display.Key)
				continue
			}
			displayConfigs = append(displayConfigs, service.Display)
		}
	}
	return proofConfigs, displayConfigs, nil
}
