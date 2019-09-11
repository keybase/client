package sig3

import (
	"encoding/hex"
	"fmt"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func (p PerTeamKey) Export(q keybase1.Seqno) keybase1.PerTeamKeyAndCheck {
	return keybase1.PerTeamKeyAndCheck{
		Ptk: keybase1.PerTeamKey{
			Gen:    p.Generation,
			Seqno:  q,
			SigKID: p.SigningKID.ToKID(),
			EncKID: p.EncryptionKID.ToKID(),
		},
		Check: p.SeedCheck,
	}
}

func (l *LinkID) Export() keybase1.LinkID {
	if l == nil {
		return keybase1.LinkID("")
	}
	return keybase1.LinkID(hex.EncodeToString(l[:]))
}

func (u UID) Export() keybase1.UID {
	return keybase1.UID(hex.EncodeToString(u[:]))
}

func (r RotateKey) Export() (ret *keybase1.HiddenTeamChainLink, err error) {
	m := make(map[keybase1.PTKType]keybase1.PerTeamKeyAndCheck)
	readerKey := r.ReaderKey()
	if readerKey == nil {
		return nil, fmt.Errorf("cannot export RotateKey, since no known reeader key")
	}

	m[keybase1.PTKType_READER] = readerKey.Export(r.Seqno())
	return &keybase1.HiddenTeamChainLink{
		MerkleRoot:  r.Base.inner.MerkleRoot.Export(),
		ParentChain: r.Base.inner.ParentChain.Export(),
		Signer:      r.Base.inner.Signer.Export(),
		Ptk:         m,
	}, nil
}

func (m MerkleRoot) Export() keybase1.MerkleRootV2 {
	return keybase1.MerkleRootV2{
		Seqno:    m.Seqno,
		HashMeta: m.Hash,
	}
}

func (t Tail) Export() keybase1.LinkTriple {
	return keybase1.LinkTriple{
		Seqno:   t.Seqno,
		SeqType: t.ChainType,
		LinkID:  t.Hash.Export(),
	}
}

func (s Signer) Export() keybase1.Signer {
	return keybase1.Signer{
		E: s.EldestSeqno,
		K: s.KID.ToKID(),
		U: s.UID.Export(),
	}
}

func ExportToPrevLinkTriple(g Generic) keybase1.LinkTriple {
	return keybase1.LinkTriple{
		Seqno:   g.Seqno() - 1,
		SeqType: g.Outer().ChainType,
		LinkID:  g.Prev().Export(),
	}
}

func ImportLinkID(l keybase1.LinkID) (*LinkID, error) {
	if len(l) != 64 {
		return nil, fmt.Errorf("failed to import linkID; wrong length: %d", len(l))
	}
	tmp, err := hex.DecodeString(string(l))
	if err != nil {
		return nil, err
	}
	var ret LinkID
	copy(ret[:], tmp)
	return &ret, nil
}

func ImportTail(l keybase1.LinkTriple) (*Tail, error) {
	hash, err := ImportLinkID(l.LinkID)
	if err != nil {
		return nil, err
	}

	return &Tail{
		Seqno:     l.Seqno,
		ChainType: l.SeqType,
		Hash:      *hash,
	}, nil
}

func ImportUID(u keybase1.UID) (ret UID) {
	tmp := u.ToBytes()
	copy(ret[:], tmp)
	return ret
}

func ImportKID(k keybase1.KID) (ret KID) {
	return k.ToBinaryKID()
}

func ImportTeamID(t keybase1.TeamID) (*TeamID, error) {
	tmp, err := hex.DecodeString(string(t))
	if err != nil {
		return nil, err
	}
	var ret TeamID
	copy(ret[:], tmp)
	return &ret, nil
}
