// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"sort"
	"time"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/uidmap"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type bulkLookupContactsProvider struct{}

var _ contacts.ContactsProvider = (*bulkLookupContactsProvider)(nil)

func (c *bulkLookupContactsProvider) LookupAll(mctx libkb.MetaContext, emails []keybase1.EmailAddress,
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (contacts.ContactLookupResults, error) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#LookupAll(len=%d)", len(emails)+len(numbers)),
		func() error { return nil })()
	return contacts.BulkLookupContacts(mctx, emails, numbers, userRegion)
}

func (c *bulkLookupContactsProvider) FindUsernames(mctx libkb.MetaContext,
	uids []keybase1.UID) (res map[keybase1.UID]contacts.ContactUsernameAndFullName, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#FillUsernames(len=%d)", len(res)),
		func() error { return nil })()

	const fullnameFreshness = 10 * time.Minute
	const networkTimeBudget = 0
	const forceNetworkForFullNames = true

	nameMap, err := uidmap.MapUIDsReturnMapMctx(mctx, uids, fullnameFreshness, networkTimeBudget, forceNetworkForFullNames)
	if err != nil {
		return nil, err
	}

	res = make(map[keybase1.UID]contacts.ContactUsernameAndFullName)
	for uid, v := range nameMap {
		ufp := contacts.ContactUsernameAndFullName{
			Username: v.NormalizedUsername.String(),
		}
		if fullNamePkg := v.FullName; fullNamePkg != nil {
			ufp.Fullname = fullNamePkg.FullName.String()
		}
		res[uid] = ufp
	}
	return res, nil
}

func (c *bulkLookupContactsProvider) FindFollowing(mctx libkb.MetaContext,
	uids []keybase1.UID) (res map[keybase1.UID]bool, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#FillFollowing(len=%d)", len(res)),
		func() error { return nil })()

	arg := libkb.NewLoadUserArgWithMetaContext(mctx).WithSelf(true).WithStubMode(libkb.StubModeUnstubbed)
	err = mctx.G().GetFullSelfer().WithUser(arg, func(user *libkb.User) error {
		mctx.Debug("In WithUser: user found: %t", user != nil)
		if user == nil {
			return libkb.UserNotFoundError{}
		}

		var trackList []*libkb.TrackChainLink
		idTable := user.IDTable()
		if idTable != nil {
			trackList = idTable.GetTrackList()
		}

		mctx.Debug("In WithUser: idTable exists: %t, trackList len: %d", idTable != nil, len(trackList))
		res = make(map[keybase1.UID]bool)
		if len(trackList) == 0 {
			// Nothing to do.
			return nil
		}

		followedUIDSet := make(map[keybase1.UID]struct{}, len(trackList))
		for _, track := range trackList {
			uid, err := track.GetTrackedUID()
			if err != nil {
				return err
			}

			followedUIDSet[uid] = struct{}{}
		}

		for _, v := range uids {
			_, found := followedUIDSet[v]
			res[v] = found
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return res, nil
}

type ContactsHandler struct {
	libkb.Contextified
	*BaseHandler

	contactsProvider *contacts.CachedContactsProvider
}

func NewCachedContactsProvider(g *libkb.GlobalContext) *contacts.CachedContactsProvider {
	return &contacts.CachedContactsProvider{
		Provider: &bulkLookupContactsProvider{},
		Store:    contacts.NewContactCacheStore(g),
	}
}

func NewContactsHandler(xp rpc.Transporter, g *libkb.GlobalContext, provider *contacts.CachedContactsProvider) *ContactsHandler {
	handler := &ContactsHandler{
		Contextified:     libkb.NewContextified(g),
		BaseHandler:      NewBaseHandler(g, xp),
		contactsProvider: provider,
	}
	return handler
}

var _ keybase1.ContactsInterface = (*ContactsHandler)(nil)

func (h *ContactsHandler) LookupContactList(ctx context.Context, arg keybase1.LookupContactListArg) (res []keybase1.ProcessedContact, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LOOKCON")
	defer mctx.TraceTimed(fmt.Sprintf("ContactsHandler#LookupContactList(len=%d)", len(arg.Contacts)),
		func() error { return err })()
	return contacts.ResolveContacts(mctx, h.contactsProvider, arg.Contacts, arg.UserRegionCode)
}

func (h *ContactsHandler) SaveContactList(ctx context.Context, arg keybase1.SaveContactListArg) (res []keybase1.ProcessedContact, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("SAVECON")
	defer mctx.TraceTimed(fmt.Sprintf("ContactsHandler#SaveContactList(len=%d)", len(arg.Contacts)),
		func() error { return err })()
	return contacts.ResolveAndSaveContacts(mctx, h.contactsProvider, arg.Contacts)
}

func (h *ContactsHandler) LookupSavedContactsList(ctx context.Context, sessionID int) (res []keybase1.ProcessedContact, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LOADCON")
	defer mctx.TraceTimed("ContactsHandler#LookupSavedContactsList", func() error { return err })()

	store := h.G().SyncedContactList
	savedContacts, err := store.RetrieveContacts(mctx)
	if err != nil {
		return nil, err
	}
	return savedContacts, nil
}

func (h *ContactsHandler) GetContactsForUserRecommendations(ctx context.Context, sessionID int) (res []keybase1.ProcessedContact, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("RECSCON")
	defer mctx.TraceTimed("ContactsHandler#GetContactsForUserRecommendations", func() error { return err })()

	savedContacts, err := h.G().SyncedContactList.RetrieveContacts(mctx)
	if err != nil {
		return nil, err
	}

	// Allocate space for the number of all saved contacts - we will likely
	// return less, though.
	res = make([]keybase1.ProcessedContact, 0, len(savedContacts))

	// Find contacts that have at least one resolved component, we are going to
	// take only the resolved component from them (chose one if there are
	// multiple).
	seenResolvedContacts := make(map[int]struct{})
	for _, contact := range savedContacts {
		if contact.Resolved {
			seenResolvedContacts[contact.ContactIndex] = struct{}{}
		}
	}

	// Find the best contact for each resolved username.
	// Map usernames to index in `res` list.
	contactForUsername := make(map[string]int, len(seenResolvedContacts))
	currentUID := mctx.CurrentUID()

	for _, contact := range savedContacts {
		if !contact.Resolved {
			if _, found := seenResolvedContacts[contact.ContactIndex]; found {
				// This contact has a resolved component, skip unresolved ones
				// completely.
				continue
			}

			res = append(res, contact)
		} else {
			if contact.Uid.Equal(currentUID) {
				// Some people have their phone number in contact list, do not
				// show current user in recommendations.
				continue
			}

			if currentIndex, found := contactForUsername[contact.Username]; found {
				current := res[currentIndex]
				var overwrite bool
				// NOTE: add more rules here if needed.
				if current.Component.Email == nil && contact.Component.Email != nil {
					// Prefer email components to phone ones.
					overwrite = true
				}

				if overwrite {
					res[currentIndex] = contact
				}
			} else {
				contactForUsername[contact.Username] = len(res)
				res = append(res, contact)
			}
		}
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].DisplayName < res[j].DisplayName
	})

	return res, nil
}
