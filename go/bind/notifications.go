package keybase

type Person struct {
	KeybaseUsername string
	KeybaseAvatar   string
	IsBot           bool
}

type Message struct {
	Id        int
	Kind      string // "Text" | "Reaction"
	Plaintext string
	From      *Person
	At        int64
}

type ChatNotification struct {
	// Ordered from oldest to newest
	Message   *Message
	ConvID    string
	TeamName  string
	TopicName string
	// e.g. "keybase#general, CoolTeam, Susannah,Jake"
	ConversationName    string
	IsGroupConversation bool
	IsPlaintext         bool
	SoundName           string
	BadgeCount          int
}
