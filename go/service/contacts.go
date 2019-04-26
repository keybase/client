package service

import (
	"fmt"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

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
		Provider: &contacts.BulkLookupContactsProvider{},
	}
	return contacts.ResolveContacts(mctx, provider, arg.Contacts, arg.UserRegionCode)
}
