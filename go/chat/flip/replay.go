package flip

import (
	"context"
	"io"
	"sort"
	"time"
)

type GameMessageReplayed struct {
	GameMessageWrappedEncoded
	Time time.Time
}

type GameHistory []GameMessageReplayed

type PlayerSummary struct {
	Player UserDevice
	Commitment Commitment
	Secret *Secret
}

type GameSummary struct {
	Err     error
	Players []PlayerSummary
	Result  Result
}

func (g GameHistory) start(rh ReplayHelper) (game *Game, rest GameHistory, err error) {
	if len(g) == 0 {
		return nil, nil, NewReplayError("cannot reply 0-length game")
	}
	first := &g[0]
	rest = g[1:]
	gmw, err := first.Decode()
	if err != nil {
		return nil, nil, err
	}
	t, err := gmw.Msg.Body.T()
	if err != nil {
		return nil, nil, err
	}
	if t != MessageType_START {
		return nil, nil, NewReplayError("expected first message to be of type START")
	}
	start := gmw.Msg.Body.Start()

	md := gmw.Msg.Md
	if !md.Initiator.Eq(gmw.Sender) {
		return nil, nil, NewReplayError("bad initiator; didn't match sender")
	}

	_, err = computeClockSkew(md, first.Time, start.StartTime.Time(), first.Time)
	if err != nil {
		return nil, nil, err
	}

	game = &Game{
		md:           md,
		isLeader:     false,
		start:        first.Time,
		key:          md.ToKey(),
		params:       start,
		gameUpdateCh: make(chan GameStateUpdateMessage),
		players:      make(map[UserDeviceKey]*GamePlayerState),
		stage:        Stage_ROUND1,
		clogf:        rh.CLogf,
	}

	return game, rest, nil
}

func runReplayLoop(ctx context.Context, game *Game, gh GameHistory) (err error) {
	for _, m := range gh {
		gmw, err := m.GameMessageWrappedEncoded.Decode()
		if err != nil {
			return err
		}
		err = game.handleMessage(ctx, gmw, m.Time)
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func extractUserDevices(v []UserDeviceCommitment) []UserDevice {
	ret := make([]UserDevice, len(v))
	for i, e := range v {
		ret[i] = e.Ud
	}
	return ret
}

func Replay(ctx context.Context, rh ReplayHelper, gh GameHistory) (*GameSummary, error) {
	ret, err := replay(ctx, rh, gh)
	if err != nil {
		rh.CLogf(ctx, "Replay failure (%s); game dump: %+v", err, gh)
	}
	return ret, err
}

func replay(ctx context.Context, rh ReplayHelper, gh GameHistory) (*GameSummary, error) {

	var game *Game
	var err error
	game, gh, err = gh.start(rh)
	if err != nil {
		return nil, err
	}

	errCh := make(chan error)
	go func() {
		err := runReplayLoop(ctx, game, gh)
		close(game.gameUpdateCh)
		errCh <- err
	}()

	summaryCh := make(chan GameSummary)
	go func() {
		var ret GameSummary
		found := false
		players := make(map[UserDeviceKey]*PlayerSummary)
		for msg := range game.gameUpdateCh {
			switch {
			case msg.Err != nil:
				ret.Err = msg.Err
			case msg.CommitmentComplete != nil:
				for _, p := range msg.CommitmentComplete.Players {
					players[p.Ud.ToKey()] = &PlayerSummary{
						Player: p.Ud,
						Commitment: p.C,
					}
				}
			case msg.Reveal != nil:
				if p := players[msg.Reveal.User.ToKey()]; p != nil {
					p.Secret = &msg.Reveal.Reveal
				}
			case msg.Result != nil:
				ret.Result = *msg.Result
				found = true
			}
		}

		// Error case: we didn't get enough reveals, so we should plumb absentees out to caller
		if !found && ret.Err == nil {
			var ea AbsenteesError
			for _, v := range players {
				if v.Secret == nil {
					ea.Absentees = append(ea.Absentees, v.Player)
				}
			}
			ret.Err = ea
		}

		// Whether success or failure, let's output the players who we found during the replay
		for _, p := range players {
			ret.Players = append(ret.Players, *p)
		}
		sort.Slice(ret.Players, func(i, j int) bool { return ret.Players[i].Player.LessThan(ret.Players[j].Player) })

		summaryCh <- ret
	}()

	err = <-errCh
	if err != nil {
		return nil, err
	}
	ret := <-summaryCh
	if ret.Err != nil {
		return nil, ret.Err
	}

	return &ret, nil
}
