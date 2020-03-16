// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/simple_fs.avdl

package keybase1

import (
	"errors"
	"fmt"
)

type OpID [16]byte

func (o OpID) DeepCopy() OpID {
	var ret OpID
	copy(ret[:], o[:])
	return ret
}

type KBFSRevision int64

func (o KBFSRevision) DeepCopy() KBFSRevision {
	return o
}

type KBFSArchivedType int

const (
	KBFSArchivedType_REVISION        KBFSArchivedType = 0
	KBFSArchivedType_TIME            KBFSArchivedType = 1
	KBFSArchivedType_TIME_STRING     KBFSArchivedType = 2
	KBFSArchivedType_REL_TIME_STRING KBFSArchivedType = 3
)

func (o KBFSArchivedType) DeepCopy() KBFSArchivedType { return o }

var KBFSArchivedTypeMap = map[string]KBFSArchivedType{
	"REVISION":        0,
	"TIME":            1,
	"TIME_STRING":     2,
	"REL_TIME_STRING": 3,
}

var KBFSArchivedTypeRevMap = map[KBFSArchivedType]string{
	0: "REVISION",
	1: "TIME",
	2: "TIME_STRING",
	3: "REL_TIME_STRING",
}

func (e KBFSArchivedType) String() string {
	if v, ok := KBFSArchivedTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type KBFSArchivedParam struct {
	KBFSArchivedType__ KBFSArchivedType `codec:"KBFSArchivedType" json:"KBFSArchivedType"`
	Revision__         *KBFSRevision    `codec:"revision,omitempty" json:"revision,omitempty"`
	Time__             *Time            `codec:"time,omitempty" json:"time,omitempty"`
	TimeString__       *string          `codec:"timeString,omitempty" json:"timeString,omitempty"`
	RelTimeString__    *string          `codec:"relTimeString,omitempty" json:"relTimeString,omitempty"`
}

func (o *KBFSArchivedParam) KBFSArchivedType() (ret KBFSArchivedType, err error) {
	switch o.KBFSArchivedType__ {
	case KBFSArchivedType_REVISION:
		if o.Revision__ == nil {
			err = errors.New("unexpected nil value for Revision__")
			return ret, err
		}
	case KBFSArchivedType_TIME:
		if o.Time__ == nil {
			err = errors.New("unexpected nil value for Time__")
			return ret, err
		}
	case KBFSArchivedType_TIME_STRING:
		if o.TimeString__ == nil {
			err = errors.New("unexpected nil value for TimeString__")
			return ret, err
		}
	case KBFSArchivedType_REL_TIME_STRING:
		if o.RelTimeString__ == nil {
			err = errors.New("unexpected nil value for RelTimeString__")
			return ret, err
		}
	}
	return o.KBFSArchivedType__, nil
}

func (o KBFSArchivedParam) Revision() (res KBFSRevision) {
	if o.KBFSArchivedType__ != KBFSArchivedType_REVISION {
		panic("wrong case accessed")
	}
	if o.Revision__ == nil {
		return
	}
	return *o.Revision__
}

func (o KBFSArchivedParam) Time() (res Time) {
	if o.KBFSArchivedType__ != KBFSArchivedType_TIME {
		panic("wrong case accessed")
	}
	if o.Time__ == nil {
		return
	}
	return *o.Time__
}

func (o KBFSArchivedParam) TimeString() (res string) {
	if o.KBFSArchivedType__ != KBFSArchivedType_TIME_STRING {
		panic("wrong case accessed")
	}
	if o.TimeString__ == nil {
		return
	}
	return *o.TimeString__
}

func (o KBFSArchivedParam) RelTimeString() (res string) {
	if o.KBFSArchivedType__ != KBFSArchivedType_REL_TIME_STRING {
		panic("wrong case accessed")
	}
	if o.RelTimeString__ == nil {
		return
	}
	return *o.RelTimeString__
}

func NewKBFSArchivedParamWithRevision(v KBFSRevision) KBFSArchivedParam {
	return KBFSArchivedParam{
		KBFSArchivedType__: KBFSArchivedType_REVISION,
		Revision__:         &v,
	}
}

func NewKBFSArchivedParamWithTime(v Time) KBFSArchivedParam {
	return KBFSArchivedParam{
		KBFSArchivedType__: KBFSArchivedType_TIME,
		Time__:             &v,
	}
}

func NewKBFSArchivedParamWithTimeString(v string) KBFSArchivedParam {
	return KBFSArchivedParam{
		KBFSArchivedType__: KBFSArchivedType_TIME_STRING,
		TimeString__:       &v,
	}
}

func NewKBFSArchivedParamWithRelTimeString(v string) KBFSArchivedParam {
	return KBFSArchivedParam{
		KBFSArchivedType__: KBFSArchivedType_REL_TIME_STRING,
		RelTimeString__:    &v,
	}
}

func (o KBFSArchivedParam) DeepCopy() KBFSArchivedParam {
	return KBFSArchivedParam{
		KBFSArchivedType__: o.KBFSArchivedType__.DeepCopy(),
		Revision__: (func(x *KBFSRevision) *KBFSRevision {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Revision__),
		Time__: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Time__),
		TimeString__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.TimeString__),
		RelTimeString__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.RelTimeString__),
	}
}

type KBFSArchivedPath struct {
	Path             string               `codec:"path" json:"path"`
	ArchivedParam    KBFSArchivedParam    `codec:"archivedParam" json:"archivedParam"`
	IdentifyBehavior *TLFIdentifyBehavior `codec:"identifyBehavior,omitempty" json:"identifyBehavior,omitempty"`
}

func (o KBFSArchivedPath) DeepCopy() KBFSArchivedPath {
	return KBFSArchivedPath{
		Path:          o.Path,
		ArchivedParam: o.ArchivedParam.DeepCopy(),
		IdentifyBehavior: (func(x *TLFIdentifyBehavior) *TLFIdentifyBehavior {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.IdentifyBehavior),
	}
}

type KBFSPath struct {
	Path             string               `codec:"path" json:"path"`
	IdentifyBehavior *TLFIdentifyBehavior `codec:"identifyBehavior,omitempty" json:"identifyBehavior,omitempty"`
}

func (o KBFSPath) DeepCopy() KBFSPath {
	return KBFSPath{
		Path: o.Path,
		IdentifyBehavior: (func(x *TLFIdentifyBehavior) *TLFIdentifyBehavior {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.IdentifyBehavior),
	}
}

type PathType int

const (
	PathType_LOCAL         PathType = 0
	PathType_KBFS          PathType = 1
	PathType_KBFS_ARCHIVED PathType = 2
)

func (o PathType) DeepCopy() PathType { return o }

var PathTypeMap = map[string]PathType{
	"LOCAL":         0,
	"KBFS":          1,
	"KBFS_ARCHIVED": 2,
}

var PathTypeRevMap = map[PathType]string{
	0: "LOCAL",
	1: "KBFS",
	2: "KBFS_ARCHIVED",
}

func (e PathType) String() string {
	if v, ok := PathTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Path struct {
	PathType__     PathType          `codec:"PathType" json:"PathType"`
	Local__        *string           `codec:"local,omitempty" json:"local,omitempty"`
	Kbfs__         *KBFSPath         `codec:"kbfs,omitempty" json:"kbfs,omitempty"`
	KbfsArchived__ *KBFSArchivedPath `codec:"kbfsArchived,omitempty" json:"kbfsArchived,omitempty"`
}

func (o *Path) PathType() (ret PathType, err error) {
	switch o.PathType__ {
	case PathType_LOCAL:
		if o.Local__ == nil {
			err = errors.New("unexpected nil value for Local__")
			return ret, err
		}
	case PathType_KBFS:
		if o.Kbfs__ == nil {
			err = errors.New("unexpected nil value for Kbfs__")
			return ret, err
		}
	case PathType_KBFS_ARCHIVED:
		if o.KbfsArchived__ == nil {
			err = errors.New("unexpected nil value for KbfsArchived__")
			return ret, err
		}
	}
	return o.PathType__, nil
}

func (o Path) Local() (res string) {
	if o.PathType__ != PathType_LOCAL {
		panic("wrong case accessed")
	}
	if o.Local__ == nil {
		return
	}
	return *o.Local__
}

func (o Path) Kbfs() (res KBFSPath) {
	if o.PathType__ != PathType_KBFS {
		panic("wrong case accessed")
	}
	if o.Kbfs__ == nil {
		return
	}
	return *o.Kbfs__
}

func (o Path) KbfsArchived() (res KBFSArchivedPath) {
	if o.PathType__ != PathType_KBFS_ARCHIVED {
		panic("wrong case accessed")
	}
	if o.KbfsArchived__ == nil {
		return
	}
	return *o.KbfsArchived__
}

func NewPathWithLocal(v string) Path {
	return Path{
		PathType__: PathType_LOCAL,
		Local__:    &v,
	}
}

func NewPathWithKbfs(v KBFSPath) Path {
	return Path{
		PathType__: PathType_KBFS,
		Kbfs__:     &v,
	}
}

func NewPathWithKbfsArchived(v KBFSArchivedPath) Path {
	return Path{
		PathType__:     PathType_KBFS_ARCHIVED,
		KbfsArchived__: &v,
	}
}

func (o Path) DeepCopy() Path {
	return Path{
		PathType__: o.PathType__.DeepCopy(),
		Local__: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Local__),
		Kbfs__: (func(x *KBFSPath) *KBFSPath {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Kbfs__),
		KbfsArchived__: (func(x *KBFSArchivedPath) *KBFSArchivedPath {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.KbfsArchived__),
	}
}

type DirentType int

const (
	DirentType_FILE DirentType = 0
	DirentType_DIR  DirentType = 1
	DirentType_SYM  DirentType = 2
	DirentType_EXEC DirentType = 3
)

func (o DirentType) DeepCopy() DirentType { return o }

var DirentTypeMap = map[string]DirentType{
	"FILE": 0,
	"DIR":  1,
	"SYM":  2,
	"EXEC": 3,
}

var DirentTypeRevMap = map[DirentType]string{
	0: "FILE",
	1: "DIR",
	2: "SYM",
	3: "EXEC",
}

func (e DirentType) String() string {
	if v, ok := DirentTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PrefetchStatus int

const (
	PrefetchStatus_NOT_STARTED PrefetchStatus = 0
	PrefetchStatus_IN_PROGRESS PrefetchStatus = 1
	PrefetchStatus_COMPLETE    PrefetchStatus = 2
)

func (o PrefetchStatus) DeepCopy() PrefetchStatus { return o }

var PrefetchStatusMap = map[string]PrefetchStatus{
	"NOT_STARTED": 0,
	"IN_PROGRESS": 1,
	"COMPLETE":    2,
}

var PrefetchStatusRevMap = map[PrefetchStatus]string{
	0: "NOT_STARTED",
	1: "IN_PROGRESS",
	2: "COMPLETE",
}

func (e PrefetchStatus) String() string {
	if v, ok := PrefetchStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PrefetchProgress struct {
	Start        Time  `codec:"start" json:"start"`
	EndEstimate  Time  `codec:"endEstimate" json:"endEstimate"`
	BytesTotal   int64 `codec:"bytesTotal" json:"bytesTotal"`
	BytesFetched int64 `codec:"bytesFetched" json:"bytesFetched"`
}

func (o PrefetchProgress) DeepCopy() PrefetchProgress {
	return PrefetchProgress{
		Start:        o.Start.DeepCopy(),
		EndEstimate:  o.EndEstimate.DeepCopy(),
		BytesTotal:   o.BytesTotal,
		BytesFetched: o.BytesFetched,
	}
}

type Dirent struct {
	Time                 Time             `codec:"time" json:"time"`
	Size                 int              `codec:"size" json:"size"`
	Name                 string           `codec:"name" json:"name"`
	DirentType           DirentType       `codec:"direntType" json:"direntType"`
	LastWriterUnverified User             `codec:"lastWriterUnverified" json:"lastWriterUnverified"`
	Writable             bool             `codec:"writable" json:"writable"`
	PrefetchStatus       PrefetchStatus   `codec:"prefetchStatus" json:"prefetchStatus"`
	PrefetchProgress     PrefetchProgress `codec:"prefetchProgress" json:"prefetchProgress"`
	SymlinkTarget        string           `codec:"symlinkTarget" json:"symlinkTarget"`
}

func (o Dirent) DeepCopy() Dirent {
	return Dirent{
		Time:                 o.Time.DeepCopy(),
		Size:                 o.Size,
		Name:                 o.Name,
		DirentType:           o.DirentType.DeepCopy(),
		LastWriterUnverified: o.LastWriterUnverified.DeepCopy(),
		Writable:             o.Writable,
		PrefetchStatus:       o.PrefetchStatus.DeepCopy(),
		PrefetchProgress:     o.PrefetchProgress.DeepCopy(),
		SymlinkTarget:        o.SymlinkTarget,
	}
}

type DirentWithRevision struct {
	Entry    Dirent       `codec:"entry" json:"entry"`
	Revision KBFSRevision `codec:"revision" json:"revision"`
}

func (o DirentWithRevision) DeepCopy() DirentWithRevision {
	return DirentWithRevision{
		Entry:    o.Entry.DeepCopy(),
		Revision: o.Revision.DeepCopy(),
	}
}

type RevisionSpanType int

const (
	RevisionSpanType_DEFAULT   RevisionSpanType = 0
	RevisionSpanType_LAST_FIVE RevisionSpanType = 1
)

func (o RevisionSpanType) DeepCopy() RevisionSpanType { return o }

var RevisionSpanTypeMap = map[string]RevisionSpanType{
	"DEFAULT":   0,
	"LAST_FIVE": 1,
}

var RevisionSpanTypeRevMap = map[RevisionSpanType]string{
	0: "DEFAULT",
	1: "LAST_FIVE",
}

func (e RevisionSpanType) String() string {
	if v, ok := RevisionSpanTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ErrorNum int

func (o ErrorNum) DeepCopy() ErrorNum {
	return o
}

type OpenFlags int

const (
	OpenFlags_READ      OpenFlags = 0
	OpenFlags_REPLACE   OpenFlags = 1
	OpenFlags_EXISTING  OpenFlags = 2
	OpenFlags_WRITE     OpenFlags = 4
	OpenFlags_APPEND    OpenFlags = 8
	OpenFlags_DIRECTORY OpenFlags = 16
)

func (o OpenFlags) DeepCopy() OpenFlags { return o }

var OpenFlagsMap = map[string]OpenFlags{
	"READ":      0,
	"REPLACE":   1,
	"EXISTING":  2,
	"WRITE":     4,
	"APPEND":    8,
	"DIRECTORY": 16,
}

var OpenFlagsRevMap = map[OpenFlags]string{
	0:  "READ",
	1:  "REPLACE",
	2:  "EXISTING",
	4:  "WRITE",
	8:  "APPEND",
	16: "DIRECTORY",
}

func (e OpenFlags) String() string {
	if v, ok := OpenFlagsRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type Progress int

func (o Progress) DeepCopy() Progress {
	return o
}

type SimpleFSListResult struct {
	Entries  []Dirent `codec:"entries" json:"entries"`
	Progress Progress `codec:"progress" json:"progress"`
}

func (o SimpleFSListResult) DeepCopy() SimpleFSListResult {
	return SimpleFSListResult{
		Entries: (func(x []Dirent) []Dirent {
			if x == nil {
				return nil
			}
			ret := make([]Dirent, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Entries),
		Progress: o.Progress.DeepCopy(),
	}
}

type FileContent struct {
	Data     []byte   `codec:"data" json:"data"`
	Progress Progress `codec:"progress" json:"progress"`
}

func (o FileContent) DeepCopy() FileContent {
	return FileContent{
		Data: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Data),
		Progress: o.Progress.DeepCopy(),
	}
}

type AsyncOps int

const (
	AsyncOps_LIST                    AsyncOps = 0
	AsyncOps_LIST_RECURSIVE          AsyncOps = 1
	AsyncOps_READ                    AsyncOps = 2
	AsyncOps_WRITE                   AsyncOps = 3
	AsyncOps_COPY                    AsyncOps = 4
	AsyncOps_MOVE                    AsyncOps = 5
	AsyncOps_REMOVE                  AsyncOps = 6
	AsyncOps_LIST_RECURSIVE_TO_DEPTH AsyncOps = 7
	AsyncOps_GET_REVISIONS           AsyncOps = 8
)

func (o AsyncOps) DeepCopy() AsyncOps { return o }

var AsyncOpsMap = map[string]AsyncOps{
	"LIST":                    0,
	"LIST_RECURSIVE":          1,
	"READ":                    2,
	"WRITE":                   3,
	"COPY":                    4,
	"MOVE":                    5,
	"REMOVE":                  6,
	"LIST_RECURSIVE_TO_DEPTH": 7,
	"GET_REVISIONS":           8,
}

var AsyncOpsRevMap = map[AsyncOps]string{
	0: "LIST",
	1: "LIST_RECURSIVE",
	2: "READ",
	3: "WRITE",
	4: "COPY",
	5: "MOVE",
	6: "REMOVE",
	7: "LIST_RECURSIVE_TO_DEPTH",
	8: "GET_REVISIONS",
}

func (e AsyncOps) String() string {
	if v, ok := AsyncOpsRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ListFilter int

const (
	ListFilter_NO_FILTER            ListFilter = 0
	ListFilter_FILTER_ALL_HIDDEN    ListFilter = 1
	ListFilter_FILTER_SYSTEM_HIDDEN ListFilter = 2
)

func (o ListFilter) DeepCopy() ListFilter { return o }

var ListFilterMap = map[string]ListFilter{
	"NO_FILTER":            0,
	"FILTER_ALL_HIDDEN":    1,
	"FILTER_SYSTEM_HIDDEN": 2,
}

var ListFilterRevMap = map[ListFilter]string{
	0: "NO_FILTER",
	1: "FILTER_ALL_HIDDEN",
	2: "FILTER_SYSTEM_HIDDEN",
}

func (e ListFilter) String() string {
	if v, ok := ListFilterRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ListArgs struct {
	OpID   OpID       `codec:"opID" json:"opID"`
	Path   Path       `codec:"path" json:"path"`
	Filter ListFilter `codec:"filter" json:"filter"`
}

func (o ListArgs) DeepCopy() ListArgs {
	return ListArgs{
		OpID:   o.OpID.DeepCopy(),
		Path:   o.Path.DeepCopy(),
		Filter: o.Filter.DeepCopy(),
	}
}

type ListToDepthArgs struct {
	OpID   OpID       `codec:"opID" json:"opID"`
	Path   Path       `codec:"path" json:"path"`
	Filter ListFilter `codec:"filter" json:"filter"`
	Depth  int        `codec:"depth" json:"depth"`
}

func (o ListToDepthArgs) DeepCopy() ListToDepthArgs {
	return ListToDepthArgs{
		OpID:   o.OpID.DeepCopy(),
		Path:   o.Path.DeepCopy(),
		Filter: o.Filter.DeepCopy(),
		Depth:  o.Depth,
	}
}

type RemoveArgs struct {
	OpID      OpID `codec:"opID" json:"opID"`
	Path      Path `codec:"path" json:"path"`
	Recursive bool `codec:"recursive" json:"recursive"`
}

func (o RemoveArgs) DeepCopy() RemoveArgs {
	return RemoveArgs{
		OpID:      o.OpID.DeepCopy(),
		Path:      o.Path.DeepCopy(),
		Recursive: o.Recursive,
	}
}

type ReadArgs struct {
	OpID   OpID  `codec:"opID" json:"opID"`
	Path   Path  `codec:"path" json:"path"`
	Offset int64 `codec:"offset" json:"offset"`
	Size   int   `codec:"size" json:"size"`
}

func (o ReadArgs) DeepCopy() ReadArgs {
	return ReadArgs{
		OpID:   o.OpID.DeepCopy(),
		Path:   o.Path.DeepCopy(),
		Offset: o.Offset,
		Size:   o.Size,
	}
}

type WriteArgs struct {
	OpID   OpID  `codec:"opID" json:"opID"`
	Path   Path  `codec:"path" json:"path"`
	Offset int64 `codec:"offset" json:"offset"`
}

func (o WriteArgs) DeepCopy() WriteArgs {
	return WriteArgs{
		OpID:   o.OpID.DeepCopy(),
		Path:   o.Path.DeepCopy(),
		Offset: o.Offset,
	}
}

type CopyArgs struct {
	OpID OpID `codec:"opID" json:"opID"`
	Src  Path `codec:"src" json:"src"`
	Dest Path `codec:"dest" json:"dest"`
}

func (o CopyArgs) DeepCopy() CopyArgs {
	return CopyArgs{
		OpID: o.OpID.DeepCopy(),
		Src:  o.Src.DeepCopy(),
		Dest: o.Dest.DeepCopy(),
	}
}

type MoveArgs struct {
	OpID OpID `codec:"opID" json:"opID"`
	Src  Path `codec:"src" json:"src"`
	Dest Path `codec:"dest" json:"dest"`
}

func (o MoveArgs) DeepCopy() MoveArgs {
	return MoveArgs{
		OpID: o.OpID.DeepCopy(),
		Src:  o.Src.DeepCopy(),
		Dest: o.Dest.DeepCopy(),
	}
}

type GetRevisionsArgs struct {
	OpID     OpID             `codec:"opID" json:"opID"`
	Path     Path             `codec:"path" json:"path"`
	SpanType RevisionSpanType `codec:"spanType" json:"spanType"`
}

func (o GetRevisionsArgs) DeepCopy() GetRevisionsArgs {
	return GetRevisionsArgs{
		OpID:     o.OpID.DeepCopy(),
		Path:     o.Path.DeepCopy(),
		SpanType: o.SpanType.DeepCopy(),
	}
}

type OpDescription struct {
	AsyncOp__              AsyncOps          `codec:"asyncOp" json:"asyncOp"`
	List__                 *ListArgs         `codec:"list,omitempty" json:"list,omitempty"`
	ListRecursive__        *ListArgs         `codec:"listRecursive,omitempty" json:"listRecursive,omitempty"`
	ListRecursiveToDepth__ *ListToDepthArgs  `codec:"listRecursiveToDepth,omitempty" json:"listRecursiveToDepth,omitempty"`
	Read__                 *ReadArgs         `codec:"read,omitempty" json:"read,omitempty"`
	Write__                *WriteArgs        `codec:"write,omitempty" json:"write,omitempty"`
	Copy__                 *CopyArgs         `codec:"copy,omitempty" json:"copy,omitempty"`
	Move__                 *MoveArgs         `codec:"move,omitempty" json:"move,omitempty"`
	Remove__               *RemoveArgs       `codec:"remove,omitempty" json:"remove,omitempty"`
	GetRevisions__         *GetRevisionsArgs `codec:"getRevisions,omitempty" json:"getRevisions,omitempty"`
}

func (o *OpDescription) AsyncOp() (ret AsyncOps, err error) {
	switch o.AsyncOp__ {
	case AsyncOps_LIST:
		if o.List__ == nil {
			err = errors.New("unexpected nil value for List__")
			return ret, err
		}
	case AsyncOps_LIST_RECURSIVE:
		if o.ListRecursive__ == nil {
			err = errors.New("unexpected nil value for ListRecursive__")
			return ret, err
		}
	case AsyncOps_LIST_RECURSIVE_TO_DEPTH:
		if o.ListRecursiveToDepth__ == nil {
			err = errors.New("unexpected nil value for ListRecursiveToDepth__")
			return ret, err
		}
	case AsyncOps_READ:
		if o.Read__ == nil {
			err = errors.New("unexpected nil value for Read__")
			return ret, err
		}
	case AsyncOps_WRITE:
		if o.Write__ == nil {
			err = errors.New("unexpected nil value for Write__")
			return ret, err
		}
	case AsyncOps_COPY:
		if o.Copy__ == nil {
			err = errors.New("unexpected nil value for Copy__")
			return ret, err
		}
	case AsyncOps_MOVE:
		if o.Move__ == nil {
			err = errors.New("unexpected nil value for Move__")
			return ret, err
		}
	case AsyncOps_REMOVE:
		if o.Remove__ == nil {
			err = errors.New("unexpected nil value for Remove__")
			return ret, err
		}
	case AsyncOps_GET_REVISIONS:
		if o.GetRevisions__ == nil {
			err = errors.New("unexpected nil value for GetRevisions__")
			return ret, err
		}
	}
	return o.AsyncOp__, nil
}

func (o OpDescription) List() (res ListArgs) {
	if o.AsyncOp__ != AsyncOps_LIST {
		panic("wrong case accessed")
	}
	if o.List__ == nil {
		return
	}
	return *o.List__
}

func (o OpDescription) ListRecursive() (res ListArgs) {
	if o.AsyncOp__ != AsyncOps_LIST_RECURSIVE {
		panic("wrong case accessed")
	}
	if o.ListRecursive__ == nil {
		return
	}
	return *o.ListRecursive__
}

func (o OpDescription) ListRecursiveToDepth() (res ListToDepthArgs) {
	if o.AsyncOp__ != AsyncOps_LIST_RECURSIVE_TO_DEPTH {
		panic("wrong case accessed")
	}
	if o.ListRecursiveToDepth__ == nil {
		return
	}
	return *o.ListRecursiveToDepth__
}

func (o OpDescription) Read() (res ReadArgs) {
	if o.AsyncOp__ != AsyncOps_READ {
		panic("wrong case accessed")
	}
	if o.Read__ == nil {
		return
	}
	return *o.Read__
}

func (o OpDescription) Write() (res WriteArgs) {
	if o.AsyncOp__ != AsyncOps_WRITE {
		panic("wrong case accessed")
	}
	if o.Write__ == nil {
		return
	}
	return *o.Write__
}

func (o OpDescription) Copy() (res CopyArgs) {
	if o.AsyncOp__ != AsyncOps_COPY {
		panic("wrong case accessed")
	}
	if o.Copy__ == nil {
		return
	}
	return *o.Copy__
}

func (o OpDescription) Move() (res MoveArgs) {
	if o.AsyncOp__ != AsyncOps_MOVE {
		panic("wrong case accessed")
	}
	if o.Move__ == nil {
		return
	}
	return *o.Move__
}

func (o OpDescription) Remove() (res RemoveArgs) {
	if o.AsyncOp__ != AsyncOps_REMOVE {
		panic("wrong case accessed")
	}
	if o.Remove__ == nil {
		return
	}
	return *o.Remove__
}

func (o OpDescription) GetRevisions() (res GetRevisionsArgs) {
	if o.AsyncOp__ != AsyncOps_GET_REVISIONS {
		panic("wrong case accessed")
	}
	if o.GetRevisions__ == nil {
		return
	}
	return *o.GetRevisions__
}

func NewOpDescriptionWithList(v ListArgs) OpDescription {
	return OpDescription{
		AsyncOp__: AsyncOps_LIST,
		List__:    &v,
	}
}

func NewOpDescriptionWithListRecursive(v ListArgs) OpDescription {
	return OpDescription{
		AsyncOp__:       AsyncOps_LIST_RECURSIVE,
		ListRecursive__: &v,
	}
}

func NewOpDescriptionWithListRecursiveToDepth(v ListToDepthArgs) OpDescription {
	return OpDescription{
		AsyncOp__:              AsyncOps_LIST_RECURSIVE_TO_DEPTH,
		ListRecursiveToDepth__: &v,
	}
}

func NewOpDescriptionWithRead(v ReadArgs) OpDescription {
	return OpDescription{
		AsyncOp__: AsyncOps_READ,
		Read__:    &v,
	}
}

func NewOpDescriptionWithWrite(v WriteArgs) OpDescription {
	return OpDescription{
		AsyncOp__: AsyncOps_WRITE,
		Write__:   &v,
	}
}

func NewOpDescriptionWithCopy(v CopyArgs) OpDescription {
	return OpDescription{
		AsyncOp__: AsyncOps_COPY,
		Copy__:    &v,
	}
}

func NewOpDescriptionWithMove(v MoveArgs) OpDescription {
	return OpDescription{
		AsyncOp__: AsyncOps_MOVE,
		Move__:    &v,
	}
}

func NewOpDescriptionWithRemove(v RemoveArgs) OpDescription {
	return OpDescription{
		AsyncOp__: AsyncOps_REMOVE,
		Remove__:  &v,
	}
}

func NewOpDescriptionWithGetRevisions(v GetRevisionsArgs) OpDescription {
	return OpDescription{
		AsyncOp__:      AsyncOps_GET_REVISIONS,
		GetRevisions__: &v,
	}
}

func (o OpDescription) DeepCopy() OpDescription {
	return OpDescription{
		AsyncOp__: o.AsyncOp__.DeepCopy(),
		List__: (func(x *ListArgs) *ListArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.List__),
		ListRecursive__: (func(x *ListArgs) *ListArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ListRecursive__),
		ListRecursiveToDepth__: (func(x *ListToDepthArgs) *ListToDepthArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ListRecursiveToDepth__),
		Read__: (func(x *ReadArgs) *ReadArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Read__),
		Write__: (func(x *WriteArgs) *WriteArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Write__),
		Copy__: (func(x *CopyArgs) *CopyArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Copy__),
		Move__: (func(x *MoveArgs) *MoveArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Move__),
		Remove__: (func(x *RemoveArgs) *RemoveArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Remove__),
		GetRevisions__: (func(x *GetRevisionsArgs) *GetRevisionsArgs {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.GetRevisions__),
	}
}

type GetRevisionsResult struct {
	Revisions []DirentWithRevision `codec:"revisions" json:"revisions"`
	Progress  Progress             `codec:"progress" json:"progress"`
}

func (o GetRevisionsResult) DeepCopy() GetRevisionsResult {
	return GetRevisionsResult{
		Revisions: (func(x []DirentWithRevision) []DirentWithRevision {
			if x == nil {
				return nil
			}
			ret := make([]DirentWithRevision, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Revisions),
		Progress: o.Progress.DeepCopy(),
	}
}

type OpProgress struct {
	Start        Time     `codec:"start" json:"start"`
	EndEstimate  Time     `codec:"endEstimate" json:"endEstimate"`
	OpType       AsyncOps `codec:"opType" json:"opType"`
	BytesTotal   int64    `codec:"bytesTotal" json:"bytesTotal"`
	BytesRead    int64    `codec:"bytesRead" json:"bytesRead"`
	BytesWritten int64    `codec:"bytesWritten" json:"bytesWritten"`
	FilesTotal   int64    `codec:"filesTotal" json:"filesTotal"`
	FilesRead    int64    `codec:"filesRead" json:"filesRead"`
	FilesWritten int64    `codec:"filesWritten" json:"filesWritten"`
}

func (o OpProgress) DeepCopy() OpProgress {
	return OpProgress{
		Start:        o.Start.DeepCopy(),
		EndEstimate:  o.EndEstimate.DeepCopy(),
		OpType:       o.OpType.DeepCopy(),
		BytesTotal:   o.BytesTotal,
		BytesRead:    o.BytesRead,
		BytesWritten: o.BytesWritten,
		FilesTotal:   o.FilesTotal,
		FilesRead:    o.FilesRead,
		FilesWritten: o.FilesWritten,
	}
}

type SimpleFSQuotaUsage struct {
	UsageBytes      int64 `codec:"usageBytes" json:"usageBytes"`
	ArchiveBytes    int64 `codec:"archiveBytes" json:"archiveBytes"`
	LimitBytes      int64 `codec:"limitBytes" json:"limitBytes"`
	GitUsageBytes   int64 `codec:"gitUsageBytes" json:"gitUsageBytes"`
	GitArchiveBytes int64 `codec:"gitArchiveBytes" json:"gitArchiveBytes"`
	GitLimitBytes   int64 `codec:"gitLimitBytes" json:"gitLimitBytes"`
}

func (o SimpleFSQuotaUsage) DeepCopy() SimpleFSQuotaUsage {
	return SimpleFSQuotaUsage{
		UsageBytes:      o.UsageBytes,
		ArchiveBytes:    o.ArchiveBytes,
		LimitBytes:      o.LimitBytes,
		GitUsageBytes:   o.GitUsageBytes,
		GitArchiveBytes: o.GitArchiveBytes,
		GitLimitBytes:   o.GitLimitBytes,
	}
}

type FolderSyncMode int

const (
	FolderSyncMode_DISABLED FolderSyncMode = 0
	FolderSyncMode_ENABLED  FolderSyncMode = 1
	FolderSyncMode_PARTIAL  FolderSyncMode = 2
)

func (o FolderSyncMode) DeepCopy() FolderSyncMode { return o }

var FolderSyncModeMap = map[string]FolderSyncMode{
	"DISABLED": 0,
	"ENABLED":  1,
	"PARTIAL":  2,
}

var FolderSyncModeRevMap = map[FolderSyncMode]string{
	0: "DISABLED",
	1: "ENABLED",
	2: "PARTIAL",
}

func (e FolderSyncMode) String() string {
	if v, ok := FolderSyncModeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FolderSyncConfig struct {
	Mode  FolderSyncMode `codec:"mode" json:"mode"`
	Paths []string       `codec:"paths" json:"paths"`
}

func (o FolderSyncConfig) DeepCopy() FolderSyncConfig {
	return FolderSyncConfig{
		Mode: o.Mode.DeepCopy(),
		Paths: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.Paths),
	}
}

type FolderSyncConfigAndStatus struct {
	Config FolderSyncConfig `codec:"config" json:"config"`
	Status FolderSyncStatus `codec:"status" json:"status"`
}

func (o FolderSyncConfigAndStatus) DeepCopy() FolderSyncConfigAndStatus {
	return FolderSyncConfigAndStatus{
		Config: o.Config.DeepCopy(),
		Status: o.Status.DeepCopy(),
	}
}

type FolderSyncConfigAndStatusWithFolder struct {
	Folder Folder           `codec:"folder" json:"folder"`
	Config FolderSyncConfig `codec:"config" json:"config"`
	Status FolderSyncStatus `codec:"status" json:"status"`
}

func (o FolderSyncConfigAndStatusWithFolder) DeepCopy() FolderSyncConfigAndStatusWithFolder {
	return FolderSyncConfigAndStatusWithFolder{
		Folder: o.Folder.DeepCopy(),
		Config: o.Config.DeepCopy(),
		Status: o.Status.DeepCopy(),
	}
}

type SyncConfigAndStatusRes struct {
	Folders       []FolderSyncConfigAndStatusWithFolder `codec:"folders" json:"folders"`
	OverallStatus FolderSyncStatus                      `codec:"overallStatus" json:"overallStatus"`
}

func (o SyncConfigAndStatusRes) DeepCopy() SyncConfigAndStatusRes {
	return SyncConfigAndStatusRes{
		Folders: (func(x []FolderSyncConfigAndStatusWithFolder) []FolderSyncConfigAndStatusWithFolder {
			if x == nil {
				return nil
			}
			ret := make([]FolderSyncConfigAndStatusWithFolder, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Folders),
		OverallStatus: o.OverallStatus.DeepCopy(),
	}
}

type FolderWithFavFlags struct {
	Folder     Folder `codec:"folder" json:"folder"`
	IsFavorite bool   `codec:"isFavorite" json:"isFavorite"`
	IsIgnored  bool   `codec:"isIgnored" json:"isIgnored"`
	IsNew      bool   `codec:"isNew" json:"isNew"`
}

func (o FolderWithFavFlags) DeepCopy() FolderWithFavFlags {
	return FolderWithFavFlags{
		Folder:     o.Folder.DeepCopy(),
		IsFavorite: o.IsFavorite,
		IsIgnored:  o.IsIgnored,
		IsNew:      o.IsNew,
	}
}

type KbfsOnlineStatus int

const (
	KbfsOnlineStatus_OFFLINE KbfsOnlineStatus = 0
	KbfsOnlineStatus_TRYING  KbfsOnlineStatus = 1
	KbfsOnlineStatus_ONLINE  KbfsOnlineStatus = 2
)

func (o KbfsOnlineStatus) DeepCopy() KbfsOnlineStatus { return o }

var KbfsOnlineStatusMap = map[string]KbfsOnlineStatus{
	"OFFLINE": 0,
	"TRYING":  1,
	"ONLINE":  2,
}

var KbfsOnlineStatusRevMap = map[KbfsOnlineStatus]string{
	0: "OFFLINE",
	1: "TRYING",
	2: "ONLINE",
}

func (e KbfsOnlineStatus) String() string {
	if v, ok := KbfsOnlineStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FSSettings struct {
	SpaceAvailableNotificationThreshold int64 `codec:"spaceAvailableNotificationThreshold" json:"spaceAvailableNotificationThreshold"`
	SfmiBannerDismissed                 bool  `codec:"sfmiBannerDismissed" json:"sfmiBannerDismissed"`
}

func (o FSSettings) DeepCopy() FSSettings {
	return FSSettings{
		SpaceAvailableNotificationThreshold: o.SpaceAvailableNotificationThreshold,
		SfmiBannerDismissed:                 o.SfmiBannerDismissed,
	}
}

type SimpleFSStats struct {
	ProcessStats      ProcessRuntimeStats `codec:"processStats" json:"processStats"`
	BlockCacheDbStats []string            `codec:"blockCacheDbStats" json:"blockCacheDbStats"`
	SyncCacheDbStats  []string            `codec:"syncCacheDbStats" json:"syncCacheDbStats"`
	RuntimeDbStats    []DbStats           `codec:"runtimeDbStats" json:"runtimeDbStats"`
}

func (o SimpleFSStats) DeepCopy() SimpleFSStats {
	return SimpleFSStats{
		ProcessStats: o.ProcessStats.DeepCopy(),
		BlockCacheDbStats: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.BlockCacheDbStats),
		SyncCacheDbStats: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.SyncCacheDbStats),
		RuntimeDbStats: (func(x []DbStats) []DbStats {
			if x == nil {
				return nil
			}
			ret := make([]DbStats, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.RuntimeDbStats),
	}
}

type SubscriptionTopic int

const (
	SubscriptionTopic_FAVORITES           SubscriptionTopic = 0
	SubscriptionTopic_JOURNAL_STATUS      SubscriptionTopic = 1
	SubscriptionTopic_ONLINE_STATUS       SubscriptionTopic = 2
	SubscriptionTopic_DOWNLOAD_STATUS     SubscriptionTopic = 3
	SubscriptionTopic_FILES_TAB_BADGE     SubscriptionTopic = 4
	SubscriptionTopic_OVERALL_SYNC_STATUS SubscriptionTopic = 5
	SubscriptionTopic_SETTINGS            SubscriptionTopic = 6
)

func (o SubscriptionTopic) DeepCopy() SubscriptionTopic { return o }

var SubscriptionTopicMap = map[string]SubscriptionTopic{
	"FAVORITES":           0,
	"JOURNAL_STATUS":      1,
	"ONLINE_STATUS":       2,
	"DOWNLOAD_STATUS":     3,
	"FILES_TAB_BADGE":     4,
	"OVERALL_SYNC_STATUS": 5,
	"SETTINGS":            6,
}

var SubscriptionTopicRevMap = map[SubscriptionTopic]string{
	0: "FAVORITES",
	1: "JOURNAL_STATUS",
	2: "ONLINE_STATUS",
	3: "DOWNLOAD_STATUS",
	4: "FILES_TAB_BADGE",
	5: "OVERALL_SYNC_STATUS",
	6: "SETTINGS",
}

func (e SubscriptionTopic) String() string {
	if v, ok := SubscriptionTopicRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type PathSubscriptionTopic int

const (
	PathSubscriptionTopic_CHILDREN PathSubscriptionTopic = 0
	PathSubscriptionTopic_STAT     PathSubscriptionTopic = 1
)

func (o PathSubscriptionTopic) DeepCopy() PathSubscriptionTopic { return o }

var PathSubscriptionTopicMap = map[string]PathSubscriptionTopic{
	"CHILDREN": 0,
	"STAT":     1,
}

var PathSubscriptionTopicRevMap = map[PathSubscriptionTopic]string{
	0: "CHILDREN",
	1: "STAT",
}

func (e PathSubscriptionTopic) String() string {
	if v, ok := PathSubscriptionTopicRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type DownloadInfo struct {
	DownloadID        string   `codec:"downloadID" json:"downloadID"`
	Path              KBFSPath `codec:"path" json:"path"`
	Filename          string   `codec:"filename" json:"filename"`
	StartTime         Time     `codec:"startTime" json:"startTime"`
	IsRegularDownload bool     `codec:"isRegularDownload" json:"isRegularDownload"`
}

func (o DownloadInfo) DeepCopy() DownloadInfo {
	return DownloadInfo{
		DownloadID:        o.DownloadID,
		Path:              o.Path.DeepCopy(),
		Filename:          o.Filename,
		StartTime:         o.StartTime.DeepCopy(),
		IsRegularDownload: o.IsRegularDownload,
	}
}

type DownloadState struct {
	DownloadID  string  `codec:"downloadID" json:"downloadID"`
	Progress    float64 `codec:"progress" json:"progress"`
	EndEstimate Time    `codec:"endEstimate" json:"endEstimate"`
	LocalPath   string  `codec:"localPath" json:"localPath"`
	Error       string  `codec:"error" json:"error"`
	Done        bool    `codec:"done" json:"done"`
	Canceled    bool    `codec:"canceled" json:"canceled"`
}

func (o DownloadState) DeepCopy() DownloadState {
	return DownloadState{
		DownloadID:  o.DownloadID,
		Progress:    o.Progress,
		EndEstimate: o.EndEstimate.DeepCopy(),
		LocalPath:   o.LocalPath,
		Error:       o.Error,
		Done:        o.Done,
		Canceled:    o.Canceled,
	}
}

type DownloadStatus struct {
	RegularDownloadIDs []string        `codec:"regularDownloadIDs" json:"regularDownloadIDs"`
	States             []DownloadState `codec:"states" json:"states"`
}

func (o DownloadStatus) DeepCopy() DownloadStatus {
	return DownloadStatus{
		RegularDownloadIDs: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.RegularDownloadIDs),
		States: (func(x []DownloadState) []DownloadState {
			if x == nil {
				return nil
			}
			ret := make([]DownloadState, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.States),
	}
}

type FilesTabBadge int

const (
	FilesTabBadge_NONE            FilesTabBadge = 0
	FilesTabBadge_UPLOADING_STUCK FilesTabBadge = 1
	FilesTabBadge_AWAITING_UPLOAD FilesTabBadge = 2
	FilesTabBadge_UPLOADING       FilesTabBadge = 3
)

func (o FilesTabBadge) DeepCopy() FilesTabBadge { return o }

var FilesTabBadgeMap = map[string]FilesTabBadge{
	"NONE":            0,
	"UPLOADING_STUCK": 1,
	"AWAITING_UPLOAD": 2,
	"UPLOADING":       3,
}

var FilesTabBadgeRevMap = map[FilesTabBadge]string{
	0: "NONE",
	1: "UPLOADING_STUCK",
	2: "AWAITING_UPLOAD",
	3: "UPLOADING",
}

func (e FilesTabBadge) String() string {
	if v, ok := FilesTabBadgeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GUIViewType int

const (
	GUIViewType_DEFAULT GUIViewType = 0
	GUIViewType_TEXT    GUIViewType = 1
	GUIViewType_IMAGE   GUIViewType = 2
	GUIViewType_AUDIO   GUIViewType = 3
	GUIViewType_VIDEO   GUIViewType = 4
	GUIViewType_PDF     GUIViewType = 5
)

func (o GUIViewType) DeepCopy() GUIViewType { return o }

var GUIViewTypeMap = map[string]GUIViewType{
	"DEFAULT": 0,
	"TEXT":    1,
	"IMAGE":   2,
	"AUDIO":   3,
	"VIDEO":   4,
	"PDF":     5,
}

var GUIViewTypeRevMap = map[GUIViewType]string{
	0: "DEFAULT",
	1: "TEXT",
	2: "IMAGE",
	3: "AUDIO",
	4: "VIDEO",
	5: "PDF",
}

func (e GUIViewType) String() string {
	if v, ok := GUIViewTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type GUIFileContext struct {
	ViewType    GUIViewType `codec:"viewType" json:"viewType"`
	ContentType string      `codec:"contentType" json:"contentType"`
	Url         string      `codec:"url" json:"url"`
}

func (o GUIFileContext) DeepCopy() GUIFileContext {
	return GUIFileContext{
		ViewType:    o.ViewType.DeepCopy(),
		ContentType: o.ContentType,
		Url:         o.Url,
	}
}
