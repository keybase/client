// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/ctl.avdl

package keybase1

import (
	"fmt"
)

type ExitCode int

const (
	ExitCode_OK      ExitCode = 0
	ExitCode_NOTOK   ExitCode = 2
	ExitCode_RESTART ExitCode = 4
)

func (o ExitCode) DeepCopy() ExitCode { return o }

var ExitCodeMap = map[string]ExitCode{
	"OK":      0,
	"NOTOK":   2,
	"RESTART": 4,
}

var ExitCodeRevMap = map[ExitCode]string{
	0: "OK",
	2: "NOTOK",
	4: "RESTART",
}

func (e ExitCode) String() string {
	if v, ok := ExitCodeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DbType int

const (
	DbType_MAIN                     DbType = 0
	DbType_CHAT                     DbType = 1
	DbType_FS_BLOCK_CACHE           DbType = 2
	DbType_FS_BLOCK_CACHE_META      DbType = 3
	DbType_FS_SYNC_BLOCK_CACHE      DbType = 4
	DbType_FS_SYNC_BLOCK_CACHE_META DbType = 5
)

func (o DbType) DeepCopy() DbType { return o }

var DbTypeMap = map[string]DbType{
	"MAIN":                     0,
	"CHAT":                     1,
	"FS_BLOCK_CACHE":           2,
	"FS_BLOCK_CACHE_META":      3,
	"FS_SYNC_BLOCK_CACHE":      4,
	"FS_SYNC_BLOCK_CACHE_META": 5,
}

var DbTypeRevMap = map[DbType]string{
	0: "MAIN",
	1: "CHAT",
	2: "FS_BLOCK_CACHE",
	3: "FS_BLOCK_CACHE_META",
	4: "FS_SYNC_BLOCK_CACHE",
	5: "FS_SYNC_BLOCK_CACHE_META",
}

func (e DbType) String() string {
	if v, ok := DbTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DbKey struct {
	DbType  DbType `codec:"dbType" json:"dbType"`
	ObjType int    `codec:"objType" json:"objType"`
	Key     string `codec:"key" json:"key"`
}

func (o DbKey) DeepCopy() DbKey {
	return DbKey{
		DbType:  o.DbType.DeepCopy(),
		ObjType: o.ObjType,
		Key:     o.Key,
	}
}

type DbValue []byte

func (o DbValue) DeepCopy() DbValue {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type OnLoginStartupStatus int

const (
	OnLoginStartupStatus_UNKNOWN  OnLoginStartupStatus = 0
	OnLoginStartupStatus_DISABLED OnLoginStartupStatus = 1
	OnLoginStartupStatus_ENABLED  OnLoginStartupStatus = 2
)

func (o OnLoginStartupStatus) DeepCopy() OnLoginStartupStatus { return o }

var OnLoginStartupStatusMap = map[string]OnLoginStartupStatus{
	"UNKNOWN":  0,
	"DISABLED": 1,
	"ENABLED":  2,
}

var OnLoginStartupStatusRevMap = map[OnLoginStartupStatus]string{
	0: "UNKNOWN",
	1: "DISABLED",
	2: "ENABLED",
}

func (e OnLoginStartupStatus) String() string {
	if v, ok := OnLoginStartupStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}
