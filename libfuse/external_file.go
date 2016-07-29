// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libfuse

import (
	"fmt"
	"io/ioutil"
	"os"
	"sync"
	"time"

	"golang.org/x/net/context"
)

func newExternalFile(path string) (*SpecialReadFile, error) {
	if path == "" {
		return nil, fmt.Errorf("No path for external file")
	}

	var once sync.Once
	var data []byte
	var err error
	var fileTime time.Time
	return &SpecialReadFile{
		read: func(context.Context) ([]byte, time.Time, error) {
			once.Do(func() {
				var info os.FileInfo
				info, err = os.Stat(path)
				if err != nil {
					return
				}
				fileTime = info.ModTime()
				data, err = ioutil.ReadFile(path)
			})
			return data, fileTime, err
		},
	}, nil
}
