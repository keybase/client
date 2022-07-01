// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// Package winacl adds support for various Windows security APIs for Dokan.
package winacl

import (
	"reflect"
	"unsafe"
)

// CurrentProcessUserSid is a utility to get the
// SID of the current user running the process.
func CurrentProcessUserSid() (*SID, error) {
	return currentProcessUserSid()
}

// CurrentProcessPrimaryGroupSid is a utility to get the
// SID of the primary group of current user running the process.
func CurrentProcessPrimaryGroupSid() (*SID, error) {
	return currentProcessPrimaryGroupSid()
}

// NewSecurityDescriptorWithBuffer creates a new self-referential
// security descriptor in the buffer provided.
func NewSecurityDescriptorWithBuffer(bs []byte) *SecurityDescriptor {
	for i := range bs {
		bs[i] = 0
	}
	var sd = SecurityDescriptor{bytes: bs,
		curOffset: int(unsafe.Sizeof(selfRelativeSecurityDescriptor{}))}
	if len(bs) >= sd.curOffset {
		sd.ptr = (*selfRelativeSecurityDescriptor)(unsafe.Pointer(&bs[0]))
		sd.ptr.Revision = 1
		sd.ptr.Control = seSelfRelative | seOwnerDefaulted | seGroupDefaulted
	}
	return &sd
}

// SecurityDescriptor is the type for security descriptors.
// Note that items have to be set in the following order:
// 1) owner, 2) group, 3) sacl, 4) dacl. Some of them may
// be omitted.
type SecurityDescriptor struct {
	bytes     []byte
	ptr       *selfRelativeSecurityDescriptor
	curOffset int
}

// Size returns the size of the security descriptor. If the buffer is too
// small then it is the size that would be needed to store this
// SecurityDescriptor.
func (sd *SecurityDescriptor) Size() int {
	return sd.curOffset
}

// HasOverflowed returns whether this security descriptor is too large for
// the provided buffer.
func (sd *SecurityDescriptor) HasOverflowed() bool {
	return sd.curOffset > len(sd.bytes)
}

type selfRelativeSecurityDescriptor struct {
	Revision, Sbz1                                   byte
	Control                                          uint16
	OwnerOffset, GroupOffset, SaclOffset, DaclOffset int32
}

const (
	seOwnerDefaulted = 0x1
	seGroupDefaulted = 0x2
	seDaclPresent    = 0x4
	seSelfRelative   = 0x8000
)

// SetOwner sets the owner field of a SecurityDescriptor.
func (sd *SecurityDescriptor) SetOwner(sid *SID) {
	if off := sd.setSid(sid); off != 0 {
		sd.ptr.OwnerOffset = int32(off)
		sd.ptr.Control &^= seOwnerDefaulted
	}
}

// SetGroup sets the owner field of a SecurityDescriptor.
func (sd *SecurityDescriptor) SetGroup(sid *SID) {
	if off := sd.setSid(sid); off != 0 {
		sd.ptr.GroupOffset = int32(off)
		sd.ptr.Control &^= seGroupDefaulted
	}
}

// SetDacl sets a dacl in the security descriptor to the given ACL.
func (sd *SecurityDescriptor) SetDacl(acl *ACL) {
	bs := acl.bytes()
	off := sd.curOffset
	sd.curOffset += len(bs)
	if sd.HasOverflowed() {
		return
	}
	copy(sd.bytes[off:], bs)
	sd.ptr.Control |= seDaclPresent
	sd.ptr.DaclOffset = int32(off)
}

func (sd *SecurityDescriptor) setSid(sid *SID) int {
	size := sidSize(sid)
	off := sd.curOffset
	sd.curOffset += size
	if sd.HasOverflowed() {
		return 0
	}
	copy(sd.bytes[off:], bufToSlice(unsafe.Pointer(sid), size))
	return off
}

func sidSize(s *SID) int {
	return 8 + 4*int(((*sidFixed)(unsafe.Pointer(s))).SubAuthorityCount)
}

type sidFixed struct {
	Revision, SubAuthorityCount byte
	IdentifierAuthority         [6]byte
}

// bufToSlice returns a byte slice aliasing the pointer and length given as arguments.
func bufToSlice(ptr unsafe.Pointer, nbytes int) []byte {
	if ptr == nil || nbytes == 0 {
		return nil
	}
	return *(*[]byte)(unsafe.Pointer(&reflect.SliceHeader{
		Data: uintptr(ptr),
		Len:  nbytes,
		Cap:  nbytes}))
}
