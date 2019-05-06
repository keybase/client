package stellar

import (
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/keybase/stellarnet"
)

// AssetSliceToAssetBase converts []stellar1.Asset to []stellarnet.AssetBase.
func AssetSliceToAssetBase(path []stellar1.Asset) []stellarnet.AssetBase {
	a := make([]stellarnet.AssetBase, len(path))
	for i, p := range path {
		a[i] = p
	}
	return a
}
