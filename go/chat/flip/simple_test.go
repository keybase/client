package flip

import (
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
)

func makeTestSecret(b byte) Secret {
	var ret Secret
	ret[1] = 0xee
	ret[0] = b
	return ret
}

func makeTestPlayer(t *testing.T, cp CommitmentPayload, b byte) PlayerState {
	s := makeTestSecret(b)
	c, err := s.computeCommitment(cp)
	require.NoError(t, err)
	return PlayerState{
		Player:     Player(fmt.Sprintf("u%d", b)),
		Commitment: &c,
		Reveal:     s,
	}
}

func TestFlip(t *testing.T) {
	var players []PlayerState
	cp := CommitmentPayload{}
	for i := 1; i < 20; i++ {
		players = append(players, makeTestPlayer(t, cp, byte(i)))
	}
	i, err := FlipInt(cp, players, int64(10033))
	require.NoError(t, err)
	require.Equal(t, i, int64(6265))
}
