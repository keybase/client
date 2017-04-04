package storage

import (
	"context"
	"fmt"

	"time"

	"bytes"

	"sort"

	"crypto/sha1"

	"encoding/hex"

	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const inboxVersion = 10

type queryHash []byte

func (q queryHash) Empty() bool {
	return len(q) == 0
}

func (q queryHash) String() string {
	return hex.EncodeToString(q)
}

func (q queryHash) Eq(r queryHash) bool {
	return bytes.Equal(q, r)
}

type inboxDiskQuery struct {
	QueryHash  queryHash         `codec:"Q"`
	Pagination *chat1.Pagination `codec:"P"`
}

func (q inboxDiskQuery) queryMatch(other inboxDiskQuery) bool {
	if q.QueryHash.Empty() && other.QueryHash.Empty() {
		return true
	}
	if !q.QueryHash.Empty() && !other.QueryHash.Empty() {
		return q.QueryHash.Eq(other.QueryHash)
	}
	return false
}

func (q inboxDiskQuery) paginationMatch(other inboxDiskQuery) bool {
	if q.Pagination == nil && other.Pagination == nil {
		return true
	}
	if q.Pagination != nil && other.Pagination != nil {
		return q.Pagination.Eq(*other.Pagination)
	}
	return false
}

func (q inboxDiskQuery) match(other inboxDiskQuery) bool {
	return q.queryMatch(other) && q.paginationMatch(other)
}

type inboxDiskData struct {
	Version       int                  `codec:"V"`
	ServerVersion int                  `codec:"S"`
	InboxVersion  chat1.InboxVers      `codec:"I"`
	Conversations []chat1.Conversation `codec:"C"`
	Queries       []inboxDiskQuery     `codec:"Q"`
}

type Inbox struct {
	libkb.Contextified
	*baseBox
	utils.DebugLabeler

	uid gregor1.UID
}

func NewInbox(g *libkb.GlobalContext, uid gregor1.UID) *Inbox {
	return &Inbox{
		Contextified: libkb.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g, "Inbox", false),
		baseBox:      newBaseBox(g),
		uid:          uid,
	}
}

func (i *Inbox) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInbox,
		Key: fmt.Sprintf("ib:%s", i.uid),
	}
}

func (i *Inbox) readDiskInbox(ctx context.Context) (inboxDiskData, Error) {
	var ibox inboxDiskData
	found, err := i.readDiskBox(ctx, i.dbKey(), &ibox)
	if err != nil {
		return ibox, NewInternalError(ctx, i.DebugLabeler,
			"failed to read inbox: uid: %d err: %s", i.uid, err.Error())
	}
	if !found {
		return ibox, MissError{}
	}

	// Check on disk server version against known server version
	if _, err = i.G().ServerCacheVersions.MatchInbox(ctx, ibox.ServerVersion); err != nil {
		i.Debug(ctx, "server version match error, clearing: %s", err.Error())
		if cerr := i.Clear(ctx); cerr != nil {
			return ibox, cerr
		}
		return ibox, MissError{}
	}
	// Check on disk version against configured
	if ibox.Version != inboxVersion {
		i.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			ibox.Version, inboxVersion)
		if cerr := i.Clear(ctx); cerr != nil {
			return ibox, cerr
		}
		return ibox, MissError{}
	}

	i.Debug(ctx, "readDiskInbox: version: %d disk version: %d server version: %d", ibox.InboxVersion,
		ibox.Version, ibox.ServerVersion)

	return ibox, nil
}

func (i *Inbox) writeDiskInbox(ctx context.Context, ibox inboxDiskData) Error {

	// Get latest server version
	vers, err := i.G().ServerCacheVersions.Fetch(ctx)
	if err != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to fetch server versions: %s", err.Error())
	}

	ibox.ServerVersion = vers.InboxVers
	ibox.Version = inboxVersion
	if ierr := i.writeDiskBox(ctx, i.dbKey(), ibox); ierr != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to write inbox: uid: %s err: %s",
			i.uid, ierr.Error())
	}
	return nil
}

type ByDatabaseOrder []chat1.Conversation

func dbConvLess(a pager.InboxEntry, b pager.InboxEntry) bool {
	if a.GetMtime() > b.GetMtime() {
		return true
	} else if a.GetMtime() < b.GetMtime() {
		return false
	}
	return bytes.Compare(a.GetConvID(), b.GetConvID()) > 0
}

func (a ByDatabaseOrder) Len() int      { return len(a) }
func (a ByDatabaseOrder) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a ByDatabaseOrder) Less(i, j int) bool {
	return dbConvLess(a[i], a[j])
}

func (i *Inbox) mergeConvs(l []chat1.Conversation, r []chat1.Conversation) (res []chat1.Conversation) {
	m := make(map[string]bool)
	for _, conv := range l {
		m[conv.Metadata.ConversationID.String()] = true
		res = append(res, conv)
	}
	for _, conv := range r {
		if !m[conv.Metadata.ConversationID.String()] {
			res = append(res, conv)
		}
	}
	return res
}

func (i *Inbox) hashQuery(ctx context.Context, query *chat1.GetInboxQuery) (queryHash, Error) {
	if query == nil {
		return nil, nil
	}

	dat, err := encode(*query)
	if err != nil {
		return nil, NewInternalError(ctx, i.DebugLabeler, "failed to encode query: %s", err.Error())
	}

	hasher := sha1.New()
	hasher.Write(dat)
	return hasher.Sum(nil), nil
}

func (i *Inbox) Merge(ctx context.Context, vers chat1.InboxVers, convsIn []chat1.Conversation,
	query *chat1.GetInboxQuery, p *chat1.Pagination) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Merge")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "Merge: vers: %d", vers)

	convs := make([]chat1.Conversation, len(convsIn))
	copy(convs, convsIn)

	// Read inbox off disk to determine if we can merge, or need to full replace
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return err
		}
	}

	// Set up query stuff
	hquery, err := i.hashQuery(ctx, query)
	if err != nil {
		return err
	}
	i.Debug(ctx, "Merge: query hash: %s", hquery)
	qp := inboxDiskQuery{QueryHash: hquery, Pagination: p}
	var data inboxDiskData

	// Replace the inbox under these conditions
	if ibox.InboxVersion != vers || err != nil {
		i.Debug(ctx, "Merge: replacing inbox: ibox.vers: %v vers: %v", ibox.InboxVersion, vers)
		data = inboxDiskData{
			Version:       inboxVersion,
			InboxVersion:  vers,
			Conversations: convs,
			Queries:       []inboxDiskQuery{qp},
		}
	} else {
		i.Debug(ctx, "Merge: merging inbox: version match")
		data = inboxDiskData{
			Version:       inboxVersion,
			InboxVersion:  vers,
			Conversations: i.mergeConvs(convs, ibox.Conversations),
			Queries:       append(ibox.Queries, qp),
		}
	}

	// Make sure that the inbox is in the write order before writing out
	sort.Sort(ByDatabaseOrder(data.Conversations))

	// Write out new inbox
	if err := i.writeDiskInbox(ctx, data); err != nil {
		return err
	}
	return nil
}

func (i *Inbox) applyQuery(ctx context.Context, query *chat1.GetInboxQuery, convs []chat1.Conversation) []chat1.Conversation {
	if query == nil {
		query = &chat1.GetInboxQuery{}
	}
	var res []chat1.Conversation
	filtered := 0
	for _, conv := range convs {
		ok := true
		// Basic checks
		if query.ConvID != nil {
			query.ConvIDs = append(query.ConvIDs, *query.ConvID)
		}
		if len(query.ConvIDs) > 0 {
			found := false
			for _, cid := range query.ConvIDs {
				if cid.Eq(conv.GetConvID()) {
					found = true
					break
				}
			}
			if !found {
				ok = false
			}
		}
		if query.After != nil && !conv.ReaderInfo.Mtime.After(*query.After) {
			ok = false
		}
		if query.Before != nil && !conv.ReaderInfo.Mtime.Before(*query.Before) {
			ok = false
		}
		if query.TopicType != nil && *query.TopicType != conv.Metadata.IdTriple.TopicType {
			ok = false
		}
		if query.TlfVisibility != nil && *query.TlfVisibility != chat1.TLFVisibility_ANY &&
			*query.TlfVisibility != conv.Metadata.Visibility {
			ok = false
		}
		if query.UnreadOnly && conv.ReaderInfo.ReadMsgid >= conv.ReaderInfo.MaxMsgid {
			ok = false
		}
		if query.ReadOnly && conv.ReaderInfo.ReadMsgid < conv.ReaderInfo.MaxMsgid {
			ok = false
		}
		if query.TlfID != nil && !query.TlfID.Eq(conv.Metadata.IdTriple.Tlfid) {
			ok = false
		}

		// Check to see if the conv status is in the query list
		if len(query.Status) > 0 {
			found := false
			for _, s := range query.Status {
				if s == conv.Metadata.Status {
					found = true
					break
				}
			}
			if !found {
				ok = false
			}
		}

		// If we are finalized and are superseded, then don't return this
		if query.OneChatTypePerTLF == nil ||
			(query.OneChatTypePerTLF != nil && *query.OneChatTypePerTLF) {
			if conv.Metadata.FinalizeInfo != nil && len(conv.Metadata.SupersededBy) > 0 && len(query.ConvIDs) == 0 {
				ok = false
			}
		}

		if ok {
			res = append(res, conv)
		} else {
			filtered++
		}
	}

	i.Debug(ctx, "applyQuery: res size: %d filtered: %d", len(res), filtered)
	return res
}

func (i *Inbox) applyPagination(ctx context.Context, convs []chat1.Conversation,
	p *chat1.Pagination) ([]chat1.Conversation, *chat1.Pagination, Error) {

	if p == nil {
		return convs, nil, nil
	}

	var res []chat1.Conversation
	var pnext, pprev pager.InboxPagerFields
	num := p.Num
	hasnext := len(p.Next) > 0
	hasprev := len(p.Previous) > 0
	i.Debug(ctx, "applyPagination: num: %d", num)
	if hasnext {
		if err := decode(p.Next, &pnext); err != nil {
			return nil, nil, RemoteError{Msg: "applyPagination: failed to decode pager: " + err.Error()}
		}
		i.Debug(ctx, "applyPagination: using next pointer: mtime: %v", pnext.Mtime)
	} else if hasprev {
		if err := decode(p.Previous, &pprev); err != nil {
			return nil, nil, RemoteError{Msg: "applyPagination: failed to decode pager: " + err.Error()}
		}
		i.Debug(ctx, "applyPagination: using prev pointer: mtime: %v", pprev.Mtime)
	} else {
		i.Debug(ctx, "applyPagination: no next or prev pointers, just using num limit")
	}

	if hasnext {
		i.Debug(ctx, "applyPagination: using hasnext collection path")
		for _, conv := range convs {
			if len(res) >= num {
				i.Debug(ctx, "applyPagination: reached num results (%d), stopping", num)
				break
			}
			if dbConvLess(pnext, conv) {
				res = append(res, conv)
			}
		}
	} else if hasprev {
		i.Debug(ctx, "applyPagination: using hasprev collection path")
		for index := len(convs) - 1; index >= 0; index-- {
			if len(res) >= num {
				i.Debug(ctx, "applyPagination: reached num results (%d), stopping", num)
				break
			}
			if dbConvLess(convs[index], pprev) {
				res = append(res, convs[index])
			}
		}
		sort.Sort(ByDatabaseOrder(res))
	} else {
		i.Debug(ctx, "applyPagination: using null collection path")
		for _, conv := range convs {
			if len(res) >= num {
				i.Debug(ctx, "applyPagination: reached num results (%d), stopping", num)
				break
			}
			res = append(res, conv)
		}
	}

	var pres []pager.InboxEntry
	for _, r := range res {
		pres = append(pres, r)
	}
	pagination, err := pager.NewInboxPager().MakePage(pres, num)
	if err != nil {
		return nil, nil, NewInternalError(ctx, i.DebugLabeler,
			"failure to create inbox page: %s", err.Error())
	}
	return res, pagination, nil
}

func (i *Inbox) queryConvIDsExist(ctx context.Context, ibox inboxDiskData,
	convIDs []chat1.ConversationID) bool {
	m := make(map[string]bool)
	for _, conv := range ibox.Conversations {
		m[conv.GetConvID().String()] = true
	}
	for _, convID := range convIDs {
		if !m[convID.String()] {
			return false
		}
	}
	return true
}

func (i *Inbox) queryExists(ctx context.Context, ibox inboxDiskData, query *chat1.GetInboxQuery,
	p *chat1.Pagination) bool {

	// If the query is specifying a list of conversation IDs, just check to see if we have *all*
	// of them on the disk
	if query != nil && len(query.ConvIDs) > 0 {
		i.Debug(ctx, "Read: queryExists: convIDs query, checking list: len: %d", len(query.ConvIDs))
		return i.queryConvIDsExist(ctx, ibox, query.ConvIDs)
	}

	hquery, err := i.hashQuery(ctx, query)
	if err != nil {
		i.Debug(ctx, "Read: queryExists: error hashing query: %s", err.Error())
		return false
	}
	i.Debug(ctx, "Read: queryExists: query hash: %s p: %v", hquery, p)

	qp := inboxDiskQuery{QueryHash: hquery, Pagination: p}
	for _, q := range ibox.Queries {
		if q.match(qp) {
			return true
		}
	}
	return false
}

func (i *Inbox) ReadAll(ctx context.Context) (vers chat1.InboxVers, res []chat1.Conversation, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "ReadAll")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox found")
		}
		return 0, nil, err
	}

	return ibox.InboxVersion, ibox.Conversations, nil
}

func (i *Inbox) Read(ctx context.Context, query *chat1.GetInboxQuery, p *chat1.Pagination) (vers chat1.InboxVers, res []chat1.Conversation, pagination *chat1.Pagination, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Read")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox found")
		}
		return 0, nil, nil, err
	}

	// Check to make sure query parameters have been seen before
	if !i.queryExists(ctx, ibox, query, p) {
		i.Debug(ctx, "Read: miss: query or pagination unknown")
		return 0, nil, nil, MissError{}
	}

	// Apply query and pagination
	res = i.applyQuery(ctx, query, ibox.Conversations)
	res, pagination, err = i.applyPagination(ctx, res, p)
	if err != nil {
		return 0, nil, nil, err
	}

	i.Debug(ctx, "Read: hit: version: %d", ibox.InboxVersion)
	return ibox.InboxVersion, res, pagination, nil
}

func (i *Inbox) Clear(ctx context.Context) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "Clear")()
	ierr := i.G().LocalChatDb.Delete(i.dbKey())
	if ierr != nil {
		return NewInternalError(ctx, i.DebugLabeler,
			"error clearing inbox: uid: %s err: %s", i.uid, ierr.Error())
	}
	return nil
}

func (i *Inbox) handleVersion(ctx context.Context, ourvers chat1.InboxVers, updatevers chat1.InboxVers) (chat1.InboxVers, bool, Error) {
	// Our version is at least as new as this update, let's not continue
	if updatevers == 0 {
		// Don't do anything to the version if we are just writing into ourselves, we'll
		// get the correct version when Gregor bounces the update back at us
		i.Debug(ctx, "handleVersion: received a self update: ours: %d update: %d", ourvers, updatevers)
		return ourvers, true, nil
	} else if ourvers >= updatevers {
		i.Debug(ctx, "handleVersion: received an old update: ours: %d update: %d", ourvers, updatevers)
		return ourvers, false, nil
	} else if updatevers == ourvers+1 {
		i.Debug(ctx, "handleVersion: received an incremental update: ours: %d update: %d", ourvers, updatevers)
		return updatevers, true, nil
	}

	i.Debug(ctx, "handleVersion: received a non-incremental update: ours: %d update: %d",
		ourvers, updatevers)

	// The update is far ahead of what we have.
	// Leave our state alone, but request a resync using a VersionMismatchError.
	return ourvers, false, NewVersionMismatchError(ourvers, updatevers)
}

func (i *Inbox) NewConversation(ctx context.Context, vers chat1.InboxVers, conv chat1.Conversation) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "NewConversation")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "NewConversation: vers: %d convID: %s", vers, conv.GetConvID())
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}

	// Do a pass to make sure we don't already know about this convo
	known := false
	for _, iconv := range ibox.Conversations {
		if iconv.GetConvID().Eq(conv.GetConvID()) {
			known = true
			break
		}
	}

	if !known {
		// Find any conversations this guy might supersede and set supersededBy pointer
		for index := range ibox.Conversations {
			iconv := &ibox.Conversations[index]
			if iconv.Metadata.FinalizeInfo == nil {
				continue
			}
			for _, super := range conv.Metadata.Supersedes {
				if iconv.GetConvID().Eq(super.ConversationID) {
					i.Debug(ctx, "NewConversation: setting supersededBy: target: %s superseder: %s",
						iconv.GetConvID(), conv.GetConvID())
					iconv.Metadata.SupersededBy = append(iconv.Metadata.SupersededBy, conv.Metadata)
				}
			}
		}

		// Add the convo
		ibox.Conversations = append([]chat1.Conversation{conv}, ibox.Conversations...)
	} else {
		i.Debug(ctx, "NewConversation: skipping update, conversation exists in inbox")
	}

	// Write out to disk
	ibox.InboxVersion = vers
	if err := i.writeDiskInbox(ctx, ibox); err != nil {
		return err
	}

	return nil
}

func (i *Inbox) getConv(convID chat1.ConversationID, convs []chat1.Conversation) (int, *chat1.Conversation) {

	var index int
	var conv chat1.Conversation
	found := false
	for index, conv = range convs {
		if conv.GetConvID().Eq(convID) {
			found = true
			break
		}
	}
	if !found {
		return 0, nil
	}

	return index, &convs[index]
}

func (i *Inbox) promoteWriter(ctx context.Context, sender gregor1.UID, writers []gregor1.UID) []gregor1.UID {
	res := make([]gregor1.UID, len(writers))
	copy(res, writers)
	for index, w := range writers {
		if bytes.Equal(w.Bytes(), sender.Bytes()) {
			res = append(res[:index], res[index+1:]...)
			res = append([]gregor1.UID{sender}, res...)
			return res
		}
	}

	i.Debug(ctx, "promoteWriter: failed to promote sender, adding to front: sender: %s", sender)
	res = append([]gregor1.UID{sender}, res...)
	return res
}

func (i *Inbox) NewMessage(ctx context.Context, vers chat1.InboxVers, convID chat1.ConversationID,
	msg chat1.MessageBoxed) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "NewMessage")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "NewMessage: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	index, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "NewMessage: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}

	// Update conversation
	found := false
	typ := msg.GetMessageType()
	for mindex, maxmsg := range conv.MaxMsgSummaries {
		if maxmsg.GetMessageType() == typ {
			conv.MaxMsgSummaries[mindex] = msg.Summary()
			found = true
			break
		}
	}
	if !found {
		conv.MaxMsgSummaries = append(conv.MaxMsgSummaries, msg.Summary())
	}

	// If we are all up to date on the thread (and the sender is the current user),
	// mark this message as read too
	if conv.ReaderInfo.ReadMsgid == conv.ReaderInfo.MaxMsgid &&
		bytes.Equal(msg.ClientHeader.Sender.Bytes(), i.uid) {
		conv.ReaderInfo.ReadMsgid = msg.GetMessageID()
	}
	conv.ReaderInfo.MaxMsgid = msg.GetMessageID()
	conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())

	conv.Metadata.ActiveList = i.promoteWriter(ctx, msg.ClientHeader.Sender,
		conv.Metadata.ActiveList)

	// If we are the sender, adjust the status.
	if bytes.Equal(msg.ClientHeader.Sender.Bytes(), i.uid) &&
		utils.GetConversationStatusBehavior(conv.Metadata.Status).SendingRemovesStatus {
		conv.Metadata.Status = chat1.ConversationStatus_UNFILED
	}
	// If we are a participant, adjust the status.
	if utils.GetConversationStatusBehavior(conv.Metadata.Status).ActivityRemovesStatus {
		conv.Metadata.Status = chat1.ConversationStatus_UNFILED
	}

	// Slot in at the top
	mconv := *conv
	i.Debug(ctx, "NewMessage: promoting convID: %s to the top of %d convs", convID,
		len(ibox.Conversations))
	ibox.Conversations = append(ibox.Conversations[:index], ibox.Conversations[index+1:]...)
	ibox.Conversations = append([]chat1.Conversation{mconv}, ibox.Conversations...)

	// Write out to disk
	ibox.InboxVersion = vers
	if err := i.writeDiskInbox(ctx, ibox); err != nil {
		return err
	}

	return nil
}

func (i *Inbox) ReadMessage(ctx context.Context, vers chat1.InboxVers, convID chat1.ConversationID,
	msgID chat1.MessageID) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "ReadMessage")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "ReadMessage: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	_, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "ReadMessage: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}

	// Update conv
	if conv.ReaderInfo.ReadMsgid < msgID {
		i.Debug(ctx, "ReadMessage: updating mtime: readMsgID: %d msgID: %d", conv.ReaderInfo.ReadMsgid,
			msgID)
		conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
		conv.ReaderInfo.ReadMsgid = msgID
	}

	// Write out to disk
	ibox.InboxVersion = vers
	if err := i.writeDiskInbox(ctx, ibox); err != nil {
		return err
	}

	return nil
}

func (i *Inbox) SetStatus(ctx context.Context, vers chat1.InboxVers, convID chat1.ConversationID,
	status chat1.ConversationStatus) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "SetStatus")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "SetStatus: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	_, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "SetStatus: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}

	conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
	conv.Metadata.Status = status

	// Write out to disk
	ibox.InboxVersion = vers
	if err := i.writeDiskInbox(ctx, ibox); err != nil {
		return err
	}

	return nil
}

func (i *Inbox) TlfFinalize(ctx context.Context, vers chat1.InboxVers, convIDs []chat1.ConversationID,
	finalizeInfo chat1.ConversationFinalizeInfo) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "TlfFinalize")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "TlfFinalize: vers: %d convIDs: %v finalizeInfo: %v", vers, convIDs, finalizeInfo)
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}

	for _, convID := range convIDs {
		// Find conversation
		_, conv := i.getConv(convID, ibox.Conversations)
		if conv == nil {
			i.Debug(ctx, "TlfFinalize: no conversation found: convID: %s", convID)
			continue
		}

		conv.Metadata.FinalizeInfo = &finalizeInfo
	}

	// Write out to disk
	ibox.InboxVersion = vers
	if err := i.writeDiskInbox(ctx, ibox); err != nil {
		return err
	}

	return nil
}

func (i *Inbox) Version(ctx context.Context) (vers chat1.InboxVers, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Version")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		return 0, err
	}

	vers = chat1.InboxVers(ibox.InboxVersion)
	return vers, nil
}

func (i *Inbox) ServerVersion(ctx context.Context) (vers int, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "ServerVersion")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		return 0, err
	}

	vers = ibox.ServerVersion
	return vers, nil
}

type ByConvMtime []chat1.Conversation

func (b ByConvMtime) Len() int      { return len(b) }
func (b ByConvMtime) Swap(i, j int) { b[i], b[j] = b[j], b[i] }
func (b ByConvMtime) Less(i, j int) bool {
	return b[i].ReaderInfo.Mtime.After(b[j].ReaderInfo.Mtime)
}

func (i *Inbox) Sync(ctx context.Context, vers chat1.InboxVers, convs []chat1.Conversation) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Sync")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		// Return MissError, since it should be unexpected if are calling this
		return err
	}

	// Sync inbox with new conversations
	oldVers := ibox.InboxVersion
	ibox.InboxVersion = vers
	convMap := make(map[string]chat1.Conversation)
	for _, conv := range convs {
		convMap[conv.GetConvID().String()] = conv
	}
	for index, conv := range ibox.Conversations {
		if newConv, ok := convMap[conv.GetConvID().String()]; ok {
			ibox.Conversations[index] = newConv
			delete(convMap, conv.GetConvID().String())
		}
	}
	i.Debug(ctx, "Sync: adding %d new conversations", len(convMap))
	for _, conv := range convMap {
		ibox.Conversations = append(ibox.Conversations, conv)
	}
	sort.Sort(ByDatabaseOrder(ibox.Conversations))

	i.Debug(ctx, "Sync: old vers: %v new vers: %v convs: %d", oldVers, ibox.InboxVersion, len(convs))
	if err = i.writeDiskInbox(ctx, ibox); err != nil {
		return err
	}

	return nil
}
