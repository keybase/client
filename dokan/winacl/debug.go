// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build debug

package winacl

import (
	"fmt"
	"strings"
)

func (si SecurityInformation) String() string {
	var cf collectFlags
	var raw = uint32(si)
	cf.AddDense(raw, []string{
		"OWNER", "GROUP", "DACL", "SACL", "LABEL", "ATTRIBUTE", "SCOPE",
	})
	cf.AddFlag(raw, 0x10000, "BACKUP")
	cf.AddFlag(raw, 0x80000000, "PROTECTED_DACL")
	cf.AddFlag(raw, 0x40000000, "PROTECTED_SACL")
	cf.AddFlag(raw, 0x20000000, "UNPROTECTED_DACL")
	cf.AddFlag(raw, 0x10000000, "UNPROTECTED_SACL")

	return cf.String()
}

func (sd *SecurityDescriptor) String() string {
	var cf collectFlags
	cf.AddDense(uint32(sd.ptr.Control), []string{
		"OWNER_DEFAULTED", "GROUP_DEFAULTED",
		"DACL_PRESENT", "DACL_DEFAULTED",
		"SACL_PRESENT", "SACL_DEFAULTED",
		"", "",
		"DACL_AUTO_INHERIT_REQ", "SACL_AUTO_INHERIT_REQ",
		"DACL_AUTO_INHERITED", "SACL_AUTO_INHERITED",
		"DACL_PROTECTED", "SACL_PROTECTED",
		"RM_CONTROL_VALID", "SELF_RELATIVE",
	})
	var res = cf.String()
	if sd.ptr.Revision != 1 {
		res += "INVALID-REVISION"
	}
	if sd.ptr.Sbz1 != 0 {
		res += "NON-ZERO-SBZ1"
	}
	return fmt.Sprintf("%s offsets (o,g,s,d) = (%d, %d, %d, %d)", res,
		sd.ptr.OwnerOffset, sd.ptr.GroupOffset,
		sd.ptr.SaclOffset, sd.ptr.DaclOffset,
	)
}

type collectFlags struct {
	parts []string
}

func (c *collectFlags) String() string {
	return strings.Join(c.parts, "|")
}

func (c *collectFlags) AddDense(val uint32, sslice []string) {
	for i, s := range sslice {
		if val&(1<<uint32(i)) != 0 {
			c.parts = append(c.parts, s)
		}
	}
}

func (c *collectFlags) AddFlag(val uint32, flag uint32, s string) {
	if val&flag != 0 {
		c.parts = append(c.parts, s)
	}
}
