// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/process.avdl

package keybase1

import (
	"fmt"
)

type FileType int

const (
	FileType_UNKNOWN   FileType = 0
	FileType_DIRECTORY FileType = 1
	FileType_FILE      FileType = 2
)

func (o FileType) DeepCopy() FileType { return o }

var FileTypeMap = map[string]FileType{
	"UNKNOWN":   0,
	"DIRECTORY": 1,
	"FILE":      2,
}

var FileTypeRevMap = map[FileType]string{
	0: "UNKNOWN",
	1: "DIRECTORY",
	2: "FILE",
}

func (e FileType) String() string {
	if v, ok := FileTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FileDescriptor struct {
	Name string   `codec:"name" json:"name"`
	Type FileType `codec:"type" json:"type"`
}

func (o FileDescriptor) DeepCopy() FileDescriptor {
	return FileDescriptor{
		Name: o.Name,
		Type: o.Type.DeepCopy(),
	}
}

type Process struct {
	Pid             string           `codec:"pid" json:"pid"`
	Command         string           `codec:"command" json:"command"`
	FileDescriptors []FileDescriptor `codec:"fileDescriptors" json:"fileDescriptors"`
}

func (o Process) DeepCopy() Process {
	return Process{
		Pid:     o.Pid,
		Command: o.Command,
		FileDescriptors: (func(x []FileDescriptor) []FileDescriptor {
			if x == nil {
				return nil
			}
			ret := make([]FileDescriptor, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.FileDescriptors),
	}
}
