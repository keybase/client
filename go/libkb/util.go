package libkb

import (
	"bufio"
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"math"
	"math/big"
	"os"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/protocol/go"
)

func ErrToOk(err error) string {
	if err == nil {
		return "ok"
	}
	return "ERROR: " + err.Error()
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
		G.Log.Errorf("Can't see if parent dir %s exists", dir)
		return err
	}

	if !exists {
		err = os.MkdirAll(dir, PERM_DIR)
		if err != nil {
			G.Log.Errorf("Can't make parent dir %s", dir)
			return err
		}
		G.Log.Debug("Created parent directory %s", dir)
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

func Cicmp(s1, s2 string) bool {
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
	}
	return ""
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
	WriteTo(io.Writer) (int64, error)
}

func SafeWriteToFile(t SafeWriter) error {
	fn := t.GetFilename()
	G.Log.Debug(fmt.Sprintf("+ Writing to %s", fn))
	tmpfn, tmp, err := TempFile(fn, PERM_FILE)
	G.Log.Debug(fmt.Sprintf("| Temporary file generated: %s", tmpfn))
	if err != nil {
		return err
	}

	_, err = t.WriteTo(tmp)
	if err == nil {
		err = tmp.Close()
		if err == nil {
			err = os.Rename(tmpfn, fn)
		} else {
			G.Log.Error(fmt.Sprintf("Error closing temporary file %s: %s", tmpfn, err.Error()))
			os.Remove(tmpfn)
		}
	} else {
		G.Log.Error(fmt.Sprintf("Error writing temporary keyring %s: %s", tmpfn, err.Error()))
		tmp.Close()
		os.Remove(tmpfn)
	}
	G.Log.Debug(fmt.Sprintf("- Wrote to %s -> %s", fn, ErrToOk(err)))
	return err
}

func IsIn(needle string, haystack []string, ci bool) bool {
	for _, h := range haystack {
		if (ci && Cicmp(h, needle)) || (!ci && h == needle) {
			return true
		}
	}
	return false
}

func IsValidHostname(s string) bool {
	parts := strings.Split(s, ".")
	// Found regex here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
	rxx := regexp.MustCompile("^(?i:[a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$")
	if len(parts) < 2 {
		return false
	}
	for _, p := range parts {
		if !rxx.MatchString(p) {
			return false
		}
	}
	// TLDs must be >=2 chars
	if len(parts[len(parts)-1]) < 2 {
		return false
	}
	return true
}

func RandBytes(length int) ([]byte, error) {
	buf := make([]byte, length)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func XORBytes(dst, a, b []byte) int {
	n := len(a)
	if len(b) < n {
		n = len(b)
	}
	for i := 0; i < n; i++ {
		dst[i] = a[i] ^ b[i]
	}
	return n
}

// The standard time.Unix() converter interprets 0 as the Unix epoch (1970).
// But in PGP, an expiry time of zero indicates that a key never expires, and
// it would be nice to be able to check for that case with Time.IsZero(). This
// conversion special-cases 0 to be time.Time's zero-value (1 AD), so that we
// get that nice property.
func UnixToTimeMappingZero(unixTime int64) time.Time {
	if unixTime == 0 {
		var zeroTime time.Time
		return zeroTime
	}
	return time.Unix(unixTime, 0)
}

func Unquote(data []byte) string { return keybase1.Unquote(data) }

func HexDecodeQuoted(data []byte) ([]byte, error) {
	return hex.DecodeString(Unquote(data))
}

func IsArmored(buf []byte) bool {
	return bytes.HasPrefix(bytes.TrimSpace(buf), []byte("-----"))
}

var clearStart = []byte("-----BEGIN PGP SIGNED MESSAGE-----")

func IsClearsign(p *Peeker) bool {
	// there should be a newline at the start, so add 1 to length.
	// (but this will accept a message without the newline)
	start := make([]byte, len(clearStart)+1)
	_, err := p.Peek(start)
	if err != nil {
		return false
	}
	return bytes.HasPrefix(bytes.TrimSpace(start), clearStart)
}

func RandInt64() (int64, error) {
	max := big.NewInt(math.MaxInt64)
	x, err := rand.Int(rand.Reader, max)
	if err != nil {
		return 0, err
	}
	return x.Int64(), nil
}

func RandInt() (int, error) {
	x, err := RandInt64()
	if err != nil {
		return 0, err
	}
	return int(x), nil
}

func RandIntn(n int) int {
	x, err := RandInt()
	if err != nil {
		G.Log.Warning("RandInt error: %s", err)
		return 0
	}
	return x % n
}

// OpenLogFile opens the standard Keybase logfile, and returns its
// name, its File object, or an Error if it didn't work out.
func OpenLogFile() (name string, file *os.File, err error) {
	name = G.Env.GetLogFile()
	return logger.OpenLogFile(name)
}
