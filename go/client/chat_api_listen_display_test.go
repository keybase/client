package client

import (
	"testing"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/stretchr/testify/require"
)

func TestApiListenFiltersForTeam(t *testing.T) {
	uiItem := &chat1.InboxUIItem{
		Name:        "keybase",
		MembersType: chat1.ConversationMembersType_TEAM,
		TopicType:   chat1.TopicType_CHAT,
		Channel:     "general",
		IsPublic:    false,
	}

	d := chatNotificationDisplay{}
	// Chat display with no filters should match any conv.
	require.True(t, d.matchFilters(uiItem))

	// By default ChatChannel filter is for non-team convs, so the uiItem won't
	// match here because we look for `keybase` the user chat. Note that such
	// filter wouldn't pass validation because command looks for user
	// conversations with that display name first.
	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "keybase"}}
	require.False(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "keybase", MembersType: "TEAM"}}
	require.True(t, d.matchFilters(uiItem))

	// We only want #desktop channel now, should not match.
	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "keybase", MembersType: "TEAM", TopicName: "desktop"}}
	require.False(t, d.matchFilters(uiItem))

	// If any of the ChatChannels match, message is passed through.
	d.filtersNormalized = []ChatChannel{
		ChatChannel{Name: "keybase", MembersType: "TEAM", TopicName: "desktop"},
		ChatChannel{Name: "keybase", MembersType: "TEAM", TopicName: "general"},
	}
	require.True(t, d.matchFilters(uiItem))

	// If none match, message is dropped.
	d.filtersNormalized = []ChatChannel{
		ChatChannel{Name: "keybase.devops", MembersType: "TEAM", TopicName: "serverless"},
		ChatChannel{Name: "keybase.devops", MembersType: "TEAM", TopicName: "general"},
	}
	require.False(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "keybase.devops", MembersType: "TEAM"}}
	require.False(t, d.matchFilters(uiItem))
}

func TestApiListenFiltersForUsers(t *testing.T) {
	uiItem := &chat1.InboxUIItem{
		Name:        "alice,bob",
		IsPublic:    false,
		MembersType: chat1.ConversationMembersType_IMPTEAMNATIVE,
		TopicType:   chat1.TopicType_CHAT,
	}

	d := chatNotificationDisplay{}
	// Chat display with no filters should match any conv.
	require.True(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "keybase", MembersType: "TEAM"}}
	require.False(t, d.matchFilters(uiItem))

	// Note: Name has to be a normalized display name for this to work, but
	// this is done by the command when chat notification listened is
	// initialized.
	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "alice,bob"}}
	require.True(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "bob,alice"}} // incorrect display name - not `matchFilters` fault.
	require.False(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "alice,bob", TopicType: "DEV"}}
	require.False(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "alice,bob", MembersType: "IMPTEAMNATIVE"}}
	require.True(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{ChatChannel{Name: "alice,bob", MembersType: "IMPTEAMUPGRADE"}}
	require.False(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{
		ChatChannel{Name: "alice,bob", MembersType: "IMPTEAMNATIVE"},
		ChatChannel{Name: "keybase", MembersType: "TEAM"},
	}
	require.True(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{
		ChatChannel{Name: "keybase", MembersType: "TEAM"},
		ChatChannel{Name: "alice,bob"},
	}
	require.True(t, d.matchFilters(uiItem))

	d.filtersNormalized = []ChatChannel{
		ChatChannel{Name: "alice,bob", MembersType: "IMPTEAMNATIVE"},
		ChatChannel{Name: "alice,bob", MembersType: "IMPTEAMUPGRADE"},
	}
	require.True(t, d.matchFilters(uiItem))
}
