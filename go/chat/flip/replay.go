package flip

import (
	"context"
	"io"
	"time"
)

type GameMessageReplayed struct {
	GameMessageWrappedEncoded
	Time time.Time
}

type GameHistory []GameMessageReplayed

type GameHistoryPlayer struct {
	Device     UserDevice
	Commitment Commitment
	Reveal     *Secret
}

type GameSummary struct {
	Err     error
	Players []GameHistoryPlayer
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

	if !first.FirstInConversation {
		return nil, nil, GameReplayError{md.GameID}
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
		commitments:  make(map[string]bool),
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
		players := make(map[UserDeviceKey]*GameHistoryPlayer)
		for msg := range game.gameUpdateCh {
			switch {
			case msg.Err != nil:
				ret.Err = msg.Err
			case msg.CommitmentComplete != nil:
				for _, p := range msg.CommitmentComplete.Players {
					ret.Players = append(ret.Players, GameHistoryPlayer{
						Device:     p.Ud,
						Commitment: p.C,
					})
				}
				for index, p := range ret.Players {
					players[p.Device.ToKey()] = &ret.Players[index]
				}
			case msg.Reveal != nil:
				if p, ok := players[msg.Reveal.User.ToKey()]; ok {
					p.Reveal = &msg.Reveal.Reveal
					delete(players, msg.Reveal.User.ToKey())
				}
			case msg.Result != nil:
				ret.Result = *msg.Result
				found = true
			}
		}
		if !found && ret.Err == nil {
			var absentees []UserDevice
			for _, v := range players {
				absentees = append(absentees, v.Device)
			}
			var err error
			if len(absentees) > 0 {
				err = AbsenteesError{Absentees: absentees}
			} else {
				err = GameAbortedError{}
			}
			ret.Err = err
		}
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
