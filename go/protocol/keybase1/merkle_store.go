// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/merkle_store.avdl

package keybase1

import (
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

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

type Merkle_storeInterface interface {
}

func Merkle_storeProtocol(i Merkle_storeInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.merkle_store",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type Merkle_storeClient struct {
	Cli rpc.GenericClient
}
