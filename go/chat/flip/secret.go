package flip

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"sort"

	chat1 "github.com/keybase/client/go/protocol/chat1"
	gregor1 "github.com/keybase/client/go/protocol/gregor1"
)

func (s *Secret) XOR(t Secret) *Secret {
	for i, b := range t {
		s[i] = b ^ s[i]
	}
	return s
}

func (s Secret) IsNil() bool {
	return bytesAreNil(s[:])
}

func bytesAreNil(v []byte) bool {
	for _, b := range v[:] {
		if b != byte(0) {
			return false
		}
	}
	return true
}

func (s Secret) Hash() Secret {
	h := sha256.New()
	h.Write(s[:])
	tmp := h.Sum(nil)
	var ret Secret
	copy(ret[:], tmp[:])
	return ret
}

func (s Secret) Eq(t Secret) bool {
	return hmac.Equal(s[:], t[:])
}

type CommitmentPayload struct {
	_struct bool                 `codec:",toarray"`
	V       Version              `codec:"v" json:"v"`
	U       gregor1.UID          `codec:"u" json:"u"`
	D       gregor1.DeviceID     `codec:"d" json:"d"`
	C       chat1.ConversationID `codec:"c" json:"c"`
	G       chat1.FlipGameID     `codec:"i" json:"i"`
	S       Time                 `codec:"s" json:"s"`
}

func (s Secret) computeCommitment(cp CommitmentPayload) (Commitment, error) {
	var ret Commitment
	hm := hmac.New(sha256.New, s[:])
	raw, err := msgpackEncode(cp)
	if err != nil {
		return ret, err
	}
	hm.Write(raw)
	tmp := hm.Sum(nil)
	copy(ret[:], tmp)
	return ret, nil
}

func (c Commitment) Eq(d Commitment) bool {
	return hmac.Equal(c[:], d[:])
}

func GenerateSecret() Secret {
	var ret Secret
	n, err := rand.Read(ret[:])
	if n != len(ret) {
		panic("failed to generate secret; short random read")
	}
	if err != nil {
		panic(fmt.Sprintf("failed to generated secret: %s", err.Error()))
	}
	return ret
}

func checkUserDeviceCommitments(v []UserDeviceCommitment) bool {
	for i := 1; i < len(v); i++ {
		if !v[i-1].Ud.LessThan(v[i].Ud) {
			return false
		}
	}
	return true
}

func sortUserDeviceCommitments(v []UserDeviceCommitment) {
	if !checkUserDeviceCommitments(v) {
		sort.Slice(v, func(i, j int) bool { return v[i].Ud.LessThan(v[j].Ud) })
	}
}

func hashUserDeviceCommitments(v []UserDeviceCommitment) (Hash, error) {
	var ret Hash
	sortUserDeviceCommitments(v)
	raw, err := msgpackEncode(v)
	if err != nil {
		return ret, err
	}
	h := sha256.New()
	h.Write(raw)
	tmp := h.Sum(nil)
	copy(ret[:], tmp[:])
	return ret, nil
}
