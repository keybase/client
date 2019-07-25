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
	Error   string       `json:"err,omitempty"`
}

type ContactLookupKey string
type ContactLookupMap map[ContactLookupKey]ContactLookupResult

func (r ContactLookupMap) FindComponent(component keybase1.ContactComponent) (res ContactLookupResult, found bool) {
	var key ContactLookupKey
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

func makeEmailLookupKey(e keybase1.EmailAddress) ContactLookupKey {
	return ContactLookupKey(fmt.Sprintf("e:%s", string(e)))
}

func makePhoneLookupKey(p keybase1.RawPhoneNumber) ContactLookupKey {
	return ContactLookupKey(fmt.Sprintf("p:%s", string(p)))
}

type ContactUsernameAndFullName struct {
	Username string
	Fullname string
}

type ContactsProvider interface {
	LookupAll(libkb.MetaContext, []keybase1.EmailAddress, []keybase1.RawPhoneNumber, keybase1.RegionCode) (ContactLookupMap, error)
	FindUsernames(libkb.MetaContext, []keybase1.UID) (map[keybase1.UID]ContactUsernameAndFullName, error)
	FindFollowing(libkb.MetaContext, []keybase1.UID) (map[keybase1.UID]bool, error)
}
