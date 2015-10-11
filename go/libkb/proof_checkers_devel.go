// +build !production,!staging

package libkb

// ListProofCheckers returns the supported networks for "keybase prove".
func ListProofCheckers() (proofCheckers []string) {
	for k := range _dispatch {
		proofCheckers = append(proofCheckers, k)
	}
	return proofCheckers
}
