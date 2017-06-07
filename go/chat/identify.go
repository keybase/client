package chat

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type IdentifyNotifier struct {
	globals.Contextified
	utils.DebugLabeler

	sync.RWMutex
	storage    *storage.Storage
	identCache map[string]keybase1.CanonicalTLFNameAndIDWithBreaks
}

func NewIdentifyNotifier(g *globals.Context) *IdentifyNotifier {
	return &IdentifyNotifier{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "IdentifyNotifier", false),
		identCache:   make(map[string]keybase1.CanonicalTLFNameAndIDWithBreaks),
		storage:      storage.New(g),
	}
}

func (i *IdentifyNotifier) Send(update keybase1.CanonicalTLFNameAndIDWithBreaks) {

	// Send to storage as well (charge forward on error)
	if err := i.storage.UpdateTLFIdentifyBreak(context.Background(), update.TlfID.ToBytes(), update.Breaks.Breaks); err != nil {
		i.Debug(context.Background(), "failed to update storage with TLF identify info: %s", err.Error())
	}

	// Send notification to GUI about identify status
	i.RLock()
	tlfName := update.CanonicalName.String()
	stored, ok := i.identCache[tlfName]
	i.RUnlock()
	if ok {
		// We have the exact update stored, don't send it again
		if stored.Eq(update) {
			i.Debug(context.Background(), "hit cache, not sending notify: %s", tlfName)
			return
		}
	}

	i.Lock()
	i.identCache[tlfName] = update
	i.Unlock()

	i.Debug(context.Background(), "cache miss, sending notify: %s dat: %v", tlfName, update)
	i.G().NotifyRouter.HandleChatIdentifyUpdate(context.Background(), update)
}

type IdentifyChangedHandler struct {
	globals.Contextified
	utils.DebugLabeler
}

func NewIdentifyChangedHandler(g *globals.Context) *IdentifyChangedHandler {
	return &IdentifyChangedHandler{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "IdentifyChangedHandler", false),
	}
}

var errNoConvForUser = errors.New("user not found in inbox")

func (h *IdentifyChangedHandler) getUsername(ctx context.Context, uid keybase1.UID) (string, error) {
	u, err := h.G().GetUPAKLoader().LookupUsername(ctx, uid)
	return u.String(), err
}

func (h *IdentifyChangedHandler) getTLFtoCrypt(ctx context.Context, uid gregor1.UID) (string, chat1.TLFID, error) {

	me := h.G().Env.GetUID()
	inbox := storage.NewInbox(h.G(), me.ToBytes())

	_, allConvs, err := inbox.ReadAll(ctx)
	if err != nil {
		return "", nil, err
	}

	for _, conv := range allConvs {
		if conv.Includes(uid) {
			maxText, err := conv.GetMaxMessage(chat1.MessageType_TEXT)
			if err != nil {
				h.Debug(ctx, "failed to get a max message from conv: uid: %s convID: %s err: %s",
					uid, conv.GetConvID(), err.Error())
				continue
			}

			return maxText.TLFNameExpanded(conv.Metadata.FinalizeInfo), conv.Metadata.IdTriple.Tlfid, nil
		}
	}

	h.Debug(ctx, "no conversation found for update for uid: %s", uid)
	return "", nil, errNoConvForUser
}

func (h *IdentifyChangedHandler) BackgroundIdentifyChanged(ctx context.Context, job engine.IdentifyJob) {
	notifier := NewIdentifyNotifier(h.G())

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
	notifier.Send(notifyPayload)
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
	notifier := NewIdentifyNotifier(h.G())
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
	if err = h.G().Identify2Cache.Delete(uid); err != nil {
		// Charge through this error, probably doesn't matter
		h.Debug(ctx, "HandleUserChanged: unable to delete cache entry: uid: %s: err: %s", uid,
			err.Error())
	}

	// Run against CryptKeys to generate notifications if necessary
	_, err = CtxKeyFinder(ctx, h.G()).Find(ctx, tlfName, chat1.ConversationMembersType_KBFS, false)
	if err != nil {
		h.Debug(ctx, "HandleUserChanged: failed to run CryptKeys: %s", err.Error())
	}

	return nil
}
