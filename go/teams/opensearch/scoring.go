package opensearch

import (
	"fmt"
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

type RankedSearchItem interface {
	Score(query string) float64
	String() string
}

type rankedSearchItem struct {
	item  keybase1.TeamSearchItem
	score float64
}

func (i rankedSearchItem) String() string {
	description := ""
	if i.item.Description != nil {
		description = *i.item.Description
	}
	return fmt.Sprintf(
		"Name: %s Description: %s MemberCount: %d LastActive: %v Score: %.2f isDemoted: %v",
		i.item.Name, description, i.item.MemberCount,
		i.item.LastActive.Time(), i.score, i.item.IsDemoted)
}

func (i rankedSearchItem) Score(query string) (score float64) {
	query = strings.ToLower(query)
	name := strings.ToLower(i.item.Name)
	// demoted teams require an exact name match to be returned
	if i.item.IsDemoted && query != name {
		return 0
	}
	for _, qtok := range strings.Split(query, " ") {
		score += ScoreName(name, qtok)
		if i.item.Description != nil {
			score += ScoreDescription(*i.item.Description, qtok)
		}
	}
	if FilterScore(score) {
		return score
	}
	return score + normalizeMemberCount(i.item.MemberCount)*memberCountWeight +
		normalizeLastActive(i.item.LastActive)*lastActiveWeight
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

func FilterScore(score float64) bool {
	return score-.0001 < 0
}

func ScoreName(name, qtok string) (score float64) {
	name = strings.ToLower(name)
	if qtok == name || strings.HasPrefix(name, qtok) || strings.HasSuffix(name, qtok) {
		score += 1000
	} else if strings.Contains(name, qtok) {
		score += 100
	}
	return score
}

func ScoreDescription(desc, qtok string) (score float64) {
	desc = strings.ToLower(desc)
	for _, dtok := range strings.Split(desc, " ") {
		if dtok == qtok {
			score += 25
		}
	}
	return score
}
