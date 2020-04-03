package teambot

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
)

const (
	minRank    = 0
	maxRank    = 10000
	rankWeight = 3
)

type rankedSearchItem struct {
	item  keybase1.FeaturedBot
	score float64
}

func (i rankedSearchItem) String() string {
	return fmt.Sprintf(
		"Bot Alias: %s Rank: %d IsPromoted: %v Score: %.2f Description: %s ",
		i.item.BotAlias, i.item.Rank, i.item.IsPromoted,
		i.score, i.item.Description)
}

func filterScore(score float64) bool {
	return score-.0001 < 0
}

func normalizeRank(rank int) float64 {
	if rank < minRank {
		return 0
	} else if rank > maxRank {
		return 1
	}
	return float64(rank) / float64(minRank-maxRank)
}

func scoreName(name, qtok string) (score float64) {
	name = strings.ToLower(name)
	if qtok == name || strings.HasPrefix(name, qtok) || strings.HasSuffix(name, qtok) {
		score += 1000
	} else if strings.Contains(name, qtok) {
		score += 100
	}
	return score
}

func scoreDescription(desc, qtok string) (score float64) {
	desc = strings.ToLower(desc)
	for _, dtok := range strings.Split(desc, " ") {
		if dtok == qtok {
			score += 25
		}
	}
	return score
}

func scoreItemFromQuery(query string, item keybase1.FeaturedBot) (score float64) {
	if !item.IsPromoted {
		return 0
	}
	for _, qtok := range strings.Split(query, " ") {
		score += scoreName(item.BotAlias, qtok)
		score += scoreName(item.BotUsername, qtok)
		score += scoreDescription(item.Description, qtok)
		score += scoreDescription(item.ExtendedDescription, qtok)
	}
	if filterScore(score) {
		return score
	}
	return score + normalizeRank(item.Rank)*rankWeight
}
