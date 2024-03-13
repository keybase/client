package chat

import (
	"context"
	"errors"
	"fmt"
	"image/gif"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"

	"camlistore.org/pkg/images"
	"github.com/dustin/go-humanize"
	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/encrypteddb"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	minShortNameLength = 2
	maxShortNameLength = 48
	minEmojiSize       = 512        // min size for reading mime type
	maxEmojiSize       = 256 * 1000 // 256kb
	animationKey       = "emojianimations"
)

type EmojiValidationError struct {
	Underlying error
	CLIDisplay string
	UIDisplay  string
}

func (e *EmojiValidationError) Error() string {
	if e == nil || e.Underlying == nil {
		return ""
	}
	return e.Underlying.Error()
}

func (e *EmojiValidationError) Export() *chat1.EmojiError {
	if e == nil {
		return nil
	}
	return &chat1.EmojiError{
		Clidisplay: e.CLIDisplay,
		Uidisplay:  e.UIDisplay,
	}
}

func NewEmojiValidationError(err error, cliDisplay, uiDisplay string) *EmojiValidationError {
	return &EmojiValidationError{
		Underlying: err,
		CLIDisplay: cliDisplay,
		UIDisplay:  uiDisplay,
	}
}

func NewEmojiValidationErrorSimple(err error, display string) *EmojiValidationError {
	return &EmojiValidationError{
		Underlying: err,
		CLIDisplay: display,
		UIDisplay:  display,
	}
}

func NewEmojiValidationErrorJustError(err error) *EmojiValidationError {
	return &EmojiValidationError{
		Underlying: err,
		CLIDisplay: err.Error(),
		UIDisplay:  err.Error(),
	}
}

type DevConvEmojiSource struct {
	globals.Contextified
	utils.DebugLabeler

	aliasLookupLock sync.Mutex
	aliasLookup     map[string]chat1.Emoji
	ri              func() chat1.RemoteInterface
	encryptedDB     *encrypteddb.EncryptedDB

	// testing
	tempDir                  string
	testingCreatedSyncConv   chan struct{}
	testingRefreshedSyncConv chan struct{}
}

var _ types.EmojiSource = (*DevConvEmojiSource)(nil)

func NewDevConvEmojiSource(g *globals.Context, ri func() chat1.RemoteInterface) *DevConvEmojiSource {
	keyFn := func(ctx context.Context) ([32]byte, error) {
		return storage.GetSecretBoxKey(ctx, g.ExternalG())
	}
	dbFn := func(g *libkb.GlobalContext) *libkb.JSONLocalDb {
		return g.LocalChatDb
	}
	return &DevConvEmojiSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "DevConvEmojiSource", false),
		ri:           ri,
		encryptedDB:  encrypteddb.New(g.ExternalG(), dbFn, keyFn),
	}
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

func (s *DevConvEmojiSource) dbKey(uid gregor1.UID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatUserEmojis,
		Key: uid.String(),
	}
}

func (s *DevConvEmojiSource) getAliasLookup(ctx context.Context, uid gregor1.UID) (res map[string]chat1.Emoji, err error) {
	s.aliasLookupLock.Lock()
	defer s.aliasLookupLock.Unlock()
	if s.aliasLookup != nil {
		res = make(map[string]chat1.Emoji, len(s.aliasLookup))
		for alias, emoji := range s.aliasLookup {
			res[alias] = emoji
		}
		return res, nil
	}
	res = make(map[string]chat1.Emoji)
	s.Debug(ctx, "getAliasLookup: missed alias lookup, reading from disk")
	found, err := s.encryptedDB.Get(ctx, s.dbKey(uid), &res)
	if err != nil {
		return res, err
	}
	if !found {
		return make(map[string]chat1.Emoji), nil
	}
	return res, nil
}

func (s *DevConvEmojiSource) putAliasLookup(ctx context.Context, uid gregor1.UID,
	aliasLookup map[string]chat1.Emoji, opts chat1.EmojiFetchOpts) error {
	s.aliasLookupLock.Lock()
	defer s.aliasLookupLock.Unlock()
	// set this if it is blank, or a full fetch
	if !opts.OnlyInTeam || s.aliasLookup == nil {
		s.aliasLookup = aliasLookup
	}
	// only commit to disk if this is a full lookup
	if !opts.OnlyInTeam {
		return s.encryptedDB.Put(ctx, s.dbKey(uid), s.aliasLookup)
	}
	return nil
}

func (s *DevConvEmojiSource) addAdvanced(ctx context.Context, uid gregor1.UID,
	storageConv *chat1.ConversationLocal, convID chat1.ConversationID,
	alias, filename string, allowOverwrite bool, storage types.ConvConversationBackedStorage) (res chat1.EmojiRemoteSource, err error) {
	var stored chat1.EmojiStorage
	alias = strings.ReplaceAll(alias, ":", "") // drop any colons from alias
	if storageConv != nil {
		_, err = storage.GetFromKnownConv(ctx, uid, *storageConv, &stored)
	} else {
		topicName := s.topicName(nil)
		_, storageConv, err = storage.Get(ctx, uid, convID, topicName, &stored, true)
	}
	if err != nil {
		return res, err
	}
	if stored.Mapping == nil {
		stored.Mapping = make(map[string]chat1.EmojiRemoteSource)
	}
	if _, ok := stored.Mapping[alias]; ok && !allowOverwrite {
		return res, NewEmojiValidationError(errors.New("alias already exists"),
			"alias already exists, must specify --allow-overwrite to edit", "alias already exists")
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
	return res, storage.PutToKnownConv(ctx, uid, *storageConv, stored)
}

func (s *DevConvEmojiSource) IsStockEmoji(alias string) bool {
	parts := strings.Split(alias, ":")
	if len(parts) > 3 { // if we have a skin tone here, drop it
		alias = fmt.Sprintf(":%s:", parts[1])
	} else if len(parts) == 1 {
		alias = fmt.Sprintf(":%s:", parts[0])
	}
	alias2 := strings.ReplaceAll(alias, "-", "_")
	return storage.EmojiExists(alias) || storage.EmojiExists(alias2)
}

func (s *DevConvEmojiSource) normalizeShortName(shortName string) string {
	return strings.ReplaceAll(shortName, ":", "") // drop any colons from alias
}

func (s *DevConvEmojiSource) validateShortName(shortName string) error {
	if len(shortName) > maxShortNameLength {
		err := errors.New("alias is too long")
		return NewEmojiValidationError(err, fmt.Sprintf("alias is too long, must be less than %d",
			maxShortNameLength), err.Error())
	}
	if len(shortName) < minShortNameLength {
		err := errors.New("alias is too short")
		return NewEmojiValidationError(err,
			fmt.Sprintf("alias is too short, must be greater than %d", minShortNameLength),
			err.Error())
	}
	if strings.Contains(shortName, "#") {
		return NewEmojiValidationErrorJustError(errors.New("invalid character in alias"))
	}
	return nil
}

func (s *DevConvEmojiSource) validateCustomEmoji(ctx context.Context, shortName, filename string) (string, error) {
	err := s.validateShortName(shortName)
	if err != nil {
		return "", err
	}
	shortName = s.normalizeShortName(shortName)

	err = s.validateFile(ctx, filename)
	if err != nil {
		return "", err
	}
	return shortName, nil
}

// validateFile validates the following:
// file size
// format
func (s *DevConvEmojiSource) validateFile(ctx context.Context, filename string) error {
	finfo, err := attachments.StatOSOrKbfsFile(ctx, s.G().GlobalContext, filename)
	if err != nil {
		return NewEmojiValidationErrorSimple(err, "unable to open file")
	}
	if finfo.IsDir() {
		return NewEmojiValidationErrorJustError(errors.New("unable to use a directory"))
	} else if finfo.Size() > maxEmojiSize {
		err := errors.New("file too large")
		return NewEmojiValidationError(err,
			fmt.Sprintf("emoji filesize too large, must be less than %s", humanize.Bytes(maxEmojiSize)),
			err.Error())
	} else if finfo.Size() < minEmojiSize {
		err := errors.New("file too small")
		return NewEmojiValidationError(err,
			fmt.Sprintf("emoji filesize too small, must be greater than %s", humanize.Bytes(minEmojiSize)),
			err.Error())
	}

	src, err := attachments.NewReadCloseResetter(ctx, s.G().GlobalContext, filename)
	if err != nil {
		return NewEmojiValidationErrorSimple(err, "failed to process file")
	}
	defer func() { src.Close() }()
	if _, _, err = images.Decode(src, nil); err != nil {
		s.Debug(ctx, "validateFile: failed to decode image: %s", err)
		if err := src.Reset(); err != nil {
			return NewEmojiValidationErrorSimple(err, "failed to process file")
		}
		g, err := gif.DecodeAll(src)
		if err != nil {
			s.Debug(ctx, "validateFile: failed to decode gif: %s", err)
			return NewEmojiValidationErrorSimple(err, "invalid image file")
		}
		if len(g.Image) == 0 {
			return NewEmojiValidationErrorJustError(errors.New("no image frames in GIF"))
		}
	}
	return nil
}

func (s *DevConvEmojiSource) fromURL(ctx context.Context, url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	file, _, err := s.G().AttachmentUploader.GetUploadTempSink(ctx, "tmp-emoji")
	if err != nil {
		return "", err
	}
	_, err = io.Copy(file, resp.Body)
	return file.Name(), err
}

func (s *DevConvEmojiSource) Add(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	alias, filename string, allowOverwrite bool) (res chat1.EmojiRemoteSource, err error) {
	defer s.Trace(ctx, &err, "Add")()
	if strings.HasPrefix(filename, "http://") || strings.HasPrefix(filename, "https://") {
		filename, err = s.fromURL(ctx, filename)
		if err != nil {
			return res, err
		}
		defer func() { _ = os.Remove(filename) }()
	}
	if alias, err = s.validateCustomEmoji(ctx, alias, filename); err != nil {
		return res, err
	}
	storage := s.makeStorage(chat1.TopicType_EMOJI)
	return s.addAdvanced(ctx, uid, nil, convID, alias, filename, allowOverwrite, storage)
}

func (s *DevConvEmojiSource) AddAlias(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	newAlias, existingAlias string) (res chat1.EmojiRemoteSource, err error) {
	defer s.Trace(ctx, &err, "AddAlias")()
	if err = s.validateShortName(newAlias); err != nil {
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
		existingSource, ok := stored.Mapping[strings.Trim(existingAlias, ":")]
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
		newAlias = s.normalizeShortName(newAlias)
	} else if s.IsStockEmoji(existingAlias) {
		username, err := s.G().GetUPAKLoader().LookupUsername(ctx, keybase1.UID(uid.String()))
		if err != nil {
			return res, err
		}
		res = chat1.NewEmojiRemoteSourceWithStockalias(chat1.EmojiStockAlias{
			Text:     existingAlias,
			Username: username.String(),
			Time:     gregor1.ToTime(s.G().GetClock().Now()),
		})
	} else {
		return res, fmt.Errorf("alias is not a valid existing custom emoji or stock emoji")
	}
	if stored.Mapping == nil {
		stored.Mapping = make(map[string]chat1.EmojiRemoteSource)
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
	defer s.Trace(ctx, &err, "Remove")()
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
	if source.IsMessage() && !source.Message().IsAlias {
		for existingAlias, existingSource := range stored.Mapping {
			if existingSource.IsMessage() && existingSource.Message().IsAlias &&
				existingSource.Message().MsgID == source.Message().MsgID {
				delete(stored.Mapping, existingAlias)
			}
		}
	}
	return storage.Put(ctx, uid, convID, topicName, stored)
}

func (s *DevConvEmojiSource) animationsDisabled(ctx context.Context, uid gregor1.UID) bool {
	st, err := s.G().GregorState.State(ctx)
	if err != nil {
		s.Debug(ctx, "animationsDisabled: failed to get state: %s", err)
		return false
	}
	cat, err := gregor1.ObjFactory{}.MakeCategory(animationKey)
	if err != nil {
		s.Debug(ctx, "animationsDisabled: failed to make category: %s", err)
		return false
	}
	items, err := st.ItemsInCategory(cat)
	if err != nil {
		s.Debug(ctx, "animationsDisabled: failed to get items: %s", err)
		return false
	}
	return len(items) > 0
}

func (s *DevConvEmojiSource) ToggleAnimations(ctx context.Context, uid gregor1.UID, enabled bool) (err error) {
	defer s.Trace(ctx, &err, "ToggleAnimations: enabled: %v", enabled)()
	cat, err := gregor1.ObjFactory{}.MakeCategory(animationKey)
	if err != nil {
		s.Debug(ctx, "animationsDisabled: failed to make category: %s", err)
		return err
	}
	if enabled {
		return s.G().GregorState.DismissCategory(ctx, cat.(gregor1.Category))
	}
	_, err = s.G().GregorState.InjectItem(ctx, animationKey, []byte{1}, gregor1.TimeOrOffset{})
	return err
}

func (s *DevConvEmojiSource) RemoteToLocalSource(ctx context.Context, uid gregor1.UID,
	remote chat1.EmojiRemoteSource) (source chat1.EmojiLoadSource, noAnimSource chat1.EmojiLoadSource, err error) {
	typ, err := remote.Typ()
	if err != nil {
		return source, noAnimSource, err
	}
	noAnim := s.animationsDisabled(ctx, uid)
	switch typ {
	case chat1.EmojiRemoteSourceTyp_MESSAGE:
		msg := remote.Message()
		sourceURL := s.G().AttachmentURLSrv.GetURL(ctx, msg.ConvID, msg.MsgID, false, noAnim, true)
		noAnimSourceURL := s.G().AttachmentURLSrv.GetURL(ctx, msg.ConvID, msg.MsgID, false, true, true)
		return chat1.NewEmojiLoadSourceWithHttpsrv(sourceURL),
			chat1.NewEmojiLoadSourceWithHttpsrv(noAnimSourceURL), nil
	case chat1.EmojiRemoteSourceTyp_STOCKALIAS:
		ret := chat1.NewEmojiLoadSourceWithStr(remote.Stockalias().Text)
		return ret, ret, nil
	default:
		return source, noAnimSource, errors.New("unknown remote source for local source")
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
		sourceMsg, err := s.G().ConvSource.GetMessage(ctx, msg.ConvID, uid, msg.MsgID, &reason, nil, false)
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
			TopicType: &topicType,
			TopicName: &readTopicName,
		})
	if err != nil {
		return res, aliasLookup, err
	}
	convs := ibox.Convs
	seenAliases := make(map[string]int)
	addEmojis := func(convs []chat1.ConversationLocal, isCrossTeam bool) {
		if opts.OnlyInTeam && isCrossTeam {
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
				source, noAnimSource, err := s.RemoteToLocalSource(ctx, uid, storedEmoji)
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
				teamname := conv.Info.TlfName
				emoji := chat1.Emoji{
					Alias:        alias,
					Source:       source,
					NoAnimSource: noAnimSource,
					RemoteSource: storedEmoji,
					IsCrossTeam:  isCrossTeam,
					CreationInfo: creationInfo,
					IsAlias:      storedEmoji.IsAlias(),
					Teamname:     &teamname,
				}
				if seen, ok := seenAliases[alias]; ok {
					seenAliases[alias]++
					emoji.Alias += fmt.Sprintf("#%d", seen)
				} else {
					seenAliases[alias] = 2
					if s.IsStockEmoji(alias) {
						emoji.Alias += fmt.Sprintf("#%d", seenAliases[alias])
						seenAliases[alias]++
					}
				}
				aliasLookup[emoji.Alias] = emoji
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
	defer s.Trace(ctx, &err, "Get %v", opts)()
	var aliasLookup map[string]chat1.Emoji
	if res, aliasLookup, err = s.getNoSet(ctx, uid, convID, opts); err != nil {
		return res, err
	}
	if err := s.putAliasLookup(ctx, uid, aliasLookup, opts); err != nil {
		s.Debug(ctx, "Get: failed to put alias lookup: %s", err)
	}
	for _, group := range res.Emojis {
		sort.Slice(group.Emojis, func(i, j int) bool {
			return group.Emojis[i].Alias < group.Emojis[j].Alias
		})
	}
	return res, nil
}

type emojiMatch struct {
	name     string
	position []int
}

func (s *DevConvEmojiSource) parse(ctx context.Context, body string) (res []emojiMatch) {
	body = utils.ReplaceQuotedSubstrings(body, false)
	hits := globals.EmojiPattern.FindAllStringSubmatchIndex(body, -1)
	for _, hit := range hits {
		if len(hit) < 4 {
			s.Debug(ctx, "parse: malformed hit: %d", len(hit))
			continue
		}
		res = append(res, emojiMatch{
			name:     body[hit[2]:hit[3]],
			position: []int{hit[0], hit[1]},
		})
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
	lmsg, err := s.G().ConvSource.GetMessage(ctx, l.Message().ConvID, uid, l.Message().MsgID, &reason,
		nil, false)
	if err != nil {
		s.Debug(ctx, "versionMatch: failed to get lmsg: %s", err)
		return false
	}
	rmsg, err := s.G().ConvSource.GetMessage(ctx, r.Message().ConvID, uid, r.Message().MsgID, &reason,
		nil, false)
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

func (s *DevConvEmojiSource) getCrossTeamConv(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, sourceConvID chat1.ConversationID) (res chat1.ConversationLocal, err error) {
	baseConv, err := utils.GetVerifiedConv(ctx, s.G(), uid, convID, types.InboxSourceDataSourceAll)
	if err != nil {
		s.Debug(ctx, "getCrossTeamConv: failed to get base conv: %s", err)
		return res, err
	}
	sourceConv, err := utils.GetVerifiedConv(ctx, s.G(), uid, sourceConvID, types.InboxSourceDataSourceAll)
	if err != nil {
		s.Debug(ctx, "getCrossTeamConv: failed to get source conv: %s", err)
		return res, err
	}
	var created bool
	topicID := chat1.TopicID(sourceConv.Info.Triple.Tlfid.Bytes())
	s.Debug(ctx, "getCrossTeamConv: attempting conv create: sourceConvID: %s topicID: %s",
		sourceConv.GetConvID(), topicID)
	topicName := topicID.String()
	if res, created, err = NewConversation(ctx, s.G(), uid, baseConv.Info.TlfName, &topicName,
		chat1.TopicType_EMOJICROSS, baseConv.GetMembersType(), baseConv.Info.Visibility,
		&topicID, s.ri, NewConvFindExistingNormal); err != nil {
		if convExistsErr, ok := err.(libkb.ChatConvExistsError); ok {
			s.Debug(ctx, "getCrossTeamConv: conv exists error received, attempting to join: %s", err)
			if err := JoinConversation(ctx, s.G(), s.DebugLabeler, s.ri, uid, convExistsErr.ConvID); err != nil {
				s.Debug(ctx, "getCrossTeamConv: failed to join: %s", err)
				return res, err
			}
			if res, err = utils.GetVerifiedConv(ctx, s.G(), uid, convExistsErr.ConvID,
				types.InboxSourceDataSourceAll); err != nil {
				s.Debug(ctx, "getCrossTeamConv: failed to get conv after successful join: %s", err)
			}
			created = false
		} else {
			return res, err
		}
	}
	if created {
		s.Debug(ctx, "getCrossTeamConv: created a new sync conv: %s (topicID: %s)", res.GetConvID(), topicID)
		if s.testingCreatedSyncConv != nil {
			s.testingCreatedSyncConv <- struct{}{}
		}
	} else {
		s.Debug(ctx, "getCrossTeamConv: using exising sync conv: %s (topicID: %s)", res.GetConvID(), topicID)
	}
	return res, nil
}

func (s *DevConvEmojiSource) getCacheDir() string {
	if len(s.tempDir) > 0 {
		return s.tempDir
	}
	return s.G().GetCacheDir()
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
	var stored chat1.EmojiStorage
	storage := s.makeStorage(chat1.TopicType_EMOJICROSS)
	sourceConvID := emoji.Source.Message().ConvID
	syncConv, err := s.getCrossTeamConv(ctx, uid, convID, sourceConvID)
	if err != nil {
		s.Debug(ctx, "syncCrossTeam: failed to get cross team conv: %s", err)
		return res, err
	}
	if _, err := storage.GetFromKnownConv(ctx, uid, syncConv, &stored); err != nil {
		s.Debug(ctx, "syncCrossTeam: failed to get from known conv: %s", err)
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
	if s.testingRefreshedSyncConv != nil {
		s.testingRefreshedSyncConv <- struct{}{}
	}
	// download from the original source
	sink, err := os.CreateTemp(s.getCacheDir(), "emoji")
	if err != nil {
		return res, err
	}
	defer os.Remove(sink.Name())
	if err := attachments.Download(ctx, s.G(), uid, sourceConvID,
		emoji.Source.Message().MsgID, sink, false, nil, s.ri); err != nil {
		s.Debug(ctx, "syncCrossTeam: failed to download: %s", err)
		return res, err
	}

	// add the source to the target storage area
	newSource, err := s.addAdvanced(ctx, uid, &syncConv, convID, stripped, sink.Name(), true, storage)
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
	convID chat1.ConversationID, mode types.EmojiHarvestMode) (res []chat1.HarvestedEmoji, err error) {
	if globals.IsEmojiHarvesterCtx(ctx) {
		s.Debug(ctx, "Harvest: in an existing harvest context, bailing")
		return nil, nil
	}
	matches := s.parse(ctx, body)
	if len(matches) == 0 {
		return nil, nil
	}
	ctx = globals.CtxMakeEmojiHarvester(ctx)
	defer s.Trace(ctx, &err, "Harvest: mode: %v", mode)()
	s.Debug(ctx, "Harvest: %d matches found", len(matches))
	aliasMap, err := s.getAliasLookup(ctx, uid)
	if err != nil {
		s.Debug(ctx, "Harvest: failed to get alias lookup: %s", err)
		return res, err
	}
	shouldSync := false
	switch mode {
	case types.EmojiHarvestModeNormal:
		shouldSync = true
		if len(aliasMap) == 0 {
			s.Debug(ctx, "Harvest: no alias map, fetching fresh")
			_, aliasMap, err = s.getNoSet(ctx, uid, &convID, chat1.EmojiFetchOpts{
				GetCreationInfo: false,
				GetAliases:      true,
				OnlyInTeam:      false,
			})
			if err != nil {
				s.Debug(ctx, "Harvest: failed to get emojis: %s", err)
				return res, err
			}
		}
	case types.EmojiHarvestModeFast:
		// skip this, just use alias map in fast mode
	}
	if len(aliasMap) == 0 {
		return nil, nil
	}
	s.Debug(ctx, "Harvest: num emojis: alias: %d", len(aliasMap))
	for _, match := range matches {
		// try group map first
		if emoji, ok := aliasMap[match.name]; ok {
			var resEmoji chat1.HarvestedEmoji
			if emoji.IsCrossTeam && shouldSync {
				if resEmoji, err = s.syncCrossTeam(ctx, uid, chat1.HarvestedEmoji{
					Alias:  match.name,
					Source: emoji.RemoteSource,
				}, convID); err != nil {
					s.Debug(ctx, "Harvest: failed to sync cross team: %s", err)
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
		}
	}
	return res, nil
}

func (s *DevConvEmojiSource) Decorate(ctx context.Context, body string, uid gregor1.UID,
	messageType chat1.MessageType, emojis []chat1.HarvestedEmoji) string {
	if len(emojis) == 0 {
		return body
	}
	matches := s.parse(ctx, body)
	if len(matches) == 0 {
		return body
	}
	bigEmoji := false
	if messageType == chat1.MessageType_TEXT && len(matches) == 1 {
		singleEmoji := matches[0]
		// check if the emoji is the entire message (ignoring whitespace)
		if singleEmoji.position[0] == 0 && singleEmoji.position[1] == len(strings.TrimSpace(body)) {
			bigEmoji = true
		}
	}
	defer s.Trace(ctx, nil, "Decorate")()
	emojiMap := make(map[string]chat1.EmojiRemoteSource, len(emojis))
	for _, emoji := range emojis {
		// If we have conflicts on alias, use the first one. This helps make dealing with reactions
		// better, since we really want the first reaction on an alias to always be displayed.
		if _, ok := emojiMap[emoji.Alias]; !ok {
			emojiMap[emoji.Alias] = emoji.Source
		}
	}
	offset := 0
	added := 0
	isReacji := messageType == chat1.MessageType_REACTION
	for _, match := range matches {
		if remoteSource, ok := emojiMap[match.name]; ok {
			source, noAnimSource, err := s.RemoteToLocalSource(ctx, uid, remoteSource)
			if err != nil {
				s.Debug(ctx, "Decorate: failed to get local source: %s", err)
				continue
			}
			typ, err := source.Typ()
			if err != nil {
				s.Debug(ctx, "Decorate: failed to get load source type: %s", err)
				continue
			}
			if typ == chat1.EmojiLoadSourceTyp_STR {
				// Instead of decorating aliases, just replace them with the alias string
				strDecoration := source.Str()
				length := match.position[1] - match.position[0]
				added := len(strDecoration) - length
				decorationOffset := match.position[0] + offset
				body = fmt.Sprintf("%s%s%s", body[:decorationOffset], strDecoration,
					body[decorationOffset+length:])
				offset += added
				continue
			}

			body, added = utils.DecorateBody(ctx, body, match.position[0]+offset,
				match.position[1]-match.position[0],
				chat1.NewUITextDecorationWithEmoji(chat1.Emoji{
					IsBig:        bigEmoji,
					IsReacji:     isReacji,
					Alias:        match.name,
					Source:       source,
					NoAnimSource: noAnimSource,
					IsAlias:      remoteSource.IsAlias(),
				}))
			offset += added
		}
	}
	return body
}

func (s *DevConvEmojiSource) IsValidSize(size int64) bool {
	return size <= maxEmojiSize && size >= minEmojiSize
}
