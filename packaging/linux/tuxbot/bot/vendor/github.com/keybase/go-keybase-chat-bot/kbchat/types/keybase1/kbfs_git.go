// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/kbfs_git.avdl

package keybase1

type GcOptions struct {
	MaxLooseRefs         int  `codec:"maxLooseRefs" json:"maxLooseRefs"`
	PruneMinLooseObjects int  `codec:"pruneMinLooseObjects" json:"pruneMinLooseObjects"`
	PruneExpireTime      Time `codec:"pruneExpireTime" json:"pruneExpireTime"`
	MaxObjectPacks       int  `codec:"maxObjectPacks" json:"maxObjectPacks"`
}

func (o GcOptions) DeepCopy() GcOptions {
	return GcOptions{
		MaxLooseRefs:         o.MaxLooseRefs,
		PruneMinLooseObjects: o.PruneMinLooseObjects,
		PruneExpireTime:      o.PruneExpireTime.DeepCopy(),
		MaxObjectPacks:       o.MaxObjectPacks,
	}
}
