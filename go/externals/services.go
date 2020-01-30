// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"context"
	"encoding/json"
	"sort"
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
	loadedHash       *keybase1.MerkleStoreKitHash
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
	p.registerServiceTypes(getStaticProofServices())
	return p
}

func (p *proofServices) clearServiceTypes() {
	p.externalServices = make(map[string]libkb.ServiceType)
	p.displayConfigs = make(map[string]keybase1.ServiceDisplayConfig)
}

func (p *proofServices) registerServiceTypes(services []libkb.ServiceType) {
	for _, st := range services {
		if !useDevelProofCheckers && st.IsDevelOnly() {
			continue
		}
		p.externalServices[st.Key()] = st
	}
}

func (p *proofServices) GetServiceType(ctx context.Context, s string) libkb.ServiceType {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(p.MetaContext(ctx))
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

type serviceAndPriority struct {
	name     string
	priority int
}

func (p *proofServices) ListServicesThatAcceptNewProofs(mctx libkb.MetaContext) []string {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(mctx)
	var services []serviceAndPriority
	experimentalGenericProofs := mctx.G().FeatureFlags.Enabled(mctx, libkb.ExperimentalGenericProofs)
	for k, v := range p.externalServices {
		if experimentalGenericProofs || v.CanMakeNewProofsSkipFeatureFlag(mctx) {
			s := serviceAndPriority{name: k, priority: v.DisplayPriority()}
			services = append(services, s)
		}
	}
	sort.Slice(services, func(i, j int) bool {
		return services[i].priority < services[j].priority
	})
	var serviceNames []string
	for _, service := range services {
		serviceNames = append(serviceNames, service.name)
	}
	return serviceNames
}

func (p *proofServices) ListDisplayConfigs(mctx libkb.MetaContext) (res []keybase1.ServiceDisplayConfig) {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(mctx)
	for _, config := range p.displayConfigs {
		res = append(res, config)
	}
	return res
}

func (p *proofServices) SuggestionFoldPriority(mctx libkb.MetaContext) int {
	p.Lock()
	defer p.Unlock()
	p.loadServiceConfigs(mctx)
	return p.suggestionFold
}

func (p *proofServices) loadServiceConfigs(mctx libkb.MetaContext) {
	tracer := p.G().CTimeTracer(mctx.Ctx(), "proofServices.loadServiceConfigs", false)
	defer tracer.Finish()

	entry, err := p.G().GetParamProofStore().GetLatestEntryWithKnown(mctx, p.loadedHash)
	if err != nil {
		mctx.Debug("unable to load paramproofs: %v", err)
		return
	}
	if entry == nil {
		// Latest config already loaded.
		return
	}
	defer mctx.TraceTimed("proofServices.loadServiceConfigsBulk", func() error { return err })()
	tracer.Stage("parse")
	config, err := p.parseServerConfig(mctx, *entry)
	if err != nil {
		mctx.Debug("unable to parse paramproofs: %v", err)
		return
	}
	tracer.Stage("fill")
	p.suggestionFold = config.SuggestionFold
	services := []libkb.ServiceType{}
	for _, config := range config.ProofConfigs {
		services = append(services, NewGenericSocialProofServiceType(config))
	}
	tracer.Stage("register")
	p.clearServiceTypes()
	p.registerServiceTypes(getStaticProofServices())
	p.registerServiceTypes(services)
	tracer.Stage("disp")
	for _, config := range config.DisplayConfigs {
		p.displayConfigs[config.Key] = *config
		if service, ok := p.externalServices[config.Key]; ok {
			service.SetDisplayConfig(config)
		}
	}
	p.loadedHash = &entry.Hash
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

func (p *proofServices) parseServerConfig(mctx libkb.MetaContext, entry keybase1.MerkleStoreEntry) (res parsedServerConfig, err error) {
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
				mctx.Debug("Unable to validate config for %s: %v", service.Config.DisplayName, err)
				continue
			}
			res.ProofConfigs = append(res.ProofConfigs, validConf)
		}
		if service.Display != nil {
			if service.Config != nil && service.Config.Domain != service.Display.Key {
				mctx.Debug("Invalid display config, key mismatch %s != %s", service.Config.Domain, service.Display.Key)
				continue
			}
			res.DisplayConfigs = append(res.DisplayConfigs, service.Display)
		}
	}
	return res, nil
}
