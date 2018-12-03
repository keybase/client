package stellar

import (
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/stellar/go/xdr"
)

// SeqnoProvider implements build.SequenceProvider.  It is intended as a one-shot
// wrapper and shouldn't be reused after the transaction is built.
type SeqnoProvider struct {
	mctx      libkb.MetaContext
	remoter   remote.Remoter
	overrides map[string]xdr.SequenceNumber
}

// NewSeqnoProvider creates a SeqnoProvider.
func NewSeqnoProvider(mctx libkb.MetaContext, remoter remote.Remoter) *SeqnoProvider {
	return &SeqnoProvider{
		mctx:      mctx,
		remoter:   remoter,
		overrides: make(map[string]xdr.SequenceNumber),
	}
}

// SequenceForAccount implements build.SequenceProvider.
func (s *SeqnoProvider) SequenceForAccount(aid string) (xdr.SequenceNumber, error) {
	if seqno, ok := s.overrides[aid]; ok {
		s.mctx.CDebugf("SeqnoProvider.SequenceForAccount(%v) -> override %v", aid, seqno)
		return seqno, nil
	}
	seqno, err := s.remoter.AccountSeqno(s.mctx.Ctx(), stellar1.AccountID(aid))
	if err != nil {
		return 0, err
	}
	s.mctx.CDebugf("SeqnoProvider.SequenceForAccount(%v) -> live %v", aid, seqno)
	return xdr.SequenceNumber(seqno), nil
}

func (s *SeqnoProvider) Override(aid string, seqno xdr.SequenceNumber) {
	s.overrides[aid] = seqno
}

// FastSeqnoProvider implements build.SequenceProvider.  It is intended
// to be used for several transactions in a row.
type FastSeqnoProvider struct {
	mctx             libkb.MetaContext
	remoter          remote.Remoter
	fetchedAccountID stellar1.AccountID
	seqno            uint64
	sync.Mutex
}

// NewFastSeqnoProvider creates a FastSeqnoProvider.
func NewFastSeqnoProvider(mctx libkb.MetaContext, remoter remote.Remoter) *FastSeqnoProvider {
	return &FastSeqnoProvider{
		mctx:    mctx,
		remoter: remoter,
	}
}

// SequenceForAccount implements build.SequenceProvider.
func (s *FastSeqnoProvider) SequenceForAccount(aid string) (xdr.SequenceNumber, error) {
	s.Lock()
	defer s.Unlock()
	if s.fetchedAccountID == "" {
		s.mctx.CDebugf("FastSeqnoProvider.SequenceForAccount(%v) -> fetching from network", aid)
		seqno, err := s.remoter.AccountSeqno(s.mctx.Ctx(), stellar1.AccountID(aid))
		if err != nil {
			return 0, err
		}
		s.fetchedAccountID = stellar1.AccountID(aid)
		s.seqno = seqno
	} else if stellar1.AccountID(aid) == s.fetchedAccountID {
		s.mctx.CDebugf("FastSeqnoProvider.SequenceForAccount(%v) -> bumping seqno", aid)
		s.seqno++
	} else {
		return 0, fmt.Errorf("invalid subsequent accountID %s (expected %s)", aid, s.fetchedAccountID)
	}

	s.mctx.CDebugf("FastSeqnoProvider.SequenceForAccount(%s) -> %d", aid, s.seqno)

	return xdr.SequenceNumber(s.seqno), nil
}
