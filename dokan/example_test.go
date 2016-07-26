// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package dokan

import (
	"log"
)

func ExampleMount() {
	var myFileSystem FileSystem // Should be the real filesystem implementation
	mp, err := Mount(&Config{FileSystem: myFileSystem, Path: `Q:`})
	if err != nil {
		log.Fatal("Mount failed:", err)
	}
	err = mp.BlockTillDone()
	if err != nil {
		log.Println("Filesystem exit:", err)
	}
}
