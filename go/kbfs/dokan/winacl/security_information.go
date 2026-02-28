// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package winacl

// SecurityInformation is a bitmask of values.
type SecurityInformation uintptr

// Various constants for SecurityInformation.
const (
	OwnerSecurityInformation     = SecurityInformation(0x1)
	GroupSecurityInformation     = SecurityInformation(0x2)
	DACLSecurityInformation      = SecurityInformation(0x4)
	SACLSecurityInformation      = SecurityInformation(0x8)
	LabelSecurityInformation     = SecurityInformation(0x10)
	AttributeSecurityInformation = SecurityInformation(0x20)
	ScopeSecurityInformation     = SecurityInformation(0x40)
	BackupSecurityInformation    = SecurityInformation(0x10000)
)
