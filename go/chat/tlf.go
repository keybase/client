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

type KBFSNameInfoSource struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewKBFSNameInfoSource(g *globals.Context) *KBFSNameInfoSource {
	return &KBFSNameInfoSource{
		DebugLabeler: utils.NewDebugLabeler(g, "KBFSNameInfoSource", false),
		Contextified: globals.NewContextified(g),
	}
}

func (t *KBFSNameInfoSource) tlfKeysClient() (*keybase1.TlfKeysClient, error) {
	if t.G().ConnectionManager == nil {
		return nil, fmt.Errorf("no connection manager available")
	}
	xp := t.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, fmt.Errorf("KBFS client wasn't found")
	}
	return &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(
			xp, libkb.ErrorUnwrapper{}, libkb.LogTagsFromContext),
	}, nil
}

func (t *KBFSNameInfoSource) Lookup(ctx context.Context, tlfName string,
	visibility chat1.TLFVisibility) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", tlfName))()
	var lastErr error
	for i := 0; i < 5; i++ {
		if visibility == chat1.TLFVisibility_PUBLIC {
			var pres keybase1.CanonicalTLFNameAndIDWithBreaks
			pres, err = t.PublicCanonicalTLFNameAndID(ctx, tlfName)
			res.CanonicalName = pres.CanonicalName.String()
			res.ID = chat1.TLFID(pres.TlfID.ToBytes())
			res.IdentifyFailures = pres.Breaks.Breaks
		} else {
			var cres keybase1.GetTLFCryptKeysRes
			cres, err = t.CryptKeys(ctx, tlfName)
			res.CanonicalName = cres.NameIDBreaks.CanonicalName.String()
			res.ID = chat1.TLFID(cres.NameIDBreaks.TlfID.ToBytes())
			res.IdentifyFailures = cres.NameIDBreaks.Breaks.Breaks
			for _, key := range cres.CryptKeys {
				res.CryptKeys = append(res.CryptKeys, key)
			}
		}
		if err != nil {
			if _, ok := err.(auth.BadKeyError); ok {
				// BadKeyError could be returned if there is a rekey race, so
				// we are retrying a few times when that happens
				lastErr = err
				time.Sleep(500 * time.Millisecond)
				continue
			}
			return res, err
		}
		return res, nil
	}

	return res, lastErr
}

func (t *KBFSNameInfoSource) CryptKeys(ctx context.Context, tlfName string) (res keybase1.GetTLFCryptKeysRes, ferr error) {
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return ferr },
		fmt.Sprintf("CryptKeys(tlf=%s,mode=%v)", tlfName, identBehavior))()

	username := t.G().Env.GetUsername()
	if len(username) == 0 {
		return res, libkb.LoginRequiredError{}
	}
	// Prepend username in case it's not present. We don't need to check if it
	// exists already since CryptKeys calls below transforms the TLF name into a
	// canonical one.
	tlfName = string(username) + "," + tlfName

	// call identifyTLF and GetTLFCryptKeys concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))

	var ib []keybase1.TLFIdentifyFailure
	group.Go(func() error {
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: identBehavior,
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

	// GUI Strict mode errors are swallowed earlier, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT &&
		len(res.NameIDBreaks.Breaks.Breaks) > 0 {
		return res, libkb.NewIdentifySummaryError(res.NameIDBreaks.Breaks.Breaks[0])
	}

	return res, nil
}

func (t *KBFSNameInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, ferr error) {
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return ferr },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", tlfName, identBehavior))()

	// call identifyTLF and CanonicalTLFNameAndIDWithBreaks concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))

	var ib []keybase1.TLFIdentifyFailure
	group.Go(func() error {
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: identBehavior,
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

	// GUI Strict mode errors are swallowed earlier, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT && len(res.Breaks.Breaks) > 0 {
		return res, libkb.NewIdentifySummaryError(res.Breaks.Breaks[0])
	}

	return res, nil
}

func (t *KBFSNameInfoSource) CompleteAndCanonicalizePrivateTlfName(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, err error) {
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

func (t *KBFSNameInfoSource) identifyTLF(ctx context.Context, arg keybase1.TLFQuery, private bool) ([]keybase1.TLFIdentifyFailure, error) {
	// need new context as errgroup will cancel it.
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))
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

func (t *KBFSNameInfoSource) identifyUser(ctx context.Context, assertion string, private bool, idBehavior keybase1.TLFIdentifyBehavior) (keybase1.TLFIdentifyFailure, error) {
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
		// Ignore these errors
		if _, ok := err.(libkb.NotFoundError); ok {
			return keybase1.TLFIdentifyFailure{}, nil
		}
		if _, ok := err.(libkb.ResolutionError); ok {
			return keybase1.TLFIdentifyFailure{}, nil
		}

		// Special treatment is needed for GUI strict mode, since we need to
		// simultaneously plumb identify breaks up to the UI, and make sure the
		// overall process returns an error. Swallow the error here so the rest of
		// the identify can proceed, but we will check later (in GetTLFCryptKeys) for breaks with this
		// mode and return an error there.
		if !(libkb.IsIdentifyProofError(err) &&
			idBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT) {
			return keybase1.TLFIdentifyFailure{}, err
		}
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
