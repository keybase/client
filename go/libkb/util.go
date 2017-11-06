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
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"math"
	"math/big"
	"os"
	"os/user"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/keybase/client/go/logger"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/clockwork"
	"golang.org/x/net/context"
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

func MakeParentDirs(log SkinnyLogger, filename string) error {
	dir := filepath.Dir(filename)
	exists, err := FileExists(dir)
	if err != nil {
		log.Errorf("Can't see if parent dir %s exists", dir)
		return err
	}

	if !exists {
		err = os.MkdirAll(dir, PermDir)
		if err != nil {
			log.Errorf("Can't make parent dir %s", dir)
			return err
		}
		log.Debug("Created parent directory %s", dir)
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

type SafeWriteLogger interface {
	Debug(format string, args ...interface{})
	Errorf(format string, args ...interface{})
}

// SafeWriteToFile to safely write to a file. Use mode=0 for default permissions.
func safeWriteToFileOnce(g SafeWriteLogger, t SafeWriter, mode os.FileMode) (err error) {
	fn := t.GetFilename()
	g.Debug("+ SafeWriteToFile(%q)", fn)
	defer g.Debug("- SafeWriteToFile(%q) -> %s", fn, ErrToOk(err))

	tmpfn, tmp, err := OpenTempFile(fn, "", mode)
	if err != nil {
		return err
	}
	g.Debug("| Temporary file generated: %s", tmpfn)
	defer tmp.Close()
	defer os.Remove(tmpfn)

	g.Debug("| WriteTo %s", tmpfn)
	n, err := t.WriteTo(tmp)
	if err != nil {
		g.Errorf("| Error writing temporary file %s: %s", tmpfn, err)
		return err
	}
	if n != 0 {
		// unfortunately, some implementations always return 0 for the number
		// of bytes written, so not much info there, but will log it when
		// it isn't 0.
		g.Debug("| bytes written to temporary file %s: %d", tmpfn, n)
	}

	if err := tmp.Sync(); err != nil {
		g.Errorf("| Error syncing temporary file %s: %s", tmpfn, err)
		return err
	}

	if err := tmp.Close(); err != nil {
		g.Errorf("| Error closing temporary file %s: %s", tmpfn, err)
		return err
	}

	g.Debug("| Renaming temporary file %s -> permanent file %s", tmpfn, fn)
	if err := os.Rename(tmpfn, fn); err != nil {
		g.Errorf("| Error renaming temporary file %s -> permanent file %s: %s", tmpfn, fn, err)
		return err
	}

	if runtime.GOOS == "android" {
		g.Debug("| Android extra checks in safeWriteToFile")
		info, err := os.Stat(fn)
		if err != nil {
			g.Errorf("| Error os.Stat(%s): %s", fn, err)
			return err
		}
		g.Debug("| File info: name = %s", info.Name())
		g.Debug("| File info: size = %d", info.Size())
		g.Debug("| File info: mode = %s", info.Mode())
		g.Debug("| File info: mod time = %s", info.ModTime())

		g.Debug("| Android extra checks done")
	}

	g.Debug("| Done writing to file %s", fn)

	return nil
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

// Found regex here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
var hostnameRE = regexp.MustCompile("^(?i:[a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$")

func IsValidHostname(s string) bool {
	parts := strings.Split(s, ".")
	// Found regex here: http://stackoverflow.com/questions/106179/regular-expression-to-match-dns-hostname-or-ip-address
	if len(parts) < 2 {
		return false
	}
	for _, p := range parts {
		if !hostnameRE.MatchString(p) {
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
	var n int
	var err error
	buf := make([]byte, length)
	if n, err = rand.Read(buf); err != nil {
		return nil, err
	}
	// rand.Read uses io.ReadFull internally, so this check should never fail.
	if n != length {
		return nil, fmt.Errorf("RandBytes got too few bytes, %d < %d", n, length)
	}
	return buf, nil
}

func RandBytesWithSuffix(length int, suffix byte) ([]byte, error) {
	buf, err := RandBytes(length)
	if err != nil {
		return nil, err
	}
	buf[len(buf)-1] = suffix
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
		panic(fmt.Sprintf("RandInt error: %s", err))
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

func RandStringB64(numTriads int) string {
	buf, err := RandBytes(numTriads * 3)
	if err != nil {
		return ""
	}
	return base64.URLEncoding.EncodeToString(buf)
}

func RandHexString(prefix string, numbytes int) (string, error) {
	buf, err := RandBytes(numbytes)
	if err != nil {
		return "", err
	}
	str := hex.EncodeToString(buf)
	return prefix + str, nil
}

func Trace(log logger.Logger, msg string, f func() error) func() {
	log = log.CloneWithAddedDepth(1)
	log.Debug("+ %s", msg)
	return func() { log.Debug("- %s -> %s", msg, ErrToOk(f())) }
}

func TraceTimed(log logger.Logger, msg string, f func() error) func() {
	log = log.CloneWithAddedDepth(1)
	log.Debug("+ %s", msg)
	start := time.Now()
	return func() { log.Debug("- %s -> %s [time=%s]", msg, ErrToOk(f()), time.Since(start)) }
}

func CTrace(ctx context.Context, log logger.Logger, msg string, f func() error) func() {
	log = log.CloneWithAddedDepth(1)
	log.CDebugf(ctx, "+ %s", msg)
	return func() { log.CDebugf(ctx, "- %s -> %s", msg, ErrToOk(f())) }
}

func CTraceTimed(ctx context.Context, log logger.Logger, msg string, f func() error, cl clockwork.Clock) func() {
	log = log.CloneWithAddedDepth(1)
	log.CDebugf(ctx, "+ %s", msg)
	start := cl.Now()
	return func() {
		log.CDebugf(ctx, "- %s -> %v [time=%s]", msg, f(), cl.Since(start))
	}
}

func TraceOK(log logger.Logger, msg string, f func() bool) func() {
	log = log.CloneWithAddedDepth(1)
	log.Debug("+ %s", msg)
	return func() { log.Debug("- %s -> %v", msg, f()) }
}

func CTraceOK(ctx context.Context, log logger.Logger, msg string, f func() bool) func() {
	log = log.CloneWithAddedDepth(1)
	log.CDebugf(ctx, "+ %s", msg)
	return func() { log.CDebugf(ctx, "- %s -> %v", msg, f()) }
}

func (g *GlobalContext) Trace(msg string, f func() error) func() {
	return Trace(g.Log.CloneWithAddedDepth(1), msg, f)
}

func (g *GlobalContext) ExitTrace(msg string, f func() error) func() {
	return func() { g.Log.Debug("| %s -> %s", msg, ErrToOk(f())) }
}

func (g *GlobalContext) CTrace(ctx context.Context, msg string, f func() error) func() {
	return CTrace(ctx, g.Log.CloneWithAddedDepth(1), msg, f)
}

func (g *GlobalContext) CVTrace(ctx context.Context, lev VDebugLevel, msg string, f func() error) func() {
	g.VDL.CLogf(ctx, lev, "+ %s", msg)
	return func() { g.VDL.CLogf(ctx, lev, "- %s -> %v", msg, ErrToOk(f())) }
}

func (g *GlobalContext) CTraceTimed(ctx context.Context, msg string, f func() error) func() {
	return CTraceTimed(ctx, g.Log.CloneWithAddedDepth(1), msg, f, g.Clock())
}

func (g *GlobalContext) CTimeTracer(ctx context.Context, label string) *TimeTracer {
	return NewTimeTracer(ctx, g.Log.CloneWithAddedDepth(1), g.Clock(), label)
}

func (g *GlobalContext) ExitTraceOK(msg string, f func() bool) func() {
	return func() { g.Log.Debug("| %s -> %v", msg, f()) }
}

func (g *GlobalContext) TraceOK(msg string, f func() bool) func() {
	return TraceOK(g.Log.CloneWithAddedDepth(1), msg, f)
}

func (g *GlobalContext) CTraceOK(ctx context.Context, msg string, f func() bool) func() {
	return CTraceOK(ctx, g.Log.CloneWithAddedDepth(1), msg, f)
}

func (g *GlobalContext) CVTraceOK(ctx context.Context, lev VDebugLevel, msg string, f func() bool) func() {
	g.VDL.CLogf(ctx, lev, "+ %s", msg)
	return func() { g.VDL.CLogf(ctx, lev, "- %s -> %v", msg, f()) }

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
	out("time> %s: %s", name, time.Since(start))
}

// CTimeLog calls out with the time since start.  Use like this:
//    defer CTimeLog(ctx, "MyFunc", time.Now(), e.G().Log.Warning)
func CTimeLog(ctx context.Context, name string, start time.Time, out func(context.Context, string, ...interface{})) {
	out(ctx, "time> %s: %s", name, time.Since(start))
}

var wsRE = regexp.MustCompile(`\s+`)

func WhitespaceNormalize(s string) string {
	v := wsRE.Split(s, -1)
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

// LogTagsFromContext is a wrapper around logger.LogTagsFromContext
// that simply casts the result to the type expected by
// rpc.Connection.
func LogTagsFromContext(ctx context.Context) (map[interface{}]string, bool) {
	tags, ok := logger.LogTagsFromContext(ctx)
	return map[interface{}]string(tags), ok
}

func MakeByte24(a []byte) [24]byte {
	const n = 24
	if len(a) != n {
		panic(fmt.Sprintf("MakeByte expected len %v but got %v slice", n, len(a)))
	}
	var b [n]byte
	copy(b[:], a)
	return b
}

func MakeByte32(a []byte) [32]byte {
	const n = 32
	if len(a) != n {
		panic(fmt.Sprintf("MakeByte expected len %v but got %v slice", n, len(a)))
	}
	var b [n]byte
	copy(b[:], a)
	return b
}

func MakeByte32Soft(a []byte) ([32]byte, error) {
	const n = 32
	var b [n]byte
	if len(a) != n {
		return b, fmt.Errorf("MakeByte expected len %v but got %v slice", n, len(a))
	}
	copy(b[:], a)
	return b, nil
}

// Sleep until `deadline` or until `ctx` is canceled, whichever occurs first.
// Returns an error BUT the error is not really an error.
// It is nil if the sleep finished, and the non-nil result of Context.Err()
func SleepUntilWithContext(ctx context.Context, clock clockwork.Clock, deadline time.Time) error {
	if ctx == nil {
		// should not happen
		clock.AfterTime(deadline)
		return nil
	}
	select {
	case <-clock.AfterTime(deadline):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func CITimeMultiplier(g Contextifier) time.Duration {
	if g.G().GetEnv().RunningInCI() {
		return time.Duration(3)
	}
	return time.Duration(1)
}

type TimeTracer struct {
	sync.Mutex
	ctx    context.Context
	log    logger.Logger
	clock  clockwork.Clock
	label  string
	stage  string
	staged bool      // whether any stages were used
	start  time.Time // when the tracer started
	prev   time.Time // when the active stage started
}

func NewTimeTracer(ctx context.Context, log logger.Logger, clock clockwork.Clock, label string) *TimeTracer {
	now := clock.Now()
	log.CDebugf(ctx, "+ %s", label)
	return &TimeTracer{
		ctx:    ctx,
		log:    log,
		clock:  clock,
		label:  label,
		stage:  "init",
		staged: false,
		start:  now,
		prev:   now,
	}
}

func (t *TimeTracer) finishStage() {
	t.log.CDebugf(t.ctx, "| %s:%s [time=%s]", t.label, t.stage, t.clock.Since(t.prev))
}

func (t *TimeTracer) Stage(format string, args ...interface{}) {
	t.Lock()
	defer t.Unlock()
	t.finishStage()
	t.stage = fmt.Sprintf(format, args...)
	t.prev = t.clock.Now()
	t.staged = true
}

func (t *TimeTracer) Finish() {
	t.Lock()
	defer t.Unlock()
	if t.staged {
		t.finishStage()
	}
	t.log.CDebugf(t.ctx, "- %s [time=%s]", t.label, t.clock.Since(t.start))
}

func IsAppStatusCode(err error, code keybase1.StatusCode) bool {
	switch err := err.(type) {
	case AppStatusError:
		return err.Code == int(code)
	}
	return false
}

func CanExec(p string) error {
	return canExec(p)
}
