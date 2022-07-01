package service

import (
	"fmt"
	"strings"

	email_utils "github.com/keybase/client/go/emails"
	"github.com/keybase/client/go/invitefriends"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"

	"golang.org/x/net/context"
)

type InviteFriendsHandler struct {
	libkb.Contextified
	*BaseHandler
}

func NewInviteFriendsHandler(xp rpc.Transporter, g *libkb.GlobalContext) *InviteFriendsHandler {
	handler := &InviteFriendsHandler{
		Contextified: libkb.NewContextified(g),
		BaseHandler:  NewBaseHandler(g, xp),
	}
	return handler
}

var _ keybase1.InviteFriendsInterface = (*InviteFriendsHandler)(nil)

func (h *InviteFriendsHandler) InvitePeople(ctx context.Context, arg keybase1.InvitePeopleArg) (succeeded int, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace("InviteFriendsHandler#InvitePeople", &err)()

	if err := assertLoggedIn(ctx, h.G()); err != nil {
		mctx.Debug("not logged in err: %v", err)
		return 0, err
	}

	allOK := true
	var assertions []string
	if arg.Emails.EmailsFromContacts != nil {
		for _, email := range *arg.Emails.EmailsFromContacts {
			assertion, parseErr := libkb.ParseAssertionURLKeyValue(mctx.G().MakeAssertionContext(mctx), "email", email.String(), false)
			if parseErr != nil {
				allOK = false
				mctx.Debug("failed to parse email %q; skipping: %s", email, parseErr)
				continue
			}
			assertions = append(assertions, assertion.String())
		}
	}
	if arg.Emails.CommaSeparatedEmailsFromUser != nil {
		var malformed []string
		parsedEmails := email_utils.ParseSeparatedEmails(mctx, *arg.Emails.CommaSeparatedEmailsFromUser, &malformed)
		if len(malformed) > 0 {
			allOK = false
		}

		actx := mctx.G().MakeAssertionContext(mctx)
		for _, email := range parsedEmails {
			// `strict` argument here doesn't actually do anything for "email" assertions.
			assertion, parseErr := libkb.ParseAssertionURLKeyValue(actx, "email", email, false /* strict */)
			if parseErr != nil {
				mctx.Debug("failed to create assertion from email %q: %s", email, parseErr)
				allOK = false
				continue
			}
			assertions = append(assertions, assertion.String())
		}
	}
	for _, phone := range arg.Phones {
		phoneStr := strings.TrimPrefix(phone.String(), "+")
		assertion, parseErr := libkb.ParseAssertionURLKeyValue(mctx.G().MakeAssertionContext(mctx), "phone", phoneStr, false)
		if parseErr != nil {
			allOK = false
			mctx.Debug("failed to parse phone number %q; skipping: %s", phone, parseErr)
			continue
		}
		assertions = append(assertions, assertion.String())
	}

	if len(assertions) == 0 {
		if allOK {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to parse any email or phone number")
	}

	type apiRes struct {
		libkb.AppStatusEmbed
	}
	payload := make(libkb.JSONPayload)
	payload["assertions"] = assertions
	apiArg := libkb.APIArg{
		Endpoint:    "invite_friends/invite",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	}
	var res apiRes
	err = mctx.G().API.PostDecode(mctx, apiArg, &res)
	if err != nil {
		return 0, err
	}
	return len(assertions), nil
}

func (h *InviteFriendsHandler) GetInviteCounts(ctx context.Context) (counts keybase1.InviteCounts, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace("InviteFriendsHandler#GetInviteCounts", &err)()

	return invitefriends.GetCounts(mctx)
}

func (h *InviteFriendsHandler) RequestInviteCounts(ctx context.Context) (err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.Trace("InviteFriendsHandler#RequestInviteCounts", &err)()

	return invitefriends.RequestNotification(mctx)
}
