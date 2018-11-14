package chat

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type DummyIdentifyNotifier struct{}

func (d DummyIdentifyNotifier) Reset()             {}
func (d DummyIdentifyNotifier) ResetOnGUIConnect() {}
func (d DummyIdentifyNotifier) Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
}

type SimpleIdentifyNotifier struct {
	globals.Contextified
	utils.DebugLabeler
	storage *storage.Storage
}

func NewSimpleIdentifyNotifier(g *globals.Context) *SimpleIdentifyNotifier {
	return &SimpleIdentifyNotifier{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "SimpleIdentifyNotifier", false),
		storage:      storage.New(g, g.ConvSource),
	}
}

func (d *SimpleIdentifyNotifier) Reset()             {}
func (d *SimpleIdentifyNotifier) ResetOnGUIConnect() {}

func (d *SimpleIdentifyNotifier) Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
	// Send to storage as well (charge forward on error)
	if err := d.storage.UpdateTLFIdentifyBreak(ctx, update.TlfID.ToBytes(), update.Breaks.Breaks); err != nil {
		d.Debug(ctx, "failed to update storage with TLF identify info: %s", err.Error())
	}
	d.G().NotifyRouter.HandleChatIdentifyUpdate(ctx, update)
}

type CachingIdentifyNotifier struct {
	globals.Contextified
	utils.DebugLabeler

	sync.RWMutex
	storage    *storage.Storage
	identCache map[string]keybase1.CanonicalTLFNameAndIDWithBreaks
}

func NewCachingIdentifyNotifier(g *globals.Context) *CachingIdentifyNotifier {
	return &CachingIdentifyNotifier{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "CachingIdentifyNotifier", false),
		identCache:   make(map[string]keybase1.CanonicalTLFNameAndIDWithBreaks),
		storage:      storage.New(g, g.ConvSource),
	}
}

func (i *CachingIdentifyNotifier) ResetOnGUIConnect() {
	i.G().ConnectionManager.RegisterLabelCallback(func(typ keybase1.ClientType) {
		switch typ {
		case keybase1.ClientType_GUI_HELPER, keybase1.ClientType_GUI_MAIN:
			i.Reset()
		}
	})
}

func (i *CachingIdentifyNotifier) Reset() {
	i.identCache = make(map[string]keybase1.CanonicalTLFNameAndIDWithBreaks)
}

func (i *CachingIdentifyNotifier) Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {

	// Send to storage as well (charge forward on error)
	if err := i.storage.UpdateTLFIdentifyBreak(ctx, update.TlfID.ToBytes(), update.Breaks.Breaks); err != nil {
		i.Debug(ctx, "failed to update storage with TLF identify info: %s", err.Error())
	}

	// Send notification to GUI about identify status
	tlfName := update.CanonicalName.String()
	i.RLock()
	stored, ok := i.identCache[tlfName]
	i.RUnlock()
	if ok {
		// We have the exact update stored, don't send it again
		if stored.Eq(update) {
			i.Debug(ctx, "hit cache, not sending notify: %s", tlfName)
			return
		}
	}
	i.Lock()
	i.identCache[tlfName] = update
	i.Unlock()

	i.Debug(ctx, "cache miss, sending notify: %s dat: %v", tlfName, update)
	i.G().NotifyRouter.HandleChatIdentifyUpdate(ctx, update)
}

type IdentifyChangedHandler struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewIdentifyChangedHandler(g *globals.Context) *IdentifyChangedHandler {
	return &IdentifyChangedHandler{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "IdentifyChangedHandler", false),
	}
}

var errNoConvForUser = errors.New("user not found in inbox")

func (h *IdentifyChangedHandler) getUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	u, err := h.G().GetUPAKLoader().LookupUsername(ctx, uid)
	return u.String(), err
}

func (h *IdentifyChangedHandler) getTLFtoCrypt(ctx context.Context, uid gregor1.UID) (string, chat1.TLFID, error) {

	me := h.G().ActiveDevice.UID()
	if me.IsNil() {
		return "", nil, libkb.LoggedInError{}
	}
	inbox := storage.NewInbox(h.G())

	_, allConvs, err := inbox.ReadAll(ctx, me.ToBytes())
	if err != nil {
		return "", nil, err
	}

	for _, conv := range allConvs {
		if conv.Conv.Includes(uid) {
			maxText, err := conv.Conv.GetMaxMessage(chat1.MessageType_TEXT)
			if err != nil {
				h.Debug(ctx, "failed to get a max message from conv: uid: %s convID: %s err: %s",
					uid, conv.GetConvID(), err.Error())
				continue
			}

			return maxText.TLFNameExpanded(conv.Conv.Metadata.FinalizeInfo),
				conv.Conv.Metadata.IdTriple.Tlfid, nil
		}
	}

	h.Debug(ctx, "no conversation found for update for uid: %s", uid)
	return "", nil, errNoConvForUser
}

func (h *IdentifyChangedHandler) BackgroundIdentifyChanged(ctx context.Context, job engine.IdentifyJob) {
	notifier := NewCachingIdentifyNotifier(h.G())

	// Get username
	uid := job.UID()
	username, err := h.getUsername(ctx, uid)
	if err != nil {
		h.Debug(ctx, "BackgroundIdentifyChanged: failed to load username: uid: %s err: %s", uid, err)
		return
	}

	// Get TLF info out of inbox
	tlfName, tlfID, err := h.getTLFtoCrypt(ctx, uid.ToBytes())
	if err != nil {
		if err != errNoConvForUser {
			h.Debug(ctx, "BackgroundIdentifyChanged: error finding TLF name for update: err: %s",
				err.Error())
		}
		return
	}

	// Form payload
	h.Debug(ctx, "BackgroundIdentifyChanged: using TLF name: %s", tlfName)
	notifyPayload := keybase1.CanonicalTLFNameAndIDWithBreaks{
		TlfID:         keybase1.TLFID(tlfID.String()),
		CanonicalName: keybase1.CanonicalTlfName(tlfName),
	}
	if job.ThisError() != nil {
		// Handle error case by transmitting a break
		idbreak := keybase1.TLFIdentifyFailure{
			User: keybase1.User{
				Uid:      uid,
				Username: username,
			},
		}
		notifyPayload.Breaks = keybase1.TLFBreak{
			Breaks: []keybase1.TLFIdentifyFailure{idbreak},
		}
		h.Debug(ctx, "BackgroundIdentifyChanged: transmitting a break")
	}

	// Fire away!
	notifier.Send(ctx, notifyPayload)
}

func (h *IdentifyChangedHandler) HandleUserChanged(uid keybase1.UID) (err error) {
	defer h.Trace(context.Background(), func() error { return err },
		fmt.Sprintf("HandleUserChanged(uid=%s)", uid))()

	// If this is about us we don't care
	me := h.G().Env.GetUID()
	if me.Equal(uid) {
		return nil
	}

	// Make a new chat context
	var breaks []keybase1.TLFIdentifyFailure
	ident := keybase1.TLFIdentifyBehavior_CHAT_GUI
	notifier := NewCachingIdentifyNotifier(h.G())
	ctx := Context(context.Background(), h.G(), ident, &breaks, notifier)

	// Find a TLF name from the local inbox that includes the user sent to us
	tlfName, _, err := h.getTLFtoCrypt(ctx, uid.ToBytes())
	if err != nil {
		if err != errNoConvForUser {
			h.Debug(ctx, "HandleUserChanged: error finding TLF name for update: err: %s", err.Error())
			return err
		}
		return nil
	}
	h.Debug(ctx, "HandleUserChanged: using TLF name: %s", tlfName)

	// Take this guy out of the cache, we want this to run fresh
	if err = h.G().Identify2Cache().Delete(uid); err != nil {
		// Charge through this error, probably doesn't matter
		h.Debug(ctx, "HandleUserChanged: unable to delete cache entry: uid: %s: err: %s", uid,
			err.Error())
	}

	// Run against CryptKeys to generate notifications if necessary
	if _, err = CreateNameInfoSource(ctx, h.G(), chat1.ConversationMembersType_IMPTEAMNATIVE).LookupID(ctx,
		tlfName, false); err != nil {
		h.Debug(ctx, "HandleUserChanged: failed to run CryptKeys: %s", err.Error())
	}
	return nil
}

type NameIdentifier struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewNameIdentifier(g *globals.Context) *NameIdentifier {
	return &NameIdentifier{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "NameIdentifier", false),
	}
}

func (t *NameIdentifier) Identify(ctx context.Context, names []string, private bool,
	getTLFID func() keybase1.TLFID, getCanonicalName func() keybase1.CanonicalTlfName) (res []keybase1.TLFIdentifyFailure, err error) {
	idNotifier := CtxIdentifyNotifier(ctx)
	identBehavior, breaks, ok := IdentifyMode(ctx)
	if !ok {
		return res, fmt.Errorf("invalid context with no chat metadata")
	}
	defer t.Trace(ctx, func() error { return err },
		fmt.Sprintf("Identify(names=%s,mode=%v,uid=%s)", strings.Join(names, ","), identBehavior,
			t.G().GetEnv().GetUsername()))()

	if identBehavior == keybase1.TLFIdentifyBehavior_CHAT_SKIP {
		t.Debug(ctx, "SKIP behavior found, not running identify")
		return nil, nil
	}

	// need new context as errgroup will cancel it.
	group, ectx := errgroup.WithContext(BackgroundContext(ctx, t.G()))
	assertions := make(chan string)

	group.Go(func() error {
		defer close(assertions)
		for _, p := range names {
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
				f, err := t.identifyUser(ectx, assertion, private, identBehavior)
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
	for f := range fails {
		res = append(res, f)
	}
	if err := group.Wait(); err != nil {
		return nil, err
	}

	// Run the updates through the identify notifier
	if idNotifier != nil {
		t.Debug(ctx, "sending update through ident notifier: %d breaks", len(res))
		idNotifier.Send(ctx, keybase1.CanonicalTLFNameAndIDWithBreaks{
			Breaks: keybase1.TLFBreak{
				Breaks: res,
			},
			TlfID:         getTLFID(),
			CanonicalName: getCanonicalName(),
		})
	}
	*breaks = appendBreaks(*breaks, res)

	return res, nil
}

func (t *NameIdentifier) identifyUser(ctx context.Context, assertion string, private bool, idBehavior keybase1.TLFIdentifyBehavior) (keybase1.TLFIdentifyFailure, error) {
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

	uis := libkb.UIs{
		IdentifyUI: chatNullIdentifyUI{},
	}
	eng := engine.NewResolveThenIdentify2(t.G().ExternalG(), &arg)
	m := libkb.NewMetaContext(ctx, t.G().ExternalG()).WithUIs(uis)
	if err := engine.RunEngine2(m, eng); err != nil {
		switch err.(type) {
		// Ignore these errors
		// NOTE: Even though we ignore a `libkb.DeletedError` here, if we have
		// previously chatted with the user we will still validate the sigchain
		// when identifying the user and then return this error.
		case libkb.NotFoundError, libkb.ResolutionError, libkb.DeletedError:
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
	resp, err := eng.Result(m)
	if err != nil {
		return keybase1.TLFIdentifyFailure{}, err
	}
	var frep keybase1.TLFIdentifyFailure
	if resp != nil && resp.TrackBreaks != nil {
		frep.User = resp.Upk.ExportToSimpleUser()
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
