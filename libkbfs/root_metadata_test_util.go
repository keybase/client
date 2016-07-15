// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

// This file contains test functions related to RootMetadata that need
// to be exported for use by other modules' tests.

// NewRootMetadataSignedForTest returns a new RootMetadataSigned for testing.
func NewRootMetadataSignedForTest(id TlfID, h BareTlfHandle) (*RootMetadataSigned, error) {
	rmds := &RootMetadataSigned{}
	err := updateNewBareRootMetadata(&rmds.MD, id, h)
	if err != nil {
		return nil, err
	}
	return rmds, nil
}

// FakeInitialRekey fakes the initial rekey for the given
// BareRootMetadata. This is necessary since newly-created
// BareRootMetadata objects don't have enough data to build a
// TlfHandle from until the first rekey.
func FakeInitialRekey(rmd *BareRootMetadata, h BareTlfHandle) {
	if rmd.ID.IsPublic() {
		panic("Called FakeInitialRekey on public TLF")
	}
	wkb := TLFWriterKeyBundle{
		WKeys: make(UserDeviceKeyInfoMap),
	}
	for _, w := range h.Writers {
		k := MakeFakeCryptPublicKeyOrBust(string(w))
		wkb.WKeys[w] = DeviceKeyInfoMap{
			k.kid: TLFCryptKeyInfo{},
		}
	}
	rmd.WKeys = TLFWriterKeyGenerations{wkb}

	rkb := TLFReaderKeyBundle{
		RKeys: make(UserDeviceKeyInfoMap),
	}
	for _, r := range h.Readers {
		k := MakeFakeCryptPublicKeyOrBust(string(r))
		rkb.RKeys[r] = DeviceKeyInfoMap{
			k.kid: TLFCryptKeyInfo{},
		}
	}
	rmd.RKeys = TLFReaderKeyGenerations{rkb}
}
