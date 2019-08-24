// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package winacl

import (
	"encoding/binary"
	"unsafe"
)

// ACL is the type for access control lists.
type ACL struct {
	raw      []byte
	aceCount int
}

func (acl *ACL) initIfEmpty() {
	if acl.raw == nil {
		acl.raw = make([]byte, 8, 8+16)
		acl.raw[0] = aclRevision
	}
}

const (
	aclRevision = 2
)

// AddAllowAccess add a new ALLOW_ACCESS ACE to the ACL.
func (acl *ACL) AddAllowAccess(accessMask uint32, sid *SID) {
	acl.initIfEmpty()
	ssize := sidSize(sid)
	var bs [8]byte
	// ACLs are little endian...
	binary.LittleEndian.PutUint16(bs[2:], uint16(8+align4up(uint32(sidSize(sid)))))
	binary.LittleEndian.PutUint32(bs[4:], accessMask)
	acl.raw = append(acl.raw, bs[:]...)
	acl.raw = append(acl.raw, bufToSlice(unsafe.Pointer(sid), ssize)...)
	for len(acl.raw)&3 != 0 {
		acl.raw = append(acl.raw, 0)
	}
	acl.aceCount++
}

func (acl *ACL) bytes() []byte {
	binary.LittleEndian.PutUint16(acl.raw[2:], uint16(len(acl.raw)))
	binary.LittleEndian.PutUint16(acl.raw[4:], uint16(acl.aceCount))
	return acl.raw
}

func align4up(u uint32) uint32 {
	return (u + 3) &^ 3
}
