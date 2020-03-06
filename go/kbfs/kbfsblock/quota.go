// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package kbfsblock

import (
	"time"

	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/protocol/keybase1"
)

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
	// UsageGitWrite indicates a git block is written
	UsageGitWrite
	// UsageGitArchive indicates an existing git block is archived
	UsageGitArchive
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

// UsageStatFromProtocol converts the RPC format into the local format.
func UsageStatFromProtocol(stat keybase1.UsageStat) *UsageStat {
	u := &UsageStat{
		Bytes: map[UsageType]int64{
			UsageWrite:      stat.Bytes.Write,
			UsageArchive:    stat.Bytes.Archive,
			UsageRead:       stat.Bytes.Read,
			UsageMDWrite:    stat.Bytes.MdWrite,
			UsageGitWrite:   stat.Bytes.GitWrite,
			UsageGitArchive: stat.Bytes.GitArchive,
		},
		Blocks: map[UsageType]int64{
			UsageWrite:      stat.Blocks.Write,
			UsageArchive:    stat.Blocks.Archive,
			UsageRead:       stat.Blocks.Read,
			UsageMDWrite:    stat.Blocks.MdWrite,
			UsageGitWrite:   stat.Blocks.GitWrite,
			UsageGitArchive: stat.Blocks.GitArchive,
		},
		Mtime: keybase1.FromTime(stat.Mtime).UnixNano(),
	}

	return u
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

// ToProtocol converts this stat to the RPC protocol format.
func (u *UsageStat) ToProtocol() (res keybase1.UsageStat) {
	res.Mtime = keybase1.ToTime(time.Unix(0, u.Mtime))

	res.Bytes.Write = u.Bytes[UsageWrite]
	res.Bytes.Archive = u.Bytes[UsageArchive]
	res.Bytes.Read = u.Bytes[UsageRead]
	res.Bytes.MdWrite = u.Bytes[UsageMDWrite]
	res.Bytes.GitWrite = u.Bytes[UsageGitWrite]
	res.Bytes.GitArchive = u.Bytes[UsageGitArchive]

	res.Blocks.Write = u.Blocks[UsageWrite]
	res.Blocks.Archive = u.Blocks[UsageArchive]
	res.Blocks.Read = u.Blocks[UsageRead]
	res.Blocks.MdWrite = u.Blocks[UsageMDWrite]
	res.Blocks.GitWrite = u.Blocks[UsageGitWrite]
	res.Blocks.GitArchive = u.Blocks[UsageGitArchive]

	return res
}

//AccumOne records the usage of one block, whose size is denoted by change
//A positive change means the block is newly added, negative means the block
//is deleted. If archive is true, it means the block is archived.
func (u *UsageStat) AccumOne(change int, usage UsageType) {
	if change == 0 {
		return
	}
	if usage == UsageMDWrite || usage >= NumUsage {
		return
	}
	u.Bytes[usage] += int64(change)
	if change > 0 {
		u.Blocks[usage]++
	} else {
		u.Blocks[usage]--
	}
}

// Accum combines changes to the existing QuotaInfo object using accumulation function accumF.
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

// QuotaInfo contains a user's quota usage information
type QuotaInfo struct {
	Folders  map[string]*UsageStat
	Total    *UsageStat
	Limit    int64
	GitLimit int64
}

// NewQuotaInfo returns a newly constructed QuotaInfo.
func NewQuotaInfo() *QuotaInfo {
	return &QuotaInfo{
		Folders: make(map[string]*UsageStat),
		Total:   NewUsageStat(),
	}
}

// QuotaInfoFromProtocol converts the RPC format into the local format.
func QuotaInfoFromProtocol(info keybase1.BlockQuotaInfo) *QuotaInfo {
	u := &QuotaInfo{
		Folders:  make(map[string]*UsageStat, len(info.Folders)),
		Total:    UsageStatFromProtocol(info.Total),
		Limit:    info.Limit,
		GitLimit: info.GitLimit,
	}
	for _, stat := range info.Folders {
		u.Folders[stat.FolderID] = UsageStatFromProtocol(stat.Stats)
	}
	return u
}

// AccumOne combines one quota charge to the existing QuotaInfo
func (u *QuotaInfo) AccumOne(change int, folder string, usage UsageType) {
	if _, ok := u.Folders[folder]; !ok {
		u.Folders[folder] = NewUsageStat()
	}
	u.Folders[folder].AccumOne(change, usage)
	u.Total.AccumOne(change, usage)
}

// Accum combines changes to the existing QuotaInfo object using accumulation function accumF.
func (u *QuotaInfo) Accum(another *QuotaInfo, accumF func(int64, int64) int64) {
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

// ToBytes marshals this QuotaInfo
func (u *QuotaInfo) ToBytes(codec kbfscodec.Codec) ([]byte, error) {
	return codec.Encode(u)
}

// ToProtocol converts this info to the RPC protocol format.
func (u *QuotaInfo) ToProtocol() (res keybase1.BlockQuotaInfo) {
	res.Limit = u.Limit
	res.GitLimit = u.GitLimit
	res.Total = u.Total.ToProtocol()

	res.Folders = make([]keybase1.FolderUsageStat, 0, len(u.Folders))
	for f, us := range u.Folders {
		res.Folders = append(res.Folders, keybase1.FolderUsageStat{
			FolderID: f,
			Stats:    us.ToProtocol(),
		})
	}

	return res
}

// QuotaInfoDecode decodes b into a QuotaInfo
func QuotaInfoDecode(b []byte, codec kbfscodec.Codec) (
	*QuotaInfo, error) {
	var info QuotaInfo
	err := codec.Decode(b, &info)
	if err != nil {
		return nil, err
	}

	return &info, nil
}
