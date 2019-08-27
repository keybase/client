// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func BulkLookupContacts(mctx libkb.MetaContext, emailsContacts []keybase1.EmailAddress,
	phoneNumberContacts []keybase1.RawPhoneNumber, userRegionCode keybase1.RegionCode, token Token) (res ContactLookupResults, err error) {

	type lookupArg struct {
		Email       string `json:"e,omitempty"`
		PhoneNumber string `json:"p,omitempty"`
	}

	type lookupRes struct {
		libkb.AppStatusEmbed
		Resolutions           map[ContactLookupKey]ContactLookupResult `json:"resolutions"`
		ResolvedFreshnessMs   int                                      `json:"resolved_freshness_ms"`
		UnresolvedFreshnessMs int                                      `json:"unresolved_freshness_ms"`
		Token                 Token                                    `json:"token"`
		TokenValidateErr      string                                   `json:"validate_err"`
		TokenValidateSC       int                                      `json:"validate_err_sc"`
	}

	lookups := make([]lookupArg, 0, len(phoneNumberContacts)+len(emailsContacts))
	for _, phoneNumber := range phoneNumberContacts {
		lookups = append(lookups, lookupArg{PhoneNumber: string(phoneNumber)})
	}
	for _, email := range emailsContacts {
		lookups = append(lookups, lookupArg{Email: string(email)})
	}

	payload := make(libkb.JSONPayload)
	payload["contacts"] = lookups
	payload["token"] = token
	payload["supports_tokens"] = 1
	if !userRegionCode.IsNil() {
		payload["user_region_code"] = userRegionCode
	}

	arg := libkb.APIArg{
		Endpoint:    "contacts/lookup",
		JSONPayload: payload,
		SessionType: libkb.APISessionTypeREQUIRED,
	}
	var resp lookupRes
	err = mctx.G().API.PostDecode(mctx, arg, &resp)
	if err != nil {
		return res, err
	}
	if resp.TokenValidateErr != "" {
		mctx.Debug("Error in validation of contact token: %s, code %d", resp.TokenValidateErr, resp.TokenValidateSC)
	}
	res = NewContactLookupResults()
	res.Results = resp.Resolutions
	res.ResolvedFreshness = time.Duration(resp.ResolvedFreshnessMs) * time.Millisecond
	res.UnresolvedFreshness = time.Duration(resp.UnresolvedFreshnessMs) * time.Millisecond
	res.Token = resp.Token
	mctx.Debug(
		"BulkLookupContacts: server said we should cache resolved entries for %.2f s and unresolved for %.2f s",
		res.ResolvedFreshness.Seconds(), res.UnresolvedFreshness.Seconds())
	return res, nil
}

func LookupSeviceMaps(mctx libkb.MetaContext, uids []keybase1.UID) (map[keybase1.UID]ServiceMap, error) {
	if len(uids) == 0 {
		return make(map[keybase1.UID]ServiceMap), nil
	}

	type lookupRes struct {
		libkb.AppStatusEmbed
		ServiceMaps map[keybase1.UID]ServiceMap `json:"service_maps"`
	}

	arg := libkb.NewAPIArg("user/service_maps")
	arg.SessionType = libkb.APISessionTypeNONE
	arg.Args = libkb.HTTPArgs{
		"uids": libkb.S{Val: libkb.UidsToString(uids)},
	}
	var resp lookupRes
	err := mctx.G().API.PostDecode(mctx, arg, &resp)
	if err != nil {
		return nil, err
	}
	return resp.ServiceMaps, nil
}
