package libkb

import (
	"fmt"
	"os"
	"sync"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// Pegboard keeps track of automatic private follows.
// When the logged-in user interacts with another user, that other user
// gets pegged to their incarnation. After the target resets,
// the logged-in user will be alerted even if there's no explicit folowing.
// CORE-10522 For now, pegboard is disabled by default and when enabled
//            only has in-memory storage.
type Pegboard struct {
	mu      sync.Mutex
	enabled bool
	store   map[keybase1.UID]Peg
	// CORE-10522 The eventual plan is to store pegs in user's private sigchain
	//            or just leveldb. With an lru in front.
}

// CORE-10522 When a peg breaks, the chat UI of "Let them in" doesn't make sense.

// CORE-10522 In chat only impteam convs are handled. Have to figure out story for KBFS convs.

// CORE-10522 In addition to chat, KBFS might should also use pegs.

// CORE-10522 Looking at a profile should call ObserveUV.

func NewPegboard() *Pegboard {
	return &Pegboard{
		enabled: os.Getenv("KEYBASE_EXPERIMENT_PEGBOARD") == "1",
		store:   make(map[keybase1.UID]Peg),
	}
}

type Peg struct {
	UID         keybase1.UID
	EldestSeqno keybase1.Seqno
	// CORE-10522 Seqno may not be enough. Consider pegging LinkID.
}

// Update a peg.
// The logged-in user has purposefully interacted with this version of the user.
func (p *Pegboard) TrackUPAK(mctx MetaContext, upak keybase1.UserPlusKeysV2) (err error) {
	if !p.enabled {
		return nil
	}
	defer mctx.Trace("Pegboard.TrackUPAK", func() error { return err })()
	p.mu.Lock()
	defer p.mu.Unlock()
	if peg, ok := p.store[upak.Uid]; ok && peg.EldestSeqno != 0 && upak.EldestSeqno != 0 && upak.EldestSeqno < peg.EldestSeqno {
		// User is already tracked. But at a newer version than the argument.
		// CORE-10522 check with explicit local and remote follows?
		return fmt.Errorf("Cannot update to older version of user: %v %v < %v", upak.Uid, upak.EldestSeqno, peg.EldestSeqno)
	}
	p.store[upak.Uid] = Peg{
		UID:         upak.Uid,
		EldestSeqno: upak.EldestSeqno,
	}
	return nil
}

// Returns an error if this user has reset since their peg was last udpated.
// Pegs users that haven't been seen before.
func (p *Pegboard) CheckUV(mctx MetaContext, uv keybase1.UserVersion) error {
	return p.checkUV(mctx, uv)
}

// Pegs users that haven't been seen before.
func (p *Pegboard) ObserveUV(mctx MetaContext, uv keybase1.UserVersion) {
	_ = p.checkUV(mctx, uv)
}

func (p *Pegboard) checkUV(mctx MetaContext, uv keybase1.UserVersion) error {
	if !p.enabled {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if peg, ok := p.store[uv.Uid]; ok {
		// This uid has been seen before.
		if peg.EldestSeqno == 0 {
			// Track the new version.
			p.store[uv.Uid] = Peg{
				UID:         uv.Uid,
				EldestSeqno: uv.EldestSeqno,
			}
		} else {
			if uv.EldestSeqno != peg.EldestSeqno {
				return fmt.Errorf("User version does not match peg %v != %v", uv.EldestSeqno, peg.EldestSeqno)
			}
		}
	} else {
		// First time seeing this uid.
		p.store[uv.Uid] = Peg{
			UID:         uv.Uid,
			EldestSeqno: uv.EldestSeqno,
		}
	}
	return nil
}

func (p *Pegboard) OnLogout(mctx MetaContext) {
	if !p.enabled {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.store = make(map[keybase1.UID]Peg)
}
