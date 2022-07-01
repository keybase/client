package teambot

import (
	"fmt"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/teams/opensearch"
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

func (i rankedSearchItem) Score(query string) (score float64) {
	if !i.item.IsPromoted {
		return 0
	}
	for _, qtok := range strings.Split(query, " ") {
		score += opensearch.ScoreName(i.item.BotAlias, qtok)
		score += opensearch.ScoreName(i.item.BotUsername, qtok)
		score += opensearch.ScoreDescription(i.item.Description, qtok)
		score += opensearch.ScoreDescription(i.item.ExtendedDescription, qtok)
	}
	if opensearch.FilterScore(score) {
		return score
	}
	return score + normalizeRank(i.item.Rank)*rankWeight
}

func (i rankedSearchItem) String() string {
	return fmt.Sprintf(
		"Bot Alias: %s Rank: %d IsPromoted: %v Score: %.2f Description: %s ",
		i.item.BotAlias, i.item.Rank, i.item.IsPromoted,
		i.score, i.item.Description)
}

func normalizeRank(rank int) float64 {
	if rank < minRank {
		return 0
	} else if rank > maxRank {
		return 1
	}
	return float64(rank) / float64(minRank-maxRank)
}
