package libkb

import (
	"bufio"
	"bytes"
	"crypto/hmac"
	"fmt"
	"io"
	"os"
	"path"
	"strings"
	"time"
)

func ErrToOk(err error) string {
	if err == nil {
		return "ok"
	} else {
		return "ERROR"
	}
}

// exists returns whether the given file or directory exists or not
func FileExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func MakeParentDirs(filename string) error {

	dir, _ := path.Split(filename)
	exists, err := FileExists(dir)
	if err != nil {
		G.Log.Error("Can't see if parent dir %s exists", dir)
		return err
	}

	if !exists {
		err = os.MkdirAll(dir, PERM_DIR)
		if err != nil {
			G.Log.Error("Can't make parent dir %s", dir)
			return err
		} else {
			G.Log.Info("Created parent directory %s", dir)
		}
	}
	return nil
}

func FastByteArrayEq(a, b []byte) bool {
	return bytes.Equal(a, b)
}

func SecureByteArrayEq(a, b []byte) bool {
	return hmac.Equal(a, b)
}

func FormatTime(tm time.Time) string {
	layout := "2006-01-02 15:04:05 MST"
	return tm.Format(layout)
}

func cicmp(s1, s2 string) bool {
	return strings.ToLower(s1) == strings.ToLower(s2)
}

func depad(s string) string {
	b := []byte(s)
	i := len(b) - 1
	for ; i >= 0; i-- {
		if b[i] != '=' {
			i++
			break
		}
	}
	ret := string(b[0:i])
	return ret
}

func PickFirstError(errors ...error) error {
	for _, e := range errors {
		if e != nil {
			return e
		}
	}
	return nil
}

type FirstErrorPicker struct {
	e error
}

func (p *FirstErrorPicker) Push(e error) {
	if e != nil && p.e == nil {
		p.e = e
	}
}

func (p *FirstErrorPicker) Error() error {
	return p.e
}

func GiveMeAnS(i int) string {
	if i != 1 {
		return "s"
	} else {
		return ""
	}
}

func KeybaseEmailAddress(s string) string {
	return s + "@keybase.io"
}

func DrainPipe(rc io.Reader, sink func(string)) error {
	scanner := bufio.NewScanner(rc)
	for scanner.Scan() {
		sink(scanner.Text())
	}
	return scanner.Err()
}

type SafeWriter interface {
	GetFilename() string
	WriteTo(io.Writer) error
}

func SafeWriteToFile(t SafeWriter) error {
	fn := t.GetFilename()
	G.Log.Debug(fmt.Sprintf("+ Writing to %s", fn))
	tmpfn, tmp, err := TempFile(fn, PERM_FILE)
	G.Log.Debug(fmt.Sprintf("| Temporary file generated: %s", tmpfn))
	if err != nil {
		return err
	}

	err = t.WriteTo(tmp)
	if err == nil {
		err = tmp.Close()
		if err == nil {
			err = os.Rename(tmpfn, fn)
		} else {
			G.Log.Error(fmt.Sprintf("Error closing temporary file %s: %s", tmp, err.Error()))
			os.Remove(tmpfn)
		}
	} else {
		G.Log.Error(fmt.Sprintf("Error writing temporary keyring %s: %s", tmp, err.Error()))
		tmp.Close()
		os.Remove(tmpfn)
	}
	G.Log.Debug(fmt.Sprintf("- Wrote to %s -> %s", fn, ErrToOk(err)))
	return err

}
