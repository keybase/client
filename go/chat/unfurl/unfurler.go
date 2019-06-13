package unfurl

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"sync"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/s3"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

type unfurlTask struct {
	UID    gregor1.UID
	ConvID chat1.ConversationID
	URL    string
	Result *chat1.Unfurl
}

type UnfurlMessageSender interface {
	SendUnfurlNonblock(ctx context.Context, convID chat1.ConversationID,
		msg chat1.MessagePlaintext, clientPrev chat1.MessageID, outboxID chat1.OutboxID) (chat1.OutboxID, error)
}

type Unfurler struct {
	sync.Mutex
	prefetchLock sync.Mutex
	globals.Contextified
	utils.DebugLabeler

	unfurlMap map[string]bool
	extractor *Extractor
	scraper   *Scraper
	packager  *Packager
	settings  *Settings
	sender    UnfurlMessageSender

	// testing
	unfurlCh chan *chat1.Unfurl
	retryCh  chan struct{}
}

var _ types.Unfurler = (*Unfurler)(nil)

func NewUnfurler(g *globals.Context, store attachments.Store, s3signer s3.Signer,
	storage types.ConversationBackedStorage, sender UnfurlMessageSender, ri func() chat1.RemoteInterface) *Unfurler {
	log := g.GetLog()
	extractor := NewExtractor(log)
	scraper := NewScraper(log)
	packager := NewPackager(log, store, s3signer, ri)
	settings := NewSettings(log, storage)
	return &Unfurler{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(log, "Unfurler", false),
		unfurlMap:    make(map[string]bool),
		extractor:    extractor,
		scraper:      scraper,
		packager:     packager,
		settings:     settings,
		sender:       sender,
	}
}

func (u *Unfurler) SetClock(clock clockwork.Clock) {
	u.scraper.cache.setClock(clock)
	u.packager.cache.setClock(clock)
}

func (u *Unfurler) SetTestingRetryCh(ch chan struct{}) {
	u.retryCh = ch
}

func (u *Unfurler) SetTestingUnfurlCh(ch chan *chat1.Unfurl) {
	u.unfurlCh = ch
}

func (u *Unfurler) Complete(ctx context.Context, outboxID chat1.OutboxID) {
	defer u.Trace(ctx, func() error { return nil }, "Complete(%s)", outboxID)()
	if err := u.G().GetKVStore().Delete(u.taskKey(outboxID)); err != nil {
		u.Debug(ctx, "Complete: failed to delete task: %s", err)
	}
	if err := u.G().GetKVStore().Delete(u.statusKey(outboxID)); err != nil {
		u.Debug(ctx, "Complete: failed to delete status: %s", err)
	}
}

func (u *Unfurler) statusKey(outboxID chat1.OutboxID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBUnfurler,
		Key: fmt.Sprintf("s|%s", outboxID),
	}
}

func (u *Unfurler) taskKey(outboxID chat1.OutboxID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBUnfurler,
		Key: fmt.Sprintf("t|%s", outboxID),
	}
}

func (u *Unfurler) Status(ctx context.Context, outboxID chat1.OutboxID) (status types.UnfurlerTaskStatus, res *chat1.UnfurlResult, err error) {
	defer u.Trace(ctx, func() error { return nil }, "Status(%s)", outboxID)()
	task, err := u.getTask(ctx, outboxID)
	if err != nil {
		u.Debug(ctx, "Status: error finding task: outboxID: %s err: %s", outboxID, err)
		return types.UnfurlerTaskStatusFailed, nil, err
	}
	found, err := u.G().GetKVStore().GetInto(&status, u.statusKey(outboxID))
	if err != nil {
		return types.UnfurlerTaskStatusFailed, nil, err
	}
	if !found {
		u.Debug(ctx, "Status: failed to find status, using unfurling: outboxID: %s", outboxID)
		status = types.UnfurlerTaskStatusUnfurling
	}
	if task.Result != nil {
		return status, &chat1.UnfurlResult{
			Unfurl: *task.Result,
			Url:    task.URL,
		}, nil
	}
	return status, nil, nil
}

func (u *Unfurler) Retry(ctx context.Context, outboxID chat1.OutboxID) {
	defer u.Trace(ctx, func() error { return nil }, "Retry(%s)", outboxID)()
	u.unfurl(ctx, outboxID)
	if u.retryCh != nil {
		u.retryCh <- struct{}{}
	}
}

func (u *Unfurler) extractURLs(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) (res []ExtractorHit) {
	if !msg.IsValid() {
		return nil
	}
	body := msg.Valid().MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return nil
	}
	switch typ {
	case chat1.MessageType_TEXT:
		hits, err := u.extractor.Extract(ctx, uid, convID, msg.GetMessageID(), body.Text().Body, u.settings)
		if err != nil {
			u.Debug(ctx, "extractURLs: failed to extract: %s", err)
			return nil
		}
		return hits
	}
	return nil
}

func (u *Unfurler) getTask(ctx context.Context, outboxID chat1.OutboxID) (res unfurlTask, err error) {
	found, err := u.G().GetKVStore().GetInto(&res, u.taskKey(outboxID))
	if err != nil {
		return res, err
	}
	if !found {
		return res, libkb.NotFoundError{}
	}
	return res, nil
}

func (u *Unfurler) saveTask(ctx context.Context, outboxID chat1.OutboxID, uid gregor1.UID,
	convID chat1.ConversationID, url string) error {
	return u.G().GetKVStore().PutObj(u.taskKey(outboxID), nil, unfurlTask{
		UID:    uid,
		ConvID: convID,
		URL:    url,
	})
}

func (u *Unfurler) setTaskResult(ctx context.Context, outboxID chat1.OutboxID, unfurl chat1.Unfurl) error {
	task, err := u.getTask(ctx, outboxID)
	if err != nil {
		return err
	}
	task.Result = &unfurl
	return u.G().GetKVStore().PutObj(u.taskKey(outboxID), nil, task)
}

func (u *Unfurler) setStatus(ctx context.Context, outboxID chat1.OutboxID, status types.UnfurlerTaskStatus) error {
	return u.G().GetKVStore().PutObj(u.statusKey(outboxID), nil, status)
}

func (u *Unfurler) makeBaseUnfurlMessage(ctx context.Context, fromMsg chat1.MessageUnboxed, outboxID chat1.OutboxID) (msg chat1.MessagePlaintext, err error) {
	if !fromMsg.IsValid() {
		return msg, errors.New("invalid message")
	}
	tlfName := fromMsg.Valid().ClientHeader.TlfName
	public := fromMsg.Valid().ClientHeader.TlfPublic
	msg = chat1.MessagePlaintext{
		ClientHeader: chat1.MessageClientHeader{
			MessageType: chat1.MessageType_UNFURL,
			TlfName:     tlfName,
			TlfPublic:   public,
			OutboxID:    &outboxID,
			Supersedes:  fromMsg.GetMessageID(),
		},
		MessageBody: chat1.NewMessageBodyWithUnfurl(chat1.MessageUnfurl{
			MessageID: fromMsg.GetMessageID(),
		}),
	}
	return msg, nil
}

func (u *Unfurler) getOutboxIDFromURL(url string, convID chat1.ConversationID, msg chat1.MessageUnboxed) chat1.OutboxID {
	seed := fmt.Sprintf("%s:%s:%d", url, convID, msg.GetMessageID())
	return storage.DeriveOutboxID([]byte(seed))
}

func (u *Unfurler) UnfurlAndSend(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msg chat1.MessageUnboxed) {
	defer u.Trace(ctx, func() error { return nil }, "UnfurlAndSend")()
	// early out for errors
	if !msg.IsValid() {
		return
	}
	// get URL hits
	hits := u.extractURLs(ctx, uid, convID, msg)
	if len(hits) == 0 {
		return
	}
	// get a map for all the URLs we have already unfurled
	prevUnfurled := make(map[string]bool)
	for _, u := range msg.Valid().Unfurls {
		prevUnfurled[u.Url] = true
	}
	// for each hit, either prompt the user for action, or generate a new message
	for _, hit := range hits {
		if prevUnfurled[hit.URL] {
			u.Debug(ctx, "UnfurlAndSend: skipping prev unfurled")
			continue
		}
		prevUnfurled[hit.URL] = true // only one action per unique URL
		switch hit.Typ {
		case ExtractorHitPrompt:
			domain, err := GetDomain(hit.URL)
			if err != nil {
				u.Debug(ctx, "UnfurlAndSend: error getting domain for prompt: %s", err)
				continue
			}
			u.G().ActivityNotifier.PromptUnfurl(ctx, uid, convID, msg.GetMessageID(), domain)
		case ExtractorHitUnfurl:
			outboxID := u.getOutboxIDFromURL(hit.URL, convID, msg)
			if _, err := u.getTask(ctx, outboxID); err == nil {
				u.Debug(ctx, "UnfurlAndSend: skipping URL hit, task exists: outboxID: %s", outboxID)
				continue
			}
			unfurlMsg, err := u.makeBaseUnfurlMessage(ctx, msg, outboxID)
			if err != nil {
				u.Debug(ctx, "UnfurlAndSend: failed to make message: %s", err)
				continue
			}
			u.Debug(ctx, "UnfurlAndSend: saving task for outboxID: %s", outboxID)
			if err := u.saveTask(ctx, outboxID, uid, convID, hit.URL); err != nil {
				u.Debug(ctx, "UnfurlAndSend: failed to save task: %s", err)
				continue
			}
			// Unfurl in background and send the message (requires nonblocking sender)
			u.unfurl(ctx, outboxID)
			u.Debug(ctx, "UnfurlAndSend: sending message for outboxID: %s", outboxID)
			if _, err := u.sender.SendUnfurlNonblock(ctx, convID, unfurlMsg, msg.GetMessageID(), outboxID); err != nil {
				u.Debug(ctx, "UnfurlAndSend: failed to send message: %s", err)
			}
		default:
			u.Debug(ctx, "UnfurlAndSend: unknown hit typ: %v", hit.Typ)
		}
	}
}

// Prefetch attempts to parse hits out of `msgText` and scrape/package the
// unfurl so the result is cached.
func (u *Unfurler) Prefetch(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgText string) (numPrefetched int) {
	u.prefetchLock.Lock()
	defer u.prefetchLock.Unlock()
	defer u.Trace(ctx, func() error { return nil }, "Prefetch")()

	hits, err := u.extractor.Extract(ctx, uid, convID, 0, msgText, u.settings)
	if err != nil {
		u.Debug(ctx, "Prefetch: failed to extract: %s", err)
		return 0
	} else if len(hits) == 0 {
		return 0
	}

	prevUnfurled := make(map[string]bool)
	// for each hit that is already whitelisted try to prefetch the result to
	// populate the message cache.
	for _, hit := range hits {
		if prevUnfurled[hit.URL] {
			u.Debug(ctx, "Prefetch: skipping prev unfurled")
			continue
		}
		prevUnfurled[hit.URL] = true // only one action per unique URL
		if hit.Typ == ExtractorHitUnfurl {
			if _, err := u.scrapeAndPackage(ctx, uid, convID, hit.URL); err != nil {
				u.Debug(ctx, "Prefetch: unable to scrapeAndPackge: %s", err)
			} else {
				numPrefetched++
			}
		}
	}
	return numPrefetched
}

func (u *Unfurler) checkAndSetUnfurling(ctx context.Context, outboxID chat1.OutboxID) (inprogress bool) {
	u.Lock()
	defer u.Unlock()
	if u.unfurlMap[outboxID.String()] {
		return true
	}
	u.unfurlMap[outboxID.String()] = true
	return false
}

func (u *Unfurler) doneUnfurling(outboxID chat1.OutboxID) {
	u.Lock()
	defer u.Unlock()
	delete(u.unfurlMap, outboxID.String())
}

func (u *Unfurler) detectPermError(err error) bool {
	switch e := err.(type) {
	case *net.DNSError:
		return !e.Temporary()
	case *url.Error:
		return !e.Temporary()
	}
	return false
}

func (u *Unfurler) testingSendUnfurl(unfurl *chat1.Unfurl) {
	if u.unfurlCh != nil {
		u.unfurlCh <- unfurl
	}
}

func (u *Unfurler) scrapeAndPackage(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	url string) (unfurl chat1.Unfurl, err error) {
	unfurlRaw, err := u.scraper.Scrape(ctx, url, nil)
	if err != nil {
		u.Debug(ctx, "unfurl: failed to scrape: %s(%T)", err, err)
		return unfurl, err
	}
	packaged, err := u.packager.Package(ctx, uid, convID, unfurlRaw)
	if err != nil {
		u.Debug(ctx, "unfurl: failed to package: %s", err)
		return unfurl, err
	}
	return packaged, err
}

func (u *Unfurler) unfurl(ctx context.Context, outboxID chat1.OutboxID) {
	defer u.Trace(ctx, func() error { return nil }, "unfurl(%s)", outboxID)()
	if u.checkAndSetUnfurling(ctx, outboxID) {
		u.Debug(ctx, "unfurl: already unfurling outboxID: %s", outboxID)
		return
	}
	ctx = libkb.CopyTagsToBackground(ctx)
	go func(ctx context.Context) (unfurl *chat1.Unfurl, err error) {
		defer func() { u.testingSendUnfurl(unfurl) }()
		defer u.doneUnfurling(outboxID)
		defer func() {
			if err != nil {
				status := types.UnfurlerTaskStatusFailed
				if u.detectPermError(err) {
					status = types.UnfurlerTaskStatusPermFailed
				}
				if err := u.setStatus(ctx, outboxID, status); err != nil {
					u.Debug(ctx, "unfurl: failed to set failed status: %s", err)
				}
			} else {
				// if it worked, then force Deliverer to run and send our message
				u.G().MessageDeliverer.ForceDeliverLoop(ctx)
			}
		}()
		task, err := u.getTask(ctx, outboxID)
		if err != nil {
			u.Debug(ctx, "unfurl: failed to get task: %s", err)
			return nil, err
		}
		if err := u.setStatus(ctx, outboxID, types.UnfurlerTaskStatusUnfurling); err != nil {
			u.Debug(ctx, "unfurl: failed to set status: %s", err)
		}
		packaged, err := u.scrapeAndPackage(ctx, task.UID, task.ConvID, task.URL)
		if err != nil {
			return nil, err
		}
		unfurl = new(chat1.Unfurl)
		*unfurl = packaged
		if err := u.setTaskResult(ctx, outboxID, *unfurl); err != nil {
			u.Debug(ctx, "unfurl: failed to set task result: %s", err)
			return nil, err
		}
		if err := u.setStatus(ctx, outboxID, types.UnfurlerTaskStatusSuccess); err != nil {
			u.Debug(ctx, "unfurl: failed to set task status: %s", err)
			return nil, err
		}
		return unfurl, nil
	}(ctx)
}

func (u *Unfurler) GetSettings(ctx context.Context, uid gregor1.UID) (res chat1.UnfurlSettings, err error) {
	defer u.Trace(ctx, func() error { return nil }, "GetSettings")()
	return u.settings.Get(ctx, uid)
}

func (u *Unfurler) WhitelistAdd(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer u.Trace(ctx, func() error { return nil }, "WhitelistAdd")()
	return u.settings.WhitelistAdd(ctx, uid, domain)
}

func (u *Unfurler) WhitelistRemove(ctx context.Context, uid gregor1.UID, domain string) (err error) {
	defer u.Trace(ctx, func() error { return nil }, "WhitelistRemove")()
	return u.settings.WhitelistRemove(ctx, uid, domain)
}

func (u *Unfurler) WhitelistAddExemption(ctx context.Context, uid gregor1.UID,
	exemption types.WhitelistExemption) {
	defer u.Trace(ctx, func() error { return nil }, "WhitelistAddExemption")()
	u.extractor.AddWhitelistExemption(ctx, uid, exemption)
}

func (u *Unfurler) SetMode(ctx context.Context, uid gregor1.UID, mode chat1.UnfurlMode) (err error) {
	defer u.Trace(ctx, func() error { return nil }, "SetMode")()
	return u.settings.SetMode(ctx, uid, mode)
}

func (u *Unfurler) SetSettings(ctx context.Context, uid gregor1.UID, settings chat1.UnfurlSettings) (err error) {
	defer u.Trace(ctx, func() error { return nil }, "SetSettings")()
	return u.settings.Set(ctx, uid, settings)
}
