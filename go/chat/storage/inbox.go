package storage

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

const inboxVersion = 32

type InboxFlushMode int

const (
	InboxFlushModeActive InboxFlushMode = iota
	InboxFlushModeDelegate
)

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

func (q inboxDiskQuery) match(other inboxDiskQuery) bool {
	return q.queryMatch(other) && q.Pagination.Eq(other.Pagination)
}

type inboxDiskIndex struct {
	ConversationIDs []chat1.ConversationID `codec:"C"`
	Queries         []inboxDiskQuery       `codec:"Q"`
}

func (i inboxDiskIndex) DeepCopy() (res inboxDiskIndex) {
	res.ConversationIDs = make([]chat1.ConversationID, len(i.ConversationIDs))
	res.Queries = make([]inboxDiskQuery, len(i.Queries))
	copy(res.ConversationIDs, i.ConversationIDs)
	copy(res.Queries, i.Queries)
	return res
}

func (i *inboxDiskIndex) mergeConvs(convIDs []chat1.ConversationID) {
	m := make(map[string]chat1.ConversationID, len(convIDs))
	for _, convID := range convIDs {
		m[convID.String()] = convID
	}
	for _, convID := range i.ConversationIDs {
		delete(m, convID.String())
	}
	for _, convID := range m {
		i.ConversationIDs = append(i.ConversationIDs, convID)
	}
}

func (i *inboxDiskIndex) merge(convIDs []chat1.ConversationID, hash queryHash) {
	i.mergeConvs(convIDs)
	queryExists := false
	qp := inboxDiskQuery{QueryHash: hash}
	for _, q := range i.Queries {
		if q.queryMatch(qp) {
			queryExists = true
			break
		}
	}
	if !queryExists {
		i.Queries = append(i.Queries, qp)
	}
}

type inboxDiskVersions struct {
	Version       int             `codec:"V"`
	ServerVersion int             `codec:"S"`
	InboxVersion  chat1.InboxVers `codec:"I"`
}

type InboxLayoutChangedNotifier interface {
	UpdateLayout(ctx context.Context, reselectMode chat1.InboxLayoutReselectMode, reason string)
	UpdateLayoutFromNewMessage(ctx context.Context, conv types.RemoteConversation)
	UpdateLayoutFromSubteamRename(ctx context.Context, convs []types.RemoteConversation)
}

type dummyInboxLayoutChangedNotifier struct{}

func (d dummyInboxLayoutChangedNotifier) UpdateLayout(ctx context.Context,
	reselectMode chat1.InboxLayoutReselectMode, reason string) {
}

func (d dummyInboxLayoutChangedNotifier) UpdateLayoutFromNewMessage(ctx context.Context,
	conv types.RemoteConversation) {
}

func (d dummyInboxLayoutChangedNotifier) UpdateLayoutFromSubteamRename(ctx context.Context,
	convs []types.RemoteConversation) {
}

func LayoutChangedNotifier(notifier InboxLayoutChangedNotifier) func(*Inbox) {
	return func(i *Inbox) {
		i.SetInboxLayoutChangedNotifier(notifier)
	}
}

type Inbox struct {
	globals.Contextified
	*baseBox
	utils.DebugLabeler

	layoutNotifier InboxLayoutChangedNotifier
}

func NewInbox(g *globals.Context, config ...func(*Inbox)) *Inbox {
	i := &Inbox{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.ExternalG(), "Inbox", false),
		baseBox:        newBaseBox(g),
		layoutNotifier: dummyInboxLayoutChangedNotifier{},
	}
	for _, c := range config {
		c(i)
	}
	return i
}

func (i *Inbox) SetInboxLayoutChangedNotifier(notifier InboxLayoutChangedNotifier) {
	i.layoutNotifier = notifier
}

func (i *Inbox) dbVersionsKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInbox,
		Key: uid.String(),
	}
}

func (i *Inbox) dbIndexKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInboxIndex,
		Key: uid.String(),
	}
}

func (i *Inbox) dbConvKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInboxConvs,
		Key: uid.String() + convID.DbShortFormString(),
	}
}

func (i *Inbox) maybeNuke(ctx context.Context, ef func() Error, uid gregor1.UID) {
	err := ef()
	if err != nil && err.ShouldClear() {
		i.Debug(ctx, "maybeNuke: nuking on err: %v", err)
		if ierr := i.clearLocked(ctx, uid); ierr != nil {
			i.Debug(ctx, "maybeNuke: unable to clear box on error! err: %s", ierr)
		}
	}
}

func (i *Inbox) readDiskVersions(ctx context.Context, uid gregor1.UID, useInMemory bool) (inboxDiskVersions, Error) {
	var ibox inboxDiskVersions
	// Check context for an aborted request
	if err := isAbortedRequest(ctx); err != nil {
		return ibox, err
	}
	// Check in memory cache first
	if memibox := inboxMemCache.GetVersions(uid); useInMemory && memibox != nil {
		i.Debug(ctx, "readDiskVersions: hit in memory cache")
		ibox = *memibox
	} else {
		found, err := i.readDiskBox(ctx, i.dbVersionsKey(uid), &ibox)
		if err != nil {
			if _, ok := err.(libkb.LoginRequiredError); ok {
				return ibox, MiscError{Msg: err.Error()}
			}
			return ibox, NewInternalError(ctx, i.DebugLabeler,
				"failed to read inbox: uid: %d err: %s", uid, err)
		}
		if !found {
			return ibox, MissError{}
		}
		if useInMemory {
			inboxMemCache.PutVersions(uid, &ibox)
		}
	}
	// Check on disk server version against known server version
	if _, err := i.G().ServerCacheVersions.MatchInbox(ctx, ibox.ServerVersion); err != nil {
		i.Debug(ctx, "readDiskVersions: server version match error, clearing: %s", err)
		if cerr := i.clearLocked(ctx, uid); cerr != nil {
			i.Debug(ctx, "readDiskVersions: failed to clear after server mismatch: %s", cerr)
		}
		return ibox, MissError{}
	}
	// Check on disk version against configured
	if ibox.Version != inboxVersion {
		i.Debug(ctx,
			"readDiskVersions: on disk version not equal to program version, clearing: disk :%d program: %d",
			ibox.Version, inboxVersion)
		if cerr := i.clearLocked(ctx, uid); cerr != nil {
			i.Debug(ctx, "readDiskVersions: failed to clear after inbox mismatch: %s", cerr)
		}
		return ibox, MissError{}
	}

	i.Debug(ctx, "readDiskVersions: version: %d disk version: %d server version: %d",
		ibox.InboxVersion, ibox.Version, ibox.ServerVersion)

	return ibox, nil
}

func (i *Inbox) writeDiskVersions(ctx context.Context, uid gregor1.UID, ibox inboxDiskVersions) Error {
	// Get latest server version
	vers, err := i.G().ServerCacheVersions.Fetch(ctx)
	if err != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to fetch server versions: %s", err)
	}
	ibox.ServerVersion = vers.InboxVers
	ibox.Version = inboxVersion
	i.Debug(ctx, "writeDiskVersions: uid: %s version: %d disk version: %d server version: %d",
		uid, ibox.InboxVersion, ibox.Version, ibox.ServerVersion)
	inboxMemCache.PutVersions(uid, &ibox)
	if err := i.writeDiskBox(ctx, i.dbVersionsKey(uid), ibox); err != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to write inbox versions: %s", err)
	}
	return nil
}

func (i *Inbox) readDiskIndex(ctx context.Context, uid gregor1.UID, useInMemory bool) (inboxDiskIndex, Error) {
	var ibox inboxDiskIndex
	// Check context for an aborted request
	if err := isAbortedRequest(ctx); err != nil {
		return ibox, err
	}
	// Check in memory cache first
	if memibox := inboxMemCache.GetIndex(uid); useInMemory && memibox != nil {
		i.Debug(ctx, "readDiskIndex: hit in memory cache")
		ibox = *memibox
	} else {
		found, err := i.readDiskBox(ctx, i.dbIndexKey(uid), &ibox)
		if err != nil {
			if _, ok := err.(libkb.LoginRequiredError); ok {
				return ibox, MiscError{Msg: err.Error()}
			}
			return ibox, NewInternalError(ctx, i.DebugLabeler,
				"failed to read inbox: uid: %d err: %s", uid, err)
		}
		if !found {
			return ibox, MissError{}
		}
		if useInMemory {
			inboxMemCache.PutIndex(uid, &ibox)
		}
	}
	i.Debug(ctx, "readDiskIndex: convs: %d queries: %d", len(ibox.ConversationIDs), len(ibox.Queries))
	return ibox, nil
}

func (i *Inbox) writeDiskIndex(ctx context.Context, uid gregor1.UID, ibox inboxDiskIndex) Error {
	i.Debug(ctx, "writeDiskIndex: convs: %d queries: %d", len(ibox.ConversationIDs), len(ibox.Queries))
	inboxMemCache.PutIndex(uid, &ibox)
	if err := i.writeDiskBox(ctx, i.dbIndexKey(uid), ibox); err != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to write inbox index: %s", err)
	}
	return nil
}

func (i *Inbox) readConvs(ctx context.Context, uid gregor1.UID, convIDs []chat1.ConversationID) (res []types.RemoteConversation, err Error) {
	res = make([]types.RemoteConversation, 0, len(convIDs))
	memHits := make(map[chat1.ConvIDStr]bool, len(convIDs))
	for _, convID := range convIDs {
		if conv := inboxMemCache.GetConv(uid, convID); conv != nil {
			res = append(res, *conv)
			memHits[convID.ConvIDStr()] = true
		}
	}
	if len(memHits) == len(convIDs) {
		return res, nil
	}
	dbReads := 0
	defer func() {
		i.Debug(ctx, "readConvs: read %d convs from db", dbReads)
	}()
	for _, convID := range convIDs {
		if memHits[convID.ConvIDStr()] {
			continue
		}
		var conv types.RemoteConversation
		dbReads++
		found, err := i.readDiskBox(ctx, i.dbConvKey(uid, convID), &conv)
		if err != nil {
			if _, ok := err.(libkb.LoginRequiredError); ok {
				return res, MiscError{Msg: err.Error()}
			}
			return res, NewInternalError(ctx, i.DebugLabeler,
				"failed to read inbox: uid: %d err: %s", uid, err)
		}
		if !found {
			return res, MissError{}
		}
		inboxMemCache.PutConv(uid, conv)
		res = append(res, conv)
	}
	return res, nil
}

func (i *Inbox) readConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res types.RemoteConversation, err Error) {
	convs, err := i.readConvs(ctx, uid, []chat1.ConversationID{convID})
	if err != nil {
		return res, err
	}
	if len(convs) == 0 {
		return res, MissError{}
	}
	return convs[0], nil
}

func (i *Inbox) writeConvs(ctx context.Context, uid gregor1.UID, convs []types.RemoteConversation,
	withVersionCheck bool) Error {
	i.summarizeConvs(convs)
	for _, conv := range convs {
		if withVersionCheck {
			existing, err := i.readConv(ctx, uid, conv.GetConvID())
			if err == nil && existing.GetVersion() >= conv.GetVersion() {
				i.Debug(ctx, "writeConvs: skipping write because of newer stored version: convID: %s old: %d new: %d",
					conv.ConvIDStr, existing.GetVersion(), conv.GetVersion())
				continue
			}
		}
		i.Debug(ctx, "writeConvs: writing conv: %s", conv.ConvIDStr)
		inboxMemCache.PutConv(uid, conv)
		if err := i.writeDiskBox(ctx, i.dbConvKey(uid, conv.GetConvID()), conv); err != nil {
			return NewInternalError(ctx, i.DebugLabeler, "failed to write conv: %s err: %s", conv.ConvIDStr,
				err)
		}
	}
	return nil
}

func (i *Inbox) writeConv(ctx context.Context, uid gregor1.UID, conv types.RemoteConversation,
	withVersionCheck bool) Error {
	return i.writeConvs(ctx, uid, []types.RemoteConversation{conv}, withVersionCheck)
}

type ByDatabaseOrder []types.RemoteConversation

func (a ByDatabaseOrder) Len() int      { return len(a) }
func (a ByDatabaseOrder) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a ByDatabaseOrder) Less(i, j int) bool {
	return utils.DBConvLess(a[i], a[j])
}

func (i *Inbox) summarizeConv(rc *types.RemoteConversation) {
	if len(rc.Conv.MaxMsgs) == 0 {
		// early out here since we don't do anything if this is empty
		return
	}

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

func (i *Inbox) summarizeConvs(convs []types.RemoteConversation) {
	for index := range convs {
		i.summarizeConv(&convs[index])
	}
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
	_, err = hasher.Write(dat)
	if err != nil {
		return nil, NewInternalError(ctx, i.DebugLabeler, "failed to write query: %s", err.Error())
	}
	return hasher.Sum(nil), nil
}

func (i *Inbox) readDiskVersionsIndexMissOk(ctx context.Context, uid gregor1.UID, useInMemory bool) (vers inboxDiskVersions, index inboxDiskIndex, err Error) {
	if vers, err = i.readDiskVersions(ctx, uid, true); err != nil {
		if _, ok := err.(MissError); !ok {
			return vers, index, err
		}
	}
	if index, err = i.readDiskIndex(ctx, uid, true); err != nil {
		if _, ok := err.(MissError); !ok {
			return vers, index, err
		}
	}
	return vers, index, nil
}

func (i *Inbox) castInternalError(ierr Error) error {
	err, ok := ierr.(error)
	if ok {
		return err
	}
	return nil
}

func (i *Inbox) MergeLocalMetadata(ctx context.Context, uid gregor1.UID, convs []chat1.ConversationLocal) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "MergeLocalMetadata")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	for _, convLocal := range convs {
		conv, err := i.readConv(ctx, uid, convLocal.GetConvID())
		if err != nil {
			i.Debug(ctx, "MergeLocalMetadata: skipping metadata for %s: err: %s", convLocal.GetConvID(),
				err)
			continue
		}
		// Don't write this out for error convos
		if convLocal.Error != nil || convLocal.GetTopicType() != chat1.TopicType_CHAT {
			continue
		}
		topicName := convLocal.Info.TopicName
		snippetDecoration, snippet, _ := utils.GetConvSnippet(ctx, i.G(), uid, convLocal,
			i.G().GetEnv().GetUsername().String())
		rcm := &types.RemoteConversationMetadata{
			Name:              convLocal.Info.TlfName,
			TopicName:         topicName,
			Headline:          convLocal.Info.Headline,
			HeadlineEmojis:    convLocal.Info.HeadlineEmojis,
			Snippet:           snippet,
			SnippetDecoration: snippetDecoration,
		}
		switch convLocal.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
		default:
			rcm.WriterNames = convLocal.AllNames()
			rcm.FullNamesForSearch = convLocal.FullNamesForSearch()
			rcm.ResetParticipants = convLocal.Info.ResetNames
		}
		conv.LocalMetadata = rcm
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}
	return nil
}

// Merge add/updates conversations into the inbox. If a given conversation is either missing
// from the inbox, or is of greater version than what is currently stored, we write it down. Otherwise,
// we ignore it. If the inbox is currently blank, then we write down the given inbox version.
func (i *Inbox) Merge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convsIn []chat1.Conversation, query *chat1.GetInboxQuery) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "Merge")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "Merge: vers: %d convs: %d", vers, len(convsIn))
	if len(convsIn) == 1 {
		i.Debug(ctx, "Merge: single conversation: %s", convsIn[0].GetConvID())
	}
	convIDs := make([]chat1.ConversationID, 0, len(convsIn))
	for _, conv := range convsIn {
		convIDs = append(convIDs, conv.GetConvID())
	}
	convs := make([]chat1.Conversation, len(convsIn))
	copy(convs, convsIn)

	iboxVers, iboxIndex, err := i.readDiskVersionsIndexMissOk(ctx, uid, true)
	if err != nil {
		return err
	}

	// write all the convs out
	if err := i.writeConvs(ctx, uid, utils.RemoteConvs(convs), true); err != nil {
		return err
	}

	// update index
	hquery, err := i.hashQuery(ctx, query)
	if err != nil {
		return err
	}
	i.Debug(ctx, "Merge: query hash: %s", hquery)
	iboxIndex.merge(convIDs, hquery)
	if err := i.writeDiskIndex(ctx, uid, iboxIndex); err != nil {
		return err
	}

	// updat eversion info
	if iboxVers.InboxVersion != 0 {
		vers = iboxVers.InboxVersion
	} else {
		i.Debug(ctx, "Merge: using given version: %d", vers)
	}
	i.Debug(ctx, "Merge: merging inbox: vers: %d convs: %d", vers, len(iboxIndex.ConversationIDs))
	// Write out new inbox
	return i.writeDiskVersions(ctx, uid, inboxDiskVersions{
		Version:      inboxVersion,
		InboxVersion: vers,
	})
}

func (i *Inbox) queryNameExists(ctx context.Context, uid gregor1.UID, ibox inboxDiskIndex,
	tlfID chat1.TLFID, membersType chat1.ConversationMembersType, topicName string,
	topicType chat1.TopicType) bool {
	convs, err := i.readConvs(ctx, uid, ibox.ConversationIDs)
	if err != nil {
		i.Debug(ctx, "queryNameExists: unexpected miss on index conv read: %s", err)
		return false
	}
	for _, conv := range convs {
		if conv.Conv.Metadata.IdTriple.Tlfid.Eq(tlfID) && conv.GetMembersType() == membersType &&
			conv.GetTopicName() == topicName && conv.GetTopicType() == topicType {
			return true
		}
	}
	return false
}

func (i *Inbox) queryExists(ctx context.Context, uid gregor1.UID, ibox inboxDiskIndex,
	query *chat1.GetInboxQuery) bool {

	// Check for a name query that is after a single conversation
	if query != nil && query.TlfID != nil && query.TopicType != nil && query.TopicName != nil &&
		len(query.MembersTypes) == 1 {
		if i.queryNameExists(ctx, uid, ibox, *query.TlfID, query.MembersTypes[0], *query.TopicName,
			*query.TopicType) {
			i.Debug(ctx, "Read: queryExists: single name query hit")
			return true
		}
	}

	// Normally a query that has not been seen before will return an error.
	// With AllowUnseenQuery, an unfamiliar query is accepted.
	if query != nil && query.AllowUnseenQuery {
		return true
	}

	hquery, err := i.hashQuery(ctx, query)
	if err != nil {
		i.Debug(ctx, "Read: queryExists: error hashing query: %s", err)
		return false
	}
	i.Debug(ctx, "Read: queryExists: query hash: %s", hquery)

	qp := inboxDiskQuery{QueryHash: hquery}
	for _, q := range ibox.Queries {
		if q.match(qp) {
			return true
		}
	}
	return false
}

func (i *Inbox) ReadAll(ctx context.Context, uid gregor1.UID, useInMemory bool) (vers chat1.InboxVers, res []types.RemoteConversation, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "ReadAll")()
	defer func() { ierr = i.castInternalError(err) }()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()

	iboxIndex, err := i.readDiskIndex(ctx, uid, useInMemory)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox index found")
		}
		return 0, nil, err
	}
	iboxVers, err := i.readDiskVersions(ctx, uid, useInMemory)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox version found")
		}
		return 0, nil, err
	}
	convs, err := i.readConvs(ctx, uid, iboxIndex.ConversationIDs)
	if err != nil {
		i.Debug(ctx, "ReadAll: unexpected miss on index conv read: %s", err)
		return 0, nil, err
	}

	return iboxVers.InboxVersion, convs, nil
}

func (i *Inbox) GetConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res types.RemoteConversation, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, fmt.Sprintf("GetConversation(%s,%s)", uid, convID))()
	defer func() { ierr = i.castInternalError(err) }()
	_, iboxRes, err := i.Read(ctx, uid, &chat1.GetInboxQuery{
		ConvID: &convID,
	})
	if err != nil {
		return res, err
	}
	if len(iboxRes) != 1 {
		return res, MissError{}
	}
	return iboxRes[0], nil
}

func (i *Inbox) Read(ctx context.Context, uid gregor1.UID, query *chat1.GetInboxQuery) (vers chat1.InboxVers, res []types.RemoteConversation, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, fmt.Sprintf("Read(%s)", uid))()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox versions found")
		}
		return 0, nil, err
	}
	var convs []types.RemoteConversation
	if query != nil && (query.ConvID != nil || len(query.ConvIDs) > 0) {
		convIDs := query.ConvIDs
		if query.ConvID != nil {
			convIDs = append(convIDs, *query.ConvID)
		}
		if convs, err = i.readConvs(ctx, uid, convIDs); err != nil {
			return 0, nil, err
		}
	} else {
		iboxIndex, err := i.readDiskIndex(ctx, uid, true)
		if err != nil {
			if _, ok := err.(MissError); ok {
				i.Debug(ctx, "Read: miss: no inbox found")
			}
			return 0, nil, err
		}

		// Check to make sure query parameters have been seen before
		if !i.queryExists(ctx, uid, iboxIndex, query) {
			i.Debug(ctx, "Read: miss: query or pagination unknown")
			return 0, nil, MissError{}
		}

		if convs, err = i.readConvs(ctx, uid, iboxIndex.ConversationIDs); err != nil {
			i.Debug(ctx, "Read: unexpected miss on index read: %s", err)
			return 0, nil, NewInternalError(ctx, i.DebugLabeler, "index out of sync with convs")
		}
	}

	// Apply query and pagination
	res = utils.ApplyInboxQuery(ctx, i.DebugLabeler, query, convs)

	i.Debug(ctx, "Read: hit: version: %d", iboxVers.InboxVersion)
	return iboxVers.InboxVersion, res, nil
}

func (i *Inbox) clearLocked(ctx context.Context, uid gregor1.UID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "clearLocked")()
	defer func() { ierr = i.castInternalError(err) }()
	var iboxIndex inboxDiskIndex
	if iboxIndex, err = i.readDiskIndex(ctx, uid, true); err != nil {
		i.Debug(ctx, "Clear: failed to read index: %s", err)
	}
	for _, convID := range iboxIndex.ConversationIDs {
		if ierr := i.G().LocalChatDb.Delete(i.dbConvKey(uid, convID)); ierr != nil {
			msg := fmt.Sprintf("error clearing conv: convID: %s err: %s", convID, ierr)
			err = NewInternalError(ctx, i.DebugLabeler, msg)
			i.Debug(ctx, msg)
		}
	}
	if ierr := i.G().LocalChatDb.Delete(i.dbVersionsKey(uid)); ierr != nil {
		msg := fmt.Sprintf("error clearing inbox versions: err: %s", ierr)
		err = NewInternalError(ctx, i.DebugLabeler, msg)
		i.Debug(ctx, msg)
	}
	if ierr := i.G().LocalChatDb.Delete(i.dbIndexKey(uid)); ierr != nil {
		msg := fmt.Sprintf("error clearing inbox index: err: %s", ierr)
		err = NewInternalError(ctx, i.DebugLabeler, msg)
		i.Debug(ctx, msg)
	}
	inboxMemCache.Clear(uid)
	return err
}

func (i *Inbox) Clear(ctx context.Context, uid gregor1.UID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "Clear")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	return i.clearLocked(ctx, uid)
}

func (i *Inbox) ClearInMemory(ctx context.Context, uid gregor1.UID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "ClearInMemory")()
	defer func() { ierr = i.castInternalError(err) }()
	inboxMemCache.Clear(uid)
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

func (i *Inbox) NewConversation(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	conv chat1.Conversation) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "NewConversation")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	layoutChanged := true
	defer func() {
		if layoutChanged {
			i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "new conversation")
		}
	}()

	i.Debug(ctx, "NewConversation: vers: %d convID: %s", vers, conv.GetConvID())
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Do a pass to make sure we don't already know about this convo
	_, err = i.readConv(ctx, uid, conv.GetConvID())
	known := err == nil
	if !known {
		iboxIndex, err := i.readDiskIndex(ctx, uid, true)
		if err != nil {
			return err
		}
		// Find any conversations this guy might supersede and set supersededBy pointer
		if len(conv.Metadata.Supersedes) > 0 {
			for _, convID := range iboxIndex.ConversationIDs {
				iconv, err := i.readConv(ctx, uid, convID)
				if err != nil {
					return err
				}
				if iconv.Conv.Metadata.FinalizeInfo == nil {
					continue
				}
				for _, super := range conv.Metadata.Supersedes {
					if iconv.GetConvID().Eq(super.ConversationID) {
						i.Debug(ctx, "NewConversation: setting supersededBy: target: %s superseder: %s",
							iconv.ConvIDStr, conv.GetConvID())
						iconv.Conv.Metadata.SupersededBy = append(iconv.Conv.Metadata.SupersededBy, conv.Metadata)
						iconv.Conv.Metadata.Version = vers.ToConvVers()
						if err := i.writeConv(ctx, uid, iconv, false); err != nil {
							return err
						}
					}
				}
			}
		}
		if err := i.writeConv(ctx, uid, utils.RemoteConv(conv), false); err != nil {
			return err
		}
		// only chat convs for layout changed
		layoutChanged = conv.GetTopicType() == chat1.TopicType_CHAT
		iboxIndex.ConversationIDs = append(iboxIndex.ConversationIDs, conv.GetConvID())
		if err := i.writeDiskIndex(ctx, uid, iboxIndex); err != nil {
			return err
		}
	} else {
		i.Debug(ctx, "NewConversation: skipping update, conversation exists in inbox")
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

// Return pointers into `convs` for the convs belonging to `teamID`.
func (i *Inbox) getConvsForTeam(ctx context.Context, uid gregor1.UID, teamID keybase1.TeamID,
	index inboxDiskIndex) (res []types.RemoteConversation) {
	tlfID, err := chat1.TeamIDToTLFID(teamID)
	if err != nil {
		i.Debug(ctx, "getConvsForTeam: teamIDToTLFID failed: %v", err)
		return nil
	}
	for _, convID := range index.ConversationIDs {
		conv, err := i.readConv(ctx, uid, convID)
		if err != nil {
			i.Debug(ctx, "getConvsForTeam: failed to get conv: %s", convID)
			continue
		}
		if conv.Conv.GetMembersType() == chat1.ConversationMembersType_TEAM &&
			conv.Conv.Metadata.IdTriple.Tlfid.Eq(tlfID) {
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

func (i *Inbox) UpdateInboxVersion(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "UpdateInboxVersion")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	ibox, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return err
	}
	ibox.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, ibox)
}

func (i *Inbox) getConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res types.RemoteConversation, found bool, err Error) {
	conv, err := i.readConv(ctx, uid, convID)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return res, false, nil
		}
		return res, false, err
	}
	return conv, true, nil
}

func (i *Inbox) IncrementLocalConvVersion(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "IncrementLocalConvVersion")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "IncrementLocalConvVersion: no conversation found: convID: %s", convID)
		return nil
	}
	conv.Conv.Metadata.LocalVersion++
	return i.writeConv(ctx, uid, conv, false)
}

func (i *Inbox) MarkLocalRead(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "MarkLocalRead")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "MarkLocalRead: no conversation found: convID: %s", convID)
		return nil
	}
	conv.LocalReadMsgID = msgID
	return i.writeConv(ctx, uid, conv, false)
}

func (i *Inbox) Draft(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	text *string) (modified bool, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return false, err
	}
	if !found {
		i.Debug(ctx, "Draft: no conversation found: convID: %s", convID)
		return false, nil
	}
	if text == nil && conv.LocalDraft == nil {
		// don't do anything if we are clearing
		return false, nil
	}
	conv.LocalDraft = text
	conv.Conv.Metadata.LocalVersion++
	return true, i.writeConv(ctx, uid, conv, false)
}

func (i *Inbox) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "NewMessage")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "NewMessage: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	updateVers := vers
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "NewMessage: no conversation found: convID: %s", convID)
		// Write out to disk
		iboxVers.InboxVersion = vers
		return i.writeDiskVersions(ctx, uid, iboxVers)
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
				return NewVersionMismatchError(iboxVers.InboxVersion, vers)
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
		bytes.Equal(msg.ClientHeader.Sender.Bytes(), uid) {
		conv.Conv.ReaderInfo.ReadMsgid = msg.GetMessageID()
		conv.Conv.ReaderInfo.LastSendTime = msg.Ctime()
	}
	conv.Conv.ReaderInfo.MaxMsgid = msg.GetMessageID()
	conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
	conv.Conv.Metadata.ActiveList = i.promoteWriter(ctx, msg.ClientHeader.Sender,
		conv.Conv.Metadata.ActiveList)

	// If we are the sender, adjust the status.
	if bytes.Equal(msg.ClientHeader.Sender.Bytes(), uid) &&
		utils.GetConversationStatusBehavior(conv.Conv.Metadata.Status).SendingRemovesStatus {
		conv.Conv.Metadata.Status = chat1.ConversationStatus_UNFILED
	}
	// If we are a participant, adjust the status.
	if utils.GetConversationStatusBehavior(conv.Conv.Metadata.Status).ActivityRemovesStatus {
		conv.Conv.Metadata.Status = chat1.ConversationStatus_UNFILED
	}
	conv.Conv.Metadata.Version = vers.ToConvVers()
	if err := i.writeConv(ctx, uid, conv, false); err != nil {
		return err
	}

	// if we have a conv at all, then we want to let any layout engine know about this
	// new message
	if conv.GetTopicType() == chat1.TopicType_CHAT {
		defer i.layoutNotifier.UpdateLayoutFromNewMessage(ctx, conv)
	}
	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msgID chat1.MessageID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "ReadMessage")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "ReadMessage: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "ReadMessage: no conversation found: convID: %s", convID)
	} else {
		// Update conv
		i.Debug(ctx, "ReadMessage: updating mtime: readMsgID: %d msgID: %d", conv.Conv.ReaderInfo.ReadMsgid,
			msgID)
		conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
		conv.Conv.ReaderInfo.ReadMsgid = msgID
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, status chat1.ConversationStatus) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "SetStatus")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	defer i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "set status")

	i.Debug(ctx, "SetStatus: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "SetStatus: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
		conv.Conv.Metadata.Status = status
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) SetAppNotificationSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, settings chat1.ConversationNotificationInfo) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "SetAppNotificationSettings")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "SetAppNotificationSettings: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "SetAppNotificationSettings: no conversation found: convID: %s", convID)
	} else {
		for apptype, kindMap := range settings.Settings {
			for kind, enabled := range kindMap {
				conv.Conv.Notifications.Settings[apptype][kind] = enabled
			}
		}
		conv.Conv.Notifications.ChannelWide = settings.ChannelWide
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

// Mark the expunge on the stored inbox
// The inbox Expunge tag is kept up to date for retention but not for delete-history.
// Does not delete any messages. Relies on separate server mechanism to delete clear max messages.
func (i *Inbox) Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "Expunge")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "Expunge: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "Expunge: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.Expunge = expunge
		conv.Conv.Metadata.Version = vers.ToConvVers()

		if len(maxMsgs) == 0 {
			// Expunge notifications should always come with max msgs.
			i.Debug(ctx,
				"Expunge: returning fake version mismatch error because of missing maxMsgs: vers: %d", vers)
			return NewVersionMismatchError(iboxVers.InboxVersion, vers)
		}

		i.Debug(ctx, "Expunge: setting max messages from server payload")
		conv.Conv.MaxMsgSummaries = maxMsgs
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) SubteamRename(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "SubteamRename")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	var layoutConvs []types.RemoteConversation
	defer func() {
		i.layoutNotifier.UpdateLayoutFromSubteamRename(ctx, layoutConvs)
	}()

	i.Debug(ctx, "SubteamRename: vers: %d convIDs: %d", vers, len(convIDs))
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Update convs
	for _, convID := range convIDs {
		conv, found, err := i.getConv(ctx, uid, convID)
		if err != nil {
			return err
		}
		if !found {
			i.Debug(ctx, "SubteamRename: no conversation found: convID: %s", convID)
			continue
		}
		layoutConvs = append(layoutConvs, conv)
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "SetConvRetention")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "SetConvRetention: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if err != nil {
		return err
	}
	if !found {
		i.Debug(ctx, "SetConvRetention: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.ConvRetention = &policy
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

// Update any local conversations with this team ID.
func (i *Inbox) SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) (res []chat1.ConversationID, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "SetTeamRetention")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "SetTeamRetention: vers: %d teamID: %s", vers, teamID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return res, nil
		}
		return res, err
	}
	iboxIndex, err := i.readDiskIndex(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return res, nil
		}
		return res, err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return res, err
	}

	// Update conversations
	convs := i.getConvsForTeam(ctx, uid, teamID, iboxIndex)
	for _, conv := range convs {
		conv.Conv.TeamRetention = &policy
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return res, err
		}
		res = append(res, conv.Conv.GetConvID())
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	err = i.writeDiskVersions(ctx, uid, iboxVers)
	return res, err
}

func (i *Inbox) SetConvSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, convSettings *chat1.ConversationSettings) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "SetConvSettings")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "SetConvSettings: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if !found {
		i.Debug(ctx, "SetConvSettings: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.ConvSettings = convSettings
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) UpgradeKBFSToImpteam(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "UpgradeKBFSToImpteam")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "UpgradeKBFSToImpteam: vers: %d convID: %s", vers, convID)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if !found {
		i.Debug(ctx, "UpgradeKBFSToImpteam: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.Metadata.MembersType = chat1.ConversationMembersType_IMPTEAMUPGRADE
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) TeamTypeChanged(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, teamType chat1.TeamType, notifInfo *chat1.ConversationNotificationInfo) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "TeamTypeChanged")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	defer i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "team type")

	i.Debug(ctx, "TeamTypeChanged: vers: %d convID: %s typ: %v", vers, convID, teamType)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Find conversation
	conv, found, err := i.getConv(ctx, uid, convID)
	if !found {
		i.Debug(ctx, "TeamTypeChanged: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.Notifications = notifInfo
		conv.Conv.Metadata.TeamType = teamType
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "TlfFinalize")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	i.Debug(ctx, "TlfFinalize: vers: %d convIDs: %v finalizeInfo: %v", vers, convIDs, finalizeInfo)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	for _, convID := range convIDs {
		// Find conversation
		conv, found, err := i.getConv(ctx, uid, convID)
		if err != nil {
			return err
		}
		if !found {
			i.Debug(ctx, "TlfFinalize: no conversation found: convID: %s", convID)
			continue
		}
		conv.Conv.Metadata.FinalizeInfo = &finalizeInfo
		conv.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, conv, false); err != nil {
			return err
		}
	}

	// Write out to disk
	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) Version(ctx context.Context, uid gregor1.UID) (vers chat1.InboxVers, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "Version")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	ibox, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return 0, nil
		}
		return 0, err
	}
	return ibox.InboxVersion, nil
}

func (i *Inbox) ServerVersion(ctx context.Context, uid gregor1.UID) (vers int, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "ServerVersion")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	ibox, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return 0, nil
		}
		return 0, err
	}
	vers = ibox.ServerVersion
	return vers, nil
}

func (i *Inbox) topicNameChanged(ctx context.Context, oldConv, newConv chat1.Conversation) bool {
	oldMsg, oldErr := oldConv.GetMaxMessage(chat1.MessageType_METADATA)
	newMsg, newErr := newConv.GetMaxMessage(chat1.MessageType_METADATA)
	if oldErr != nil && newErr != nil {
		return false
	}
	if oldErr != newErr {
		return true
	}
	return oldMsg.GetMessageID() != newMsg.GetMessageID()
}

func (i *Inbox) Sync(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers, convs []chat1.Conversation) (res types.InboxSyncRes, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "Sync")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	defer i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "sync")

	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		// Return MissError, since it should be unexpected if are calling this
		return res, err
	}
	iboxIndex, err := i.readDiskIndex(ctx, uid, true)
	if err != nil {
		// Return MissError, since it should be unexpected if are calling this
		return res, err
	}

	// Sync inbox with new conversations
	oldVers := iboxVers.InboxVersion
	iboxVers.InboxVersion = vers
	convMap := make(map[chat1.ConvIDStr]chat1.Conversation)
	for _, conv := range convs {
		convMap[conv.GetConvID().ConvIDStr()] = conv
	}
	for _, convID := range iboxIndex.ConversationIDs {
		if newConv, ok := convMap[convID.ConvIDStr()]; ok {
			oldConv, err := i.readConv(ctx, uid, convID)
			if err != nil {
				if _, ok := err.(MissError); ok {
					// just keep going if we don't have it
					continue
				}
				return res, err
			}
			if oldConv.Conv.Metadata.TeamType != newConv.Metadata.TeamType {
				// Changing the team type might be hard for clients of the inbox system to process,
				// so call it out so they can know a hard update happened here.
				res.TeamTypeChanged = true
			}
			if oldConv.Conv.Metadata.MembersType != newConv.Metadata.MembersType {
				res.MembersTypeChanged = append(res.MembersTypeChanged,
					oldConv.GetConvID())
			}
			if oldConv.Conv.Expunge != newConv.Expunge {
				// The earliest point in non-deleted history has moved up.
				// Point it out so that convsource can get updated.
				res.Expunges = append(res.Expunges, types.InboxSyncResExpunge{
					ConvID:  newConv.Metadata.ConversationID,
					Expunge: newConv.Expunge,
				})
			}
			if i.topicNameChanged(ctx, oldConv.Conv, newConv) {
				res.TopicNameChanged = append(res.TopicNameChanged, newConv.GetConvID())
			}
			delete(convMap, oldConv.ConvIDStr)
			oldConv.Conv = newConv
			if err := i.writeConv(ctx, uid, oldConv, false); err != nil {
				return res, err
			}
		}
	}
	i.Debug(ctx, "Sync: adding %d new conversations", len(convMap))
	for _, conv := range convMap {
		if err := i.writeConv(ctx, uid, utils.RemoteConv(conv), false); err != nil {
			return res, err
		}
		iboxIndex.ConversationIDs = append(iboxIndex.ConversationIDs, conv.GetConvID())
	}
	if err = i.writeDiskIndex(ctx, uid, iboxIndex); err != nil {
		return res, err
	}
	i.Debug(ctx, "Sync: old vers: %v new vers: %v convs: %d", oldVers, iboxVers.InboxVersion, len(convs))
	if err = i.writeDiskVersions(ctx, uid, iboxVers); err != nil {
		return res, err
	}

	// Filter the conversations for the result
	res.FilteredConvs = utils.ApplyInboxQuery(ctx, i.DebugLabeler, &chat1.GetInboxQuery{
		ConvIDs: utils.PluckConvIDs(convs),
	}, utils.RemoteConvs(convs))

	return res, nil
}

func (i *Inbox) MembershipUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	userJoined []chat1.Conversation, userRemoved []chat1.ConversationMember,
	othersJoined []chat1.ConversationMember, othersRemoved []chat1.ConversationMember,
	userReset []chat1.ConversationMember, othersReset []chat1.ConversationMember,
	teamMemberRoleUpdate *chat1.TeamMemberRoleUpdate) (roleUpdates []chat1.ConversationID, err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "MembershipUpdate")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	layoutChanged := false
	defer func() {
		if layoutChanged {
			i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "membership")
		}
	}()

	i.Debug(ctx, "MembershipUpdate: updating userJoined: %d userRemoved: %d othersJoined: %d othersRemoved: %d, teamMemberRoleUpdate: %+v",
		len(userJoined), len(userRemoved), len(othersJoined), len(othersRemoved), teamMemberRoleUpdate)
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil, nil
		}
		return nil, err
	}
	iboxIndex, err := i.readDiskIndex(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil, nil
		}
		return nil, err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return nil, err
	}

	// Process our own changes
	var ujids []chat1.ConversationID
	for _, uj := range userJoined {
		i.Debug(ctx, "MembershipUpdate: joined conv: %s", uj.GetConvID())
		conv := utils.RemoteConv(uj)
		if err := i.writeConv(ctx, uid, conv, true); err != nil {
			return nil, err
		}
		ujids = append(ujids, conv.GetConvID())
		layoutChanged = layoutChanged || uj.GetTopicType() == chat1.TopicType_CHAT
	}
	iboxIndex.mergeConvs(ujids)
	convIDs := iboxIndex.ConversationIDs
	removedMap := make(map[chat1.ConvIDStr]bool)
	for _, r := range userRemoved {
		i.Debug(ctx, "MembershipUpdate: removing user from: %s", r)
		removedMap[r.ConvID.ConvIDStr()] = true
		layoutChanged = layoutChanged || r.TopicType == chat1.TopicType_CHAT
	}
	resetMap := make(map[chat1.ConvIDStr]bool)
	for _, r := range userReset {
		i.Debug(ctx, "MembershipUpdate: user reset in: %s", r)
		resetMap[r.ConvID.ConvIDStr()] = true
	}
	iboxIndex.ConversationIDs = nil
	for _, convID := range convIDs {
		dirty := false
		conv, err := i.readConv(ctx, uid, convID)
		if err != nil {
			return nil, err
		}
		if teamMemberRoleUpdate != nil && conv.Conv.Metadata.IdTriple.Tlfid.Eq(teamMemberRoleUpdate.TlfID) {
			conv.Conv.ReaderInfo.UntrustedTeamRole = teamMemberRoleUpdate.Role
			conv.Conv.Metadata.LocalVersion++
			roleUpdates = append(roleUpdates, conv.GetConvID())
			dirty = true
		}
		if removedMap[conv.ConvIDStr] {
			conv.Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_LEFT
			conv.Conv.Metadata.Version = vers.ToConvVers()
			newAllList := make([]gregor1.UID, 0, len(conv.Conv.Metadata.AllList))
			for _, u := range conv.Conv.Metadata.AllList {
				if !u.Eq(uid) {
					newAllList = append(newAllList, u)
				}
			}
			switch conv.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
			default:
				conv.Conv.Metadata.AllList = newAllList
			}
			dirty = true
		} else if resetMap[conv.ConvIDStr] {
			conv.Conv.ReaderInfo.Status = chat1.ConversationMemberStatus_RESET
			conv.Conv.Metadata.Version = vers.ToConvVers()
			switch conv.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
				// do nothing
			default:
				// Double check this user isn't already in here
				exists := false
				for _, u := range conv.Conv.Metadata.ResetList {
					if u.Eq(uid) {
						exists = true
						break
					}
				}
				if !exists {
					conv.Conv.Metadata.ResetList = append(conv.Conv.Metadata.ResetList, uid)
				}
			}
			dirty = true
		}
		if dirty {
			if err := i.writeConv(ctx, uid, conv, false); err != nil {
				return nil, err
			}
		}
		iboxIndex.ConversationIDs = append(iboxIndex.ConversationIDs, convID)
	}

	// Update all lists with other people joining and leaving
	for _, oj := range othersJoined {
		cp, err := i.readConv(ctx, uid, oj.ConvID)
		if err != nil {
			continue
		}
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
			switch cp.Conv.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
			default:
				cp.Conv.Metadata.ResetList = append(cp.Conv.Metadata.ResetList[:resetIndex],
					cp.Conv.Metadata.ResetList[resetIndex+1:]...)
			}
		} else {
			// Double check this user isn't already in here
			exists := false
			for _, u := range cp.Conv.Metadata.AllList {
				if u.Eq(oj.Uid) {
					exists = true
					break
				}
			}
			if !exists {
				switch cp.Conv.GetMembersType() {
				case chat1.ConversationMembersType_TEAM:
				default:
					cp.Conv.Metadata.AllList = append(cp.Conv.Metadata.AllList, oj.Uid)
				}
			}
		}
		cp.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, cp, false); err != nil {
			return nil, err
		}
	}
	for _, or := range othersRemoved {
		cp, err := i.readConv(ctx, uid, or.ConvID)
		if err != nil {
			continue
		}
		newAllList := make([]gregor1.UID, 0, len(cp.Conv.Metadata.AllList))
		for _, u := range cp.Conv.Metadata.AllList {
			if !u.Eq(or.Uid) {
				newAllList = append(newAllList, u)
			}
		}
		cp.Conv.Metadata.AllList = newAllList
		cp.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, cp, false); err != nil {
			return nil, err
		}
	}
	for _, or := range othersReset {
		cp, err := i.readConv(ctx, uid, or.ConvID)
		if err != nil {
			continue
		}
		switch cp.Conv.GetMembersType() {
		case chat1.ConversationMembersType_TEAM:
		default:
			cp.Conv.Metadata.ResetList = append(cp.Conv.Metadata.ResetList, or.Uid)
		}
		cp.Conv.Metadata.Version = vers.ToConvVers()
		if err := i.writeConv(ctx, uid, cp, false); err != nil {
			return nil, err
		}
	}
	if err := i.writeDiskIndex(ctx, uid, iboxIndex); err != nil {
		return nil, err
	}
	iboxVers.InboxVersion = vers
	return roleUpdates, i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) ConversationsUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convUpdates []chat1.ConversationUpdate) (err Error) {
	var ierr error
	defer i.Trace(ctx, &ierr, "ConversationsUpdate")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)

	if len(convUpdates) == 0 {
		return nil
	}

	layoutChanged := false
	defer func() {
		if layoutChanged {
			i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "existence")
		}
	}()

	i.Debug(ctx, "ConversationsUpdate: updating %d convs", len(convUpdates))
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, iboxVers.InboxVersion, vers); !cont {
		return err
	}

	// Process our own changes
	for _, u := range convUpdates {
		i.Debug(ctx, "ConversationsUpdate: changed conv: %v", u)
		oldConv, err := i.readConv(ctx, uid, u.ConvID)
		if err != nil {
			i.Debug(ctx, "ConversationsUpdate: skipping conv: %s err: %s", u.ConvID, err)
			continue
		}
		if oldConv.Conv.Metadata.Existence != u.Existence {
			layoutChanged = true
		}
		oldConv.Conv.Metadata.Existence = u.Existence
		if err := i.writeConv(ctx, uid, oldConv, false); err != nil {
			return err
		}
	}

	iboxVers.InboxVersion = vers
	return i.writeDiskVersions(ctx, uid, iboxVers)
}

func (i *Inbox) UpdateLocalMtime(ctx context.Context, uid gregor1.UID,
	convUpdates []chat1.LocalMtimeUpdate) (err Error) {
	if len(convUpdates) == 0 {
		return nil
	}
	var ierr error
	defer i.Trace(ctx, &ierr, "UpdateLocalMtime")()
	defer func() { ierr = i.castInternalError(err) }()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNuke(ctx, func() Error { return err }, uid)
	var convs []types.RemoteConversation
	defer func() {
		for _, conv := range convs {
			i.layoutNotifier.UpdateLayoutFromNewMessage(ctx, conv)
		}
	}()

	i.Debug(ctx, "UpdateLocalMtime: updating %d convs", len(convUpdates))
	iboxVers, err := i.readDiskVersions(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Process our own changes
	for _, u := range convUpdates {
		i.Debug(ctx, "UpdateLocalMtime: applying conv update: %v", u)
		oldConv, err := i.readConv(ctx, uid, u.ConvID)
		if err != nil {
			i.Debug(ctx, "UpdateLocalMtime: skipping conv: %s err: %s", u.ConvID, err)
			continue
		}
		oldConv.LocalMtime = u.Mtime
		oldConv.Conv.Metadata.LocalVersion++
		if err := i.writeConv(ctx, uid, oldConv, false); err != nil {
			return err
		}
	}
	return i.writeDiskVersions(ctx, uid, iboxVers)
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
	return NewInbox(i.G()).Version(ctx, uid)
}
