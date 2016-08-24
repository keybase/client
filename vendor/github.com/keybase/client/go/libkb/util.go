// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"bufio"
	"bytes"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"fmt"
	"io"
	"math"
	"math/big"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// PrereleaseBuild can be set at compile time for prerelease builds.
// CAUTION: Don't change the name of this variable without grepping for
// occurrences in shell scripts!
var PrereleaseBuild string

// VersionString returns semantic version string
func VersionString() string {
	if PrereleaseBuild != "" {
		return fmt.Sprintf("%s-%s", Version, PrereleaseBuild)
	}
	return Version
}

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

	dir, _ := filepath.Split(filename)
	exists, err := FileExists(dir)
	if err != nil {
		G.Log.Errorf("Can't see if parent dir %s exists", dir)
		return err
	}

	if !exists {
		err = os.MkdirAll(dir, PermDir)
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

func TrimCicmp(s1, s2 string) bool {
	return Cicmp(strings.TrimSpace(s1), strings.TrimSpace(s2))
}

func NameTrim(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	strip := func(r rune) rune {
		switch {
		case r == '_', r == '-', r == '+', r == '\'':
			return -1
		case unicode.IsSpace(r):
			return -1
		}
		return r

	}
	return strings.Map(strip, s)
}

// NameCmp removes whitespace and underscores, compares tolower.
func NameCmp(n1, n2 string) bool {
	return NameTrim(n1) == NameTrim(n2)
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

// SafeWriteToFile to safely write to a file. Use mode=0 for default permissions.
func SafeWriteToFile(t SafeWriter, mode os.FileMode) error {
	fn := t.GetFilename()
	G.Log.Debug(fmt.Sprintf("+ Writing to %s", fn))
	tmpfn, tmp, err := OpenTempFile(fn, "", mode)
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
			G.Log.Error(fmt.Sprintf("Error closing temporary file %s: %s", tmpfn, err))
			os.Remove(tmpfn)
		}
	} else {
		G.Log.Error(fmt.Sprintf("Error writing temporary file %s: %s", tmpfn, err))
		tmp.Close()
		os.Remove(tmpfn)
	}
	G.Log.Debug(fmt.Sprintf("- Wrote to %s -> %s", fn, ErrToOk(err)))
	return err
}

// Pluralize returns pluralized string with value.
// For example,
//   Pluralize(1, "zebra", "zebras", true) => "1 zebra"
//   Pluralize(2, "zebra", "zebras", true) => "2 zebras"
//   Pluralize(2, "zebra", "zebras", false) => "zebras"
func Pluralize(n int, singular string, plural string, nshow bool) string {
	if n == 1 {
		if nshow {
			return fmt.Sprintf("%d %s", n, singular)
		}
		return singular
	}
	if nshow {
		return fmt.Sprintf("%d %s", n, plural)
	}
	return plural
}

// Contains returns true if string is contained in string slice
func Contains(s string, list []string) bool {
	return IsIn(s, list, false)
}

// IsIn checks for needle in haystack, ci means case-insensitive.
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

// MakeURI makes a URI string out of the given protocol and
// host strings, adding necessary punctuation in between.
func MakeURI(prot string, host string) string {
	if prot == "" {
		return host
	}
	if prot[len(prot)-1] != ':' {
		prot += ":"
	}
	return prot + "//" + host
}

// RemoveNilErrors returns error slice with ni errors removed.
func RemoveNilErrors(errs []error) []error {
	var r []error
	for _, err := range errs {
		if err != nil {
			r = append(r, err)
		}
	}
	return r
}

// CombineErrors returns a single error for multiple errors, or nil if none.
func CombineErrors(errs ...error) error {
	errs = RemoveNilErrors(errs)
	if len(errs) == 0 {
		return nil
	} else if len(errs) == 1 {
		return errs[0]
	}

	msgs := []string{}
	for _, err := range errs {
		msgs = append(msgs, err.Error())
	}
	return fmt.Errorf("There were multiple errors: %s", strings.Join(msgs, "; "))
}

// IsDirEmpty returns whether directory has any files.
func IsDirEmpty(dir string) (bool, error) {
	f, err := os.Open(dir)
	if err != nil {
		return false, err
	}
	defer f.Close()

	_, err = f.Readdir(1)
	if err == io.EOF {
		return true, nil
	}
	return false, err // Either not empty or error, suits both cases
}

// RandString returns random (base32) string with prefix.
func RandString(prefix string, numbytes int) (string, error) {
	buf, err := RandBytes(numbytes)
	if err != nil {
		return "", err
	}
	str := base32.StdEncoding.EncodeToString(buf)
	if prefix != "" {
		str = strings.Join([]string{prefix, str}, "")
	}
	return str, nil
}

func Trace(log logger.Logger, msg string, f func() error) func() {
	log.Debug("+ %s", msg)
	return func() { log.Debug("- %s -> %s", msg, ErrToOk(f())) }
}

func (g *GlobalContext) Trace(msg string, f func() error) func() {
	return Trace(g.Log, msg, f)
}

// SplitByRunes splits string by runes
func SplitByRunes(s string, separators []rune) []string {
	f := func(r rune) bool {
		for _, s := range separators {
			if r == s {
				return true
			}
		}
		return false
	}
	return strings.FieldsFunc(s, f)
}

// SplitPath return string split by path separator: SplitPath("/a/b/c") => []string{"a", "b", "c"}
func SplitPath(s string) []string {
	return SplitByRunes(s, []rune{filepath.Separator})
}

// IsSystemAdminUser returns true if current user is root or admin (system user, not Keybase user).
// WARNING: You shouldn't rely on this for security purposes.
func IsSystemAdminUser() (isAdminUser bool, match string, err error) {
	u, err := user.Current()
	if err != nil {
		return
	}

	if u.Uid == "0" {
		match = "Uid: 0"
		isAdminUser = true
		return
	}
	return
}

// DigestForFileAtPath returns a SHA256 digest for file at specified path
func DigestForFileAtPath(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	return Digest(f)
}

// Digest returns a SHA256 digest
func Digest(r io.Reader) (string, error) {
	hasher := sha256.New()
	if _, err := io.Copy(hasher, r); err != nil {
		return "", err
	}
	digest := hex.EncodeToString(hasher.Sum(nil))
	return digest, nil
}

// TimeLog calls out with the time since start.  Use like this:
//    defer TimeLog("MyFunc", time.Now(), e.G().Log.Warning)
func TimeLog(name string, start time.Time, out func(string, ...interface{})) {
	out("* %s: %s", name, time.Since(start))
}

func WhitespaceNormalize(s string) string {
	v := regexp.MustCompile(`\s+`).Split(s, -1)
	if len(v) > 0 && len(v[0]) == 0 {
		v = v[1:]
	}
	if len(v) > 0 && len(v[len(v)-1]) == 0 {
		v = v[0 : len(v)-1]
	}
	return strings.Join(v, " ")
}

// JoinPredicate joins strings with predicate
func JoinPredicate(arr []string, delimeter string, f func(s string) bool) string {
	arrNew := make([]string, 0, len(arr))
	for _, s := range arr {
		if f(s) {
			arrNew = append(arrNew, s)
		}
	}
	return strings.Join(arrNew, delimeter)
}
