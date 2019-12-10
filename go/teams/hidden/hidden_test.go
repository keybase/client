package hidden

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/keybase/client/go/blindtree"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/sig3"
)

func TestMakeHiddenRespFromTeamLeaf(t *testing.T) {

	tails := make(map[keybase1.SeqType]sig3.Tail)
	tails[keybase1.SeqType_TEAM_PRIVATE_HIDDEN] = sig3.Tail{ChainType: keybase1.SeqType_TEAM_PRIVATE_HIDDEN}
	testSeqno := keybase1.Seqno(5)

	tests := []struct {
		desc        string
		leaf        blindtree.BlindMerkleValue
		shouldError bool
		errType     libkb.HiddenMerkleErrorType
		respType    libkb.MerkleHiddenResponseType
	}{
		{"Leaf without hidden chain", blindtree.BlindMerkleValueTeamV1(blindtree.TeamV1Value{}), true, libkb.HiddenMerkleErrorNoHiddenChainInLeaf, 0},
		{"wrong leaf type", blindtree.BlindMerkleValue{ValueType: 71}, true, libkb.HiddenMerkleErrorInvalidLeafType, 0},
		{"empty leaf type", blindtree.BlindMerkleValueEmpty(), false, 0, libkb.MerkleHiddenResponseTypeABSENCEPROOF},
		{"valid leaf", blindtree.BlindMerkleValueTeamV1(blindtree.TeamV1Value{
			Tails: map[keybase1.SeqType]sig3.Tail{keybase1.SeqType_TEAM_PRIVATE_HIDDEN: {ChainType: keybase1.SeqType_TEAM_PRIVATE_HIDDEN}},
		}), false, 0, libkb.MerkleHiddenResponseTypeOK},
		{"inconsistent leaf", blindtree.BlindMerkleValueTeamV1(blindtree.TeamV1Value{
			Tails: map[keybase1.SeqType]sig3.Tail{keybase1.SeqType_TEAM_PRIVATE_HIDDEN: {ChainType: keybase1.SeqType_PUBLIC}},
		}), true, libkb.HiddenMerkleErrorInconsistentLeaf, 0},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			hr, err := makeHiddenRespFromTeamLeaf(libkb.MetaContext{}, test.leaf, testSeqno)
			if test.shouldError {
				require.Error(t, err)
				require.IsType(t, libkb.HiddenMerkleError{}, err)
				require.Equal(t, err.(libkb.HiddenMerkleError).ErrorType(), test.errType)
			} else {
				require.NoError(t, err)
				require.Equal(t, test.respType, hr.RespType)
				require.Equal(t, testSeqno, hr.UncommittedSeqno)
				if test.respType == libkb.MerkleHiddenResponseTypeOK {
					require.Equal(t, keybase1.SeqType_TEAM_PRIVATE_HIDDEN, hr.CommittedHiddenTail.ChainType)
				}
			}
		})
	}

}
