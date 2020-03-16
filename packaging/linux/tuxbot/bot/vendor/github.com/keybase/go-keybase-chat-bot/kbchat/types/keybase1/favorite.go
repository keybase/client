// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/favorite.avdl

package keybase1

import (
	"errors"
	"fmt"
)

type FolderType int

const (
	FolderType_UNKNOWN FolderType = 0
	FolderType_PRIVATE FolderType = 1
	FolderType_PUBLIC  FolderType = 2
	FolderType_TEAM    FolderType = 3
)

func (o FolderType) DeepCopy() FolderType { return o }

var FolderTypeMap = map[string]FolderType{
	"UNKNOWN": 0,
	"PRIVATE": 1,
	"PUBLIC":  2,
	"TEAM":    3,
}

var FolderTypeRevMap = map[FolderType]string{
	0: "UNKNOWN",
	1: "PRIVATE",
	2: "PUBLIC",
	3: "TEAM",
}

func (e FolderType) String() string {
	if v, ok := FolderTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FolderConflictType int

const (
	FolderConflictType_NONE                  FolderConflictType = 0
	FolderConflictType_IN_CONFLICT           FolderConflictType = 1
	FolderConflictType_IN_CONFLICT_AND_STUCK FolderConflictType = 2
	FolderConflictType_CLEARED_CONFLICT      FolderConflictType = 3
)

func (o FolderConflictType) DeepCopy() FolderConflictType { return o }

var FolderConflictTypeMap = map[string]FolderConflictType{
	"NONE":                  0,
	"IN_CONFLICT":           1,
	"IN_CONFLICT_AND_STUCK": 2,
	"CLEARED_CONFLICT":      3,
}

var FolderConflictTypeRevMap = map[FolderConflictType]string{
	0: "NONE",
	1: "IN_CONFLICT",
	2: "IN_CONFLICT_AND_STUCK",
	3: "CLEARED_CONFLICT",
}

func (e FolderConflictType) String() string {
	if v, ok := FolderConflictTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ConflictStateType int

const (
	ConflictStateType_NormalView               ConflictStateType = 1
	ConflictStateType_ManualResolvingLocalView ConflictStateType = 2
)

func (o ConflictStateType) DeepCopy() ConflictStateType { return o }

var ConflictStateTypeMap = map[string]ConflictStateType{
	"NormalView":               1,
	"ManualResolvingLocalView": 2,
}

var ConflictStateTypeRevMap = map[ConflictStateType]string{
	1: "NormalView",
	2: "ManualResolvingLocalView",
}

func (e ConflictStateType) String() string {
	if v, ok := ConflictStateTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FolderNormalView struct {
	ResolvingConflict bool   `codec:"resolvingConflict" json:"resolvingConflict"`
	StuckInConflict   bool   `codec:"stuckInConflict" json:"stuckInConflict"`
	LocalViews        []Path `codec:"localViews" json:"localViews"`
}

func (o FolderNormalView) DeepCopy() FolderNormalView {
	return FolderNormalView{
		ResolvingConflict: o.ResolvingConflict,
		StuckInConflict:   o.StuckInConflict,
		LocalViews: (func(x []Path) []Path {
			if x == nil {
				return nil
			}
			ret := make([]Path, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.LocalViews),
	}
}

type FolderConflictManualResolvingLocalView struct {
	NormalView Path `codec:"normalView" json:"normalView"`
}

func (o FolderConflictManualResolvingLocalView) DeepCopy() FolderConflictManualResolvingLocalView {
	return FolderConflictManualResolvingLocalView{
		NormalView: o.NormalView.DeepCopy(),
	}
}

type ConflictState struct {
	ConflictStateType__        ConflictStateType                       `codec:"conflictStateType" json:"conflictStateType"`
	Normalview__               *FolderNormalView                       `codec:"normalview,omitempty" json:"normalview,omitempty"`
	Manualresolvinglocalview__ *FolderConflictManualResolvingLocalView `codec:"manualresolvinglocalview,omitempty" json:"manualresolvinglocalview,omitempty"`
}

func (o *ConflictState) ConflictStateType() (ret ConflictStateType, err error) {
	switch o.ConflictStateType__ {
	case ConflictStateType_NormalView:
		if o.Normalview__ == nil {
			err = errors.New("unexpected nil value for Normalview__")
			return ret, err
		}
	case ConflictStateType_ManualResolvingLocalView:
		if o.Manualresolvinglocalview__ == nil {
			err = errors.New("unexpected nil value for Manualresolvinglocalview__")
			return ret, err
		}
	}
	return o.ConflictStateType__, nil
}

func (o ConflictState) Normalview() (res FolderNormalView) {
	if o.ConflictStateType__ != ConflictStateType_NormalView {
		panic("wrong case accessed")
	}
	if o.Normalview__ == nil {
		return
	}
	return *o.Normalview__
}

func (o ConflictState) Manualresolvinglocalview() (res FolderConflictManualResolvingLocalView) {
	if o.ConflictStateType__ != ConflictStateType_ManualResolvingLocalView {
		panic("wrong case accessed")
	}
	if o.Manualresolvinglocalview__ == nil {
		return
	}
	return *o.Manualresolvinglocalview__
}

func NewConflictStateWithNormalview(v FolderNormalView) ConflictState {
	return ConflictState{
		ConflictStateType__: ConflictStateType_NormalView,
		Normalview__:        &v,
	}
}

func NewConflictStateWithManualresolvinglocalview(v FolderConflictManualResolvingLocalView) ConflictState {
	return ConflictState{
		ConflictStateType__:        ConflictStateType_ManualResolvingLocalView,
		Manualresolvinglocalview__: &v,
	}
}

func (o ConflictState) DeepCopy() ConflictState {
	return ConflictState{
		ConflictStateType__: o.ConflictStateType__.DeepCopy(),
		Normalview__: (func(x *FolderNormalView) *FolderNormalView {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Normalview__),
		Manualresolvinglocalview__: (func(x *FolderConflictManualResolvingLocalView) *FolderConflictManualResolvingLocalView {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Manualresolvinglocalview__),
	}
}

// Folder represents a favorite top-level folder in kbfs.
// This type is likely to change significantly as all the various parts are
// connected and tested.
type Folder struct {
	Name          string            `codec:"name" json:"name"`
	Private       bool              `codec:"private" json:"private"`
	Created       bool              `codec:"created" json:"created"`
	FolderType    FolderType        `codec:"folderType" json:"folderType"`
	TeamID        *TeamID           `codec:"team_id,omitempty" json:"team_id,omitempty"`
	ResetMembers  []User            `codec:"reset_members" json:"reset_members"`
	Mtime         *Time             `codec:"mtime,omitempty" json:"mtime,omitempty"`
	ConflictState *ConflictState    `codec:"conflictState,omitempty" json:"conflictState,omitempty"`
	SyncConfig    *FolderSyncConfig `codec:"syncConfig,omitempty" json:"syncConfig,omitempty"`
}

func (o Folder) DeepCopy() Folder {
	return Folder{
		Name:       o.Name,
		Private:    o.Private,
		Created:    o.Created,
		FolderType: o.FolderType.DeepCopy(),
		TeamID: (func(x *TeamID) *TeamID {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.TeamID),
		ResetMembers: (func(x []User) []User {
			if x == nil {
				return nil
			}
			ret := make([]User, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.ResetMembers),
		Mtime: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Mtime),
		ConflictState: (func(x *ConflictState) *ConflictState {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ConflictState),
		SyncConfig: (func(x *FolderSyncConfig) *FolderSyncConfig {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.SyncConfig),
	}
}

type FolderHandle struct {
	Name       string     `codec:"name" json:"name"`
	FolderType FolderType `codec:"folderType" json:"folderType"`
	Created    bool       `codec:"created" json:"created"`
}

func (o FolderHandle) DeepCopy() FolderHandle {
	return FolderHandle{
		Name:       o.Name,
		FolderType: o.FolderType.DeepCopy(),
		Created:    o.Created,
	}
}

type FavoritesResult struct {
	FavoriteFolders []Folder `codec:"favoriteFolders" json:"favoriteFolders"`
	IgnoredFolders  []Folder `codec:"ignoredFolders" json:"ignoredFolders"`
	NewFolders      []Folder `codec:"newFolders" json:"newFolders"`
}

func (o FavoritesResult) DeepCopy() FavoritesResult {
	return FavoritesResult{
		FavoriteFolders: (func(x []Folder) []Folder {
			if x == nil {
				return nil
			}
			ret := make([]Folder, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.FavoriteFolders),
		IgnoredFolders: (func(x []Folder) []Folder {
			if x == nil {
				return nil
			}
			ret := make([]Folder, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.IgnoredFolders),
		NewFolders: (func(x []Folder) []Folder {
			if x == nil {
				return nil
			}
			ret := make([]Folder, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.NewFolders),
	}
}
