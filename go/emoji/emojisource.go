package emoji

import (
	"context"
	"errors"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type DevConvEmojiSource struct {
	globals.Contextified
	utils.DebugLabeler
	ri func() chat1.RemoteInterface
}

var _ types.EmojiSource = (*DevConvEmojiSource)(nil)

func NewEmojiSource(g *globals.Context, ri func() chat1.RemoteInterface) *DevConvEmojiSource {
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
	alias, filename string) error {
	var stored chat1.EmojiStorage
	storage := s.makeStorage()
	_, err := storage.Get(ctx, uid, convID, s.topicName(), &storage)
	if err != nil {
		return err
	}
	// TODO: fill in actual attachment here
	stored.Mapping[alias] = chat1.NewEmojiRemoteSourceWithMessage(0)
	return storage.Put(ctx, uid, convID, s.topicName(), stored)
}

func (s *DevConvEmojiSource) remoteToLocalSource(ctx context.Context, convID chat1.ConversationID,
	remote chat1.EmojiRemoteSource) (res chat1.EmojiLoadSource, err error) {
	typ, err := remote.Typ()
	if err != nil {
		return res, err
	}
	switch typ {
	case chat1.EmojiRemoteSourceTyp_MESSAGE:
		url := s.G().AttachmentURLSrv.GetURL(ctx, convID, remote.Message(), false)
		return chat1.NewEmojiLoadSourceWithHttpsrv(url), nil
	default:
		return res, errors.New("unknown remote source")
	}
}

func (s *DevConvEmojiSource) Get(ctx context.Context, uid gregor1.UID) (res chat1.UserEmojis, err error) {
	storage := s.makeStorage()
	topicType := chat1.TopicType_EMOJI
	ibox, err := s.G().InboxSource.Read(ctx, uid, types.InboxSourceDataSourceAll,
		&chat1.GetInboxQueryLocal{
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
			return res, err
		}
		if !found {
			s.Debug(ctx, "Get: no stored info for: %s", conv.GetConvID())
			continue
		}
		group := chat1.EmojiGroup{
			Name: conv.Info.TlfName,
		}
		for alias, storedEmoji := range stored.Mapping {
			source, err := s.remoteToLocalSource(ctx, conv.GetConvID(), storedEmoji)
			if err != nil {
				s.Debug(ctx, "Get: skipping emoji on remote-to-local error: %s", err)
				continue
			}
			group.Emojis = append(group.Emojis, chat1.Emoji{
				Alias:  alias,
				Source: source,
			})
		}
		res.Emojis = append(res.Emojis, group)
	}
	return res, nil
}

func (s *DevConvEmojiSource) Decorate(ctx context.Context, body string) string {
	// TODO
	return body
}
