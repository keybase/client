package service

import (
	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"golang.org/x/net/context"
)

type EmailsHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewEmailsHandler(xp rpc.Transporter, g *libkb.GlobalContext) *EmailsHandler {
	handler := &EmailsHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}
	return handler
}

var _ keybase1.EmailsInterface = (*EmailsHandler)(nil)

func (h *EmailsHandler) AddEmail(ctx context.Context, arg keybase1.AddEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#AddEmail", func() error { return err })()
	return emails.AddEmail(mctx, arg.Email, arg.Visibility)
}

func (h *EmailsHandler) DeleteEmail(ctx context.Context, arg keybase1.DeleteEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#DeleteEmail", func() error { return err })()
	return emails.DeleteEmail(mctx, arg.Email)
}

func (h *EmailsHandler) SetPrimaryEmail(ctx context.Context, arg keybase1.SetPrimaryEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#SetPrimaryEmail", func() error { return err })()
	return emails.SetPrimaryEmail(mctx, arg.Email)
}

func (h *EmailsHandler) EditEmail(ctx context.Context, arg keybase1.EditEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#EditEmail", func() error { return err })()
	err = emails.DeleteEmail(mctx, arg.OldEmail)
	if err != nil {
		return err
	}
	return emails.AddEmail(mctx, arg.Email, arg.Visibility)
}

func (h *EmailsHandler) SendVerificationEmail(ctx context.Context, arg keybase1.SendVerificationEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#SendVerificationEmail", func() error { return err })()
	return emails.SendVerificationEmail(mctx, arg.Email)
}

func (h *EmailsHandler) SetVisibilityEmail(ctx context.Context, arg keybase1.SetVisibilityEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#SetVisibilityEmailArg", func() error { return err })()
	return emails.SetVisibilityEmail(mctx, arg.Email, arg.Visibility)
}

func (h *EmailsHandler) SetVisibilityAllEmail(ctx context.Context, arg keybase1.SetVisibilityAllEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#SetVisibilityAllEmailArg", func() error { return err })()
	return emails.SetVisibilityAllEmail(mctx, arg.Visibility)
}

func (h *EmailsHandler) GetEmails(ctx context.Context, sessionID int) (ret []keybase1.Email, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#GetEmails", func() error { return err })()
	return emails.GetEmails(mctx)
}

func (h *EmailsHandler) BulkLookupEmails(ctx context.Context, arg keybase1.BulkLookupEmailsArg) (ret []keybase1.EmailLookupResult, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("EmailsHandler#BulkLookupEmails", func() error { return err })()
	return emails.BulkLookupEmails(mctx, arg.EmailContacts)
}
