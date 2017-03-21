package chat

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
)

type KBFSTLFInfoSource struct {
	utils.DebugLabeler
	libkb.Contextified
}

func NewKBFSTLFInfoSource(g *libkb.GlobalContext) *KBFSTLFInfoSource {
	return &KBFSTLFInfoSource{
		DebugLabeler: utils.NewDebugLabeler(g, "KBFSTLFInfoSource", false),
		Contextified: libkb.NewContextified(g),
	}
}

func (t *KBFSTLFInfoSource) tlfKeysClient() (*keybase1.TlfKeysClient, error) {
	xp := t.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, fmt.Errorf("KBFS client wasn't found")
	}
	return &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(
			xp, libkb.ErrorUnwrapper{}, libkb.LogTagsFromContext),
	}, nil
}

func (t *KBFSTLFInfoSource) Lookup(ctx context.Context, tlfName string,
	visibility chat1.TLFVisibility) (*types.TLFInfo, error) {
	res, err := CtxKeyFinder(ctx).Find(ctx, t, tlfName, visibility == chat1.TLFVisibility_PUBLIC)
	if err != nil {
		return nil, err
	}
	info := &types.TLFInfo{
		ID:               chat1.TLFID(res.NameIDBreaks.TlfID.ToBytes()),
		CanonicalName:    res.NameIDBreaks.CanonicalName.String(),
		IdentifyFailures: res.NameIDBreaks.Breaks.Breaks,
	}
	return info, nil
}

func (t *KBFSTLFInfoSource) CryptKeys(ctx context.Context, tlfName string) (res keybase1.GetTLFCryptKeysRes, err error) {
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("CryptKeys(tlf=%s,mode=%v)", tlfName, identBehavior))()

	query := keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: identBehavior,
	}
	ib, err := t.identifyTLF(ctx, query, true)
	if err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}

	tlfClient, err := t.tlfKeysClient()
	if err != nil {
		return res, err
	}

	resp, err := tlfClient.GetTLFCryptKeys(ctx, query)
	if err != nil {
		return resp, err
	}

	// for now, replace id breaks with those calculated here
	resp.NameIDBreaks.Breaks.Breaks = ib

	if in := CtxIdentifyNotifier(ctx); in != nil {
		in.Send(resp.NameIDBreaks)
	}
	if ok {
		*breaks = appendBreaks(*breaks, resp.NameIDBreaks.Breaks.Breaks)
	}
	return resp, nil
}

func (t *KBFSTLFInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", tlfName, identBehavior))()

	tlfClient, err := t.tlfKeysClient()
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	resp, err := tlfClient.GetPublicCanonicalTLFNameAndID(ctx, keybase1.TLFQuery{
		TlfName:          tlfName,
		IdentifyBehavior: identBehavior,
	})
	if err != nil {
		return resp, err
	}

	if in := CtxIdentifyNotifier(ctx); in != nil {
		in.Send(resp)
	}
	if ok {
		*breaks = appendBreaks(*breaks, resp.Breaks.Breaks)
	}
	return resp, nil
}

func (t *KBFSTLFInfoSource) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
	username := t.G().Env.GetUsername()
	if len(username) == 0 {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, libkb.LoginRequiredError{}
	}

	// Prepend username in case it's not present. We don't need to check if it
	// exists already since CryptKeys calls below transforms the TLF name into a
	// canonical one.
	//
	// This makes username a writer on this TLF, which might be unexpected.
	// TODO: We should think about how to handle read-only TLFs.
	tlfName = string(username) + "," + tlfName

	// TODO: do some caching so we don't end up calling this RPC
	// unnecessarily too often
	resp, err := t.CryptKeys(ctx, tlfName)
	if err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	return resp.NameIDBreaks, nil
}

func (t *KBFSTLFInfoSource) identifyTLF(ctx context.Context, arg keybase1.TLFQuery, private bool) ([]keybase1.TLFIdentifyFailure, error) {
	var fails []keybase1.TLFIdentifyFailure
	pieces := strings.Split(arg.TlfName, ",")
	for _, p := range pieces {
		f, err := t.identifyUser(ctx, p, private, arg.IdentifyBehavior)
		if err != nil {
			return nil, err
		}
		fails = append(fails, f)
	}
	return fails, nil
}

func (t *KBFSTLFInfoSource) identifyUser(ctx context.Context, assertion string, private bool, idBehavior keybase1.TLFIdentifyBehavior) (keybase1.TLFIdentifyFailure, error) {
	reason := "You accessed a public conversation."
	if private {
		reason = fmt.Sprintf("You accessed a private conversation with %s.", assertion)
	}

	arg := keybase1.Identify2Arg{
		UserAssertion:    assertion,
		UseDelegateUI:    true,
		Reason:           keybase1.IdentifyReason{Reason: reason},
		CanSuppressUI:    true,
		IdentifyBehavior: idBehavior,
	}

	sessionID, idUI, err := t.G().UIRouter.GetIdentifyUICtx(ctx)
	if err != nil {
		return keybase1.TLFIdentifyFailure{}, err
	}

	ectx := engine.Context{
		IdentifyUI: idUI,
		SessionID:  sessionID,
		NetContext: ctx,
	}

	eng := engine.NewResolveThenIdentify2(t.G(), &arg)
	err = engine.RunEngine(eng, &ectx)
	if err != nil {
		return keybase1.TLFIdentifyFailure{}, err
	}
	resp := eng.Result()

	var frep keybase1.TLFIdentifyFailure
	if resp != nil {
		frep.User = keybase1.User{
			Uid:      resp.Upk.Uid,
			Username: resp.Upk.Username,
		}
		frep.Breaks = resp.TrackBreaks
	}

	return frep, nil
}

func appendBreaks(l []keybase1.TLFIdentifyFailure, r []keybase1.TLFIdentifyFailure) []keybase1.TLFIdentifyFailure {
	m := make(map[string]bool)
	var res []keybase1.TLFIdentifyFailure
	for _, f := range l {
		m[f.User.Username] = true
		res = append(res, f)
	}
	for _, f := range r {
		if !m[f.User.Username] {
			res = append(res, f)
		}
	}
	return res
}
