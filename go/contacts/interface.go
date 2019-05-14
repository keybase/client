// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ContactLookupResult struct {
	UID     keybase1.UID `json:"uid,omitempty"`
	Coerced string       `json:"coerced,omitempty"`
}

type ContactLookupMap map[string]ContactLookupResult

func (r ContactLookupMap) FindComponent(component keybase1.ContactComponent) (res ContactLookupResult, found bool) {
	var key string
	switch {
	case component.Email != nil:
		key = makeEmailLookupKey(*component.Email)
	case component.PhoneNumber != nil:
		key = makePhoneLookupKey(*component.PhoneNumber)
	default:
		return res, false
	}
	res, found = r[key]
	return res, found
}

func makeEmailLookupKey(e keybase1.EmailAddress) string {
	return fmt.Sprintf("e:%s", string(e))
}

func makePhoneLookupKey(p keybase1.RawPhoneNumber) string {
	return fmt.Sprintf("p:%s", string(p))
}

type ContactsProvider interface {
	LookupAll(libkb.MetaContext, []keybase1.EmailAddress, []keybase1.RawPhoneNumber, keybase1.RegionCode) (ContactLookupMap, error)
	FillUsernames(libkb.MetaContext, []keybase1.ProcessedContact)
	FillFollowing(libkb.MetaContext, []keybase1.ProcessedContact)
}
