package emom

import (
	"errors"
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
	for waiter := range s.waitCh {
		if _, found := s.slots[waiter.seqno]; found {
			waiter.doneCh <- errors.New("seqno already waiting in queue")
			continue
		}
		s.slots[waiter.seqno] = waiter
		if waiter, found := s.slots[s.seqno]; found {
			delete(s.slots, s.seqno)
			s.seqno++
			waiter.doneCh <- nil
		}
	}

}

func (s *Sequencer) Wait(seqno emom1.Seqno) error {
	doneCh := make(chan error)
	s.waitCh <- waiter{seqno, doneCh}
	return <-doneCh
}
