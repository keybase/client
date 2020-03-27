package chat

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/kyokomi/emoji"
	"golang.org/x/sync/errgroup"
)

type emojiLoadJob struct {
	attempts   int
	keyMap     map[string]string
	body       string
	convID     chat1.ConversationID
	crossTeams map[string]chat1.HarvestedEmoji
}

type DevConvEmojiSource struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	uid          gregor1.UID
	stopCh       chan struct{}
	started      bool
	eg           errgroup.Group
	activeCancel context.CancelFunc

	getLock     sync.Mutex
	aliasLookup map[string]chat1.Emoji
	ri          func() chat1.RemoteInterface
	jobCh       chan emojiLoadJob
}

var _ types.EmojiSource = (*DevConvEmojiSource)(nil)

func NewDevConvEmojiSource(g *globals.Context, ri func() chat1.RemoteInterface) *DevConvEmojiSource {
	return &DevConvEmojiSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "DevConvEmojiSource", false),
		ri:           ri,
		jobCh:        make(chan emojiLoadJob, 1000),
	}
}

func (s *DevConvEmojiSource) Start(ctx context.Context, uid gregor1.UID) {
	defer s.Trace(ctx, func() error { return nil }, "Start")()
	s.Lock()
	defer s.Unlock()
	if s.started {
		return
	}
	s.stopCh = make(chan struct{})
	s.started = true
	s.uid = uid
	s.eg.Go(func() error { return s.loadLoop(s.stopCh) })
}

func (s *DevConvEmojiSource) Stop(ctx context.Context) chan struct{} {
	defer s.Trace(ctx, func() error { return nil }, "Stop")()
	s.Lock()
	defer s.Unlock()
	ch := make(chan struct{})
	if s.started {
		close(s.stopCh)
		if s.activeCancel != nil {
			s.activeCancel()
		}
		s.started = false
		go func() {
			err := s.eg.Wait()
			if err != nil {
				s.Debug(ctx, "Stop: error waiting: %+v", err)
			}
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch
}

func (s *DevConvEmojiSource) makeStorage(topicType chat1.TopicType) types.ConvConversationBackedStorage {
	return NewConvDevConversationBackedStorage(s.G(), topicType, false, s.ri)
}

func (s *DevConvEmojiSource) topicName(suffix *string) string {
	ret := "emojis"
	if suffix != nil {
		ret += *suffix
	}
	return ret
}

func (s *DevConvEmojiSource) addAdvanced(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	alias, filename string, topicNameSuffix *string, storage types.ConvConversationBackedStorage) (res chat1.EmojiRemoteSource, err error) {
	var stored chat1.EmojiStorage
	topicName := s.topicName(topicNameSuffix)
	_, storageConv, err := storage.Get(ctx, uid, convID, topicName, &stored, true)
	if err != nil {
		return res, err
	}
	if stored.Mapping == nil {
		stored.Mapping = make(map[string]chat1.EmojiRemoteSource)
	}
	sender := NewBlockingSender(s.G(), NewBoxer(s.G()), s.ri)
	_, msgID, err := attachments.NewSender(s.G()).PostFileAttachment(ctx, sender, uid,
		storageConv.GetConvID(), storageConv.Info.TlfName, keybase1.TLFVisibility_PRIVATE, nil, filename,
		"", nil, 0, nil, nil)
	if err != nil {
		return res, err
	}
	if msgID == nil {
		return res, errors.New("no messageID from attachment")
	}
	res = chat1.NewEmojiRemoteSourceWithMessage(chat1.EmojiMessage{
		ConvID: storageConv.GetConvID(),
		MsgID:  *msgID,
	})
	stored.Mapping[alias] = res
	return res, storage.Put(ctx, uid, convID, topicName, stored)
}

func (s *DevConvEmojiSource) isStockEmoji(alias string) bool {
	_, ok := emoji.CodeMap()[":"+alias+":"]
	return ok
}

func (s *DevConvEmojiSource) validateAlias(alias string) (string, error) {
	alias = strings.ReplaceAll(alias, ":", "") // drop any colons from alias
	if strings.Contains(alias, "#") {
		return alias, errors.New("invalid character in emoji alias")
	}
	if s.isStockEmoji(alias) {
		return alias, errors.New("cannot use existing stock emoji alias")
	}
	return alias, nil
}

func (s *DevConvEmojiSource) Add(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	alias, filename string) (res chat1.EmojiRemoteSource, err error) {
	defer s.Trace(ctx, func() error { return err }, "Add")()
	if alias, err = s.validateAlias(alias); err != nil {
		return res, err
	}
	storage := s.makeStorage(chat1.TopicType_EMOJI)
	return s.addAdvanced(ctx, uid, convID, alias, filename, nil, storage)
}

func (s *DevConvEmojiSource) AddAlias(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	newAlias, existingAlias string) (res chat1.EmojiRemoteSource, err error) {
	defer s.Trace(ctx, func() error { return err }, "AddAlias")()
	if newAlias, err = s.validateAlias(newAlias); err != nil {
		return res, err
	}
	var stored chat1.EmojiStorage
	storage := s.makeStorage(chat1.TopicType_EMOJI)
	topicName := s.topicName(nil)
	if _, _, err := storage.Get(ctx, uid, convID, topicName, &stored, false); err != nil {
		return res, err
	}
	getExistingMsgSrc := func() (res chat1.EmojiRemoteSource, found bool) {
		if stored.Mapping == nil {
			return res, false
		}
		existingSource, ok := stored.Mapping[existingAlias]
		if !ok {
			return res, false
		}
		if !existingSource.IsMessage() {
			return res, false
		}
		return existingSource, true
	}
	msgSrc, ok := getExistingMsgSrc()
	if ok {
		res = chat1.NewEmojiRemoteSourceWithMessage(chat1.EmojiMessage{
			ConvID:  msgSrc.Message().ConvID,
			MsgID:   msgSrc.Message().MsgID,
			IsAlias: true,
		})
	} else {
		username, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(uid.String()))
		if err != nil {
			return res, err
		}
		res = chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
			Text:     existingAlias,
			Username: username.String(),
			Time:     gregor1.ToTime(time.Now()),
		})
	}
	stored.Mapping[newAlias] = res
	return res, storage.Put(ctx, uid, convID, topicName, stored)
}

func (s *DevConvEmojiSource) removeRemoteSource(ctx context.Context, uid gregor1.UID,
	conv chat1.ConversationLocal, source chat1.EmojiRemoteSource) error {
	typ, err := source.Typ()
	if err != nil {
		return err
	}
	switch typ {
	case chat1.EmojiRemoteSourceTyp_MESSAGE:
		if source.Message().IsAlias {
			s.Debug(ctx, "removeRemoteSource: skipping asset remove on alias")
			return nil
		}
		return s.G().ChatHelper.DeleteMsg(ctx, source.Message().ConvID, conv.Info.TlfName,
			source.Message().MsgID)
	case chat1.EmojiRemoteSourceTyp_STOCKALIAS:
		// do nothing
	default:
		return fmt.Errorf("unable to delete remote source of typ: %v", typ)
	}
	return nil
}

func (s *DevConvEmojiSource) Remove(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	alias string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Remove")()
	var stored chat1.EmojiStorage
	storage := s.makeStorage(chat1.TopicType_EMOJI)
	topicName := s.topicName(nil)
	_, storageConv, err := storage.Get(ctx, uid, convID, topicName, &stored, true)
	if err != nil {
		return err
	}
	if storageConv == nil {
		s.Debug(ctx, "Remove: no storage conv returned, bailing")
		return nil
	}
	if stored.Mapping == nil {
		s.Debug(ctx, "Remove: no mapping, bailing")
		return nil
	}
	// get attachment message and delete it
	source, ok := stored.Mapping[alias]
	if !ok {
		s.Debug(ctx, "Remove: no alias in mapping, bailing")
		return nil
	}
	if err := s.removeRemoteSource(ctx, uid, *storageConv, source); err != nil {
		s.Debug(ctx, "Remove: failed to remove remote source: %s", err)
		return err
	}
	delete(stored.Mapping, alias)
	// take out any aliases
	if source.IsMessage() {
		for existingAlias, existingSource := range stored.Mapping {
			if existingSource.IsMessage() && existingSource.Message().IsAlias &&
				existingSource.Message().MsgID == source.Message().MsgID {
				delete(stored.Mapping, existingAlias)
			}
		}
	}
	return storage.Put(ctx, uid, convID, topicName, stored)
}

func (s *DevConvEmojiSource) remoteToLocalSource(ctx context.Context, remote chat1.EmojiRemoteSource) (res chat1.EmojiLoadSource, err error) {
	typ, err := remote.Typ()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.EmojiRemoteSourceTyp_MESSAGE:
		msg := remote.Message()
		url := s.G().AttachmentURLSrv.GetURL(ctx, msg.ConvID, msg.MsgID, false)
		return chat1.NewEmojiLoadSourceWithHttpsrv(url), nil
	case chat1.EmojiRemoteSourceTyp_STOCKALIAS:
		return chat1.NewEmojiLoadSourceWithStr(remote.Stockalias().Text), nil
	default:
		return res, errors.New("unknown remote source for local source")
	}
}

func (s *DevConvEmojiSource) creationInfo(ctx context.Context, uid gregor1.UID,
	remote chat1.EmojiRemoteSource) (res chat1.EmojiCreationInfo, err error) {
	typ, err := remote.Typ()
	if err != nil {
		return res, err
	}
	reason := chat1.GetThreadReason_EMOJISOURCE
	switch typ {
	case chat1.EmojiRemoteSourceTyp_MESSAGE:
		msg := remote.Message()
		sourceMsg, err := GetMessage(ctx, s.G(), uid, msg.ConvID, msg.MsgID, false, &reason)
		if err != nil {
			return res, err
		}
		if !sourceMsg.IsValid() {
			return res, errors.New("invalid message for creation info")
		}
		return chat1.EmojiCreationInfo{
			Username: sourceMsg.Valid().SenderUsername,
			Time:     sourceMsg.Valid().ServerHeader.Ctime,
		}, nil
	case chat1.EmojiRemoteSourceTyp_STOCKALIAS:
		return chat1.EmojiCreationInfo{
			Username: remote.Stockalias().Username,
			Time:     remote.Stockalias().Time,
		}, nil
	default:
		return res, errors.New("unknown remote source for creation info")
	}
}

func (s *DevConvEmojiSource) getNoSet(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID,
	opts chat1.EmojiFetchOpts) (res chat1.UserEmojis, aliasLookup map[string]chat1.Emoji, err error) {
	aliasLookup = make(map[string]chat1.Emoji)
	topicType := chat1.TopicType_EMOJI
	storage := s.makeStorage(topicType)
	var sourceTLFID *chat1.TLFID
	seenAliases := make(map[string]int)
	if convID != nil {
		conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, *convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return res, aliasLookup, err
		}
		sourceTLFID = new(chat1.TLFID)
		*sourceTLFID = conv.Conv.Metadata.IdTriple.Tlfid
	}
	readTopicName := s.topicName(nil)
	ibox, _, err := s.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, &chat1.GetInboxLocalQuery{
			TopicType:    &topicType,
			MemberStatus: chat1.AllConversationMemberStatuses(),
			TopicName:    &readTopicName,
		})
	if err != nil {
		return res, aliasLookup, err
	}
	convs := ibox.Convs
	addEmojis := func(convs []chat1.ConversationLocal, isCrossTeam bool) {
		if opts.OnlyInTeam {
			return
		}
		for _, conv := range convs {
			var stored chat1.EmojiStorage
			found, err := storage.GetFromKnownConv(ctx, uid, conv, &stored)
			if err != nil {
				s.Debug(ctx, "Get: failed to read from known conv: %s", err)
				continue
			}
			if !found {
				s.Debug(ctx, "Get: no stored info for: %s", conv.GetConvID())
				continue
			}
			group := chat1.EmojiGroup{
				Name: conv.Info.TlfName,
			}
			for alias, storedEmoji := range stored.Mapping {
				if !opts.GetAliases && storedEmoji.IsAlias() {
					continue
				}
				var creationInfo *chat1.EmojiCreationInfo
				source, err := s.remoteToLocalSource(ctx, storedEmoji)
				if err != nil {
					s.Debug(ctx, "Get: skipping emoji on remote-to-local error: %s", err)
					continue
				}
				if opts.GetCreationInfo {
					ci, err := s.creationInfo(ctx, uid, storedEmoji)
					if err != nil {
						s.Debug(ctx, "Get: failed to get creation info: %s", err)
					} else {
						creationInfo = new(chat1.EmojiCreationInfo)
						*creationInfo = ci
					}
				}
				emoji := chat1.Emoji{
					Alias:        alias,
					Source:       source,
					RemoteSource: storedEmoji,
					IsCrossTeam:  isCrossTeam,
					CreationInfo: creationInfo,
				}
				if seen, ok := seenAliases[alias]; ok {
					seenAliases[alias]++
					emoji.Alias += fmt.Sprintf("#%d", seen)
					aliasLookup[alias] = emoji
				} else {
					seenAliases[alias] = 2
				}
				group.Emojis = append(group.Emojis, emoji)
			}
			res.Emojis = append(res.Emojis, group)
		}
	}
	var tlfConvs, otherConvs []chat1.ConversationLocal
	for _, conv := range convs {
		if sourceTLFID != nil && conv.Info.Triple.Tlfid.Eq(*sourceTLFID) {
			tlfConvs = append(tlfConvs, conv)
		} else {
			otherConvs = append(otherConvs, conv)
		}
	}
	addEmojis(tlfConvs, false)
	addEmojis(otherConvs, sourceTLFID != nil)
	return res, aliasLookup, nil
}

func (s *DevConvEmojiSource) Get(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID,
	opts chat1.EmojiFetchOpts) (res chat1.UserEmojis, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get")()
	var aliasLookup map[string]chat1.Emoji
	if res, aliasLookup, err = s.getNoSet(ctx, uid, convID, opts); err != nil {
		return res, err
	}
	s.getLock.Lock()
	defer s.getLock.Unlock()
	s.aliasLookup = aliasLookup
	return res, nil
}

var emojiPattern = regexp.MustCompile(`(?::)([^:\s]+)(?::)`)

type emojiMatch struct {
	name     string
	position []int
}

func (s *DevConvEmojiSource) parse(ctx context.Context, body string) (res []emojiMatch) {
	body = utils.ReplaceQuotedSubstrings(body, false)
	hits := emojiPattern.FindAllStringSubmatchIndex(body, -1)
	for _, hit := range hits {
		if len(hit) < 4 {
			s.Debug(ctx, "parse: malformed hit: %d", len(hit))
			continue
		}
		name := body[hit[2]:hit[3]]
		if !s.isStockEmoji(name) {
			res = append(res, emojiMatch{
				name:     name,
				position: []int{hit[0], hit[1]},
			})
		}
	}
	return res
}

func (s *DevConvEmojiSource) stripAlias(alias string) string {
	return strings.Split(alias, "#")[0]
}

func (s *DevConvEmojiSource) versionMatch(ctx context.Context, uid gregor1.UID, l chat1.EmojiRemoteSource,
	r chat1.EmojiRemoteSource) bool {
	if !l.IsMessage() || !r.IsMessage() {
		return false
	}
	reason := chat1.GetThreadReason_EMOJISOURCE
	lmsg, err := GetMessage(ctx, s.G(), uid, l.Message().ConvID, l.Message().MsgID, false, &reason)
	if err != nil {
		s.Debug(ctx, "versionMatch: failed to get lmsg: %s", err)
		return false
	}
	rmsg, err := GetMessage(ctx, s.G(), uid, r.Message().ConvID, r.Message().MsgID, false, &reason)
	if err != nil {
		s.Debug(ctx, "versionMatch: failed to get rmsg: %s", err)
		return false
	}
	if !lmsg.IsValid() || !rmsg.IsValid() {
		s.Debug(ctx, "versionMatch: one message not valid: lmsg: %s rmsg: %s", lmsg.DebugString(),
			rmsg.DebugString())
		return false
	}
	if !lmsg.Valid().MessageBody.IsType(chat1.MessageType_ATTACHMENT) ||
		!rmsg.Valid().MessageBody.IsType(chat1.MessageType_ATTACHMENT) {
		s.Debug(ctx, "versionMatch: one message not attachment: lmsg: %s rmsg: %s", lmsg.DebugString(),
			rmsg.DebugString())
		return false
	}
	lhash := lmsg.Valid().MessageBody.Attachment().Object.PtHash
	rhash := rmsg.Valid().MessageBody.Attachment().Object.PtHash
	return lhash != nil && rhash != nil && lhash.Eq(rhash)
}

func (s *DevConvEmojiSource) syncCrossTeam(ctx context.Context, uid gregor1.UID, emoji chat1.HarvestedEmoji,
	convID chat1.ConversationID) (res chat1.HarvestedEmoji, err error) {
	typ, err := emoji.Source.Typ()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.EmojiRemoteSourceTyp_MESSAGE:
	case chat1.EmojiRemoteSourceTyp_STOCKALIAS:
		emoji.IsCrossTeam = true
		return emoji, nil
	default:
		return res, errors.New("invalid remote source to sync")
	}
	suffix := convID.String()
	var stored chat1.EmojiStorage
	storage := s.makeStorage(chat1.TopicType_EMOJICROSS)
	if _, _, err := storage.Get(ctx, uid, convID, s.topicName(&suffix), &stored, true); err != nil {
		return res, err
	}
	if stored.Mapping == nil {
		stored.Mapping = make(map[string]chat1.EmojiRemoteSource)
	}

	// check for a match
	stripped := s.stripAlias(emoji.Alias)
	if existing, ok := stored.Mapping[stripped]; ok {
		s.Debug(ctx, "syncCrossTeam: hit mapping")
		if s.versionMatch(ctx, uid, existing, emoji.Source) {
			s.Debug(ctx, "syncCrossTeam: hit version, returning")
			return chat1.HarvestedEmoji{
				Alias:       emoji.Alias,
				Source:      existing,
				IsCrossTeam: true,
			}, nil
		}
		s.Debug(ctx, "syncCrossTeam: missed on version")
	} else {
		s.Debug(ctx, "syncCrossTeam: missed mapping")
	}

	// download from the original source
	sink, err := ioutil.TempFile(os.TempDir(), "emoji")
	if err != nil {
		return res, err
	}
	defer os.Remove(sink.Name())
	if err := attachments.Download(ctx, s.G(), uid, emoji.Source.Message().ConvID,
		emoji.Source.Message().MsgID, sink, false, nil, s.ri); err != nil {
		s.Debug(ctx, "syncCrossTeam: failed to download: %s", err)
		return res, err
	}

	// add the source to the target storage area
	newSource, err := s.addAdvanced(ctx, uid, convID, stripped, sink.Name(), &suffix, storage)
	if err != nil {
		return res, err
	}
	return chat1.HarvestedEmoji{
		Alias:       emoji.Alias,
		Source:      newSource,
		IsCrossTeam: true,
	}, nil
}

func (s *DevConvEmojiSource) Harvest(ctx context.Context, body string, uid gregor1.UID,
	convID chat1.ConversationID, crossTeams map[string]chat1.HarvestedEmoji,
	mode types.EmojiSourceHarvestMode) (res []chat1.HarvestedEmoji, err error) {
	if globals.IsEmojiHarvesterCtx(ctx) {
		s.Debug(ctx, "Harvest: in an existing harvest context, bailing")
		return nil, nil
	}
	matches := s.parse(ctx, body)
	if len(matches) == 0 {
		return nil, nil
	}
	ctx = globals.CtxMakeEmojiHarvester(ctx)
	defer s.Trace(ctx, func() error { return err }, "Harvest: mode: %v", mode)()
	s.Debug(ctx, "Harvest: %d matches found", len(matches))
	emojis, _, err := s.getNoSet(ctx, uid, &convID, chat1.EmojiFetchOpts{
		GetCreationInfo: false,
		GetAliases:      true,
		OnlyInTeam:      false,
	})
	if err != nil {
		return res, err
	}
	if len(emojis.Emojis) == 0 && len(crossTeams) == 0 {
		return nil, nil
	}
	groupMap := make(map[string]chat1.Emoji)
	for _, group := range emojis.Emojis {
		for _, emoji := range group.Emojis {
			groupMap[emoji.Alias] = emoji
		}
	}
	crossTeamMap := make(map[string]chat1.HarvestedEmoji)
	aliasMap := make(map[string]chat1.Emoji)
	switch mode {
	case types.EmojiSourceHarvestModeInbound:
		for _, emoji := range crossTeams {
			crossTeamMap[emoji.Alias] = emoji
		}
	case types.EmojiSourceHarvestModeOutbound:
		s.getLock.Lock()
		for alias, emoji := range s.aliasLookup {
			aliasMap[alias] = emoji
		}
		s.getLock.Unlock()
	default:
		return nil, errors.New("unknown harvest mode")
	}
	s.Debug(ctx, "Harvest: num emojis: conv: %d crossTeam: %d alias: %d", len(groupMap), len(crossTeamMap),
		len(aliasMap))
	for _, match := range matches {
		// try group map first
		if emoji, ok := groupMap[match.name]; ok {
			var resEmoji chat1.HarvestedEmoji
			if emoji.IsCrossTeam {
				if resEmoji, err = s.syncCrossTeam(ctx, uid, chat1.HarvestedEmoji{
					Alias:  match.name,
					Source: emoji.RemoteSource,
				}, convID); err != nil {
					return res, err
				}
			} else {
				resEmoji = chat1.HarvestedEmoji{
					Alias:       match.name,
					Source:      emoji.RemoteSource,
					IsCrossTeam: emoji.IsCrossTeam,
				}
			}
			res = append(res, resEmoji)
		} else if emoji, ok := crossTeamMap[match.name]; ok {
			// then known cross teams
			emoji.IsCrossTeam = true
			res = append(res, emoji)
		} else if emoji, ok := aliasMap[match.name]; ok {
			// then any aliases we know about from the last Get call
			newEmoji, err := s.syncCrossTeam(ctx, uid, chat1.HarvestedEmoji{
				Alias:  match.name,
				Source: emoji.RemoteSource,
			}, convID)
			if err != nil {
				return res, err
			}
			res = append(res, newEmoji)
		}
	}
	return res, nil
}

func (s *DevConvEmojiSource) makeResolveKey(convID chat1.ConversationID, msgID chat1.MessageID,
	alias string) string {
	return base64.StdEncoding.EncodeToString([]byte(fmt.Sprintf("er:%s:%d:%s", convID, msgID, alias)))
}

func (s *DevConvEmojiSource) Decorate(ctx context.Context, body string, convID chat1.ConversationID,
	msgID chat1.MessageID, crossTeams map[string]chat1.HarvestedEmoji) string {
	matches := s.parse(ctx, body)
	if len(matches) == 0 {
		return body
	}
	defer s.Trace(ctx, func() error { return nil }, "Decorate")()
	offset := 0
	added := 0
	var job emojiLoadJob
	job.convID = convID
	job.body = body
	job.keyMap = make(map[string]string)
	job.crossTeams = crossTeams
	for _, match := range matches {
		// TODO: "cache hits" (tbd) should decorate immediately with emoji info without a load
		resolveKey := s.makeResolveKey(convID, msgID, match.name)
		payload := chat1.NewUIEmojiDecorationWithResolving(chat1.UIEmojiResolvingInfo{
			Key:   resolveKey,
			Alias: match.name,
		})
		dec := chat1.NewUITextDecorationWithEmoji(payload)
		job.keyMap[match.name] = resolveKey
		body, added = utils.DecorateBody(ctx, body, match.position[0]+offset,
			match.position[1]-match.position[0], dec)
		offset += added
	}
	// only queue if we have resolving requests in play
	if len(job.keyMap) > 0 {
		s.jobCh <- job
	}
	return body
}

func (s *DevConvEmojiSource) loadJob(ctx context.Context, job emojiLoadJob) (err error) {
	// set up context
	s.Lock()
	if !s.started {
		s.Unlock()
		return nil
	}
	ctx, s.activeCancel = context.WithCancel(ctx)
	s.Unlock()

	ctx = globals.ChatCtx(ctx, s.G(), keybase1.TLFIdentifyBehavior_CHAT_GUI, nil, nil)
	defer s.Trace(ctx, func() error { return nil }, "loadJob")()
	s.Debug(ctx, "loadJob: uid: %s crossTeams: %d", s.uid, len(job.crossTeams))
	emojis, err := s.Harvest(ctx, job.body, s.uid, job.convID, job.crossTeams,
		types.EmojiSourceHarvestModeInbound)
	if err != nil {
		s.Debug(ctx, "loadJob: failed to harvest: %s", err)
		return err
	}
	s.Debug(ctx, "loadJob: uid: %s harvested %d", s.uid, len(emojis))
	var infos []chat1.EmojiNotifyInfo
	for _, emoji := range emojis {
		key, ok := job.keyMap[emoji.Alias]
		if !ok {
			s.Debug(ctx, "loadJob: failed to find alias in keymap, skipping")
			continue
		}
		localSource, err := s.remoteToLocalSource(ctx, emoji.Source)
		if err != nil {
			s.Debug(ctx, "loadJob: failed to get local source, skipping")
			continue
		}
		infos = append(infos, chat1.EmojiNotifyInfo{
			Key: key,
			Emoji: chat1.Emoji{
				Alias:  emoji.Alias,
				Source: localSource,
			},
		})
	}
	s.Debug(ctx, "loadJob: sending notification: uid: %s num: %d", s.uid, len(infos))
	if len(infos) > 0 {
		s.G().NotifyRouter.HandleEmojiInfo(ctx, infos)
	}
	return nil
}

func (s *DevConvEmojiSource) loadLoop(stopCh chan struct{}) error {
	ctx := context.Background()
	s.Debug(ctx, "loadLoop: starting up: uid: %s", s.uid)
	for {
		select {
		case <-stopCh:
			s.Debug(ctx, "loadLoop: shutting down")
			return nil
		case job := <-s.jobCh:
			if err := s.loadJob(ctx, job); err != nil {
				if job.attempts > 5 {
					s.Debug(ctx, "loadLoop: job in convID: %s hit max attempts", job.convID)
				} else {
					job.attempts++
					s.Debug(ctx, "loadLoop: job in convID: %s retrying: attempts: %d",
						job.convID, job.attempts)
					select {
					case s.jobCh <- job:
					default:
						s.Debug(ctx, "loadLoop: failed to retry job, queue full")
					}
				}
			}
		}
	}
}
