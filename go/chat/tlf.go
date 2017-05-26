package chat

import (
	"fmt"
	"strings"
	"time"

	"github.com/keybase/client/go/auth"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type KBFSTLFInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewKBFSTLFInfoSource(g *globals.Context) *KBFSTLFInfoSource {
	return &KBFSTLFInfoSource{
		DebugLabeler: utils.NewDebugLabeler(g, "KBFSTLFInfoSource", false),
		Contextified: globals.NewContextified(g),
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
	var lastErr error
	for i := 0; i < 5; i++ {
		res, err := CtxKeyFinder(ctx).Find(ctx, t, tlfName, visibility == chat1.TLFVisibility_PUBLIC)
		if err != nil {
			if _, ok := err.(auth.BadKeyError); ok {
				// BadKeyError could be returned if there is a rekey race, so
				// we are retrying a few times when that happens
				lastErr = err
				time.Sleep(500 * time.Millisecond)
				continue
			}
			return nil, err
		}
		info := &types.TLFInfo{
			ID:               chat1.TLFID(res.NameIDBreaks.TlfID.ToBytes()),
			CanonicalName:    res.NameIDBreaks.CanonicalName.String(),
			IdentifyFailures: res.NameIDBreaks.Breaks.Breaks,
		}
		return info, nil
	}

	return nil, lastErr
}

func (t *KBFSTLFInfoSource) CryptKeys(ctx context.Context, tlfName string) (res keybase1.GetTLFCryptKeysRes, ferr error) {
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return ferr },
		fmt.Sprintf("CryptKeys(tlf=%s,mode=%v)", tlfName, identBehavior))()

	// call identifyTLF and GetTLFCryptKeys concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G().GetEnv()))

	var ib []keybase1.TLFIdentifyFailure
	group.Go(func() error {
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
		}
		var err error
		ib, err = t.identifyTLF(ectx, query, true)
		return err
	})

	group.Go(func() error {
		tlfClient, err := t.tlfKeysClient()
		if err != nil {
			return err
		}

		// skip identify:
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		}

		res, err = tlfClient.GetTLFCryptKeys(ectx, query)
		return err
	})

	if err := group.Wait(); err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}

	// use id breaks calculated by identifyTLF
	res.NameIDBreaks.Breaks.Breaks = ib

	if in := CtxIdentifyNotifier(ctx); in != nil {
		in.Send(res.NameIDBreaks)
	}
	*breaks = appendBreaks(*breaks, res.NameIDBreaks.Breaks.Breaks)

	// If the given identify mode treats breaks as errors, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if !identBehavior.WarningInsteadOfErrorOnBrokenTracks() && len(res.NameIDBreaks.Breaks.Breaks) > 0 {
		return res, libkb.NewIdentifySummaryError(res.NameIDBreaks.Breaks.Breaks[0])
	}

	return res, nil
}

func (t *KBFSTLFInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, ferr error) {
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return ferr },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", tlfName, identBehavior))()

	// call identifyTLF and CanonicalTLFNameAndIDWithBreaks concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G().GetEnv()))

	var ib []keybase1.TLFIdentifyFailure
	group.Go(func() error {
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_GUI,
		}

		var err error
		ib, err = t.identifyTLF(ectx, query, false)
		return err
	})

	group.Go(func() error {
		tlfClient, err := t.tlfKeysClient()
		if err != nil {
			return err
		}

		// skip identify:
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		}

		res, err = tlfClient.GetPublicCanonicalTLFNameAndID(ectx, query)
		return err
	})

	if err := group.Wait(); err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}

	// use id breaks calculated by identifyTLF
	res.Breaks.Breaks = ib
	if in := CtxIdentifyNotifier(ctx); in != nil {
		in.Send(res)
	}
	*breaks = appendBreaks(*breaks, res.Breaks.Breaks)

	// If the given identify mode treats breaks as errors, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if !identBehavior.WarningInsteadOfErrorOnBrokenTracks() && len(res.Breaks.Breaks) > 0 {
		return res, libkb.NewIdentifySummaryError(res.Breaks.Breaks[0])
	}

	return res, nil
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
	// need new context as errgroup will cancel it.
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G().GetEnv()))
	assertions := make(chan string)

	group.Go(func() error {
		defer close(assertions)
		pieces := strings.Split(strings.Fields(arg.TlfName)[0], ",")
		for _, p := range pieces {
			select {
			case assertions <- p:
			case <-ectx.Done():
				return ectx.Err()
			}
		}
		return nil
	})

	fails := make(chan keybase1.TLFIdentifyFailure)
	const numIdentifiers = 3
	for i := 0; i < numIdentifiers; i++ {
		group.Go(func() error {
			for assertion := range assertions {
				f, err := t.identifyUser(ectx, assertion, private, arg.IdentifyBehavior)
				if err != nil {
					return err
				}
				if f.Breaks == nil {
					continue
				}
				select {
				case fails <- f:
				case <-ectx.Done():
					return ectx.Err()
				}
			}
			return nil
		})
	}

	go func() {
		group.Wait()
		close(fails)
	}()

	var res []keybase1.TLFIdentifyFailure
	for f := range fails {
		res = append(res, f)
	}

	if err := group.Wait(); err != nil {
		return nil, err
	}
	return res, nil
}

func (t *KBFSTLFInfoSource) identifyUser(ctx context.Context, assertion string, private bool, idBehavior keybase1.TLFIdentifyBehavior) (keybase1.TLFIdentifyFailure, error) {
	reason := "You accessed a public conversation."
	if private {
		reason = fmt.Sprintf("You accessed a private conversation with %s.", assertion)
	}

	arg := keybase1.Identify2Arg{
		UserAssertion:    assertion,
		UseDelegateUI:    false,
		Reason:           keybase1.IdentifyReason{Reason: reason},
		CanSuppressUI:    true,
		IdentifyBehavior: idBehavior,
	}

	ectx := engine.Context{
		IdentifyUI: chatNullIdentifyUI{},
		NetContext: ctx,
	}

	eng := engine.NewResolveThenIdentify2(t.G().ExternalG(), &arg)
	err := engine.RunEngine(eng, &ectx)
	if err != nil {
		if _, ok := err.(libkb.NotFoundError); ok {
			err = nil
		}
		if _, ok := err.(libkb.ResolutionError); ok {
			err = nil
		}
		return keybase1.TLFIdentifyFailure{}, err
	}
	resp := eng.Result()

	var frep keybase1.TLFIdentifyFailure
	if resp != nil && resp.TrackBreaks != nil {
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
