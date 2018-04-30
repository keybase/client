package chat

import (
	"errors"
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

const kbfsTimeout = 15 * time.Second

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
		return nil, errors.New("no connection manager available")
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

func (t *KBFSNameInfoSource) Lookup(ctx context.Context, tlfName string, public bool) (res *types.NameInfo, err error) {
	defer t.Trace(ctx, func() error { return err }, fmt.Sprintf("Lookup(%s)", tlfName))()
	var lastErr error
	res = types.NewNameInfo()
	visibility := keybase1.TLFVisibility_PRIVATE
	if public {
		visibility = keybase1.TLFVisibility_PUBLIC
	}
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
				res.CryptKeys[chat1.ConversationMembersType_KBFS] =
					append(res.CryptKeys[chat1.ConversationMembersType_KBFS], key)
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

func (t *KBFSNameInfoSource) EncryptionKeys(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (*types.NameInfo, error) {
	return t.Lookup(ctx, tlfName, public)
}

func (t *KBFSNameInfoSource) DecryptionKeys(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	keyGeneration int, kbfsEncrypted bool) (*types.NameInfo, error) {
	return t.Lookup(ctx, tlfName, public)
}

func (t *KBFSNameInfoSource) EphemeralEncryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool) (teamEK keybase1.TeamEk, err error) {
	return teamEK, fmt.Errorf("KBFSNameInfoSource doesn't support ephemeral keys")
}

func (t *KBFSNameInfoSource) EphemeralDecryptionKey(ctx context.Context, tlfName string, tlfID chat1.TLFID,
	membersType chat1.ConversationMembersType, public bool,
	generation keybase1.EkGeneration) (teamEK keybase1.TeamEk, err error) {
	return teamEK, fmt.Errorf("KBFSNameInfoSource doesn't support ephemeral keys")
}

func (t *KBFSNameInfoSource) CryptKeys(ctx context.Context, tlfName string) (res keybase1.GetTLFCryptKeysRes, ferr error) {
	identBehavior, _, ok := IdentifyMode(ctx)
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
	doneCh := make(chan struct{})
	group.Go(func() error {
		t.Debug(ectx, "CryptKeys: running identify")
		var err error
		names := utils.SplitTLFName(tlfName)
		ib, err = t.Identify(ectx, names, true,
			func() keybase1.TLFID {
				<-doneCh
				return res.NameIDBreaks.TlfID
			},
			func() keybase1.CanonicalTlfName {
				<-doneCh
				return res.NameIDBreaks.CanonicalName
			},
		)
		return err
	})
	group.Go(func() error {
		defer close(doneCh)
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

		tctx, cancel := context.WithTimeout(ectx, kbfsTimeout)
		defer cancel()
		res, err = tlfClient.GetTLFCryptKeys(tctx, query)
		if err == context.DeadlineExceeded {
			return ErrKeyServerTimeout
		}
		return err
	})

	if err := group.Wait(); err != nil {
		return keybase1.GetTLFCryptKeysRes{}, err
	}
	res.NameIDBreaks.Breaks.Breaks = ib

	// GUI Strict mode errors are swallowed earlier, return an error now (key is that it is
	// after send to IdentifyNotifier)
	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_GUI_STRICT &&
		len(res.NameIDBreaks.Breaks.Breaks) > 0 {
		return res, libkb.NewIdentifySummaryError(res.NameIDBreaks.Breaks.Breaks[0])
	}

	return res, nil
}

func (t *KBFSNameInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tlfName string) (res keybase1.CanonicalTLFNameAndIDWithBreaks, ferr error) {
	identBehavior, _, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return ferr },
		fmt.Sprintf("PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", tlfName, identBehavior))()

	// call Identify and CanonicalTLFNameAndIDWithBreaks concurrently:
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))

	var ib []keybase1.TLFIdentifyFailure
	doneCh := make(chan struct{})
	if identBehavior != keybase1.TLFIdentifyBehavior_CHAT_SKIP {
		group.Go(func() error {
			var err error
			names := utils.SplitTLFName(tlfName)
			ib, err = t.Identify(ectx, names, false,
				func() keybase1.TLFID {
					<-doneCh
					return res.TlfID
				},
				func() keybase1.CanonicalTlfName {
					<-doneCh
					return res.CanonicalName
				},
			)
			return err
		})
	}

	group.Go(func() error {
		defer close(doneCh)
		tlfClient, err := t.tlfKeysClient()
		if err != nil {
			return err
		}

		// skip identify:
		query := keybase1.TLFQuery{
			TlfName:          tlfName,
			IdentifyBehavior: keybase1.TLFIdentifyBehavior_CHAT_SKIP,
		}

		tctx, cancel := context.WithTimeout(ectx, kbfsTimeout)
		defer cancel()
		res, err = tlfClient.GetPublicCanonicalTLFNameAndID(tctx, query)
		if err == context.DeadlineExceeded {
			return ErrKeyServerTimeout
		}
		return err
	})

	if err := group.Wait(); err != nil {
		return keybase1.CanonicalTLFNameAndIDWithBreaks{}, err
	}
	res.Breaks.Breaks = ib

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
