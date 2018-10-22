package service

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/phonenumbers"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"golang.org/x/net/context"
)

type PhoneNumbersHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewPhoneNumbersHandler(xp rpc.Transporter, g *libkb.GlobalContext) *PhoneNumbersHandler {
	handler := &PhoneNumbersHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}
	return handler
}

var _ keybase1.PhoneNumbersInterface = (*PhoneNumbersHandler)(nil)

func (h *PhoneNumbersHandler) AddPhoneNumber(ctx context.Context, arg keybase1.AddPhoneNumberArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("PhoneNumbersHandler#AddPhoneNumber", func() error { return err })()
	return phonenumbers.AddPhoneNumber(mctx, arg.PhoneNumber)
}

func (h *PhoneNumbersHandler) VerifyPhoneNumber(ctx context.Context, arg keybase1.VerifyPhoneNumberArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("PhoneNumbersHandler#VerifyPhoneNumber", func() error { return err })()
	return phonenumbers.VerifyPhoneNumber(mctx, arg.PhoneNumber, arg.Code)
}

func (h *PhoneNumbersHandler) GetPhoneNumbers(ctx context.Context, sessionID int) (ret []keybase1.UserPhoneNumber, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("PhoneNumbersHandler#GetPhoneNumbers", func() error { return err })()
	return phonenumbers.GetPhoneNumbers(mctx)
}

func (h *PhoneNumbersHandler) DeletePhoneNumber(ctx context.Context, arg keybase1.DeletePhoneNumberArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("PhoneNumbersHandler#DeletePhoneNumber", func() error { return err })()
	return phonenumbers.DeletePhoneNumber(mctx, arg.PhoneNumber)
}

func (h *PhoneNumbersHandler) SetVisibilityPhoneNumber(ctx context.Context, arg keybase1.SetVisibilityPhoneNumberArg) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.CTraceTimed("PhoneNumbersHandler#SetVisibilityPhoneNumber", func() error { return err })()
	return phonenumbers.SetVisibilityPhoneNumber(mctx, arg.PhoneNumber, arg.Visibility)
}

const phoneNumbersGregorHandlerName = "phoneHandler"

type phoneNumbersGregorHandler struct {
	libkb.Contextified
}

var _ libkb.GregorInBandMessageHandler = (*phoneNumbersGregorHandler)(nil)

func newPhoneNumbersGregorHandler(g *libkb.GlobalContext) *phoneNumbersGregorHandler {
	return &phoneNumbersGregorHandler{
		Contextified: libkb.NewContextified(g),
	}
}

func (r *phoneNumbersGregorHandler) Create(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	switch category {
	case "phone.added":
		return true, r.handleAddedMsg(ctx, cli, item)
	case "phone.verified":
		return true, r.handleVerifiedMsg(ctx, cli, item)
	case "phone.superseded":
		return true, r.handleSupersededMsg(ctx, cli, item)
	default:
		if strings.HasPrefix(category, "phone.") {
			return false, fmt.Errorf("unknown phoneNumbersGregorHandler category: %q", category)
		}
		return false, nil
	}
}

func (r *phoneNumbersGregorHandler) Dismiss(ctx context.Context, cli gregor1.IncomingInterface, category string, item gregor.Item) (bool, error) {
	return false, nil
}

func (r *phoneNumbersGregorHandler) IsAlive() bool {
	return true
}

func (r *phoneNumbersGregorHandler) Name() string {
	return phoneNumbersGregorHandlerName
}

func (r *phoneNumbersGregorHandler) handleAddedMsg(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	m := libkb.NewMetaContext(ctx, r.G())
	m.CDebugf("phoneNumbersGregorHandler: phone.added received")
	var msg keybase1.PhoneNumberAddedMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		m.CDebugf("error unmarshaling phone.added item: %s", err)
		return err
	}
	m.CDebugf("phone.added unmarshaled: %+v", msg)

	r.G().NotifyRouter.HandlePhoneNumberAdded(ctx, msg.PhoneNumber)

	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *phoneNumbersGregorHandler) handleVerifiedMsg(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	m := libkb.NewMetaContext(ctx, r.G())
	m.CDebugf("phoneNumbersGregorHandler: phone.verified received")
	var msg keybase1.PhoneNumberVerifiedMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		m.CDebugf("error unmarshaling phone.verified item: %s", err)
		return err
	}
	m.CDebugf("phone.verified unmarshaled: %+v", msg)

	r.G().NotifyRouter.HandlePhoneNumberVerified(ctx, msg.PhoneNumber)

	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}

func (r *phoneNumbersGregorHandler) handleSupersededMsg(ctx context.Context, cli gregor1.IncomingInterface, item gregor.Item) error {
	m := libkb.NewMetaContext(ctx, r.G())
	m.CDebugf("phoneNumbersGregorHandler: phone.superseded received")
	var msg keybase1.PhoneNumberSupersededMsg
	if err := json.Unmarshal(item.Body().Bytes(), &msg); err != nil {
		m.CDebugf("error unmarshaling phone.superseded item: %s", err)
		return err
	}
	m.CDebugf("phone.superseded unmarshaled: %+v", msg)

	r.G().NotifyRouter.HandlePhoneNumberSuperseded(ctx, msg.PhoneNumber)

	return r.G().GregorDismisser.DismissItem(ctx, cli, item.Metadata().MsgID())
}
