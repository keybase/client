package emom

import (
	emom1 "github.com/keybase/client/go/protocol/emom1"
)

type waiter struct {
	seqno  emom1.Seqno
	doneCh chan<- error
}

type Sequencer struct {
	waitCh chan waiter
	seqno  emom1.Seqno
	slots  map[emom1.Seqno]waiter
}

func NewSequencer() *Sequencer {
	ret := &Sequencer{
		waitCh: make(chan waiter),
	}
	go ret.loop()
	return ret
}

func (s *Sequencer) loop() {

}

func (s *Sequencer) Wait(seqno emom1.Seqno) error {
	doneCh := make(chan error)
	s.waitCh <- waiter{seqno, doneCh}
	return <-doneCh
}
