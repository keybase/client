package sigid

import (
	"encoding/binary"
	"fmt"
	"sort"

	"github.com/blang/semver"
	"github.com/keybase/client/go/kbcrypto"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

type YNM int

const (
	No    YNM = 0
	Yes   YNM = 1
	Maybe YNM = 2
)

func isModernSigIDMaker(clientName string, clientVersionString string) YNM {
	var clientVersion, cutoffVersion semver.Version
	var err error
	if clientName != "keybase.io go client" {
		return Yes
	}
	clientVersion, err = semver.Make(clientVersionString)
	if err != nil {
		return Yes
	}
	cutoffVersion, err = semver.Make("1.0.16")
	if err != nil {
		panic(err)
	}
	if clientVersion.GT(cutoffVersion) {
		return Yes
	}
	if clientVersion.EQ(cutoffVersion) {
		return Maybe
	}
	return No
}

func isMaybeModernSigIDMakerModern(sigID keybase1.SigID) bool {
	buf := sigID.ToBytes()
	if buf == nil {
		return true
	}
	ui16 := binary.BigEndian.Uint16(buf[0:2])
	n := sort.Search(len(legacyHashPrefixes16), func(i int) bool {
		return legacyHashPrefixes16[i] >= ui16
	})
	if n < len(legacyHashPrefixes16) && legacyHashPrefixes16[n] == ui16 {
		return false
	}
	decode3Bytes := func(b []byte) uint32 {
		return ((uint32(b[0]) << 16) | (uint32(b[1]) << 8) | uint32(b[2]))
	}
	ui32 := decode3Bytes(buf)
	n = sort.Search(len(legacyHashPrefixes24)/3, func(i int) bool {
		return decode3Bytes(legacyHashPrefixes24[(i*3):]) >= ui32
	})
	if n < len(legacyHashPrefixes24)/3 && decode3Bytes(legacyHashPrefixes24[(n*3):]) == ui32 {
		return false
	}
	ui32 = binary.BigEndian.Uint32(buf[0:4])
	n = sort.Search(len(legacyHashPrefixes32), func(i int) bool {
		return legacyHashPrefixes32[i] >= ui32
	})
	if n < len(legacyHashPrefixes32) && legacyHashPrefixes32[n] == ui32 {
		return false
	}
	return true
}

func ComputeSigBodyAndID(sigInfo *kbcrypto.NaclSigInfo, clientName string, clientVersion string) (body []byte, sigID keybase1.SigID, err error) {
	isModern := isModernSigIDMaker(clientName, clientVersion)
	body, err = kbcrypto.EncodePacketToBytes(sigInfo)
	sigID = kbcrypto.ComputeSigIDFromSigBody(body)
	if err != nil {
		return nil, sigID, err
	}
	if isModern == Yes {
		return body, sigID, nil
	}
	fmt.Printf("going it! %s\n", sigID.String())
	if isModern == Maybe && isMaybeModernSigIDMakerModern(sigID) {
		return body, sigID, nil
	}
	body, err = kbcrypto.EncodePacketToBytesWithOptionalHash(sigInfo, false)
	if err != nil {
		return nil, sigID, err
	}
	sigID = kbcrypto.ComputeSigIDFromSigBody(body)

	return body, sigID, nil
}
