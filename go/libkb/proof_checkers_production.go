// Copyright 2015 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// +build production staging

package libkb

// ListProofCheckers returns the supported networks for "keybase prove".
func ListProofCheckers() (proofCheckers []string) {
	for k := range _dispatch {
		// Rooter's a test social network for keybase proofs.
		if k != "rooter" {
			proofCheckers = append(proofCheckers, k)
		}
	}
	return proofCheckers
}
