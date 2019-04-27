package service

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/phonenumbers"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/uidmap"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type bulkLookupContactsProvider struct {
}

func (c *bulkLookupContactsProvider) LookupPhoneNumbers(mctx libkb.MetaContext, numbers []keybase1.RawPhoneNumber,
	userRegion keybase1.RegionCode) (res []contacts.ContactLookupResult, err error) {

	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#LookupContactList(len=%d)", len(numbers)),
		func() error { return err })()

	regionCodes := make([]keybase1.RegionCode, len(numbers))
	var maybeUserRegion *keybase1.RegionCode
	if !userRegion.IsNil() {
		maybeUserRegion = &userRegion
	}
	ret, err := phonenumbers.BulkLookupPhoneNumbers(mctx, numbers, regionCodes, maybeUserRegion)
	if err != nil {
		return res, err
	}
	res = make([]contacts.ContactLookupResult, len(numbers))
	for i, v := range ret {
		if v.Err != nil {
			mctx.Debug("Server returned an error while looking up phone %q: %s", numbers[i], *v.Err)
			continue
		}
		if v.Uid != nil {
			res[i].Found = true
			res[i].UID = *v.Uid
		}
	}
	return res, nil
}

func (c *bulkLookupContactsProvider) LookupEmails(mctx libkb.MetaContext, emailList []keybase1.EmailAddress) (res []contacts.ContactLookupResult, err error) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#LookupEmails(len=%d)", len(emailList)),
		func() error { return err })()

	strList := make([]string, len(emailList))
	for i, v := range emailList {
		strList[i] = string(v)
	}
	ret, err := emails.BulkLookupEmails(mctx, strList)
	if err != nil {
		return res, err
	}
	res = make([]contacts.ContactLookupResult, len(emailList))
	for i, v := range ret {
		if v.Uid != nil {
			res[i].Found = true
			res[i].UID = *v.Uid
		}
	}
	return res, nil
}

func (c *bulkLookupContactsProvider) FillUsernames(mctx libkb.MetaContext, res []keybase1.ProcessedContact) {
	defer mctx.TraceTimed(fmt.Sprintf("bulkLookupContactsProvider#FillUsernames(len=%d)", len(res)),
		func() error { return nil })()

	const fullnameFreshness = 10 * time.Minute
	const networkTimeBudget = 0

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

type ContactsHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewContactsHandler(xp rpc.Transporter, g *libkb.GlobalContext) *ContactsHandler {
	handler := &ContactsHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}
	return handler
}

var _ keybase1.ContactsInterface = (*ContactsHandler)(nil)

func (h *ContactsHandler) LookupContactList(ctx context.Context, arg keybase1.LookupContactListArg) (res []keybase1.ProcessedContact, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("LOOKCON")
	defer mctx.TraceTimed(fmt.Sprintf("ContactsHandler#LookupContactList(len=%d)", len(arg.Contacts)),
		func() error { return err })()
	provider := &contacts.CachedContactsProvider{
		Provider: &bulkLookupContactsProvider{},
	}
	return contacts.ResolveContacts(mctx, provider, arg.Contacts, arg.UserRegionCode)
}
