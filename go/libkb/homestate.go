package libkb

import (
	"github.com/keybase/client/go/protocol/keybase1"
)

type HomeTodoMap map[keybase1.HomeScreenTodoType]int
type HomeItemMap map[keybase1.HomeScreenItemType]HomeTodoMap

type HomeStateBody struct {
	Version              int           `json:"version"`
	BadgeCountMap        HomeItemMap   `json:"badge_count_map"`
	LastViewedTime       keybase1.Time `json:"last_viewed_time"`
	AnnouncementsVersion int           `json:"announcements_version"`
}

func (a *HomeStateBody) LessThan(b HomeStateBody) bool {
	if a == nil {
		return true
	}
	if a.Version < b.Version {
		return true
	}
	if a.Version == b.Version && a.LastViewedTime < b.LastViewedTime {
		return true
	}
	if a.AnnouncementsVersion < b.AnnouncementsVersion {
		return true
	}
	return false
}
