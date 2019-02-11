package flip

import (
	"crypto/hmac"
)

type CommitmentPayload struct {
	_struct bool           `codec:",toarray"`
	V       Version        `codec:"v" json:"v"`
	U       UID            `codec:"u" json:"u"`
	D       DeviceID       `codec:"d" json:"d"`
	C       ConversationID `codec:"c" json:"c"`
	G       GameID         `codec:"i" json:"i"`
	S       Time           `codec:"s" json:"s"`
}

func computeCommitment(s Secret, cp CommitmentPayload) (Commitment, error) {
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
