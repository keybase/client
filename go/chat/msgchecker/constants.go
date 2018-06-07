package msgchecker

const (
	TextMessageMaxLength     = 10000
	ReactionMessageMaxLength = 50
	HeadlineMaxLength        = 280
	TopicMaxLength           = 20
)

const (
	BoxedTextMessageBodyMaxLength          = 11000
	BoxedEditMessageBodyMaxLength          = 11000
	BoxedReactionMessageBodyMaxLength      = 150
	BoxedHeadlineMessageBodyMaxLength      = 380
	BoxedMetadataMessageBodyMaxLength      = 200
	BoxedJoinMessageBodyMaxLength          = 200
	BoxedLeaveMessageBodyMaxLength         = 200
	BoxedSystemMessageBodyMaxLength        = 5000
	BoxedDeleteHistoryMessageBodyMaxLength = 200
)
