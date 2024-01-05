// Modified from https://github.com/aktau/github-release/blob/master/file.go

package github

import (
	"fmt"
	"io"
	"os"
)

func getFileSize(f *os.File) (int64, error) {
	/* first try stat */
	off, err := fsizeStat(f)
	if err != nil {
		/* if that fails, try seek */
		return fsizeSeek(f)
	}

	return off, nil
}

func fsizeStat(f *os.File) (int64, error) {
	fi, err := f.Stat()

	if err != nil {
		return 0, err
	}

	return fi.Size(), nil
}

func fsizeSeek(f io.Seeker) (int64, error) {
	off, err := f.Seek(0, 2)
	if err != nil {
		return 0, fmt.Errorf("seeking did not work, stdin is not" +
			"supported yet because github doesn't support chunking" +
			"requests (and I haven't implemented detecting stdin and" +
			"buffering yet")
	}

	_, err = f.Seek(0, 0)
	if err != nil {
		return 0, fmt.Errorf("could not seek back in the file")
	}
	return off, nil
}
