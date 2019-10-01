package blindtree

import (
	"fmt"
	"testing"

	"github.com/keybase/client/go/msgpack"

	"github.com/keybase/client/go/protocol/keybase1"

	"github.com/stretchr/testify/require"
)

func TestEncodeMerkleValues(t *testing.T) {
	fakeTail := Teamv1HiddenTail([32]byte{0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04})
	fakeTeamValue := Teamv1Value{
		Tails: map[keybase1.SeqType]Teamv1HiddenTail{keybase1.SeqType_TEAM_PRIVATE_HIDDEN: fakeTail},
	}

	encodingTests := []struct {
		Value        interface{}
		EncodedValue BlindMerkleValue
		Type         BlindMerkleValueType
	}{
		{"Ciao", BlindMerkleValueStringForTesting("Ciao"), ValueTypeStringForTesting},
		{"Bong", BlindMerkleValueStringForTesting("Bong"), ValueTypeStringForTesting},
		{"", BlindMerkleValueStringForTesting(""), ValueTypeStringForTesting},
		{fakeTeamValue, BlindMerkleValueTeamV1(fakeTeamValue), ValueTypeTeamV1},
	}

	for _, et := range encodingTests {
		t.Run(fmt.Sprintf("%v", et.Value), func(t *testing.T) {
			require.Equal(t, et.EncodedValue.ValueType, et.Type)
			require.EqualValues(t, et.Value, et.EncodedValue.InnerValue)

			enc, err := msgpack.EncodeCanonical(et.EncodedValue)
			require.NoError(t, err)
			t.Logf("Encoded: %X", enc)

			var dec BlindMerkleValue
			err = msgpack.Decode(&dec, enc)
			require.NoError(t, err)
			require.Equal(t, et.Type, dec.ValueType)

			switch et.Type {
			case ValueTypeStringForTesting:
				s, ok := dec.InnerValue.(string)
				require.True(t, ok, "Got type %T", dec.InnerValue)
				require.EqualValues(t, et.Value, s)
			case ValueTypeTeamV1:
				s, ok := dec.InnerValue.(Teamv1Value)
				require.True(t, ok, "Got type %T", dec.InnerValue)
				require.EqualValues(t, et.Value, s)
			default:
				t.Errorf("The test does not suppor type %v", et.Type)
			}
		})
	}
}
