package opensearch

import (
	"strings"
	"time"

	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	minScoringMemberCount   = 0
	maxScoringMemberCount   = 100000
	minScoringActivityHours = 7 * 24      // one week
	maxScoringActivityHours = 4 * 30 * 24 // one month
	memberCountWeight       = 400
	lastActiveWeight        = 20
)

func filterScore(score float64) bool {
	return score-.0001 < 0
}

func normalizeMemberCount(memberCount int) float64 {
	if memberCount < minScoringMemberCount {
		return 0
	} else if memberCount > maxScoringMemberCount {
		return 1
	}
	return float64(memberCount) / float64(maxScoringMemberCount-minScoringMemberCount)
}

func normalizeLastActive(lastActive keybase1.Time) float64 {
	hours := time.Since(lastActive.Time()).Hours()
	if hours > maxScoringActivityHours {
		return 0
	} else if hours < minScoringActivityHours {
		return 1
	}
	return 1 - hours/(maxScoringActivityHours-minScoringActivityHours)
}

func scoreItemFromQuery(query string, item keybase1.TeamSearchItem) (score float64) {
	name := strings.ToLower(item.Name)
	// demoted teams require an exact name match to be returned
	if item.IsDemoted && query != name {
		return 0
	}
	for _, qtok := range strings.Split(query, " ") {
		if qtok == name || strings.HasPrefix(name, qtok) || strings.HasSuffix(name, qtok) {
			score += 1000
		} else if strings.Contains(name, qtok) {
			score += 100
		}
		if item.Description != nil {
			desc := strings.ToLower(*item.Description)
			for _, dtok := range strings.Split(desc, " ") {
				if dtok == qtok {
					score += 25
				}
			}
		}
	}
	if filterScore(score) {
		return score
	}
	return score + normalizeMemberCount(item.MemberCount)*memberCountWeight +
		normalizeLastActive(item.LastActive)*lastActiveWeight
}
