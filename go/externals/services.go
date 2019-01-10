// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"encoding/json"
	"strings"
	"sync"

	libkb "github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// SupportedVersion is which version of ParamProofs is supported by this client.
const SupportedVersion int = 1

// Contains both the statically known services and loads the configurations for
// known services from the server
type proofServices struct {
	sync.Mutex
	externalServices map[string]libkb.ServiceType
	loaded           bool
}

func NewProofServices() libkb.ExternalServicesCollector {
	return newProofServices()
}

func newProofServices() *proofServices {
	p := &proofServices{
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
		p.externalServices[st.Key()] = st
	}
}

func (p *proofServices) GetServiceType(mctx libkb.MetaContext, s string) libkb.ServiceType {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(mctx)
	return p.externalServices[strings.ToLower(s)]
}

func (p *proofServices) ListProofCheckers(mctx libkb.MetaContext) []string {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(mctx)
	var ret []string
	for k := range p.externalServices {
		ret = append(ret, k)
	}
	return ret
}

func (p *proofServices) ListServicesThatAcceptNewProofs(mctx libkb.MetaContext) []string {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(mctx)
	var ret []string
	for k, v := range p.externalServices {
		if v.CanMakeNewProofs() {
			ret = append(ret, k)
		}
	}
	return ret
}

func (p *proofServices) loadServiceConfigs(mctx libkb.MetaContext) {
	// TODO Remove with CORE-8969
	shouldRun := mctx.G().Env.GetFeatureFlags().Admin() || mctx.G().Env.GetRunMode() == libkb.DevelRunMode || mctx.G().Env.RunningInCI()

	if !shouldRun {
		return
	}

	entry, err := mctx.G().GetParamProofStore().GetLatestEntry(mctx)
	if err != nil {
		mctx.CDebugf("unable to load paramproofs: %v", err)
		return
	}
	proofConfigs, displayConfigs, err := p.parseServiceConfigs(mctx, entry)
	if err != nil {
		mctx.CDebugf("unable to parse paramproofs: %v", err)
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

func (p *proofServices) parseServiceConfigs(mctx libkb.MetaContext, entry keybase1.MerkleStoreEntry) (
	proofConfigs []*GenericSocialProofConfig, displayConfigs []*keybase1.ServiceDisplayConfig, err error) {
	b := []byte(entry.Entry)
	services := proofServicesT{}

	if err := json.Unmarshal(b, &services); err != nil {
		return nil, nil, err
	}

	for _, service := range services.Services {
		if service.Config != nil {
			// Do some basic validation of what we parsed
			validConf, err := NewGenericSocialProofConfig(mctx.G(), *service.Config)
			if err != nil {
				mctx.CDebugf("Unable to validate config for %s: %v", service.Config.DisplayName, err)
				continue
			}
			proofConfigs = append(proofConfigs, validConf)
		}
		if service.Display != nil {
			if service.Config != nil && service.Config.Domain != service.Display.Key {
				mctx.CDebugf("Invalid display config, key mismatch %s != %s", service.Config.Domain, service.Display.Key)
				continue
			}
			displayConfigs = append(displayConfigs, service.Display)
		}
	}
	return proofConfigs, displayConfigs, nil
}
