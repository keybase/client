// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/metadata.avdl

package keybase1

type KeyHalf struct {
	User      UID    `codec:"user" json:"user"`
	DeviceKID KID    `codec:"deviceKID" json:"deviceKID"`
	Key       []byte `codec:"key" json:"key"`
}

func (o KeyHalf) DeepCopy() KeyHalf {
	return KeyHalf{
		User:      o.User.DeepCopy(),
		DeviceKID: o.DeviceKID.DeepCopy(),
		Key: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Key),
	}
}

type MDBlock struct {
	Version   int    `codec:"version" json:"version"`
	Timestamp Time   `codec:"timestamp" json:"timestamp"`
	Block     []byte `codec:"block" json:"block"`
}

func (o MDBlock) DeepCopy() MDBlock {
	return MDBlock{
		Version:   o.Version,
		Timestamp: o.Timestamp.DeepCopy(),
		Block: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Block),
	}
}

type KeyBundle struct {
	Version int    `codec:"version" json:"version"`
	Bundle  []byte `codec:"bundle" json:"bundle"`
}

func (o KeyBundle) DeepCopy() KeyBundle {
	return KeyBundle{
		Version: o.Version,
		Bundle: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Bundle),
	}
}

type MetadataResponse struct {
	FolderID string    `codec:"folderID" json:"folderID"`
	MdBlocks []MDBlock `codec:"mdBlocks" json:"mdBlocks"`
}

func (o MetadataResponse) DeepCopy() MetadataResponse {
	return MetadataResponse{
		FolderID: o.FolderID,
		MdBlocks: (func(x []MDBlock) []MDBlock {
			if x == nil {
				return nil
			}
			ret := make([]MDBlock, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.MdBlocks),
	}
}

type MerkleRoot struct {
	Version int    `codec:"version" json:"version"`
	Root    []byte `codec:"root" json:"root"`
}

func (o MerkleRoot) DeepCopy() MerkleRoot {
	return MerkleRoot{
		Version: o.Version,
		Root: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Root),
	}
}

type PingResponse struct {
	Timestamp Time `codec:"timestamp" json:"timestamp"`
}

func (o PingResponse) DeepCopy() PingResponse {
	return PingResponse{
		Timestamp: o.Timestamp.DeepCopy(),
	}
}

type KeyBundleResponse struct {
	WriterBundle KeyBundle `codec:"WriterBundle" json:"WriterBundle"`
	ReaderBundle KeyBundle `codec:"ReaderBundle" json:"ReaderBundle"`
}

func (o KeyBundleResponse) DeepCopy() KeyBundleResponse {
	return KeyBundleResponse{
		WriterBundle: o.WriterBundle.DeepCopy(),
		ReaderBundle: o.ReaderBundle.DeepCopy(),
	}
}

type LockID int64

func (o LockID) DeepCopy() LockID {
	return o
}

type MDPriority int

func (o MDPriority) DeepCopy() MDPriority {
	return o
}

type LockContext struct {
	RequireLockID       LockID `codec:"requireLockID" json:"requireLockID"`
	ReleaseAfterSuccess bool   `codec:"releaseAfterSuccess" json:"releaseAfterSuccess"`
}

func (o LockContext) DeepCopy() LockContext {
	return LockContext{
		RequireLockID:       o.RequireLockID.DeepCopy(),
		ReleaseAfterSuccess: o.ReleaseAfterSuccess,
	}
}

type FindNextMDResponse struct {
	KbfsRoot    MerkleRoot `codec:"kbfsRoot" json:"kbfsRoot"`
	MerkleNodes [][]byte   `codec:"merkleNodes" json:"merkleNodes"`
	RootSeqno   Seqno      `codec:"rootSeqno" json:"rootSeqno"`
	RootHash    HashMeta   `codec:"rootHash" json:"rootHash"`
}

func (o FindNextMDResponse) DeepCopy() FindNextMDResponse {
	return FindNextMDResponse{
		KbfsRoot: o.KbfsRoot.DeepCopy(),
		MerkleNodes: (func(x [][]byte) [][]byte {
			if x == nil {
				return nil
			}
			ret := make([][]byte, len(x))
			for i, v := range x {
				vCopy := (func(x []byte) []byte {
					if x == nil {
						return nil
					}
					return append([]byte{}, x...)
				})(v)
				ret[i] = vCopy
			}
			return ret
		})(o.MerkleNodes),
		RootSeqno: o.RootSeqno.DeepCopy(),
		RootHash:  o.RootHash.DeepCopy(),
	}
}
