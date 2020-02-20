package sigid

import (
	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

func ComputeSigBodyAndID(sigInfo *kbcrypto.NaclSigInfo, clientName string, clientVersion string) (body []byte, sigID keybase1.SigID, err error) {
	return nil, sigID, nil
}
