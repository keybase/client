package chat

import (
	"fmt"
	"time"

	"github.com/keybase/client/go/auth"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
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
	*NameIdentifier
}

func NewKBFSNameInfoSource(g *globals.Context) *KBFSNameInfoSource {
	return &KBFSNameInfoSource{
		DebugLabeler:   utils.NewDebugLabeler(g.GetLog(), "KBFSNameInfoSource", false),
		Contextified:   globals.NewContextified(g),
		NameIdentifier: NewNameIdentifier(g),
	}
}

func (t *KBFSNameInfoSource) tlfKeysClient() (*keybase1.TlfKeysClient, error) {
	if t.G().ConnectionManager == nil {
		return nil, fmt.Errorf("no connection manager available")
	}
	xp := t.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, libkb.KBFSNotRunningError{}
	}
	return &keybase1.TlfKeysClient{
		Cli: rpc.NewClient(
			xp, libkb.NewContextifiedErrorUnwrapper(t.G().ExternalG()), libkb.LogTagsFromContext),
	}, nil
}

func (t *KBFSNameInfoSource) Lookup(ctx context.Context, tlfName string,
	visibility keybase1.TLFVisibility) (res types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", tlfName))()
	var lastErr error
	for i := 0; i < 5; i++ {
		if visibility == keybase1.TLFVisibility_PUBLIC {
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
	idNotifier := CtxIdentifyNotifier(ctx)
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

	// call Identify and GetTLFCryptKeys concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))

	var ib []keybase1.TLFIdentifyFailure
	if identBehavior != keybase1.TLFIdentifyBehavior_CHAT_SKIP {
		t.Debug(ectx, "CryptKeys: running identify")
		group.Go(func() error {
			query := keybase1.TLFQuery{
				TlfName:          tlfName,
				IdentifyBehavior: identBehavior,
			}
			var err error
			ib, err = t.Identify(ectx, query, true)
			return err
		})
		// use id breaks calculated by Identify
		res.NameIDBreaks.Breaks.Breaks = ib

		if idNotifier != nil {
			idNotifier.Send(res.NameIDBreaks)
		}
		*breaks = appendBreaks(*breaks, res.NameIDBreaks.Breaks.Breaks)
	}

	group.Go(func() error {
		t.Debug(ectx, "CryptKeys: running GetTLFCryptKeys on KFBS daemon")
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

	// GUI Strict mode errors are swallowed earlier, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT &&
		len(res.NameIDBreaks.Breaks.Breaks) > 0 {
		return res, libkb.NewIdentifySummaryError(res.NameIDBreaks.Breaks.Breaks[0])
	}

	return res, nil
}

func (t *KBFSNameInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, ferr error) {
	idNotifier := CtxIdentifyNotifier(ctx)
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return ferr },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", tlfName, identBehavior))()

	// call Identify and CanonicalTLFNameAndIDWithBreaks concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))

	var ib []keybase1.TLFIdentifyFailure
	if identBehavior != keybase1.TLFIdentifyBehavior_CHAT_SKIP {
		group.Go(func() error {
			query := keybase1.TLFQuery{
				TlfName:          tlfName,
				IdentifyBehavior: identBehavior,
			}

			var err error
			ib, err = t.Identify(ectx, query, false)
			return err
		})

		// use id breaks calculated by Identify
		res.Breaks.Breaks = ib
		if idNotifier != nil {
			idNotifier.Send(res)
		}
		*breaks = appendBreaks(*breaks, res.Breaks.Breaks)
	}

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
