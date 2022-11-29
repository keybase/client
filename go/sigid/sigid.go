package sigid

import (
	"encoding/binary"
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

// isMaybeModernSigIDMakerModern is something. The general lay of the
// land is that SigIDs generated with Keybase prior to version 1.0.16
// did so incorrectly, since they didn't compute the SHA256 of the NaclSigInfo
// properly before computing the SigID. Those versions of Keybase at 1.0.17
// and after do the right thing. The problem is 1.0.16. Some clients with the
// 1.0.16 compute SigIDs the right way, and some do it the wrong way,
// (likely because Linux nightlies were going out with the 1.0.16 version).
//
// There are 77331 total signatures that were generated via 1.0.16, of which
// 16555 where generated the wrong way (using the <= 1.0.16 method). In data.go,
// we have prefixes of wrong/legacy signature IDs, that need to be fixed. To save
// binary space, we only include in data.go the shortest possible prefix of the
// wrong/legacy signature IDs that don't collide with prefixes from the group of
// correct signatures. So the idea is that if we compute a hash the modern way,
// then find its prefix in data.go, then we need to recompute it the legacy way,
// since that's the SigID that we use throughout the app.
//
// Background:
//
// The commit that fixes the 2016 bug is:
//
//	https://github.com/keybase/client/commit/ca023e2d6f9192fd8e923f3113ae4a11cda8b53a
//
// So code on opposite sides of this bug will generate SigIDs in two
// different ways.
func isMaybeModernSigIDMakerModern(sigID keybase1.SigIDBase) bool {
	buf := sigID.ToBytes()
	if buf == nil {
		return true
	}

	// Note we have prefixes of 3 sizes --- 2 bytes, 3 and 4.
	// We check if this sigID in the 2, then 3 then 4 byte
	// tables. If we find it, then we know it's a *legacy*
	// SigID and needs to be computed with the legacy bug.
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

func ComputeSigBodyAndID(sigInfo *kbcrypto.NaclSigInfo, clientName string, clientVersion string) (body []byte, sigID keybase1.SigIDBase, err error) {
	isModern := isModernSigIDMaker(clientName, clientVersion)
	body, err = kbcrypto.EncodePacketToBytes(sigInfo)
	sigID = kbcrypto.ComputeSigIDFromSigBody(body)
	if err != nil {
		return nil, sigID, err
	}
	if isModern == Yes {
		return body, sigID, nil
	}
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
