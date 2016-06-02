// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

// BareTlfHandle uniquely identifies top-level folders by readers and
// writers.
//
// TODO: Have separate types for writers vs. readers.
type BareTlfHandle struct {
	Writers           []keybase1.UID             `codec:"w,omitempty"`
	Readers           []keybase1.UID             `codec:"r,omitempty"`
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`
	ConflictInfo      *ConflictInfo              `codec:"ci,omitempty"`
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

// SocialAssertionList can be used to lexicographically sort SocialAssertions.
type SocialAssertionList []keybase1.SocialAssertion

func (u SocialAssertionList) Len() int {
	return len(u)
}

func (u SocialAssertionList) Less(i, j int) bool {
	si := u[i].String()
	sj := u[j].String()
	return si < sj
}

func (u SocialAssertionList) Swap(i, j int) {
	u[i], u[j] = u[j], u[i]
}

// ErrNoWriters is the error returned by MakeBareTlfHandle if it is
// passed an empty list of writers.
var ErrNoWriters = errors.New("Cannot make TLF handle with no writers; need rekey?")

// ErrInvalidWriter is the error returned by MakeBareTlfHandle if it
// is passed an invalid writer.
var ErrInvalidWriter = errors.New("Cannot make TLF handle with invalid writer")

// ErrInvalidReader is the error returned by MakeBareTlfHandle if it
// is passed an invalid reader.
var ErrInvalidReader = errors.New("Cannot make TLF handle with invalid reader")

// MakeBareTlfHandle creates a BareTlfHandle from the given list of
// readers and writers.
func MakeBareTlfHandle(
	writers, readers []keybase1.UID,
	unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion,
	conflictInfo *ConflictInfo) (BareTlfHandle, error) {
	if len(writers) == 0 {
		return BareTlfHandle{}, ErrNoWriters
	}

	for _, w := range writers {
		if w == keybase1.PUBLIC_UID {
			return BareTlfHandle{}, ErrInvalidWriter
		}
	}

	if (len(readers) + len(unresolvedReaders)) > 1 {
		// If we have more than one reader, none of them
		// should be the public UID.
		for _, r := range readers {
			if r == keybase1.PUBLIC_UID {
				return BareTlfHandle{}, ErrInvalidReader
			}
		}
	}

	// TODO: Check for overlap between readers and writers, and
	// for duplicates.

	writersCopy := make([]keybase1.UID, len(writers))
	copy(writersCopy, writers)
	sort.Sort(UIDList(writersCopy))

	var readersCopy []keybase1.UID
	if len(readers) > 0 {
		readersCopy = make([]keybase1.UID, len(readers))
		copy(readersCopy, readers)
		sort.Sort(UIDList(readersCopy))
	}

	var unresolvedWritersCopy []keybase1.SocialAssertion
	if len(unresolvedWriters) > 0 {
		unresolvedWritersCopy = make([]keybase1.SocialAssertion, len(unresolvedWriters))
		copy(unresolvedWritersCopy, unresolvedWriters)
		sort.Sort(SocialAssertionList(unresolvedWritersCopy))
	}

	var unresolvedReadersCopy []keybase1.SocialAssertion
	if len(unresolvedReaders) > 0 {
		unresolvedReadersCopy = make([]keybase1.SocialAssertion, len(unresolvedReaders))
		copy(unresolvedReadersCopy, unresolvedReaders)
		sort.Sort(SocialAssertionList(unresolvedReadersCopy))
	}

	return BareTlfHandle{
		Writers:           writersCopy,
		Readers:           readersCopy,
		UnresolvedWriters: unresolvedWritersCopy,
		UnresolvedReaders: unresolvedReadersCopy,
		ConflictInfo:      conflictInfo,
	}, nil
}

func resolveAssertions(assertions map[keybase1.SocialAssertion]keybase1.UID,
	unresolved []keybase1.SocialAssertion, resolved []keybase1.UID) (
	map[keybase1.UID]bool, []keybase1.SocialAssertion) {
	resolvedMap := uidSliceToSet(resolved)
	unresolvedMap := assertionSliceToSet(unresolved)
	for a, u := range assertions {
		if unresolvedMap[a] {
			resolvedMap[u] = true
			delete(unresolvedMap, a)
		}
	}
	return resolvedMap, assertionSetToSlice(unresolvedMap)
}

func uidSetToSlice(m map[keybase1.UID]bool) (s []keybase1.UID) {
	for u := range m {
		s = append(s, u)
	}
	return s
}

func assertionSetToSlice(m map[keybase1.SocialAssertion]bool) (s []keybase1.SocialAssertion) {
	for u := range m {
		s = append(s, u)
	}
	return s
}

func uidSliceToSet(s []keybase1.UID) map[keybase1.UID]bool {
	m := make(map[keybase1.UID]bool, len(s))
	for _, u := range s {
		m[u] = true
	}
	return m
}

func assertionSliceToSet(s []keybase1.SocialAssertion) map[keybase1.SocialAssertion]bool {
	m := make(map[keybase1.SocialAssertion]bool, len(s))
	for _, u := range s {
		m[u] = true
	}
	return m
}

// ResolveAssertions creates a new BareTlfHandle given an existing one with
// while resolving the passed assertions.
func (h BareTlfHandle) ResolveAssertions(
	assertions map[keybase1.SocialAssertion]keybase1.UID) BareTlfHandle {
	if len(assertions) == 0 || (len(h.UnresolvedWriters) == 0 && len(h.UnresolvedReaders) == 0) {
		return h
	}
	var resolvedWriters, resolvedReaders map[keybase1.UID]bool
	resolvedWriters, h.UnresolvedWriters = resolveAssertions(assertions, h.UnresolvedWriters, h.Writers)
	resolvedReaders, h.UnresolvedReaders = resolveAssertions(assertions, h.UnresolvedReaders, h.Readers)
	h.Writers = uidSetToSlice(resolvedWriters)
	for _, u := range h.Writers {
		delete(resolvedReaders, u)
	}
	h.Readers = uidSetToSlice(resolvedReaders)
	sort.Sort(UIDList(h.Writers))
	sort.Sort(UIDList(h.Readers))
	sort.Sort(SocialAssertionList(h.UnresolvedWriters))
	sort.Sort(SocialAssertionList(h.UnresolvedReaders))
	return h
}

// IsPublic returns whether or not this BareTlfHandle represents a
// public top-level folder.
func (h BareTlfHandle) IsPublic() bool {
	return len(h.Readers) == 1 && h.Readers[0].Equal(keybase1.PublicUID)
}

func (h BareTlfHandle) findUserInList(user keybase1.UID,
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
// top-level folder represented by this BareTlfHandle.
func (h BareTlfHandle) IsWriter(user keybase1.UID) bool {
	return h.findUserInList(user, h.Writers)
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this BareTlfHandle.
func (h BareTlfHandle) IsReader(user keybase1.UID) bool {
	return h.IsPublic() || h.findUserInList(user, h.Readers) || h.IsWriter(user)
}

// Users returns a list of all reader and writer UIDs for the tlf,
// separated out into resolved and unresolved.
func (h BareTlfHandle) Users() ([]keybase1.UID, []keybase1.SocialAssertion) {
	var resolvedUsers []keybase1.UID
	resolvedUsers = append(resolvedUsers, h.Writers...)
	resolvedUsers = append(resolvedUsers, h.Readers...)
	var unresolvedUsers []keybase1.SocialAssertion
	unresolvedUsers = append(unresolvedUsers, h.UnresolvedWriters...)
	unresolvedUsers = append(unresolvedUsers, h.UnresolvedReaders...)
	return resolvedUsers, unresolvedUsers
}

// CanonicalTlfName is a string containing the canonical name of a TLF.
type CanonicalTlfName string

// TlfHandle is like BareTlfHandle but it also contains a canonical
// TLF name.  It is go-routine-safe.
type TlfHandle struct {
	// TODO: don't store a BareTlfHandle but generate it as
	// necessary.
	BareTlfHandle
	resolvedWriters map[keybase1.UID]libkb.NormalizedUsername
	resolvedReaders map[keybase1.UID]libkb.NormalizedUsername
	// name can be computed from the other fields, but cached for
	// speed.
	name CanonicalTlfName
}

type nameUIDPair struct {
	name libkb.NormalizedUsername
	uid  keybase1.UID
}

type resolvableUser interface {
	// resolve must do exactly one of the following:
	//
	//   - return a non-zero nameUIDPair;
	//   - return a non-zero keybase1.SocialAssertion;
	//   - return a non-nil error.
	resolve(context.Context) (nameUIDPair, keybase1.SocialAssertion, error)
}

func resolveOneUser(
	ctx context.Context, user resolvableUser,
	errCh chan<- error, userInfoResults chan<- nameUIDPair,
	socialAssertionResults chan<- keybase1.SocialAssertion) {
	userInfo, socialAssertion, err := user.resolve(ctx)
	if err != nil {
		select {
		case errCh <- err:
		default:
			// another worker reported an error before us;
			// first one wins
		}
		return
	}
	if userInfo != (nameUIDPair{}) {
		userInfoResults <- userInfo
		return
	}

	if socialAssertion != (keybase1.SocialAssertion{}) {
		socialAssertionResults <- socialAssertion
		return
	}

	errCh <- fmt.Errorf("Resolving %v resulted in empty userInfo and empty socialAssertion", user)
}

func makeTlfHandleHelper(
	ctx context.Context, public bool, writers, readers []resolvableUser,
	conflictInfo *ConflictInfo) (*TlfHandle, error) {
	if public && len(readers) > 0 {
		return nil, errors.New("public folder cannot have readers")
	}

	// parallelize the resolutions for each user
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 1)

	wc := make(chan nameUIDPair, len(writers))
	uwc := make(chan keybase1.SocialAssertion, len(writers))
	for _, writer := range writers {
		go resolveOneUser(ctx, writer, errCh, wc, uwc)
	}

	rc := make(chan nameUIDPair, len(readers))
	urc := make(chan keybase1.SocialAssertion, len(readers))
	for _, reader := range readers {
		go resolveOneUser(ctx, reader, errCh, rc, urc)
	}

	usedWNames := make(map[keybase1.UID]libkb.NormalizedUsername, len(writers))
	usedRNames := make(map[keybase1.UID]libkb.NormalizedUsername, len(readers))
	usedUnresolvedWriters := make(map[keybase1.SocialAssertion]bool)
	usedUnresolvedReaders := make(map[keybase1.SocialAssertion]bool)
	for i := 0; i < len(writers)+len(readers); i++ {
		select {
		case err := <-errCh:
			return nil, err
		case userInfo := <-wc:
			usedWNames[userInfo.uid] = userInfo.name
		case userInfo := <-rc:
			usedRNames[userInfo.uid] = userInfo.name
		case socialAssertion := <-uwc:
			usedUnresolvedWriters[socialAssertion] = true
		case socialAssertion := <-urc:
			usedUnresolvedReaders[socialAssertion] = true
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	for uid := range usedWNames {
		delete(usedRNames, uid)
	}

	for sa := range usedUnresolvedWriters {
		delete(usedUnresolvedReaders, sa)
	}

	writerUIDs, unresolvedWriters :=
		getSortedHandleLists(usedWNames, usedUnresolvedWriters)

	var readerUIDs []keybase1.UID
	var unresolvedReaders []keybase1.SocialAssertion
	if public {
		readerUIDs = []keybase1.UID{keybase1.PublicUID}
	} else {
		readerUIDs, unresolvedReaders =
			getSortedHandleLists(usedRNames, usedUnresolvedReaders)
	}

	bareHandle, err := MakeBareTlfHandle(
		writerUIDs, readerUIDs,
		unresolvedWriters, unresolvedReaders,
		conflictInfo)
	if err != nil {
		return nil, err
	}

	writerNames := getSortedNames(usedWNames, unresolvedWriters)
	canonicalName := strings.Join(writerNames, ",")
	if !public && len(usedRNames)+len(unresolvedReaders) > 0 {
		readerNames := getSortedNames(usedRNames, unresolvedReaders)
		canonicalName += ReaderSep + strings.Join(readerNames, ",")
	}
	if conflictInfo != nil {
		canonicalName += ConflictSuffixSep + conflictInfo.String()
	}

	h := &TlfHandle{
		BareTlfHandle:   bareHandle,
		resolvedWriters: usedWNames,
		resolvedReaders: usedRNames,
		name:            CanonicalTlfName(canonicalName),
	}

	return h, nil
}

type resolvableUID struct {
	nug normalizedUsernameGetter
	uid keybase1.UID
}

func (ruid resolvableUID) resolve(ctx context.Context) (nameUIDPair, keybase1.SocialAssertion, error) {
	name, err := ruid.nug.GetNormalizedUsername(ctx, ruid.uid)
	if err != nil {
		return nameUIDPair{}, keybase1.SocialAssertion{}, err
	}
	return nameUIDPair{
		name: name,
		uid:  ruid.uid,
	}, keybase1.SocialAssertion{}, nil
}

type resolvableSocialAssertion keybase1.SocialAssertion

func (rsa resolvableSocialAssertion) resolve(ctx context.Context) (nameUIDPair, keybase1.SocialAssertion, error) {
	return nameUIDPair{}, keybase1.SocialAssertion(rsa), nil
}

// MakeTlfHandle creates a TlfHandle from the given BareTlfHandle and
// the given normalizedUsernameGetter (which is usually a KBPKI).
func MakeTlfHandle(
	ctx context.Context, bareHandle BareTlfHandle,
	nug normalizedUsernameGetter) (*TlfHandle, error) {
	writers := make([]resolvableUser, 0, len(bareHandle.Writers)+len(bareHandle.UnresolvedWriters))
	for _, w := range bareHandle.Writers {
		writers = append(writers, resolvableUID{nug, w})
	}
	for _, uw := range bareHandle.UnresolvedWriters {
		writers = append(writers, resolvableSocialAssertion(uw))
	}

	var readers []resolvableUser
	if !bareHandle.IsPublic() {
		readers = make([]resolvableUser, 0, len(bareHandle.Readers)+len(bareHandle.UnresolvedReaders))
		for _, r := range bareHandle.Readers {
			readers = append(readers, resolvableUID{nug, r})
		}
		for _, ur := range bareHandle.UnresolvedReaders {
			readers = append(readers, resolvableSocialAssertion(ur))
		}
	}

	h, err := makeTlfHandleHelper(ctx, bareHandle.IsPublic(), writers, readers, bareHandle.ConflictInfo)
	if err != nil {
		return nil, err
	}

	if !reflect.DeepEqual(h.BareTlfHandle, bareHandle) {
		panic(fmt.Errorf("h.BareTlfHandle=%+v unexpectedly not equal to bareHandle=%+v", h.BareTlfHandle, bareHandle))
	}

	return h, nil
}

func (h *TlfHandle) deepCopy(codec Codec) (*TlfHandle, error) {
	var hCopy TlfHandle

	err := CodecUpdate(codec, &hCopy, h)
	if err != nil {
		return nil, err
	}

	err = CodecUpdate(codec, &hCopy.resolvedWriters, h.resolvedWriters)
	if err != nil {
		return nil, err
	}

	err = CodecUpdate(codec, &hCopy.resolvedReaders, h.resolvedReaders)
	if err != nil {
		return nil, err
	}

	hCopy.name = h.name

	return &hCopy, nil
}

func getSortedNames(
	uidToName map[keybase1.UID]libkb.NormalizedUsername,
	unresolved []keybase1.SocialAssertion) []string {
	var names []string
	for _, name := range uidToName {
		names = append(names, name.String())
	}
	for _, sa := range unresolved {
		names = append(names, sa.String())
	}
	sort.Sort(sort.StringSlice(names))
	return names
}

// GetCanonicalName returns the canonical name of this TLF.
func (h *TlfHandle) GetCanonicalName() CanonicalTlfName {
	if h.name == "" {
		panic(fmt.Sprintf("TlfHandle %v with no name", h))
	}

	return h.name
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

// GetCanonicalPath returns the full canonical path of this TLF.
func (h *TlfHandle) GetCanonicalPath() string {
	return buildCanonicalPath(h.IsPublic(), h.GetCanonicalName())
}

// ToFavorite converts a TlfHandle into a Favorite, suitable for
// Favorites calls.
func (h *TlfHandle) ToFavorite() Favorite {
	return Favorite{
		Name:   string(h.GetCanonicalName()),
		Public: h.IsPublic(),
	}
}

// ToFavorite converts a TlfHandle into a Favorite, and sets internal
// state about whether the corresponding folder was just created or
// not.
func (h *TlfHandle) toFavorite(created bool) Favorite {
	f := h.ToFavorite()
	f.created = created
	return f
}

type resolvableNameUIDPair nameUIDPair

func (rp resolvableNameUIDPair) resolve(ctx context.Context) (nameUIDPair, keybase1.SocialAssertion, error) {
	return nameUIDPair(rp), keybase1.SocialAssertion{}, nil
}

// ResolveAgainForUser tries to resolve any unresolved assertions in
// the given handle and returns a new handle with the results. As an
// optimization, if h contains no unresolved assertions, it just
// returns itself.  If uid != keybase1.UID(""), it only allows
// assertions that resolve to uid.
func (h *TlfHandle) ResolveAgainForUser(ctx context.Context, resolver resolver,
	uid keybase1.UID) (*TlfHandle, error) {
	if len(h.UnresolvedWriters)+len(h.UnresolvedReaders) == 0 {
		return h, nil
	}

	writers := make([]resolvableUser, 0, len(h.Writers)+len(h.UnresolvedWriters))
	for uid, w := range h.resolvedWriters {
		writers = append(writers, resolvableNameUIDPair{w, uid})
	}
	for _, uw := range h.UnresolvedWriters {
		writers = append(writers, resolvableAssertion{resolver,
			uw.String(), uid})
	}

	var readers []resolvableUser
	if !h.IsPublic() {
		readers = make([]resolvableUser, 0, len(h.Readers)+len(h.UnresolvedReaders))
		for uid, r := range h.resolvedReaders {
			readers = append(readers, resolvableNameUIDPair{r, uid})
		}
		for _, ur := range h.UnresolvedReaders {
			readers = append(readers, resolvableAssertion{resolver,
				ur.String(), uid})
		}
	}

	newH, err := makeTlfHandleHelper(ctx, h.IsPublic(), writers, readers, h.BareTlfHandle.ConflictInfo)
	if err != nil {
		return nil, err
	}

	return newH, nil
}

// ResolveAgain tries to resolve any unresolved assertions in the
// given handle and returns a new handle with the results. As an
// optimization, if h contains no unresolved assertions, it just
// returns itself.
func (h *TlfHandle) ResolveAgain(ctx context.Context, resolver resolver) (
	*TlfHandle, error) {
	return h.ResolveAgainForUser(ctx, resolver, keybase1.UID(""))
}

func getSortedHandleLists(
	uidToName map[keybase1.UID]libkb.NormalizedUsername,
	unresolved map[keybase1.SocialAssertion]bool) (
	[]keybase1.UID, []keybase1.SocialAssertion) {
	var uids []keybase1.UID
	var assertions []keybase1.SocialAssertion
	for uid := range uidToName {
		uids = append(uids, uid)
	}
	for sa := range unresolved {
		assertions = append(assertions, sa)
	}
	sort.Sort(UIDList(uids))
	sort.Sort(SocialAssertionList(assertions))
	return uids, assertions
}

func splitAndNormalizeTLFName(name string, public bool) (
	writerNames, readerNames []string,
	conflictSuffix string, err error) {

	names := strings.SplitN(name, ConflictSuffixSep, 2)
	if len(names) > 2 {
		return nil, nil, "", BadTLFNameError{name}
	}
	if len(names) > 1 {
		conflictSuffix = names[1]
	}

	splitNames := strings.SplitN(names[0], ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, nil, "", BadTLFNameError{name}
	}
	writerNames = strings.Split(splitNames[0], ",")
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	}

	hasPublic := len(readerNames) == 0

	if public && !hasPublic {
		// No public folder exists for this folder.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	normalizedName, err := normalizeNamesInTLF(writerNames, readerNames, conflictSuffix)
	if err != nil {
		return nil, nil, "", err
	}
	if normalizedName != name {
		return nil, nil, "", TlfNameNotCanonical{name, normalizedName}
	}

	return writerNames, readerNames, strings.ToLower(conflictSuffix), nil
}

// TODO: this function can likely be replaced with a call to
// AssertionParseAndOnly when CORE-2967 and CORE-2968 are fixed.
func normalizeAssertionOrName(s string) (string, error) {
	if libkb.CheckUsername.F(s) {
		return libkb.NewNormalizedUsername(s).String(), nil
	}

	// TODO: this fails for http and https right now (see CORE-2968).
	socialAssertion, isSocialAssertion := libkb.NormalizeSocialAssertion(s)
	if isSocialAssertion {
		return socialAssertion.String(), nil
	}

	if expr, err := libkb.AssertionParseAndOnly(s); err == nil {
		// If the expression only contains a single url, make sure
		// it's not a just considered a single keybase username.  If
		// it is, then some non-username slipped into the default
		// "keybase" case and should be considered an error.
		urls := expr.CollectUrls(nil)
		if len(urls) == 1 && urls[0].IsKeybase() {
			return "", NoSuchUserError{s}
		}

		// Normalize and return.  Ideally `AssertionParseAndOnly`
		// would normalize for us, but that doesn't work yet, so for
		// now we'll just lower-case.  This will incorrectly lower
		// case http/https/web assertions, as well as case-sensitive
		// social assertions in AND expressions.  TODO: see CORE-2967.
		return strings.ToLower(s), nil
	}

	return "", BadTLFNameError{s}
}

// normalizeNamesInTLF takes a split TLF name and, without doing any
// resolutions or identify calls, normalizes all elements of the
// name. It then returns the normalized name.
func normalizeNamesInTLF(writerNames, readerNames []string,
	conflictSuffix string) (string, error) {
	sortedWriterNames := make([]string, len(writerNames))
	var err error
	for i, w := range writerNames {
		sortedWriterNames[i], err = normalizeAssertionOrName(w)
		if err != nil {
			return "", err
		}
	}
	sort.Strings(sortedWriterNames)
	normalizedName := strings.Join(sortedWriterNames, ",")
	if len(readerNames) > 0 {
		sortedReaderNames := make([]string, len(readerNames))
		for i, r := range readerNames {
			sortedReaderNames[i], err = normalizeAssertionOrName(r)
			if err != nil {
				return "", err
			}
		}
		sort.Strings(sortedReaderNames)
		normalizedName += ReaderSep + strings.Join(sortedReaderNames, ",")
	}
	if len(conflictSuffix) != 0 {
		// This *should* be normalized already but make sure.  I can see not
		// doing so might surprise a caller.
		normalizedName += ConflictSuffixSep + strings.ToLower(conflictSuffix)
	}

	return normalizedName, nil
}

type resolvableAssertion struct {
	resolver   resolver
	assertion  string
	mustBeUser keybase1.UID
}

func (ra resolvableAssertion) resolve(ctx context.Context) (
	nameUIDPair, keybase1.SocialAssertion, error) {
	if ra.assertion == PublicUIDName {
		return nameUIDPair{}, keybase1.SocialAssertion{}, fmt.Errorf("Invalid name %s", ra.assertion)
	}
	name, uid, err := ra.resolver.Resolve(ctx, ra.assertion)
	if err == nil && ra.mustBeUser != keybase1.UID("") && ra.mustBeUser != uid {
		// Force an unresolved assertion sinced the forced user doesn't match
		err = NoSuchUserError{ra.assertion}
	}
	switch err := err.(type) {
	default:
		return nameUIDPair{}, keybase1.SocialAssertion{}, err
	case nil:
		return nameUIDPair{
			name: name,
			uid:  uid,
		}, keybase1.SocialAssertion{}, nil
	case NoSuchUserError:
		socialAssertion, ok := libkb.NormalizeSocialAssertion(ra.assertion)
		if !ok {
			return nameUIDPair{}, keybase1.SocialAssertion{}, err
		}
		return nameUIDPair{}, socialAssertion, nil
	}
}

// ParseTlfHandle parses a TlfHandle from an encoded string. See
// TlfHandle.GetCanonicalName() for the opposite direction.
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
	writerNames, readerNames, conflictSuffix, err := splitAndNormalizeTLFName(name, public)
	if err != nil {
		return nil, err
	}

	hasPublic := len(readerNames) == 0

	if public && !hasPublic {
		// No public folder exists for this folder.
		return nil, NoSuchNameError{Name: name}
	}

	normalizedName, err := normalizeNamesInTLF(writerNames, readerNames, conflictSuffix)
	if err != nil {
		return nil, err
	}
	if normalizedName != name {
		return nil, TlfNameNotCanonical{name, normalizedName}
	}

	writers := make([]resolvableUser, len(writerNames))
	for i, w := range writerNames {
		writers[i] = resolvableAssertion{kbpki, w, keybase1.UID("")}
	}
	readers := make([]resolvableUser, len(readerNames))
	for i, r := range readerNames {
		readers[i] = resolvableAssertion{kbpki, r, keybase1.UID("")}
	}

	var conflictInfo *ConflictInfo
	if len(conflictSuffix) != 0 {
		conflictInfo, err = ParseConflictInfo(conflictSuffix)
		if err != nil {
			return nil, err
		}
	}

	h, err := makeTlfHandleHelper(ctx, public, writers, readers, conflictInfo)
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
			return nil, ReadAccessError{currentUsername, h.GetCanonicalName(), public}
		}
	}

	if string(h.GetCanonicalName()) == name {
		// Name is already canonical (i.e., all usernames and
		// no assertions) so we can delay the identify until
		// the node is actually used.
		return h, nil
	}

	// Otherwise, identify before returning the canonical name.
	err = identifyHandle(ctx, kbpki, kbpki, h)
	if err != nil {
		return nil, err
	}

	return nil, TlfNameNotCanonical{name, string(h.GetCanonicalName())}
}

// CheckTlfHandleOffline does light checks whether a TLF handle looks ok,
// it avoids all network calls.
func CheckTlfHandleOffline(
	ctx context.Context, name string, public bool) error {
	_, _, _, err := splitAndNormalizeTLFName(name, public)
	return err
}
