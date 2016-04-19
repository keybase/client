package libkbfs

import (
	"bytes"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// TlfHandle uniquely identifies top-level folders by readers and
// writers.  It is go-routine-safe.
type TlfHandle struct {
	Readers           []keybase1.UID             `codec:"r,omitempty"`
	Writers           []keybase1.UID             `codec:"w,omitempty"`
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	cachedName        string
	cachedBytes       []byte
	cacheMutex        sync.Mutex // control access to the "cached" values
}

// CanonicalTlfName is a string containing the canonical name of a TLF.
type CanonicalTlfName string

// NewTlfHandle constructs a new, blank TlfHandle.
func NewTlfHandle() *TlfHandle {
	return &TlfHandle{}
}

// TlfHandleDecode decodes b into a TlfHandle.
func TlfHandleDecode(b []byte, config Config) (*TlfHandle, error) {
	var handle TlfHandle
	err := config.Codec().Decode(b, &handle)
	if err != nil {
		return nil, err
	}

	return &handle, nil
}

// UIDList can be used to lexicographically sort UIDs.
type UIDList []keybase1.UID

func (u UIDList) Len() int {
	return len(u)
}

func (u UIDList) Less(i, j int) bool {
	return u[i].Less(u[j])
}

func (u UIDList) Swap(i, j int) {
	u[i], u[j] = u[j], u[i]
}

func sortedUIDsAndNames(m map[keybase1.UID]libkb.NormalizedUsername) (
	[]keybase1.UID, []string) {
	var uids []keybase1.UID
	var names []string
	for uid, name := range m {
		uids = append(uids, uid)
		names = append(names, name.String())
	}
	sort.Sort(UIDList(uids))
	sort.Sort(sort.StringSlice(names))
	return uids, names
}

func splitAndCheckTLFNameIntoWritersAndReaders(name string, public bool) (
	writerNames, readerNames []string, err error) {
	splitNames := strings.SplitN(name, ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, nil, BadTLFNameError{name}
	}
	writerNames = strings.Split(splitNames[0], ",")
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	}

	hasPublic := len(readerNames) == 0

	if public && !hasPublic {
		// No public folder exists for this folder.
		return nil, nil, NoSuchNameError{Name: name}
	}

	normalizedName := normalizeUserNamesInTLF(writerNames, readerNames)
	if normalizedName != name {
		return nil, nil, TlfNameNotCanonical{name, normalizedName}
	}

	return writerNames, readerNames, nil
}

// normalizeUserNamesInTLF takes a split TLF name and, without doing
// any resolutions or identify calls, normalizes all elements of the
// name that are bare user names. It then returns the normalized name.
//
// Note that this normalizes (i.e., lower-cases) any assertions in the
// name as well, but doesn't resolve them.  This is safe since the
// libkb assertion parser does that same thing.
func normalizeUserNamesInTLF(writerNames, readerNames []string) string {
	sortedWriterNames := make([]string, len(writerNames))
	for i, w := range writerNames {
		sortedWriterNames[i] = libkb.NewNormalizedUsername(w).String()
	}
	sort.Strings(sortedWriterNames)
	normalizedName := strings.Join(sortedWriterNames, ",")
	if len(readerNames) > 0 {
		sortedReaderNames := make([]string, len(readerNames))
		for i, r := range readerNames {
			sortedReaderNames[i] =
				libkb.NewNormalizedUsername(r).String()
		}
		sort.Strings(sortedReaderNames)
		normalizedName += ReaderSep + strings.Join(sortedReaderNames, ",")
	}
	return normalizedName
}

type userResolver func(ctx context.Context, assertion string, isWriter bool) (
	UserInfo, error)

func resolveOneUser(
	ctx context.Context, userResolver userResolver, assertion string,
	isWriter bool, errCh chan<- error, results chan<- UserInfo) {
	// short-circuit if this is the special public user:
	if assertion == PublicUIDName {
		results <- UserInfo{
			Name: PublicUIDName,
			UID:  keybase1.PublicUID,
		}
		return
	}

	userInfo, err := userResolver(ctx, assertion, isWriter)
	if err != nil {
		select {
		case errCh <- err:
		default:
			// another worker reported an error before us;
			// first one wins
		}
		return
	}
	results <- userInfo
}

func parseTlfHandleHelper(ctx context.Context, userResolver userResolver,
	public bool, writerNames, readerNames []string) (
	*TlfHandle, CanonicalTlfName, error) {
	if public && len(readerNames) > 0 {
		panic("public folder cannot have reader names")
	}

	// parallelize the resolutions for each user
	errCh := make(chan error, 1)
	wc := make(chan UserInfo, len(writerNames))
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	for _, writer := range writerNames {
		go resolveOneUser(ctx, userResolver, writer, true, errCh, wc)
	}

	rc := make(chan UserInfo, len(readerNames))
	for _, reader := range readerNames {
		go resolveOneUser(ctx, userResolver, reader, false, errCh, rc)
	}

	usedWNames := make(map[keybase1.UID]libkb.NormalizedUsername, len(writerNames))
	usedRNames := make(map[keybase1.UID]libkb.NormalizedUsername, len(readerNames))
	for i := 0; i < len(writerNames)+len(readerNames); i++ {
		select {
		case err := <-errCh:
			return nil, "", err
		case userInfo := <-wc:
			usedWNames[userInfo.UID] = userInfo.Name
		case userInfo := <-rc:
			usedRNames[userInfo.UID] = userInfo.Name
		case <-ctx.Done():
			return nil, "", ctx.Err()
		}
	}

	for uid := range usedWNames {
		delete(usedRNames, uid)
	}

	writerUIDs, writerNames := sortedUIDsAndNames(usedWNames)

	canonicalName := strings.Join(writerNames, ",")
	var cachedName string

	var readerUIDs []keybase1.UID
	if public {
		readerUIDs = []keybase1.UID{keybase1.PublicUID}
		// Public folders have the same canonical name as
		// their non-public equivalents.
		cachedName = canonicalName + ReaderSep + PublicUIDName
	} else {
		var readerNames []string
		readerUIDs, readerNames = sortedUIDsAndNames(usedRNames)
		if len(readerNames) > 0 {
			canonicalName += ReaderSep + strings.Join(readerNames, ",")
		}
		cachedName = canonicalName
	}

	h := &TlfHandle{
		Writers:    writerUIDs,
		Readers:    readerUIDs,
		cachedName: cachedName,
	}

	return h, CanonicalTlfName(canonicalName), nil
}

// resolveTlfHandle parses a TlfHandle from a split TLF name using
// kbpki.Resolve().
func resolveTlfHandle(ctx context.Context, kbpki KBPKI,
	public bool, writerNames, readerNames []string) (
	*TlfHandle, CanonicalTlfName, error) {
	resolveUser := func(ctx context.Context, assertion string, isWriter bool) (UserInfo, error) {
		name, uid, err := kbpki.Resolve(ctx, assertion)
		if err != nil {
			return UserInfo{}, err
		}
		return UserInfo{
			Name: name,
			UID:  uid,
		}, nil
	}
	return parseTlfHandleHelper(ctx, resolveUser, public, writerNames, readerNames)
}

func buildCanonicalPath(public bool, canonicalName CanonicalTlfName) string {
	var folderType string
	if public {
		folderType = "public"
	} else {
		folderType = "private"
	}
	// TODO: Handle windows paths?
	return fmt.Sprintf("/keybase/%s/%s", folderType, canonicalName)
}

func identifyHelper(ctx context.Context, kbpki KBPKI, _ CanonicalTlfName, assertion string, _ bool, public bool) (UserInfo, error) {
	var pubOrPri string
	if public {
		pubOrPri = "public"
	} else {
		pubOrPri = "private"
	}
	reason := fmt.Sprintf("You accessed a %s folder with %s.", pubOrPri, assertion)
	return kbpki.Identify(ctx, assertion, reason)
}

// identifyTlfHandle parses a TlfHandle from a split TLF name using
// kbpki.Identify().
func identifyTlfHandle(ctx context.Context, kbpki KBPKI,
	canonicalName CanonicalTlfName, public bool, writerNames, readerNames []string) (
	*TlfHandle, CanonicalTlfName, error) {
	identifyUser := func(ctx context.Context, assertion string, isWriter bool) (UserInfo, error) {
		return identifyHelper(ctx, kbpki, canonicalName, assertion, isWriter, public)
	}
	return parseTlfHandleHelper(ctx, identifyUser, public, writerNames, readerNames)
}

func identifyUID(ctx context.Context, kbpki KBPKI, canonicalName CanonicalTlfName,
	uid keybase1.UID, isWriter, isPublic bool) error {
	username, err := kbpki.GetNormalizedUsername(ctx, uid)
	if err != nil {
		return err
	}
	userInfo, err := identifyHelper(ctx, kbpki, canonicalName, username.String(), isWriter, isPublic)
	if err != nil {
		return err
	}
	if userInfo.Name != username {
		return fmt.Errorf("Identify returned name=%s, expected %s", userInfo.Name, username)
	}
	if userInfo.UID != uid {
		return fmt.Errorf("Identify returned uid=%s, expected %s", userInfo.UID, uid)
	}
	return nil
}

// GetCanonicalName returns the canonical name of this TLF.
func (h *TlfHandle) GetCanonicalName(ctx context.Context, config Config) CanonicalTlfName {
	s := h.ToString(ctx, config)
	if h.IsPublic() {
		return CanonicalTlfName(strings.TrimSuffix(s, ReaderSep+PublicUIDName))
	}
	return CanonicalTlfName(s)
}

func identifyOneUID(ctx context.Context, kbpki KBPKI,
	canonicalName CanonicalTlfName, uid keybase1.UID, isWriter,
	isPublic bool, errChan chan<- error) {
	err := identifyUID(ctx, kbpki, canonicalName, uid, isWriter, isPublic)
	if err != nil {
		select {
		case errChan <- err:
		default:
		}
	}
}

// identifyHandle identifies the canonical names in the given handle.
func identifyHandle(ctx context.Context, config Config, h *TlfHandle) error {
	canonicalName := h.GetCanonicalName(ctx, config)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var wg sync.WaitGroup
	errChan := make(chan error, 1)
	// TODO: limit the number of concurrent identifies?
	for _, writerUID := range h.Writers {
		wg.Add(1)
		localWriter := writerUID
		go func() {
			defer wg.Done()
			identifyOneUID(ctx, config.KBPKI(), canonicalName, localWriter,
				true, h.IsPublic(), errChan)
		}()
	}

	if !h.IsPublic() && len(h.Readers) > 0 {
		for _, readerUID := range h.Readers {
			wg.Add(1)
			localReader := readerUID
			go func() {
				defer wg.Done()
				identifyOneUID(ctx, config.KBPKI(), canonicalName, localReader,
					false, h.IsPublic(), errChan)
			}()
		}
	}

	go func() {
		wg.Wait()
		close(errChan)
	}()

	return <-errChan
}

// IsPublic returns whether or not this TlfHandle represents a public
// top-level folder.
func (h *TlfHandle) IsPublic() bool {
	return len(h.Readers) == 1 && h.Readers[0].Equal(keybase1.PublicUID)
}

// IsPrivateShare returns whether or not this TlfHandle represents a
// private share (some non-public directory with more than one writer).
func (h *TlfHandle) IsPrivateShare() bool {
	return !h.IsPublic() && len(h.Writers) > 1
}

// HasPublic represents whether this top-level folder should have a
// corresponding public top-level folder.
func (h *TlfHandle) HasPublic() bool {
	return len(h.Readers) == 0
}

func (h *TlfHandle) findUserInList(user keybase1.UID,
	users []keybase1.UID) bool {
	// TODO: this could be more efficient with a cached map/set
	for _, u := range users {
		if u == user {
			return true
		}
	}
	return false
}

// IsWriter returns whether or not the given user is a writer for the
// top-level folder represented by this TlfHandle.
func (h *TlfHandle) IsWriter(user keybase1.UID) bool {
	return h.findUserInList(user, h.Writers)
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this TlfHandle.
func (h *TlfHandle) IsReader(user keybase1.UID) bool {
	return h.IsPublic() || h.findUserInList(user, h.Readers) || h.IsWriter(user)
}

func resolveUIDs(ctx context.Context, config Config,
	uids []keybase1.UID) string {
	names := make([]string, 0, len(uids))
	// TODO: parallelize?
	for _, uid := range uids {
		if uid.Equal(keybase1.PublicUID) {
			// PublicUIDName is already normalized.
			names = append(names, PublicUIDName)
		} else if name, err := config.KBPKI().GetNormalizedUsername(ctx, uid); err == nil {
			names = append(names, string(name))
		} else {
			// TODO: Somehow try to set the tlf name and public field
			// correctly?
			config.Reporter().ReportErr(ctx, "", false, ReadMode, err)
			names = append(names, fmt.Sprintf("uid:%s", uid))
		}
	}

	sort.Strings(names)
	return strings.Join(names, ",")
}

// ToString returns a string representation of this TlfHandle.
func (h *TlfHandle) ToString(ctx context.Context, config Config) string {
	h.cacheMutex.Lock()
	defer h.cacheMutex.Unlock()
	if h.cachedName != "" {
		return h.cachedName
	}

	h.cachedName = resolveUIDs(ctx, config, h.Writers)

	// assume only additional readers are listed
	if len(h.Readers) > 0 {
		h.cachedName += ReaderSep + resolveUIDs(ctx, config, h.Readers)
	}

	// TODO: don't cache if there were errors?
	return h.cachedName
}

// GetCanonicalPath returns the full canonical path of this TLF.
func (h *TlfHandle) GetCanonicalPath(ctx context.Context, config Config) string {
	return buildCanonicalPath(h.IsPublic(), h.GetCanonicalName(ctx, config))
}

// ToBytes marshals this TlfHandle.
func (h *TlfHandle) ToBytes(config Config) (out []byte, err error) {
	h.cacheMutex.Lock()
	defer h.cacheMutex.Unlock()
	if len(h.cachedBytes) > 0 {
		return h.cachedBytes, nil
	}

	if out, err = config.Codec().Encode(h); err != nil {
		h.cachedBytes = out
	}
	return out, err
}

// ToFavorite converts a TlfHandle into a Favorite, suitable for
// Favorites calls.
func (h *TlfHandle) ToFavorite(ctx context.Context, config Config) Favorite {
	return Favorite{
		Name:   string(h.GetCanonicalName(ctx, config)),
		Public: h.IsPublic(),
	}
}

// Equal returns true if two TlfHandles are equal.
func (h *TlfHandle) Equal(rhs *TlfHandle, config Config) bool {
	hBytes, _ := h.ToBytes(config)
	rhsBytes, _ := rhs.ToBytes(config)
	return bytes.Equal(hBytes, rhsBytes)
}

// Users returns a list of all reader and writer UIDs for the tlf.
func (h *TlfHandle) Users() []keybase1.UID {
	var users []keybase1.UID
	users = append(users, h.Writers...)
	users = append(users, h.Readers...)
	return users
}

// ParseTlfHandle parses a TlfHandle from an encoded string. See
// ToString for the opposite direction.
//
// Some errors that may be returned and can be specially handled:
//
// TlfNameNotCanonical: Returned when the given name is not canonical
// -- another name to try (which itself may not be canonical) is in
// the error. Usually, you want to treat this as a symlink to the name
// to try.
//
// NoSuchNameError: Returned when public is set and the given folder
// has no public folder.
func ParseTlfHandle(
	ctx context.Context, kbpki KBPKI, name string, public bool) (
	*TlfHandle, error) {
	// Before parsing the tlf handle (which results in identify
	// calls that cause tracker popups), first see if there's any
	// quick normalization of usernames we can do.  For example,
	// this avoids an identify in the case of "HEAD" which might
	// just be a shell trying to look for a git repo rather than a
	// real user lookup for "head" (KBFS-531).  Note that the name
	// might still contain assertions, which will result in
	// another alias in a subsequent lookup.
	writerNames, readerNames, err := splitAndCheckTLFNameIntoWritersAndReaders(name, public)
	if err != nil {
		return nil, err
	}

	h, canonicalName, err := resolveTlfHandle(
		ctx, kbpki, public, writerNames, readerNames)
	if err != nil {
		return nil, err
	}

	if !public {
		currentUsername, currentUID, err := kbpki.GetCurrentUserInfo(ctx)
		if err != nil {
			return nil, err
		}

		canRead := false

		for _, uid := range append(h.Writers, h.Readers...) {
			if uid == currentUID {
				canRead = true
				break
			}
		}

		if !canRead {
			return nil, ReadAccessError{currentUsername, canonicalName, public}
		}
	}

	if string(canonicalName) == name {
		// Name is already canonical (i.e., all usernames and
		// no assertions) so we can delay the identify until
		// the node is actually used.
		return h, nil
	}

	// Otherwise, identify before returning the canonical name.
	_, _, err = identifyTlfHandle(
		ctx, kbpki, canonicalName, public, writerNames, readerNames)
	if err != nil {
		return nil, err
	}

	return nil, TlfNameNotCanonical{name, string(canonicalName)}
}

// CheckTlfHandleOffline does light checks whether a TLF handle looks ok,
// it avoids all network calls.
func CheckTlfHandleOffline(
	ctx context.Context, name string, public bool) error {
	_, _, err := splitAndCheckTLFNameIntoWritersAndReaders(name, public)
	return err
}
