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

// Contains both the statically known services and loads the configurations for
// known services from the server
type proofServices struct {
	sync.Mutex
	libkb.Contextified
	loaded           bool
	externalServices map[string]libkb.ServiceType // map keys are ServiceType.Key()
	displayConfigs   map[string]keybase1.ServiceDisplayConfig
	suggestionFold   int
}

func NewProofServices(g *libkb.GlobalContext) libkb.ExternalServicesCollector {
	return newProofServices(g)
}

func newProofServices(g *libkb.GlobalContext) *proofServices {
	p := &proofServices{
		Contextified:     libkb.NewContextified(g),
		externalServices: make(map[string]libkb.ServiceType),
		displayConfigs:   make(map[string]keybase1.ServiceDisplayConfig),
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

func (p *proofServices) ListServicesThatAcceptNewProofs(mctx libkb.MetaContext) []string {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs()
	var ret []string
	for k, v := range p.externalServices {
		if v.CanMakeNewProofs(mctx) {
			ret = append(ret, k)
		}
	}
	return ret
}

func (p *proofServices) ListDisplayConfigs() (res []keybase1.ServiceDisplayConfig) {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs()
	for _, config := range p.displayConfigs {
		res = append(res, config)
	}
	return res
}

func (p *proofServices) SuggestionFoldPriority() int {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs()
	return p.suggestionFold
}

func (p *proofServices) loadServiceConfigs() {
	if !p.G().ShouldUseParameterizedProofs() {
		return
	}

	mctx := libkb.NewMetaContext(context.TODO(), p.G())
	entry, err := p.G().GetParamProofStore().GetLatestEntry(mctx)
	if err != nil {
		p.G().Log.CDebugf(context.TODO(), "unable to load paramproofs: %v", err)
		return
	}
	config, err := p.parseServerConfig(entry)
	if err != nil {
		p.G().Log.CDebugf(context.TODO(), "unable to parse paramproofs: %v", err)
		return
	}
	p.suggestionFold = config.SuggestionFold
	services := []libkb.ServiceType{}
	for _, config := range config.ProofConfigs {
		services = append(services, NewGenericSocialProofServiceType(config))
	}
	p.displayConfigs = make(map[string]keybase1.ServiceDisplayConfig)
	p.registerServiceTypes(services)
	for _, config := range config.DisplayConfigs {
		p.displayConfigs[config.Key] = *config
		if service, ok := p.externalServices[config.Key]; ok {
			service.SetDisplayConfig(config)
		}
	}
}

type parsedServerConfig struct {
	SuggestionFold int
	ProofConfigs   []*GenericSocialProofConfig
	DisplayConfigs []*keybase1.ServiceDisplayConfig
}

type proofServicesT struct {
	SuggestionFold int                              `json:"suggestion_fold"`
	Services       []keybase1.ExternalServiceConfig `json:"services"`
}

func (p *proofServices) parseServerConfig(entry keybase1.MerkleStoreEntry) (res parsedServerConfig, err error) {
	b := []byte(entry.Entry)
	services := proofServicesT{}

	if err := json.Unmarshal(b, &services); err != nil {
		return res, err
	}

	res.SuggestionFold = services.SuggestionFold
	for _, service := range services.Services {
		if service.Config != nil {
			// Do some basic validation of what we parsed
			validConf, err := NewGenericSocialProofConfig(p.G(), *service.Config)
			if err != nil {
				p.G().Log.CDebugf(context.TODO(), "Unable to validate config for %s: %v", service.Config.DisplayName, err)
				continue
			}
			res.ProofConfigs = append(res.ProofConfigs, validConf)
		}
		if service.Display != nil {
			if service.Config != nil && service.Config.Domain != service.Display.Key {
				p.G().Log.CDebugf(context.TODO(), "Invalid display config, key mismatch %s != %s", service.Config.Domain, service.Display.Key)
				continue
			}
			res.DisplayConfigs = append(res.DisplayConfigs, service.Display)
		}
	}
	return res, nil
}
