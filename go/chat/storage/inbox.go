package storage

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/pager"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

const inboxVersion = 18

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
	Version       int                        `codec:"V"`
	ServerVersion int                        `codec:"S"`
	InboxVersion  chat1.InboxVers            `codec:"I"`
	Conversations []types.RemoteConversation `codec:"C"`
	Queries       []inboxDiskQuery           `codec:"Q"`
}

type Inbox struct {
	globals.Contextified
	*baseBox
	utils.DebugLabeler

	uid gregor1.UID
}

var addHookOnce sync.Once

func NewInbox(g *globals.Context, uid gregor1.UID) *Inbox {
	if len(uid) == 0 {
		panic("Inbox: empty userid")
	}

	// add a logout hook to clear the in-memory inbox cache, but only add it once:
	addHookOnce.Do(func() {
		g.ExternalG().AddLogoutHook(inboxMemCache)
	})

	return &Inbox{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Inbox", false),
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

	// Check in memory cache first
	if memibox := inboxMemCache.Get(i.uid); memibox != nil {
		i.Debug(ctx, "hit in memory cache")
		ibox = *memibox
	} else {
		found, err := i.readDiskBox(ctx, i.dbKey(), &ibox)
		if err != nil {
			return ibox, NewInternalError(ctx, i.DebugLabeler,
				"failed to read inbox: uid: %d err: %s", i.uid, err.Error())
		}
		if !found {
			return ibox, MissError{}
		}
		inboxMemCache.Put(i.uid, &ibox)
	}

	// Check on disk server version against known server version
	if _, err := i.G().ServerCacheVersions.MatchInbox(ctx, ibox.ServerVersion); err != nil {
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

	i.Debug(ctx, "readDiskInbox: version: %d disk version: %d server version: %d convs: %d",
		ibox.InboxVersion, ibox.Version, ibox.ServerVersion, len(ibox.Conversations))

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
	ibox.Conversations = i.summarizeConvs(ibox.Conversations)
	i.Debug(ctx, "writeDiskInbox: version: %d disk version: %d server version: %d convs: %d",
		ibox.InboxVersion, ibox.Version, ibox.ServerVersion, len(ibox.Conversations))
	inboxMemCache.Put(i.uid, &ibox)
	if ierr := i.writeDiskBox(ctx, i.dbKey(), ibox); ierr != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to write inbox: uid: %s err: %s",
			i.uid, ierr.Error())
	}
	return nil
}

type ByDatabaseOrder []types.RemoteConversation

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

func (i *Inbox) summarizeConv(rc *types.RemoteConversation) {
	summaries := make(map[chat1.MessageType]chat1.MessageSummary)

	// Collect the existing summaries
	for _, m := range rc.Conv.MaxMsgSummaries {
		summaries[m.GetMessageType()] = m
	}

	// Collect the locally-grown summaries
	for _, m := range rc.Conv.MaxMsgs {
		summaries[m.GetMessageType()] = m.Summary()
	}

	// Insert all the summaries
	rc.Conv.MaxMsgs = nil
	rc.Conv.MaxMsgSummaries = nil
	for _, m := range summaries {
		rc.Conv.MaxMsgSummaries = append(rc.Conv.MaxMsgSummaries, m)
	}
}

func (i *Inbox) summarizeConvs(convs []types.RemoteConversation) (res []types.RemoteConversation) {
	for _, conv := range convs {
		i.summarizeConv(&conv)
		res = append(res, conv)
	}
	return res
}

func (i *Inbox) mergeConvs(l []types.RemoteConversation, r []types.RemoteConversation) (res []types.RemoteConversation) {
	m := make(map[string]bool)
	for _, conv := range l {
		m[conv.Conv.Metadata.ConversationID.String()] = true
		res = append(res, conv)
	}
	for _, conv := range r {
		if !m[conv.Conv.Metadata.ConversationID.String()] {
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

func (i *Inbox) MergeLocalMetadata(ctx context.Context, convs []chat1.ConversationLocal) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "MergeLocalMetadata")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return err
		}
		// If we don't have anything on disk, then just do nothing
		i.Debug(ctx, "MergeLocalMetadata: no inbox found to merge against")
		return nil
	}

	convMap := make(map[string]chat1.ConversationLocal)
	for _, conv := range convs {
		convMap[conv.GetConvID().String()] = conv
	}
	for index, rc := range ibox.Conversations {
		if convLocal, ok := convMap[rc.GetConvID().String()]; ok {
			// Don't write this out for error convos
			if convLocal.Error != nil {
				continue
			}
			rcm := &types.RemoteConversationMetadata{
				TopicName: utils.GetTopicName(convLocal),
				Headline:  utils.GetHeadline(convLocal),
				Snippet:   utils.GetConvSnippet(convLocal),
			}
			switch convLocal.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
				// don't fill out things that don't get shown in inbox for team chats
			default:
				rcm.WriterNames = convLocal.Names()
				rcm.ResetParticipants = convLocal.Info.ResetNames
			}
			ibox.Conversations[index].LocalMetadata = rcm
		}
	}

	// Make sure that the inbox is in the write order before writing out
	sort.Sort(ByDatabaseOrder(ibox.Conversations))

	// Write out new inbox
	return i.writeDiskInbox(ctx, ibox)
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
		i.Debug(ctx, "Merge: replacing inbox: ibox.vers: %v vers: %v convs: %d", ibox.InboxVersion, vers,
			len(convs))
		data = inboxDiskData{
			Version:       inboxVersion,
			InboxVersion:  vers,
			Conversations: utils.RemoteConvs(convs),
			Queries:       []inboxDiskQuery{qp},
		}
	} else {
		i.Debug(ctx, "Merge: merging inbox: version match")
		data = inboxDiskData{
			Version:       inboxVersion,
			InboxVersion:  vers,
			Conversations: i.mergeConvs(utils.RemoteConvs(convs), ibox.Conversations),
			Queries:       append(ibox.Queries, qp),
		}
	}

	// Make sure that the inbox is in the write order before writing out
	sort.Sort(ByDatabaseOrder(data.Conversations))

	// Write out new inbox
	return i.writeDiskInbox(ctx, data)
}

func (i *Inbox) supersedersNotEmpty(ctx context.Context, superseders []chat1.ConversationMetadata, convs []types.RemoteConversation) bool {
	for _, superseder := range superseders {
		for _, conv := range convs {
			if superseder.ConversationID.Eq(conv.GetConvID()) {
				for _, msg := range conv.Conv.MaxMsgSummaries {
					if utils.IsVisibleChatMessageType(msg.GetMessageType()) {
						return true
					}
				}
			}
		}
	}
	return false
}

func (i *Inbox) applyQuery(ctx context.Context, query *chat1.GetInboxQuery, rcs []types.RemoteConversation) []types.RemoteConversation {
	if query == nil {
		query = &chat1.GetInboxQuery{}
	}
	var res []types.RemoteConversation
	filtered := 0
	for _, rc := range rcs {
		ok := true
		conv := rc.Conv

		// Existence check
		if conv.Metadata.Existence != chat1.ConversationExistence_ACTIVE {
			ok = false
		}

		// Member status check
		switch conv.ReaderInfo.Status {
		case chat1.ConversationMemberStatus_ACTIVE, chat1.ConversationMemberStatus_PREVIEW,
			chat1.ConversationMemberStatus_RESET:
			// only let these states through
		default:
			ok = false
		}

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
		if query.TlfVisibility != nil && *query.TlfVisibility != keybase1.TLFVisibility_ANY &&
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
				if i.supersedersNotEmpty(ctx, conv.Metadata.SupersededBy, rcs) {
					ok = false
				}
			}
		}

		if ok {
			res = append(res, rc)
		} else {
			filtered++
		}
	}

	i.Debug(ctx, "applyQuery: res size: %d filtered: %d", len(res), filtered)
	return res
}

func (i *Inbox) applyPagination(ctx context.Context, convs []types.RemoteConversation,
	p *chat1.Pagination) ([]types.RemoteConversation, *chat1.Pagination, Error) {

	if p == nil {
		return convs, nil, nil
	}

	var res []types.RemoteConversation
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
	if query != nil && (len(query.ConvIDs) > 0 || query.ConvID != nil) {
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

func (i *Inbox) ReadAll(ctx context.Context) (vers chat1.InboxVers, res []types.RemoteConversation, err Error) {
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

func (i *Inbox) Read(ctx context.Context, query *chat1.GetInboxQuery, p *chat1.Pagination) (vers chat1.InboxVers, res []types.RemoteConversation, pagination *chat1.Pagination, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("Read(%s)", i.uid))()
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
	inboxMemCache.Clear(i.uid)
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
			if iconv.Conv.Metadata.FinalizeInfo == nil {
				continue
			}
			for _, super := range conv.Metadata.Supersedes {
				if iconv.GetConvID().Eq(super.ConversationID) {
					i.Debug(ctx, "NewConversation: setting supersededBy: target: %s superseder: %s",
						iconv.GetConvID(), conv.GetConvID())
					iconv.Conv.Metadata.SupersededBy = append(iconv.Conv.Metadata.SupersededBy, conv.Metadata)
					iconv.Conv.Metadata.Version = vers.ToConvVers()
				}
			}
		}

		// Add the convo
		ibox.Conversations = append(utils.RemoteConvs([]chat1.Conversation{conv}), ibox.Conversations...)
	} else {
		i.Debug(ctx, "NewConversation: skipping update, conversation exists in inbox")
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

func (i *Inbox) getConv(convID chat1.ConversationID, convs []types.RemoteConversation) (int, *types.RemoteConversation) {

	var index int
	var conv types.RemoteConversation
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

// Return pointers into `convs` for the convs belonging to `teamID`.
func (i *Inbox) getConvsForTeam(ctx context.Context, teamID keybase1.TeamID, convs []types.RemoteConversation) (res []*types.RemoteConversation) {
	tlfID, err := chat1.TeamIDToTLFID(teamID)
	if err != nil {
		i.Debug(ctx, "getConvsForTeam: teamIDToTLFID failed: %v", err)
		return nil
	}
	for i := range convs {
		conv := &convs[i]
		if conv.Conv.GetMembersType() == chat1.ConversationMembersType_TEAM && conv.Conv.Metadata.IdTriple.Tlfid.Eq(tlfID) {
			res = append(res, conv)
		}
	}
	return res
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
	msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (err Error) {
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
	updateVers := vers
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	index, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "NewMessage: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}

	// Update conversation. Use given max messages if the param is non-empty, otherwise just fill
	// it in ourselves
	if len(maxMsgs) == 0 {
		// Check for a delete, if so just auto return a version mismatch to resync. The reason
		// is it is tricky to update max messages in this case. NOTE: this update must also not be a
		// self update, we only do this clear if the server transmitted the update to us.
		if updateVers > 0 {
			switch msg.GetMessageType() {
			case chat1.MessageType_DELETE, chat1.MessageType_DELETEHISTORY:
				i.Debug(ctx, "NewMessage: returning fake version mismatch error because of delete: vers: %d",
					vers)
				return NewVersionMismatchError(ibox.InboxVersion, vers)
			}
		}
		found := false
		typ := msg.GetMessageType()
		for mindex, maxmsg := range conv.Conv.MaxMsgSummaries {
			if maxmsg.GetMessageType() == typ {
				conv.Conv.MaxMsgSummaries[mindex] = msg.Summary()
				found = true
				break
			}
		}
		if !found {
			conv.Conv.MaxMsgSummaries = append(conv.Conv.MaxMsgSummaries, msg.Summary())
		}
	} else {
		i.Debug(ctx, "NewMessage: setting max messages from server payload")
		conv.Conv.MaxMsgSummaries = maxMsgs
	}

	// If we are all up to date on the thread (and the sender is the current user),
	// mark this message as read too
	if conv.Conv.ReaderInfo.ReadMsgid == conv.Conv.ReaderInfo.MaxMsgid &&
		bytes.Equal(msg.ClientHeader.Sender.Bytes(), i.uid) {
		conv.Conv.ReaderInfo.ReadMsgid = msg.GetMessageID()
	}
	conv.Conv.ReaderInfo.MaxMsgid = msg.GetMessageID()
	conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
	conv.Conv.Metadata.ActiveList = i.promoteWriter(ctx, msg.ClientHeader.Sender,
		conv.Conv.Metadata.ActiveList)

	// If we are the sender, adjust the status.
	if bytes.Equal(msg.ClientHeader.Sender.Bytes(), i.uid) &&
		utils.GetConversationStatusBehavior(conv.Conv.Metadata.Status).SendingRemovesStatus {
		conv.Conv.Metadata.Status = chat1.ConversationStatus_UNFILED
	}
	// If we are a participant, adjust the status.
	if utils.GetConversationStatusBehavior(conv.Conv.Metadata.Status).ActivityRemovesStatus {
		conv.Conv.Metadata.Status = chat1.ConversationStatus_UNFILED
	}
	conv.Conv.Metadata.Version = vers.ToConvVers()

	// Slot in at the top
	mconv := *conv
	i.Debug(ctx, "NewMessage: promoting convID: %s to the top of %d convs", convID,
		len(ibox.Conversations))
	ibox.Conversations = append(ibox.Conversations[:index], ibox.Conversations[index+1:]...)
	ibox.Conversations = append([]types.RemoteConversation{mconv}, ibox.Conversations...)

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
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
	if conv.Conv.ReaderInfo.ReadMsgid < msgID {
		i.Debug(ctx, "ReadMessage: updating mtime: readMsgID: %d msgID: %d", conv.Conv.ReaderInfo.ReadMsgid,
			msgID)
		conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
		conv.Conv.ReaderInfo.ReadMsgid = msgID
	}
	conv.Conv.Metadata.Version = vers.ToConvVers()

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
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

	conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
	conv.Conv.Metadata.Status = status
	conv.Conv.Metadata.Version = vers.ToConvVers()

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

func (i *Inbox) SetAppNotificationSettings(ctx context.Context, vers chat1.InboxVers,
	convID chat1.ConversationID, settings chat1.ConversationNotificationInfo) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "SetAppNotificationSettings")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "SetAppNotificationSettings: vers: %d convID: %s", vers, convID)
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
		i.Debug(ctx, "SetAppNotificationSettings: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}
	for apptype, kindMap := range settings.Settings {
		for kind, enabled := range kindMap {
			conv.Conv.Notifications.Settings[apptype][kind] = enabled
		}
	}
	conv.Conv.Notifications.ChannelWide = settings.ChannelWide
	conv.Conv.Metadata.Version = vers.ToConvVers()

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

// Mark the expunge on the stored inbox
// Does not delete any messages. Relies on separate server mechanism to delete clear max messages.
func (i *Inbox) Expunge(ctx context.Context, vers chat1.InboxVers,
	convID chat1.ConversationID, expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Expunge")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "Expunge: vers: %d convID: %s", vers, convID)
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
		i.Debug(ctx, "Expunge: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}
	conv.Conv.Expunge = expunge
	conv.Conv.Metadata.Version = vers.ToConvVers()

	if len(maxMsgs) == 0 {
		// Expunge notifications should always come with max msgs.
		i.Debug(ctx, "Expunge: returning fake version mismatch error because of missing maxMsgs: vers: %d",
			vers)
		return NewVersionMismatchError(ibox.InboxVersion, vers)
	} else {
		i.Debug(ctx, "Expunge: setting max messages from server payload")
		conv.Conv.MaxMsgSummaries = maxMsgs
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

func (i *Inbox) SetConvRetention(ctx context.Context, vers chat1.InboxVers,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "SetConvRetention")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "SetConvRetention: vers: %d convID: %s", vers, convID)
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
		i.Debug(ctx, "SetConvRetention: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}
	conv.Conv.ConvRetention = &policy
	conv.Conv.Metadata.Version = vers.ToConvVers()

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

// Update any local conversations with this team ID.
func (i *Inbox) SetTeamRetention(ctx context.Context, vers chat1.InboxVers,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) (res []chat1.ConversationID, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "SetTeamRetention")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "SetTeamRetention: vers: %d teamID: %s", vers, teamID)
	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return res, nil
		}
		return res, err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return res, err
	}

	// Update conversations
	convs := i.getConvsForTeam(ctx, teamID, ibox.Conversations)
	if len(convs) == 0 {
		return res, nil
	}
	for _, conv := range convs {
		conv.Conv.TeamRetention = &policy
		conv.Conv.Metadata.Version = vers.ToConvVers()
		res = append(res, conv.Conv.GetConvID())
	}

	// Write out to disk
	ibox.InboxVersion = vers
	err = i.writeDiskInbox(ctx, ibox)
	return res, err
}

func (i *Inbox) UpgradeKBFSToImpteam(ctx context.Context, vers chat1.InboxVers,
	convID chat1.ConversationID) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "UpgradeKBFSToImpteam: vers: %d convID: %s", vers, convID)
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
		i.Debug(ctx, "UpgradeKBFSToImpteam: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}
	conv.Conv.Metadata.MembersType = chat1.ConversationMembersType_IMPTEAMUPGRADE

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

func (i *Inbox) TeamTypeChanged(ctx context.Context, vers chat1.InboxVers,
	convID chat1.ConversationID, teamType chat1.TeamType, notifInfo *chat1.ConversationNotificationInfo) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "TeamTypeChanged")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "TeamTypeChanged: vers: %d convID: %s typ: %v", vers, convID, teamType)
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
		i.Debug(ctx, "TeamTypeChanged: no conversation found: convID: %s, clearing", convID)
		return i.Clear(ctx)
	}
	conv.Conv.Notifications = notifInfo
	conv.Conv.Metadata.TeamType = teamType
	conv.Conv.Metadata.Version = vers.ToConvVers()

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
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

		conv.Conv.Metadata.FinalizeInfo = &finalizeInfo
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
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

type InboxSyncRes struct {
	TeamTypeChanged    bool
	MembersTypeChanged []chat1.ConversationID
	Expunges           []InboxSyncResExpunge
}

type InboxSyncResExpunge struct {
	ConvID  chat1.ConversationID
	Expunge chat1.Expunge
}

func (i *Inbox) Sync(ctx context.Context, vers chat1.InboxVers, convs []chat1.Conversation) (res InboxSyncRes, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Sync")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	ibox, err := i.readDiskInbox(ctx)
	if err != nil {
		// Return MissError, since it should be unexpected if are calling this
		return res, err
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
			oldConv := ibox.Conversations[index].Conv
			if oldConv.Metadata.TeamType != newConv.Metadata.TeamType {
				// Changing the team type might be hard for clients of the inbox system to process,
				// so call it out so they can know a hard update happened here.
				res.TeamTypeChanged = true
			}
			if oldConv.Metadata.MembersType != newConv.Metadata.MembersType {
				res.MembersTypeChanged = append(res.MembersTypeChanged,
					oldConv.GetConvID())
			}
			if oldConv.Expunge != newConv.Expunge {
				// The earliest point in non-deleted history has moved up.
				// Point it out so that convsource can get updated.
				res.Expunges = append(res.Expunges, InboxSyncResExpunge{
					ConvID:  newConv.Metadata.ConversationID,
					Expunge: newConv.Expunge,
				})
			}
			ibox.Conversations[index].Conv = newConv
			delete(convMap, conv.GetConvID().String())
		}
	}
	i.Debug(ctx, "Sync: adding %d new conversations", len(convMap))
	for _, conv := range convMap {
		ibox.Conversations = append(ibox.Conversations, types.RemoteConversation{
			Conv: conv,
		})
	}
	sort.Sort(ByDatabaseOrder(ibox.Conversations))

	i.Debug(ctx, "Sync: old vers: %v new vers: %v convs: %d", oldVers, ibox.InboxVersion, len(convs))
	if err = i.writeDiskInbox(ctx, ibox); err != nil {
		return res, err
	}

	return res, nil
}

func (i *Inbox) MembershipUpdate(ctx context.Context, vers chat1.InboxVers,
	userJoined []chat1.Conversation, userRemoved []chat1.ConversationID,
	othersJoined []chat1.ConversationMember, othersRemoved []chat1.ConversationMember,
	userReset []chat1.ConversationID, othersReset []chat1.ConversationMember) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "MembershipUpdate")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey())

	i.Debug(ctx, "MembershipUpdate: updating userJoined: %d userRemoved: %d othersJoined: %d othersRemoved: %d", len(userJoined), len(userRemoved), len(othersJoined), len(othersRemoved))
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

	// Process our own changes
	var ujs []types.RemoteConversation
	for _, uj := range userJoined {
		i.Debug(ctx, "MembershipUpdate: joined conv: %s", uj.GetConvID())
		ujs = append(ujs, types.RemoteConversation{
			Conv: uj,
		})
	}
	convs := i.mergeConvs(ujs, ibox.Conversations)
	removedMap := make(map[string]bool)
	for _, r := range userRemoved {
		i.Debug(ctx, "MembershipUpdate: removing user from: %s", r)
		removedMap[r.String()] = true
	}
	resetMap := make(map[string]bool)
	for _, r := range userReset {
		i.Debug(ctx, "MembershipUpdate: user reset in: %s", r)
		resetMap[r.String()] = true
	}
	ibox.Conversations = nil
	for _, conv := range convs {
		if removedMap[conv.GetConvID().String()] {
			conv.Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_LEFT
			conv.Conv.Metadata.Version = vers.ToConvVers()
		} else if resetMap[conv.GetConvID().String()] {
			conv.Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_RESET
			conv.Conv.Metadata.Version = vers.ToConvVers()
		}
		ibox.Conversations = append(ibox.Conversations, conv)
	}
	sort.Sort(ByDatabaseOrder(ibox.Conversations))

	// Update all lists with other people joining and leaving
	convMap := make(map[string]*types.RemoteConversation)
	for index, c := range ibox.Conversations {
		convMap[c.GetConvID().String()] = &ibox.Conversations[index]
	}
	for _, oj := range othersJoined {
		if cp, ok := convMap[oj.ConvID.String()]; ok {
			// Check reset list for this UID, if we find it remove it instead of adding to all list
			isReset := false
			var resetIndex int
			var r gregor1.UID
			for resetIndex, r = range cp.Conv.Metadata.ResetList {
				if r.Eq(oj.Uid) {
					isReset = true
					break
				}
			}
			if isReset {
				cp.Conv.Metadata.ResetList = append(cp.Conv.Metadata.ResetList[:resetIndex],
					cp.Conv.Metadata.ResetList[resetIndex+1:]...)
			} else {
				cp.Conv.Metadata.AllList = append(cp.Conv.Metadata.AllList, oj.Uid)
			}
			cp.Conv.Metadata.Version = vers.ToConvVers()
		}
	}
	for _, or := range othersRemoved {
		if cp, ok := convMap[or.ConvID.String()]; ok {
			var newAllList []gregor1.UID
			for _, u := range cp.Conv.Metadata.AllList {
				if !u.Eq(or.Uid) {
					newAllList = append(newAllList, u)
				}
			}
			cp.Conv.Metadata.AllList = newAllList
			cp.Conv.Metadata.Version = vers.ToConvVers()
		}
	}
	for _, or := range othersReset {
		if cp, ok := convMap[or.ConvID.String()]; ok {
			cp.Conv.Metadata.ResetList = append(cp.Conv.Metadata.ResetList, or.Uid)
			cp.Conv.Metadata.Version = vers.ToConvVers()
		}
	}

	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, ibox)
}

type InboxVersionSource struct {
	globals.Contextified
}

func NewInboxVersionSource(g *globals.Context) *InboxVersionSource {
	return &InboxVersionSource{
		Contextified: globals.NewContextified(g),
	}
}

func (i *InboxVersionSource) GetInboxVersion(ctx context.Context, uid gregor1.UID) (chat1.InboxVers, error) {
	return NewInbox(i.G(), uid).Version(ctx)
}
