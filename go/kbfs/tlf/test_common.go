// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

// FakeID creates a fake public or private TLF ID from the given
// byte.
func FakeID(b byte, t Type) ID {
	bytes := [idByteLen]byte{b}
	switch t {
	case Public:
		bytes[idByteLen-1] = pubIDSuffix
	case Private:
		bytes[idByteLen-1] = idSuffix
	case SingleTeam:
		bytes[idByteLen-1] = singleTeamIDSuffix
	}
	return ID{bytes}
}

// FakeIDByte returns the byte used to create a fake TLF ID with
// FakeID.
func FakeIDByte(id ID) byte {
	return id.id[0]
}
