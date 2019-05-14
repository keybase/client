package service

import (
	"fmt"
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
	numbers []keybase1.RawPhoneNumber, userRegion keybase1.RegionCode) (contacts.ContactLookupMap, error) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#LookupAll(len=%d)", len(emails)+len(numbers)),
		func() error { return nil })()
	return contacts.BulkLookupContacts(mctx, emails, numbers, userRegion)
}

func (c *bulkLookupContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#FillUsernames(len=%d)", len(res)),
		func() error { return nil })()

	const fullnameFreshness = 10 * time.Minute
	const networkTimeBudget = 0
	const forceNetworkForFullNames = true

	uidSet := make(map[keybase1.UID]struct{}, len(res))
	for _, v := range res {
		if v.Resolved {
			uidSet[v.Uid] = struct{}{}
		}
	}
	uids := make([]keybase1.UID, 0, len(uidSet))
	for k := range uidSet {
		uids = append(uids, k)
	}
	nameMap, err := uidmap.MapUIDsReturnMapMctx(mctx, uids, fullnameFreshness, networkTimeBudget, forceNetworkForFullNames)
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

func (c *bulkLookupContactsProvider) FillFollowing(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#FillFollowing(len=%d)", len(res)),
		func() error { return nil })()

	arg := libkb.NewLoadUserArgWithMetaContext(mctx).WithSelf(true).WithStubMode(libkb.StubModeUnstubbed)
	err := mctx.G().GetFullSelfer().WithUser(arg, func(user *libkb.User) error {
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

		if len(trackList) == 0 {
			// Nothing to do.
			return nil
		}

		uidSet := make(map[keybase1.UID]struct{}, len(trackList))
		for _, track := range trackList {
			uid, err := track.GetTrackedUID()
			if err != nil {
				return err
			}

			uidSet[uid] = struct{}{}
		}

		for i, v := range res {
			_, found := uidSet[v.Uid]
			if found {
				res[i].Following = true
			}
		}

		return nil
	})

	if err != nil {
		mctx.Warning("Unable to get following list: %s", err)
	}
}

type ContactsHandler struct {
	libkb.Contextified
	*BaseHandler

	contactsProvider *contacts.CachedContactsProvider
}

func NewContactsHandler(xp rpc.Transporter, g *libkb.GlobalContext) *ContactsHandler {
	contactsProvider := &contacts.CachedContactsProvider{
		Provider: &bulkLookupContactsProvider{},
		Store:    contacts.NewContactCacheStore(g),
	}

	handler := &ContactsHandler{
		Contextified:     libkb.NewContextified(g),
		BaseHandler:      NewBaseHandler(g, xp),
		contactsProvider: contactsProvider,
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
