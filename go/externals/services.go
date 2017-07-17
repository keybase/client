// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import (
	"strings"

	libkb "github.com/keybase/client/go/libkb"
)

type externalServicesCollection map[string]libkb.ServiceType

var externalServices = externalServicesCollection(make(map[string]libkb.ServiceType))

func (e externalServicesCollection) Register(st libkb.ServiceType) {
	for _, k := range st.AllStringKeys() {
		e[k] = st
	}
}

func (e externalServicesCollection) GetServiceType(s string) libkb.ServiceType {
	return e[strings.ToLower(s)]
}

func (e externalServicesCollection) ListProofCheckers(mode libkb.RunMode) []string {
	var ret []string
	for k, v := range e {
		if useDevelProofCheckers || !v.IsDevelOnly() {
			ret = append(ret, k)
		}
	}
	return ret
}

var _ libkb.ExternalServicesCollector = externalServices

func GetServices() libkb.ExternalServicesCollector {
	return externalServices
}
