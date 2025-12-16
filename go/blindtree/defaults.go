package blindtree

import (
	"github.com/keybase/client/go/merkletree2"
)

// Blind tree defaults. Should not be changed without updating the clients first!
const (
	encodingType                = merkletree2.EncodingTypeBlindedSHA512_256v1
	useBlindedValueHashes bool  = true
	logChildrenPerNode    uint8 = 1
	maxValuesPerLeaf            = 1
	keysByteLength              = 16
)

func GetCurrentBlindTreeConfig() (cfg merkletree2.Config) {
	valueConstructor := func() interface{} { return BlindMerkleValue{} }

	cfg, err := merkletree2.NewConfig(
		encodingType.GetEncoder(),
		useBlindedValueHashes,
		logChildrenPerNode,
		maxValuesPerLeaf,
		keysByteLength,
		valueConstructor)
	if err != nil {
		panic(err)
	}
	return cfg
}

// This config uses the non thread safe encoder.
func GetCurrentBlindTreeConfigUnsafe() (cfg merkletree2.Config) {
	valueConstructor := func() interface{} { return BlindMerkleValue{} }

	cfg, err := merkletree2.NewConfig(
		encodingType.GetUnsafeEncoder(),
		useBlindedValueHashes,
		logChildrenPerNode,
		maxValuesPerLeaf,
		keysByteLength,
		valueConstructor)
	if err != nil {
		panic(err)
	}
	return cfg
}
