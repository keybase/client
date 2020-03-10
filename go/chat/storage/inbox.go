package storage

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/keybase/client/go/encrypteddb"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

const inboxVersion = 28

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

type inboxDiskData struct {
	Version       int                        `codec:"V"`
	ServerVersion int                        `codec:"S"`
	InboxVersion  chat1.InboxVers            `codec:"I"`
	Conversations []types.RemoteConversation `codec:"C"`
	Queries       []inboxDiskQuery           `codec:"Q"`
}

type SharedInboxItem struct {
	ConvID      chat1.ConvIDStr
	Name        string
	Public      bool
	MembersType chat1.ConversationMembersType
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

	flushMode      InboxFlushMode
	layoutNotifier InboxLayoutChangedNotifier
}

func FlushMode(mode InboxFlushMode) func(*Inbox) {
	return func(i *Inbox) {
		i.SetFlushMode(mode)
	}
}

func NewInbox(g *globals.Context, config ...func(*Inbox)) *Inbox {
	i := &Inbox{
		Contextified:   globals.NewContextified(g),
		DebugLabeler:   utils.NewDebugLabeler(g.ExternalG(), "Inbox", false),
		baseBox:        newBaseBox(g),
		flushMode:      InboxFlushModeActive,
		layoutNotifier: dummyInboxLayoutChangedNotifier{},
	}
	for _, c := range config {
		c(i)
	}
	return i
}

func (i *Inbox) SetFlushMode(mode InboxFlushMode) {
	i.flushMode = mode
}

func (i *Inbox) SetInboxLayoutChangedNotifier(notifier InboxLayoutChangedNotifier) {
	i.layoutNotifier = notifier
}

func (i *Inbox) dbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatInbox,
		Key: fmt.Sprintf("ib:%s", uid),
	}
}

func (i *Inbox) readDiskInbox(ctx context.Context, uid gregor1.UID, useInMemory bool) (inboxDiskData, Error) {
	var ibox inboxDiskData
	// Check context for an aborted request
	if err := isAbortedRequest(ctx); err != nil {
		return ibox, err
	}
	// Check in memory cache first
	if memibox := inboxMemCache.Get(uid); useInMemory && memibox != nil {
		i.Debug(ctx, "hit in memory cache")
		ibox = *memibox
	} else {
		found, err := i.readDiskBox(ctx, i.dbKey(uid), &ibox)
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
			inboxMemCache.Put(uid, &ibox)
		}
	}
	// Check on disk server version against known server version
	if _, err := i.G().ServerCacheVersions.MatchInbox(ctx, ibox.ServerVersion); err != nil {
		i.Debug(ctx, "server version match error, clearing: %s", err)
		if cerr := i.Clear(ctx, uid); cerr != nil {
			return ibox, cerr
		}
		return ibox, MissError{}
	}
	// Check on disk version against configured
	if ibox.Version != inboxVersion {
		i.Debug(ctx, "on disk version not equal to program version, clearing: disk :%d program: %d",
			ibox.Version, inboxVersion)
		if cerr := i.Clear(ctx, uid); cerr != nil {
			return ibox, cerr
		}
		return ibox, MissError{}
	}

	i.Debug(ctx, "readDiskInbox: version: %d disk version: %d server version: %d convs: %d",
		ibox.InboxVersion, ibox.Version, ibox.ServerVersion, len(ibox.Conversations))

	return ibox, nil
}

func (i *Inbox) sharedInboxFile(ctx context.Context, uid gregor1.UID) (*encrypteddb.EncryptedFile, error) {
	dir := filepath.Join(i.G().GetEnv().GetSharedDataDir(), "sharedinbox", uid.String())
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return nil, err
	}
	return encrypteddb.NewFile(i.G().ExternalG(), filepath.Join(dir, "flatinbox.mpack"),
		func(ctx context.Context) ([32]byte, error) {
			return GetSecretBoxKey(ctx, i.G().ExternalG())
		}), nil
}

func (i *Inbox) writeMobileSharedInbox(ctx context.Context, ibox inboxDiskData, uid gregor1.UID) {
	defer i.Trace(ctx, func() error { return nil }, fmt.Sprintf("writeMobileSharedInbox(%s)", uid))()
	// Bail out if we are an extension or we aren't also writing into a mobile shared directory
	if i.G().GetEnv().IsMobileExtension() || i.G().GetEnv().GetMobileSharedHome() == "" ||
		i.G().GetAppType() != libkb.MobileAppType {
		return
	}
	var writable []SharedInboxItem
	sort.Sort(utils.RemoteConvByMtime(ibox.Conversations))
	for _, rc := range ibox.Conversations {
		if rc.Conv.GetTopicType() != chat1.TopicType_CHAT {
			continue
		}
		if rc.Conv.Metadata.TeamType == chat1.TeamType_COMPLEX && rc.LocalMetadata == nil {
			// need local metadata for channel names, so skip if we don't have it
			continue
		}
		name := utils.GetRemoteConvDisplayName(rc)
		if len(name) == 0 {
			i.Debug(ctx, "writeMobileSharedInbox: skipping convID: %s, no name", rc.ConvIDStr)
			continue
		}
		writable = append(writable, SharedInboxItem{
			ConvID:      rc.ConvIDStr,
			Name:        name,
			Public:      rc.Conv.IsPublic(),
			MembersType: rc.Conv.GetMembersType(),
		})
		if len(writable) > 200 {
			break
		}
	}
	sif, err := i.sharedInboxFile(ctx, uid)
	if err != nil {
		i.Debug(ctx, "writeMobileSharedInbox: failed to get shared inbox file: %s", err)
		return
	}
	if err := sif.Put(ctx, writable); err != nil {
		i.Debug(ctx, "writeMobileSharedInbox: failed to write: %s", err)
	}
}

func (i *Inbox) flushLocked(ctx context.Context, uid gregor1.UID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("flushLocked(%s)", uid))()
	ibox := inboxMemCache.Get(uid)
	if ibox == nil {
		i.Debug(ctx, "flushLocked: no inbox in memory, not doing anything")
		return nil
	}
	i.Debug(ctx, "flushLocked: version: %d disk version: %d server version: %d convs: %d",
		ibox.InboxVersion, ibox.Version, ibox.ServerVersion, len(ibox.Conversations))
	if ierr := i.writeDiskBox(ctx, i.dbKey(uid), ibox); ierr != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to write inbox: uid: %s err: %s", uid, ierr)
	}
	i.writeMobileSharedInbox(ctx, *ibox, uid)
	return nil
}

func (i *Inbox) Flush(ctx context.Context, uid gregor1.UID) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("Flush(%s)", uid))()
	return i.flushLocked(ctx, uid)
}

func (i *Inbox) writeDiskInbox(ctx context.Context, uid gregor1.UID, ibox inboxDiskData) Error {
	// Get latest server version
	vers, err := i.G().ServerCacheVersions.Fetch(ctx)
	if err != nil {
		return NewInternalError(ctx, i.DebugLabeler, "failed to fetch server versions: %s", err.Error())
	}
	ibox.ServerVersion = vers.InboxVers
	ibox.Version = inboxVersion
	i.summarizeConvs(ibox.Conversations)
	i.Debug(ctx, "writeDiskInbox: uid: %s version: %d disk version: %d server version: %d convs: %d",
		uid, ibox.InboxVersion, ibox.Version, ibox.ServerVersion, len(ibox.Conversations))
	inboxMemCache.Put(uid, &ibox)
	switch i.flushMode {
	case InboxFlushModeActive:
		return i.flushLocked(ctx, uid)
	case InboxFlushModeDelegate:
		return nil
	}
	return nil
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

func (i *Inbox) mergeConvs(l []types.RemoteConversation, r []types.RemoteConversation) (res []types.RemoteConversation) {
	m := make(map[chat1.ConvIDStr]types.RemoteConversation, len(l))
	for _, conv := range l {
		m[conv.ConvIDStr] = conv
	}
	res = make([]types.RemoteConversation, 0, len(l)+len(r))
	for _, conv := range r {
		key := conv.ConvIDStr
		if m[key].GetVersion() <= conv.GetVersion() {
			res = append(res, conv)
			delete(m, key)
		}
	}
	for _, conv := range m {
		res = append(res, conv)
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
	_, err = hasher.Write(dat)
	if err != nil {
		return nil, NewInternalError(ctx, i.DebugLabeler, "failed to write query: %s", err.Error())
	}
	return hasher.Sum(nil), nil
}

func (i *Inbox) MergeLocalMetadata(ctx context.Context, uid gregor1.UID, convs []chat1.ConversationLocal) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("MergeLocalMetadata: num convs: %d",
		len(convs)))()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	if len(convs) == 0 {
		return nil
	}
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); !ok {
			return err
		}
		// If we don't have anything on disk, then just do nothing
		i.Debug(ctx, "MergeLocalMetadata: no inbox found to merge against")
		return nil
	}

	convMap := make(map[chat1.ConvIDStr]chat1.ConversationLocal)
	for _, conv := range convs {
		convMap[conv.GetConvID().ConvIDStr()] = conv
	}
	for index, rc := range ibox.Conversations {
		if convLocal, ok := convMap[rc.ConvIDStr]; ok {
			// Don't write this out for error convos
			if convLocal.Error != nil || convLocal.GetTopicType() != chat1.TopicType_CHAT {
				continue
			}
			topicName := convLocal.Info.TopicName
			snippetDecoration, snippet := utils.GetConvSnippet(convLocal,
				i.G().GetEnv().GetUsername().String())
			rcm := &types.RemoteConversationMetadata{
				Name:              convLocal.Info.TlfName,
				TopicName:         topicName,
				Headline:          convLocal.Info.Headline,
				Snippet:           snippet,
				SnippetDecoration: snippetDecoration,
			}
			switch convLocal.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
				// Only write out participant names for general channel for teams, only thing needed
				// by frontend
				if topicName == globals.DefaultTeamTopic {
					rcm.WriterNames = convLocal.AllNames()
				}
			default:
				rcm.WriterNames = convLocal.AllNames()
				rcm.FullNamesForSearch = convLocal.FullNamesForSearch()
				rcm.ResetParticipants = convLocal.Info.ResetNames
			}
			ibox.Conversations[index].LocalMetadata = rcm
		}
	}

	// Write out new inbox
	return i.writeDiskInbox(ctx, uid, ibox)
}

// Merge add/updates conversations into the inbox. If a given conversation is either missing
// from the inbox, or is of greater version than what is currently stored, we write it down. Otherwise,
// we ignore it. If the inbox is currently blank, then we write down the given inbox version.
func (i *Inbox) Merge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convsIn []chat1.Conversation, query *chat1.GetInboxQuery) (err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "Merge")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "Merge: vers: %d convs: %d", vers, len(convsIn))
	if len(convsIn) == 1 {
		i.Debug(ctx, "Merge: single conversation: %s", convsIn[0].GetConvID())
	}

	convs := make([]chat1.Conversation, len(convsIn))
	copy(convs, convsIn)

	// Read inbox off disk to determine if we can merge, or need to full replace
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	qp := inboxDiskQuery{QueryHash: hquery}

	// Set inbox version if the current inbox is empty. Otherwise, we just use whatever the current
	// value is.
	if ibox.InboxVersion != 0 {
		vers = ibox.InboxVersion
	} else {
		i.Debug(ctx, "Merge: using given version: %d", vers)
	}
	i.Debug(ctx, "Merge: merging inbox: vers: %d", vers)
	data := inboxDiskData{
		Version:       inboxVersion,
		InboxVersion:  vers,
		Conversations: i.mergeConvs(utils.RemoteConvs(convs), ibox.Conversations),
		Queries:       append(ibox.Queries, qp),
	}

	// Write out new inbox
	return i.writeDiskInbox(ctx, uid, data)
}

func (i *Inbox) queryConvIDsExist(ctx context.Context, ibox inboxDiskData,
	convIDs []chat1.ConversationID) bool {
	if len(convIDs) == 1 { // fast path for single convID case
		for _, conv := range ibox.Conversations {
			if conv.GetConvID().Eq(convIDs[0]) {
				return true
			}
		}
		return false
	}

	m := make(map[chat1.ConvIDStr]struct{}, len(ibox.Conversations))
	for _, conv := range ibox.Conversations {
		m[conv.ConvIDStr] = struct{}{}
	}
	for _, convID := range convIDs {
		if _, ok := m[convID.ConvIDStr()]; !ok {
			return false
		}
	}
	return true
}

func (i *Inbox) queryNameExists(ctx context.Context, ibox inboxDiskData,
	tlfID chat1.TLFID, membersType chat1.ConversationMembersType, topicName string,
	topicType chat1.TopicType) bool {
	for _, conv := range ibox.Conversations {
		if conv.Conv.Metadata.IdTriple.Tlfid.Eq(tlfID) && conv.GetMembersType() == membersType &&
			conv.GetTopicName() == topicName && conv.GetTopicType() == topicType {
			return true
		}
	}
	return false
}

func (i *Inbox) queryExists(ctx context.Context, ibox inboxDiskData, query *chat1.GetInboxQuery) bool {

	// If the query is specifying a list of conversation IDs, just check to see if we have *all*
	// of them on the disk
	if query != nil && (len(query.ConvIDs) > 0 || query.ConvID != nil) {
		convIDs := query.ConvIDs
		if query.ConvID != nil {
			convIDs = append(convIDs, *query.ConvID)
		}
		i.Debug(ctx, "Read: queryExists: convIDs query, checking list: len: %d", len(convIDs))
		return i.queryConvIDsExist(ctx, ibox, convIDs)
	}

	// Check for a name query that is after a single conversation
	if query != nil && query.TlfID != nil && query.TopicType != nil && query.TopicName != nil &&
		len(query.MembersTypes) == 1 {
		if i.queryNameExists(ctx, ibox, *query.TlfID, query.MembersTypes[0], *query.TopicName,
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
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, "ReadAll")()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	ibox, err := i.readDiskInbox(ctx, uid, useInMemory)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox found")
		}
		return 0, nil, err
	}

	return ibox.InboxVersion, ibox.Conversations, nil
}

func (i *Inbox) GetConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res types.RemoteConversation, err Error) {
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("GetConversation(%s,%s)", uid, convID))()
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
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("Read(%s)", uid))()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			i.Debug(ctx, "Read: miss: no inbox found")
		}
		return 0, nil, err
	}

	// Check to make sure query parameters have been seen before
	if !i.queryExists(ctx, ibox, query) {
		i.Debug(ctx, "Read: miss: query or pagination unknown")
		return 0, nil, MissError{}
	}

	// Apply query and pagination
	res = utils.ApplyInboxQuery(ctx, i.DebugLabeler, query, ibox.Conversations)

	i.Debug(ctx, "Read: hit: version: %d", ibox.InboxVersion)
	return ibox.InboxVersion, res, nil
}

func (i *Inbox) ReadShared(ctx context.Context, uid gregor1.UID) (res []SharedInboxItem, err Error) {
	// no lock required here since we are just reading from a separate file
	defer i.Trace(ctx, func() error { return err }, fmt.Sprintf("ReadShared(%s)", uid))()
	sif, ierr := i.sharedInboxFile(ctx, uid)
	if ierr != nil {
		return res, NewInternalError(ctx, i.DebugLabeler, "error getting shared inbox: %s", ierr)
	}
	if ierr := sif.Get(ctx, &res); ierr != nil {
		return res, NewInternalError(ctx, i.DebugLabeler, "error reading shared inbox: %s", ierr)
	}
	return res, nil
}

func (i *Inbox) Clear(ctx context.Context, uid gregor1.UID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "Clear")()
	inboxMemCache.Clear(uid)
	ierr := i.G().LocalChatDb.Delete(i.dbKey(uid))
	if ierr != nil {
		return NewInternalError(ctx, i.DebugLabeler,
			"error clearing inbox: uid: %s err: %s", uid, ierr)
	}
	return nil
}

func (i *Inbox) ClearInMemory(ctx context.Context, uid gregor1.UID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "ClearInMemory")()
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
	defer i.Trace(ctx, func() error { return err }, "NewConversation")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	layoutChanged := true
	defer func() {
		if layoutChanged {
			i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "new conversation")
		}
	}()

	i.Debug(ctx, "NewConversation: vers: %d convID: %s", vers, conv.GetConvID())
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
						iconv.ConvIDStr, conv.GetConvID())
					iconv.Conv.Metadata.SupersededBy = append(iconv.Conv.Metadata.SupersededBy, conv.Metadata)
					iconv.Conv.Metadata.Version = vers.ToConvVers()
				}
			}
		}

		// only chat convs for layout changed
		layoutChanged = conv.GetTopicType() == chat1.TopicType_CHAT
		ibox.Conversations = append(utils.RemoteConvs([]chat1.Conversation{conv}), ibox.Conversations...)
	} else {
		i.Debug(ctx, "NewConversation: skipping update, conversation exists in inbox")
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
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

func (i *Inbox) UpdateInboxVersion(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "UpdateInboxVersion")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) IncrementLocalConvVersion(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "IncrementLocalConvVersion")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}
	_, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "IncrementLocalConvVersion: no conversation found: convID: %s", convID)
		return nil
	}
	conv.Conv.Metadata.LocalVersion++
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) MarkLocalRead(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "MarkLocalRead")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}
	_, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "MarkLocalRead: no conversation found: convID: %s", convID)
		return nil
	}
	conv.LocalReadMsgID = msgID
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) Draft(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	text *string) (modified bool, err Error) {
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return false, nil
		}
		return false, err
	}
	_, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "MarkLocalRead: no conversation found: convID: %s", convID)
		return false, nil
	}
	if text == nil && conv.LocalDraft == nil {
		// don't do anything if we are clearing
		return false, nil
	}
	conv.LocalDraft = text
	conv.Conv.Metadata.LocalVersion++
	return true, i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) NewMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msg chat1.MessageBoxed, maxMsgs []chat1.MessageSummary) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "NewMessage")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "NewMessage: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	_, conv := i.getConv(convID, ibox.Conversations)
	if conv == nil {
		i.Debug(ctx, "NewMessage: no conversation found: convID: %s", convID)
		// Write out to disk
		ibox.InboxVersion = vers
		return i.writeDiskInbox(ctx, uid, ibox)
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

	// Slot in at the top
	mconv := *conv
	// if we have a conv at all, then we want to let any layout engine know about this
	// new message
	if mconv.GetTopicType() == chat1.TopicType_CHAT {
		defer i.layoutNotifier.UpdateLayoutFromNewMessage(ctx, mconv)
	}
	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) ReadMessage(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, msgID chat1.MessageID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "ReadMessage")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "ReadMessage: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "ReadMessage: no conversation found: convID: %s", convID)
	} else {
		// Update conv
		if conv.Conv.ReaderInfo.ReadMsgid < msgID {
			i.Debug(ctx, "ReadMessage: updating mtime: readMsgID: %d msgID: %d", conv.Conv.ReaderInfo.ReadMsgid,
				msgID)
			conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
			conv.Conv.ReaderInfo.ReadMsgid = msgID
		}
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) SetStatus(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, status chat1.ConversationStatus) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "SetStatus")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	defer i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "set status")

	i.Debug(ctx, "SetStatus: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "SetStatus: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.ReaderInfo.Mtime = gregor1.ToTime(time.Now())
		conv.Conv.Metadata.Status = status
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) SetAppNotificationSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, settings chat1.ConversationNotificationInfo) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "SetAppNotificationSettings")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "SetAppNotificationSettings: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "SetAppNotificationSettings: no conversation found: convID: %s", convID)
	} else {
		for apptype, kindMap := range settings.Settings {
			for kind, enabled := range kindMap {
				conv.Conv.Notifications.Settings[apptype][kind] = enabled
			}
		}
		conv.Conv.Notifications.ChannelWide = settings.ChannelWide
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

// Mark the expunge on the stored inbox
// The inbox Expunge tag is kept up to date for retention but not for delete-history.
// Does not delete any messages. Relies on separate server mechanism to delete clear max messages.
func (i *Inbox) Expunge(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, expunge chat1.Expunge, maxMsgs []chat1.MessageSummary) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "Expunge")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "Expunge: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "Expunge: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.Expunge = expunge
		conv.Conv.Metadata.Version = vers.ToConvVers()

		if len(maxMsgs) == 0 {
			// Expunge notifications should always come with max msgs.
			i.Debug(ctx,
				"Expunge: returning fake version mismatch error because of missing maxMsgs: vers: %d", vers)
			return NewVersionMismatchError(ibox.InboxVersion, vers)
		}

		i.Debug(ctx, "Expunge: setting max messages from server payload")
		conv.Conv.MaxMsgSummaries = maxMsgs
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) SubteamRename(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "SubteamRename")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	var layoutConvs []types.RemoteConversation
	defer func() {
		i.layoutNotifier.UpdateLayoutFromSubteamRename(ctx, layoutConvs)
	}()

	i.Debug(ctx, "SubteamRename: vers: %d convIDs: %d", vers, len(convIDs))
	ibox, err := i.readDiskInbox(ctx, uid, true)
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

	// Update convs
	for _, convID := range convIDs {
		_, conv := i.getConv(convID, ibox.Conversations)
		if conv == nil {
			i.Debug(ctx, "SubteamRename: no conversation found: convID: %s", convID)
			continue
		}
		layoutConvs = append(layoutConvs, *conv)
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) SetConvRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, policy chat1.RetentionPolicy) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "SetConvRetention")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "SetConvRetention: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "SetConvRetention: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.ConvRetention = &policy
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

// Update any local conversations with this team ID.
func (i *Inbox) SetTeamRetention(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	teamID keybase1.TeamID, policy chat1.RetentionPolicy) (res []chat1.ConversationID, err Error) {
	defer i.Trace(ctx, func() error { return err }, "SetTeamRetention")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "SetTeamRetention: vers: %d teamID: %s", vers, teamID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	for _, conv := range convs {
		conv.Conv.TeamRetention = &policy
		conv.Conv.Metadata.Version = vers.ToConvVers()
		res = append(res, conv.Conv.GetConvID())
	}

	// Write out to disk
	ibox.InboxVersion = vers
	err = i.writeDiskInbox(ctx, uid, ibox)
	return res, err
}

func (i *Inbox) SetConvSettings(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, convSettings *chat1.ConversationSettings) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "SetConvSettings")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "SetConvSettings: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "SetConvSettings: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.ConvSettings = convSettings
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) UpgradeKBFSToImpteam(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "UpgradeKBFSToImpteam")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "UpgradeKBFSToImpteam: vers: %d convID: %s", vers, convID)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "UpgradeKBFSToImpteam: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.Metadata.MembersType = chat1.ConversationMembersType_IMPTEAMUPGRADE
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) TeamTypeChanged(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convID chat1.ConversationID, teamType chat1.TeamType, notifInfo *chat1.ConversationNotificationInfo) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "TeamTypeChanged")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	defer i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "team type")

	i.Debug(ctx, "TeamTypeChanged: vers: %d convID: %s typ: %v", vers, convID, teamType)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
		i.Debug(ctx, "TeamTypeChanged: no conversation found: convID: %s", convID)
	} else {
		conv.Conv.Notifications = notifInfo
		conv.Conv.Metadata.TeamType = teamType
		conv.Conv.Metadata.Version = vers.ToConvVers()
	}

	// Write out to disk
	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) TlfFinalize(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convIDs []chat1.ConversationID, finalizeInfo chat1.ConversationFinalizeInfo) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "TlfFinalize")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

	i.Debug(ctx, "TlfFinalize: vers: %d convIDs: %v finalizeInfo: %v", vers, convIDs, finalizeInfo)
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) Version(ctx context.Context, uid gregor1.UID) (vers chat1.InboxVers, err Error) {
	defer i.Trace(ctx, func() error { return err }, "Version")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return 0, nil
		}
		return 0, err
	}
	return ibox.InboxVersion, nil
}

func (i *Inbox) ServerVersion(ctx context.Context, uid gregor1.UID) (vers int, err Error) {
	defer i.Trace(ctx, func() error { return err }, "ServerVersion")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	defer i.Trace(ctx, func() error { return err }, "Sync")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	defer i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "sync")

	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		// Return MissError, since it should be unexpected if are calling this
		return res, err
	}

	// Sync inbox with new conversations
	oldVers := ibox.InboxVersion
	ibox.InboxVersion = vers
	convMap := make(map[chat1.ConvIDStr]chat1.Conversation)
	for _, conv := range convs {
		convMap[conv.GetConvID().ConvIDStr()] = conv
	}
	for index, conv := range ibox.Conversations {
		if newConv, ok := convMap[conv.ConvIDStr]; ok {
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
				res.Expunges = append(res.Expunges, types.InboxSyncResExpunge{
					ConvID:  newConv.Metadata.ConversationID,
					Expunge: newConv.Expunge,
				})
			}
			if i.topicNameChanged(ctx, oldConv, newConv) {
				res.TopicNameChanged = append(res.TopicNameChanged, newConv.GetConvID())
			}

			ibox.Conversations[index].Conv = newConv
			delete(convMap, conv.ConvIDStr)
		}
	}
	i.Debug(ctx, "Sync: adding %d new conversations", len(convMap))
	for _, conv := range convMap {
		ibox.Conversations = append(ibox.Conversations, utils.RemoteConv(conv))
	}

	i.Debug(ctx, "Sync: old vers: %v new vers: %v convs: %d", oldVers, ibox.InboxVersion, len(convs))
	if err = i.writeDiskInbox(ctx, uid, ibox); err != nil {
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
	defer i.Trace(ctx, func() error { return err }, "MembershipUpdate")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	layoutChanged := false
	defer func() {
		if layoutChanged {
			i.layoutNotifier.UpdateLayout(ctx, chat1.InboxLayoutReselectMode_DEFAULT, "membership")
		}
	}()

	i.Debug(ctx, "MembershipUpdate: updating userJoined: %d userRemoved: %d othersJoined: %d othersRemoved: %d, teamMemberRoleUpdate: %+v",
		len(userJoined), len(userRemoved), len(othersJoined), len(othersRemoved), teamMemberRoleUpdate)
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil, nil
		}
		return nil, err
	}
	// Check inbox versions, make sure it makes sense (clear otherwise)
	var cont bool
	if vers, cont, err = i.handleVersion(ctx, ibox.InboxVersion, vers); !cont {
		return nil, err
	}

	// Process our own changes
	var ujs []types.RemoteConversation
	for _, uj := range userJoined {
		i.Debug(ctx, "MembershipUpdate: joined conv: %s", uj.GetConvID())
		ujs = append(ujs, utils.RemoteConv(uj))
		layoutChanged = layoutChanged || uj.GetTopicType() == chat1.TopicType_CHAT
	}
	convs := i.mergeConvs(ujs, ibox.Conversations)
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
	ibox.Conversations = nil
	for _, conv := range convs {
		if teamMemberRoleUpdate != nil && conv.Conv.Metadata.IdTriple.Tlfid.Eq(teamMemberRoleUpdate.TlfID) {
			conv.Conv.ReaderInfo.UntrustedTeamRole = teamMemberRoleUpdate.Role
			conv.Conv.Metadata.LocalVersion++
			roleUpdates = append(roleUpdates, conv.GetConvID())
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
		}
		ibox.Conversations = append(ibox.Conversations, conv)
	}

	// Update all lists with other people joining and leaving
	convMap := make(map[chat1.ConvIDStr]*types.RemoteConversation, len(ibox.Conversations))
	for index, c := range ibox.Conversations {
		convMap[c.ConvIDStr] = &ibox.Conversations[index]
	}
	for _, oj := range othersJoined {
		if cp, ok := convMap[oj.ConvID.ConvIDStr()]; ok {
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
		}
	}
	for _, or := range othersRemoved {
		if cp, ok := convMap[or.ConvID.ConvIDStr()]; ok {
			newAllList := make([]gregor1.UID, 0, len(cp.Conv.Metadata.AllList))
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
		if cp, ok := convMap[or.ConvID.ConvIDStr()]; ok {
			switch cp.Conv.GetMembersType() {
			case chat1.ConversationMembersType_TEAM:
			default:
				cp.Conv.Metadata.ResetList = append(cp.Conv.Metadata.ResetList, or.Uid)
			}
			cp.Conv.Metadata.Version = vers.ToConvVers()
		}
	}

	ibox.InboxVersion = vers
	return roleUpdates, i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) ConversationsUpdate(ctx context.Context, uid gregor1.UID, vers chat1.InboxVers,
	convUpdates []chat1.ConversationUpdate) (err Error) {
	defer i.Trace(ctx, func() error { return err }, "ConversationsUpdate")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))

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
	ibox, err := i.readDiskInbox(ctx, uid, true)
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
	updateMap := make(map[chat1.ConvIDStr]chat1.ConversationUpdate)
	for _, u := range convUpdates {
		updateMap[u.ConvID.ConvIDStr()] = u
	}

	for idx, conv := range ibox.Conversations {
		if update, ok := updateMap[conv.ConvIDStr]; ok {
			i.Debug(ctx, "ConversationsUpdate: changed conv: %v", update)
			if ibox.Conversations[idx].Conv.Metadata.Existence != update.Existence {
				layoutChanged = true
			}
			ibox.Conversations[idx].Conv.Metadata.Existence = update.Existence
		}
	}

	ibox.InboxVersion = vers
	return i.writeDiskInbox(ctx, uid, ibox)
}

func (i *Inbox) UpdateLocalMtime(ctx context.Context, uid gregor1.UID,
	convUpdates []chat1.LocalMtimeUpdate) (err Error) {
	if len(convUpdates) == 0 {
		return nil
	}
	defer i.Trace(ctx, func() error { return err }, "UpdateLocalMtime")()
	locks.Inbox.Lock()
	defer locks.Inbox.Unlock()
	defer i.maybeNukeFn(func() Error { return err }, i.dbKey(uid))
	var convs []types.RemoteConversation
	defer func() {
		for _, conv := range convs {
			i.layoutNotifier.UpdateLayoutFromNewMessage(ctx, conv)
		}
	}()

	i.Debug(ctx, "UpdateLocalMtime: updating %d convs", len(convUpdates))
	ibox, err := i.readDiskInbox(ctx, uid, true)
	if err != nil {
		if _, ok := err.(MissError); ok {
			return nil
		}
		return err
	}

	// Process our own changes
	updateMap := make(map[chat1.ConvIDStr]chat1.LocalMtimeUpdate)
	for _, u := range convUpdates {
		updateMap[u.ConvID.ConvIDStr()] = u
	}

	for idx, conv := range ibox.Conversations {
		if update, ok := updateMap[conv.ConvIDStr]; ok {
			i.Debug(ctx, "UpdateLocalMtime: applying conv update: %v", update)
			ibox.Conversations[idx].LocalMtime = update.Mtime
			ibox.Conversations[idx].Conv.Metadata.LocalVersion++
			convs = append(convs, ibox.Conversations[idx])
		}
	}
	return i.writeDiskInbox(ctx, uid, ibox)
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
