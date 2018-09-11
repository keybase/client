package stellar

import (
	"golang.org/x/net/context"

	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/client/go/stellar/remote"
	"github.com/stellar/go/xdr"
)

// SeqnoProvider implements build.SequenceProvider.  It is intended as a one-shot
// wrapper and shouldn't be reused after the transaction is built.
type SeqnoProvider struct {
	ctx       context.Context
	remoter   remote.Remoter
	overrides map[string]xdr.SequenceNumber
}

// NewSeqnoProvider creates a SeqnoProvider.
func NewSeqnoProvider(ctx context.Context, remoter remote.Remoter) *SeqnoProvider {
	return &SeqnoProvider{
		ctx:       ctx,
		remoter:   remoter,
		overrides: make(map[string]xdr.SequenceNumber),
	}
}

// SequenceForAccount implements build.SequenceProvider.
func (s *SeqnoProvider) SequenceForAccount(aid string) (xdr.SequenceNumber, error) {
	if seqno, ok := s.overrides[aid]; ok {
		return seqno, nil
	}
	seqno, err := s.remoter.AccountSeqno(s.ctx, stellar1.AccountID(aid))
	if err != nil {
		return 0, err
	}
	return xdr.SequenceNumber(seqno), nil
}

func (s *SeqnoProvider) Override(aid string, seqno xdr.SequenceNumber) {
	s.overrides[aid] = seqno
}
