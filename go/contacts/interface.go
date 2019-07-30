// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type ContactLookupResult struct {
	UID     keybase1.UID `json:"uid,omitempty"`
	Coerced string       `json:"coerced,omitempty"`
	Error   string       `json:"err,omitempty"`
}

type ContactLookupKey string
type ContactLookupResults struct {
	Results map[ContactLookupKey]ContactLookupResult
	// Results provided - or not provided - by this provider
	// should are valid for the following amount of time:
	ResolvedFreshness   time.Duration
	UnresolvedFreshness time.Duration
}

func NewContactLookupResults() ContactLookupResults {
	return ContactLookupResults{
		Results: make(map[ContactLookupKey]ContactLookupResult),
	}
}

func (r *ContactLookupResults) FindComponent(component keybase1.ContactComponent) (res ContactLookupResult, found bool) {
	var key ContactLookupKey
	switch {
	case component.Email != nil:
		key = makeEmailLookupKey(*component.Email)
	case component.PhoneNumber != nil:
		key = makePhoneLookupKey(*component.PhoneNumber)
	default:
		return res, false
	}
	res, found = r.Results[key]
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
	LookupAll(libkb.MetaContext, []keybase1.EmailAddress, []keybase1.RawPhoneNumber, keybase1.RegionCode) (ContactLookupResults, error)
	FindUsernames(libkb.MetaContext, []keybase1.UID) (map[keybase1.UID]ContactUsernameAndFullName, error)
	FindFollowing(libkb.MetaContext, []keybase1.UID) (map[keybase1.UID]bool, error)
}
