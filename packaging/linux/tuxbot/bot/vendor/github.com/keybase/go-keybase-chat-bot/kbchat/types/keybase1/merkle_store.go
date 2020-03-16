// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/merkle_store.avdl

package keybase1

type MerkleStoreSupportedVersion int

func (o MerkleStoreSupportedVersion) DeepCopy() MerkleStoreSupportedVersion {
	return o
}

type MerkleStoreKitHash string

func (o MerkleStoreKitHash) DeepCopy() MerkleStoreKitHash {
	return o
}

type MerkleStoreKit string

func (o MerkleStoreKit) DeepCopy() MerkleStoreKit {
	return o
}

type MerkleStoreEntryString string

func (o MerkleStoreEntryString) DeepCopy() MerkleStoreEntryString {
	return o
}

type MerkleStoreEntry struct {
	Hash  MerkleStoreKitHash     `codec:"hash" json:"hash"`
	Entry MerkleStoreEntryString `codec:"entry" json:"entry"`
}

func (o MerkleStoreEntry) DeepCopy() MerkleStoreEntry {
	return MerkleStoreEntry{
		Hash:  o.Hash.DeepCopy(),
		Entry: o.Entry.DeepCopy(),
	}
}
