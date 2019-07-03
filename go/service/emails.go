package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
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
	defer mctx.TraceTimed("EmailsHandler#AddEmail", func() error { return err })()
	return emails.AddEmail(mctx, arg.Email, arg.Visibility)
}

func (h *EmailsHandler) DeleteEmail(ctx context.Context, arg keybase1.DeleteEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#DeleteEmail", func() error { return err })()
	return emails.DeleteEmail(mctx, arg.Email)
}

func (h *EmailsHandler) SetPrimaryEmail(ctx context.Context, arg keybase1.SetPrimaryEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#SetPrimaryEmail", func() error { return err })()
	return emails.SetPrimaryEmail(mctx, arg.Email)
}

func (h *EmailsHandler) EditEmail(ctx context.Context, arg keybase1.EditEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#EditEmail", func() error { return err })()
	err = emails.DeleteEmail(mctx, arg.OldEmail)
	if err != nil {
		return err
	}
	return emails.AddEmail(mctx, arg.Email, arg.Visibility)
}

func (h *EmailsHandler) SendVerificationEmail(ctx context.Context, arg keybase1.SendVerificationEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#SendVerificationEmail", func() error { return err })()
	return emails.SendVerificationEmail(mctx, arg.Email)
}

func (h *EmailsHandler) SetVisibilityEmail(ctx context.Context, arg keybase1.SetVisibilityEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#SetVisibilityEmailArg", func() error { return err })()
	return emails.SetVisibilityEmail(mctx, arg.Email, arg.Visibility)
}

func (h *EmailsHandler) SetVisibilityAllEmail(ctx context.Context, arg keybase1.SetVisibilityAllEmailArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#SetVisibilityAllEmailArg", func() error { return err })()
	return emails.SetVisibilityAllEmail(mctx, arg.Visibility)
}

func (h *EmailsHandler) GetEmails(ctx context.Context, sessionID int) (ret []keybase1.Email, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed("EmailsHandler#GetEmails", func() error { return err })()
	return emails.GetEmails(mctx)
}

const emailsGregorHandlerName = "emailHandler"

type emailsGregorHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*emailsGregorHandler)(nil)

func newEmailsGregorHandler(g *libkb.GlobalContext) *emailsGregorHandler {
	return &emailsGregorHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *emailsGregorHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "email.added", "email.edited", "email.primary_changed", "email.deleted", "email.visibility_changed":
		return true, r.handleEmailChangedMsg(ctx, cli, category, item)
	case "email.verified":
		return true, r.handleVerifiedMsg(ctx, cli, item)
	default:
		if strings.HasPrefix(category, "email.") {
			return false, fmt.Errorf("unknown emailsGregorHandler category: %q", category)
		}
		return false, nil
	}
}

func (r *emailsGregorHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *emailsGregorHandler) IsAlive() bool {
	return true
}

func (r *emailsGregorHandler) Name() string {
	return emailsGregorHandlerName
}

func (r *emailsGregorHandler) handleVerifiedMsg(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	m := libkb.NewMetaContext(ctx, r.G())
	m.Debug("emailsGregorHandler: email.verified received")
	var msg keybase1.EmailAddressVerifiedMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		m.Debug("error unmarshaling email.verified item: %s", err)
		return err
	}
	m.Debug("email.verified unmarshaled: %+v", msg)

	r.G().NotifyRouter.HandleEmailAddressVerified(ctx, msg.Email)
	return r.G().GregorState.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *emailsGregorHandler) handleEmailChangedMsg(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) error {
	mctx := libkb.NewMetaContext(ctx, r.G())
	mctx.Debug("emailsGregorHandler: %s received", category)
	var msg keybase1.EmailAddressChangedMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		mctx.Debug("error unmarshaling %s item: %s", category, err)
		return err
	}
	mctx.Debug("%s unmarshaled: %+v", category, msg)

	emailList, err := emails.GetEmails(mctx)
	if err != nil {
		mctx.Error("Could not get current phone number list during handleEmailChangedMsg: %s", err)
	} else {
		r.G().NotifyRouter.HandleEmailAddressChanged(ctx, emailList, category, msg.Email)
	}
	// Do not dismiss these notifications so other devices can see it and
	// update their state as well.
	return nil
}
