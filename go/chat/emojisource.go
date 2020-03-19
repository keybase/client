package chat

import (
	"context"
	"errors"
	"regexp"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type DevConvEmojiSource struct {
	globals.Contextified
	utils.DebugLabeler
	ri func() chat1.RemoteInterface
}

var _ types.EmojiSource = (*DevConvEmojiSource)(nil)

func NewDevConvEmojiSource(g *globals.Context, ri func() chat1.RemoteInterface) *DevConvEmojiSource {
	return &DevConvEmojiSource{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "DevConvEmojiSource", false),
		ri:           ri,
	}
}

func (s *DevConvEmojiSource) makeStorage() types.ConvConversationBackedStorage {
	return NewConvDevConversationBackedStorage(s.G(), chat1.TopicType_EMOJI, true, s.ri)
}

func (s *DevConvEmojiSource) topicName() string {
	return "emojis"
}

func (s *DevConvEmojiSource) Add(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	alias, filename string) (err error) {
	defer s.Trace(ctx, func() error { return err }, "Add")()
	var stored chat1.EmojiStorage
	storage := s.makeStorage()
	_, storageConv, err := storage.Get(ctx, uid, convID, s.topicName(), &stored, true)
	if err != nil {
		return err
	}
	if stored.Mapping == nil {
		stored.Mapping = make(map[string]chat1.EmojiRemoteSource)
	}
	sender := NewBlockingSender(s.G(), NewBoxer(s.G()), s.ri)
	_, msgID, err := attachments.NewSender(s.G()).PostFileAttachment(ctx, sender, uid,
		storageConv.GetConvID(), storageConv.Info.TlfName, keybase1.TLFVisibility_PRIVATE, nil, filename,
		"", nil, 0, nil, nil)
	if err != nil {
		return err
	}
	if msgID == nil {
		return errors.New("no messageID from attachment")
	}
	stored.Mapping[alias] = chat1.NewEmojiRemoteSourceWithMessage(chat1.EmojiMessage{
		ConvID: storageConv.GetConvID(),
		MsgID:  *msgID,
	})
	return storage.Put(ctx, uid, convID, s.topicName(), stored)
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
	default:
		return res, errors.New("unknown remote source")
	}
}

func (s *DevConvEmojiSource) Get(ctx context.Context, uid gregor1.UID, convID *chat1.ConversationID) (res chat1.UserEmojis, err error) {
	defer s.Trace(ctx, func() error { return err }, "Get")()
	storage := s.makeStorage()
	topicType := chat1.TopicType_EMOJI
	var nq *chat1.NameQuery
	if convID != nil {
		conv, err := utils.GetUnverifiedConv(ctx, s.G(), uid, *convID, types.InboxSourceDataSourceAll)
		if err != nil {
			return res, err
		}
		nq = new(chat1.NameQuery)
		nq.TlfID = &conv.Conv.Metadata.IdTriple.Tlfid
	}
	ibox, _, err := s.G().InboxSource.Read(ctx, uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, &chat1.GetInboxLocalQuery{
			Name:         nq,
			TopicType:    &topicType,
			MemberStatus: chat1.AllConversationMemberStatuses(),
		})
	if err != nil {
		return res, err
	}
	convs := ibox.Convs
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
			source, err := s.remoteToLocalSource(ctx, storedEmoji)
			if err != nil {
				s.Debug(ctx, "Get: skipping emoji on remote-to-local error: %s", err)
				continue
			}
			group.Emojis = append(group.Emojis, chat1.Emoji{
				Alias:        alias,
				Source:       source,
				RemoteSource: storedEmoji,
			})
		}
		res.Emojis = append(res.Emojis, group)
	}
	return res, nil
}

var emojiPattern = regexp.MustCompile(`(?::)([^:\s]+)(?::)`)

type emojiMatch struct {
	name     string
	position []int
}

func (s *DevConvEmojiSource) parse(ctx context.Context, body string) (res []emojiMatch) {
	hits := emojiPattern.FindAllStringSubmatchIndex(body, -1)
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

func (s *DevConvEmojiSource) Harvest(ctx context.Context, body string, uid gregor1.UID,
	convID chat1.ConversationID) (res []chat1.HarvestedEmoji, err error) {
	matches := s.parse(ctx, body)
	if len(matches) == 0 {
		return nil, nil
	}
	defer s.Trace(ctx, func() error { return err }, "Harvest")()
	s.Debug(ctx, "Harvest: %d matches found", len(matches))
	emojis, err := s.Get(ctx, uid, &convID)
	if err != nil {
		return res, err
	}
	if len(emojis.Emojis) == 0 {
		return nil, nil
	}
	group := emojis.Emojis[0] // only consider the first hit
	s.Debug(ctx, "Harvest: using %d emojis to search for matches", len(group.Emojis))
	emojiMap := make(map[string]chat1.EmojiRemoteSource, len(group.Emojis))
	for _, emoji := range group.Emojis {
		emojiMap[emoji.Alias] = emoji.RemoteSource
	}
	for _, match := range matches {
		if source, ok := emojiMap[match.name]; ok {
			res = append(res, chat1.HarvestedEmoji{
				Alias:  match.name,
				Source: source,
			})
		}
	}
	return res, nil
}

func (s *DevConvEmojiSource) Decorate(ctx context.Context, body string, convID chat1.ConversationID,
	emojis []chat1.HarvestedEmoji) string {
	if len(emojis) == 0 {
		return body
	}
	matches := s.parse(ctx, body)
	if len(matches) == 0 {
		return body
	}
	defer s.Trace(ctx, func() error { return nil }, "Decorate")()
	emojiMap := make(map[string]chat1.EmojiRemoteSource, len(emojis))
	for _, emoji := range emojis {
		emojiMap[emoji.Alias] = emoji.Source
	}
	offset := 0
	added := 0
	for _, match := range matches {
		if source, ok := emojiMap[match.name]; ok {
			localSource, err := s.remoteToLocalSource(ctx, source)
			if err != nil {
				s.Debug(ctx, "Decorate: failed to get local source: %s", err)
				continue
			}
			body, added = utils.DecorateBody(ctx, body, match.position[0]+offset,
				match.position[1]-match.position[0],
				chat1.NewUITextDecorationWithEmoji(chat1.Emoji{
					Alias:  match.name,
					Source: localSource,
				}))
			offset += added
		}
	}
	return body
}
