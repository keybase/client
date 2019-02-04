// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !production,!staging

package externals

import libkb "github.com/keybase/client/go/libkb"

const useDevelProofCheckers = true

func getBuildSpecificStaticProofServices() []libkb.ServiceType {
	return []libkb.ServiceType{
		&RooterServiceType{},
	}
}
