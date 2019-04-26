// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package contacts

import (
	"errors"
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/phonenumbers"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/uidmap"
)

type BulkLookupContactsProvider struct {
}

func (c *BulkLookupContactsProvider) LookupPhoneNumbers(mctx libkb.MetaContext, numbers []keybase1.RawPhoneNumber,
	userRegion keybase1.RegionCode) (res []ContactLookupResult, err error) {

	var regionCodes []keybase1.RegionCode
	var maybeUserRegion *keybase1.RegionCode
	if len(userRegion) > 0 {
		maybeUserRegion = &userRegion
	}
	ret, err := phonenumbers.BulkLookupPhoneNumbers(mctx, numbers, regionCodes, maybeUserRegion)
	if err != nil {
		return res, err
	}
	res = make([]ContactLookupResult, len(ret))
	for i, r := range ret {
		if r.Err != nil {
			mctx.Debug("Server returned an error while looking up phone %q: %s", numbers[i], *r.Err)
			continue
		}
		if r.Uid != nil {
			//res[i] =
		}
	}
	return res, nil
}

func (c *BulkLookupContactsProvider) LookupEmails(mctx libkb.MetaContext, emails []keybase1.EmailAddress) (res []ContactLookupResult, err error) {
	// TODO: Call something that bulk looks up emails, needs to add API to
	// kbweb.
	return res, errors.New("not implemented")
}

func (c *BulkLookupContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	const fullnameFreshness = 10 * time.Minute
	const networkTimeBudget = 0

	uidSet := make(map[keybase1.UID]struct{}, len(res))
	for _, v := range res {
		if v.Resolved {
			uidSet[v.Uid] = struct{}{}
		}
	}
	uids := make([]keybase1.UID, len(uidSet))
	for k := range uidSet {
		uids = append(uids, k)
	}
	nameMap, err := uidmap.MapUIDsReturnMapMctx(mctx, uids, fullnameFreshness, networkTimeBudget, true)
	if err != nil {
		mctx.Debug("UIDMapper returned %q, continuing...")
	}
	for i, v := range res {
		if namePkg, found := nameMap[v.Uid]; found {
			res[i].Username = namePkg.NormalizedUsername.String()
			if fullNamePkg := namePkg.FullName; fullNamePkg != nil {
				res[i].FullName = fullNamePkg.FullName.String()
			}
		}
	}
}
