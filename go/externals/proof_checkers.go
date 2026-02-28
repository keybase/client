// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package externals

import libkb "github.com/keybase/client/go/libkb"

func getStaticProofServices() []libkb.ServiceType {
	services := []libkb.ServiceType{
		&DNSServiceType{},
		&FacebookServiceType{},
		&GithubServiceType{},
		&HackerNewsServiceType{},
		&RedditServiceType{},
		&TwitterServiceType{},
		&WebServiceType{},
		&WebServiceType{scheme: "http"},
		&WebServiceType{scheme: "https"},
	}
	return append(services, getBuildSpecificStaticProofServices()...)
}
