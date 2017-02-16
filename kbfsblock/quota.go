// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import "github.com/keybase/kbfs/kbfscodec"

// UsageType indicates the type of usage that quota manager is keeping stats of
type UsageType int

const (
	// UsageWrite indicates a data block is written (written blocks include archived blocks)
	UsageWrite UsageType = iota
	// UsageArchive indicates an existing (data) block is archived
	UsageArchive
	// UsageRead indicates a block is read
	UsageRead
	// UsageMDWrite indicates a MD block is written
	UsageMDWrite
	// NumUsage indicates the number of usage types
	NumUsage
)

// UsageStat tracks the amount of bytes/blocks used, broken down by usage types
type UsageStat struct {
	Bytes  map[UsageType]int64
	Blocks map[UsageType]int64
	// Mtime is in unix nanoseconds
	Mtime int64
}

// NewUsageStat creates a new UsageStat
func NewUsageStat() *UsageStat {
	return &UsageStat{
		Bytes:  make(map[UsageType]int64),
		Blocks: make(map[UsageType]int64),
	}
}

// NonZero checks whether UsageStat has accumulated any usage info
func (u *UsageStat) NonZero() bool {
	for i := UsageType(0); i < NumUsage; i++ {
		if u.Bytes[i] != 0 {
			return true
		}
	}
	return false
}

//AccumOne records the usage of one block, whose size is denoted by change
//A positive change means the block is newly added, negative means the block
//is deleted. If archive is true, it means the block is archived.
func (u *UsageStat) AccumOne(change int, usage UsageType) {
	if change == 0 {
		return
	}
	if usage < UsageWrite || usage > UsageRead {
		return
	}
	u.Bytes[usage] += int64(change)
	if change > 0 {
		u.Blocks[usage]++
	} else {
		u.Blocks[usage]--
	}
}

// Accum combines changes to the existing UserQuotaInfo object using accumulation function accumF.
func (u *UsageStat) Accum(another *UsageStat, accumF func(int64, int64) int64) {
	if another == nil {
		return
	}
	for k, v := range another.Bytes {
		u.Bytes[k] = accumF(u.Bytes[k], v)
	}
	for k, v := range another.Blocks {
		u.Blocks[k] = accumF(u.Blocks[k], v)
	}
}

// UserQuotaInfo contains a user's quota usage information
type UserQuotaInfo struct {
	Folders map[string]*UsageStat
	Total   *UsageStat
	Limit   int64
}

// NewUserQuotaInfo returns a newly constructed UserQuotaInfo.
func NewUserQuotaInfo() *UserQuotaInfo {
	return &UserQuotaInfo{
		Folders: make(map[string]*UsageStat),
		Total:   NewUsageStat(),
	}
}

// AccumOne combines one quota charge to the existing UserQuotaInfo
func (u *UserQuotaInfo) AccumOne(change int, folder string, usage UsageType) {
	if _, ok := u.Folders[folder]; !ok {
		u.Folders[folder] = NewUsageStat()
	}
	u.Folders[folder].AccumOne(change, usage)
	u.Total.AccumOne(change, usage)
}

// Accum combines changes to the existing UserQuotaInfo object using accumulation function accumF.
func (u *UserQuotaInfo) Accum(another *UserQuotaInfo, accumF func(int64, int64) int64) {
	if another == nil {
		return
	}
	if u.Total == nil {
		u.Total = NewUsageStat()
	}
	u.Total.Accum(another.Total, accumF)
	for f, change := range another.Folders {
		if _, ok := u.Folders[f]; !ok {
			u.Folders[f] = NewUsageStat()
		}
		u.Folders[f].Accum(change, accumF)
	}
}

// ToBytes marshals this UserQuotaInfo
func (u *UserQuotaInfo) ToBytes(codec kbfscodec.Codec) ([]byte, error) {
	return codec.Encode(u)
}

// UserQuotaInfoDecode decodes b into a UserQuotaInfo
func UserQuotaInfoDecode(b []byte, codec kbfscodec.Codec) (
	*UserQuotaInfo, error) {
	var info UserQuotaInfo
	err := codec.Decode(b, &info)
	if err != nil {
		return nil, err
	}

	return &info, nil
}
