// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package tlf

import (
	"reflect"
	"sort"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
)

// Handle uniquely identified top-level folders by readers and writers.
//
// NOTE: if you change this type, ensure you update the `NumField` check in
// `init`, and that the new fields are correctly checked for equality in
// `Handle.DeepEqual()`.
// TODO: Have separate types for writers vs. readers.
type Handle struct {
	Writers           []keybase1.UserOrTeamID    `codec:"w,omitempty"`
	Readers           []keybase1.UserOrTeamID    `codec:"r,omitempty"`
	UnresolvedWriters []keybase1.SocialAssertion `codec:"uw,omitempty"`
	UnresolvedReaders []keybase1.SocialAssertion `codec:"ur,omitempty"`
	ConflictInfo      *HandleExtension           `codec:"ci,omitempty"`
	FinalizedInfo     *HandleExtension           `codec:"fi,omitempty"`

	// caching field to track whether we've sorted the slices.
	sorted bool `codec:"-"`
}

// init verifies that we haven't changed the number of fields, so that if we
// do, the engineer can take a good, long look at what they've done.
func init() {
	if reflect.ValueOf(Handle{}).NumField() != 7 {
		panic(errors.New(
			"Unexpected number of fields in Handle; please update the check " +
				"above and ensure that Handle.DeepEqual() accounts for the " +
				"new field"))
	}
}

// errNoWriters is the error returned by MakeHandle if it is
// passed an empty list of writers.
var errNoWriters = errors.New("Cannot make TLF handle with no writers; need rekey?")

// errInvalidWriter is the error returned by MakeHandle if it
// is passed an invalid writer.
var errInvalidWriter = errors.New("Cannot make TLF handle with invalid writer")

// errInvalidReader is the error returned by MakeHandle if it
// is passed an invalid reader.
var errInvalidReader = errors.New("Cannot make TLF handle with invalid reader")

// UIDList can be used to lexicographically sort UserOrTeamIDs.
type UIDList []keybase1.UserOrTeamID

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

// MakeHandle creates a Handle from the given list of
// readers and writers. If the given reader list contains just
// keybase1.PUBLIC_UID, then the returned handle will be for a public
// folder. Otherwise, it will be private. PUBLIC_UID shouldn't be in
// any list in any other case.
func MakeHandle(
	writers, readers []keybase1.UserOrTeamID,
	unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion,
	extensions []HandleExtension) (Handle, error) {
	if len(writers) == 0 {
		if len(unresolvedWriters) == 1 {
			return Handle{}, errors.Errorf(
				"No resolution found for %s", unresolvedWriters[0])
		} else if len(unresolvedWriters) > 1 {
			return Handle{}, errors.Errorf(
				"No resolutions found for %v", unresolvedWriters)
		}
		return Handle{}, errNoWriters
	}

	if writers[0].IsTeamOrSubteam() {
		// Right now we only support single-team private TLFs.
		if len(writers) > 1 || len(unresolvedWriters) != 0 {
			return Handle{}, errInvalidWriter
		} else if len(readers) != 0 || len(unresolvedReaders) != 0 {
			return Handle{}, errInvalidReader
		}
	}

	for i, w := range writers {
		if w == keybase1.PUBLIC_UID {
			return Handle{}, errInvalidWriter
		} else if i > 0 && w.IsTeamOrSubteam() {
			return Handle{}, errInvalidWriter
		}
	}

	// If we have more than one reader, none of them should be the
	// public UID.  And no readers should be a team.
	checkPublic := (len(readers) + len(unresolvedReaders)) > 1
	for _, r := range readers {
		if checkPublic && r == keybase1.PUBLIC_UID {
			return Handle{}, errInvalidReader
		} else if r.IsTeamOrSubteam() {
			return Handle{}, errInvalidReader
		}
	}

	// TODO: Check for overlap between readers and writers, and
	// for duplicates.

	writersCopy := make([]keybase1.UserOrTeamID, len(writers))
	copy(writersCopy, writers)
	sort.Sort(UIDList(writersCopy))

	var readersCopy []keybase1.UserOrTeamID
	if len(readers) > 0 {
		readersCopy = make([]keybase1.UserOrTeamID, len(readers))
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

	conflictInfo, finalizedInfo := HandleExtensionList(extensions).Splat()

	return Handle{
		Writers:           writersCopy,
		Readers:           readersCopy,
		UnresolvedWriters: unresolvedWritersCopy,
		UnresolvedReaders: unresolvedReadersCopy,
		ConflictInfo:      conflictInfo,
		FinalizedInfo:     finalizedInfo,
		sorted:            true,
	}, nil
}

// IsBackedByTeam returns true if h represents a TLF backed by a team. It could
// be either a SingleTeam TLF or a private/public TLF backed by an implicit
// team.
func (h Handle) IsBackedByTeam() bool {
	if len(h.Writers) != 1 ||
		len(h.Readers) != 0 ||
		len(h.UnresolvedReaders) != 0 ||
		len(h.UnresolvedWriters) != 0 {
		return false
	}
	return h.Writers[0].IsTeamOrSubteam()
}

// Type returns the type of TLF this Handle represents.
func (h Handle) Type() Type {
	if len(h.Readers) == 1 &&
		h.Readers[0].Equal(keybase1.PublicUID.AsUserOrTeam()) {
		return Public
	} else if len(h.Writers) == 1 && h.Writers[0].IsTeamOrSubteam() {
		return SingleTeam
	}
	return Private
}

// TypeForKeying returns the keying type for the handle h.
func (h Handle) TypeForKeying() KeyingType {
	if h.IsBackedByTeam() {
		return TeamKeying
	}
	return h.Type().ToKeyingType()
}

func (h Handle) findUserInList(user keybase1.UserOrTeamID,
	users []keybase1.UserOrTeamID) bool {
	for _, u := range users {
		if u == user {
			return true
		}
	}
	return false
}

// IsWriter returns whether or not the given user is a writer for the
// top-level folder represented by this Handle.
func (h Handle) IsWriter(user keybase1.UserOrTeamID) bool {
	if h.TypeForKeying() == TeamKeying {
		panic("Can't call Handle.IsWriter() for a single team TLF")
	}
	return h.findUserInList(user, h.Writers)
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this Handle.
func (h Handle) IsReader(user keybase1.UserOrTeamID) bool {
	if h.TypeForKeying() == TeamKeying {
		panic("Can't call Handle.IsReader() for a single team TLF")
	}
	return h.TypeForKeying() == PublicKeying ||
		h.findUserInList(user, h.Readers) ||
		h.IsWriter(user)
}

// ResolvedUsers returns the concatenation of h.Writers and h.Readers,
// except if the handle is public, the returned list won't contain
// PUBLIC_UID.
func (h Handle) ResolvedUsers() []keybase1.UserOrTeamID {
	var resolvedUsers []keybase1.UserOrTeamID
	resolvedUsers = append(resolvedUsers, h.Writers...)
	if h.TypeForKeying() == PrivateKeying {
		resolvedUsers = append(resolvedUsers, h.Readers...)
	}
	return resolvedUsers
}

// HasUnresolvedUsers returns true if this handle has any unresolved
// writers or readers.
func (h Handle) HasUnresolvedUsers() bool {
	return len(h.UnresolvedWriters) > 0 || len(h.UnresolvedReaders) > 0
}

// UnresolvedUsers returns the concatenation of h.UnresolvedWriters
// and h.UnresolvedReaders.
func (h Handle) UnresolvedUsers() []keybase1.SocialAssertion {
	var unresolvedUsers []keybase1.SocialAssertion
	unresolvedUsers = append(unresolvedUsers, h.UnresolvedWriters...)
	unresolvedUsers = append(unresolvedUsers, h.UnresolvedReaders...)
	return unresolvedUsers
}

func uidSliceToSet(s []keybase1.UserOrTeamID) map[keybase1.UserOrTeamID]bool {
	m := make(map[keybase1.UserOrTeamID]bool, len(s))
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

func resolveAssertions(
	assertions map[keybase1.SocialAssertion]keybase1.UID,
	unresolved []keybase1.SocialAssertion, resolved []keybase1.UserOrTeamID) (
	map[keybase1.UserOrTeamID]bool, []keybase1.SocialAssertion) {
	resolvedMap := uidSliceToSet(resolved)
	unresolvedMap := assertionSliceToSet(unresolved)
	for a, u := range assertions {
		if unresolvedMap[a] {
			resolvedMap[u.AsUserOrTeam()] = true
			delete(unresolvedMap, a)
		}
	}
	return resolvedMap, assertionSetToSlice(unresolvedMap)
}

func uidSetToSlice(m map[keybase1.UserOrTeamID]bool) (
	s []keybase1.UserOrTeamID) {
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

// ResolveAssertions creates a new Handle given an existing one with
// while resolving the passed assertions.
func (h Handle) ResolveAssertions(
	assertions map[keybase1.SocialAssertion]keybase1.UID) Handle {
	if len(assertions) == 0 || (len(h.UnresolvedWriters) == 0 && len(h.UnresolvedReaders) == 0) || h.IsFinal() {
		return h
	}
	var resolvedWriters, resolvedReaders map[keybase1.UserOrTeamID]bool
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
	h.sorted = true
	return h
}

// Extensions returns a list of extensions for the given handle.
func (h Handle) Extensions() (extensions []HandleExtension) {
	if h.ConflictInfo != nil {
		extensions = append(extensions, *h.ConflictInfo)
	}
	if h.FinalizedInfo != nil {
		extensions = append(extensions, *h.FinalizedInfo)
	}
	return extensions
}

// IsFinal returns true if the handle has been finalized.
func (h Handle) IsFinal() bool {
	return h.FinalizedInfo != nil
}

// IsConflict returns true if the handle is a conflict handle.
func (h Handle) IsConflict() bool {
	return h.ConflictInfo != nil
}

// DeepEqual returns true if the handle is equal to another handle.
// This can mutate the Handle in that it might sort its Writers,
// Readers, UnresolvedWriters, and UnresolvedReaders.
func (h *Handle) DeepEqual(other Handle) bool {
	if len(h.Writers) != len(other.Writers) {
		return false
	}
	if len(h.UnresolvedWriters) != len(other.UnresolvedWriters) {
		return false
	}
	if len(h.Readers) != len(other.Readers) {
		return false
	}
	if len(h.UnresolvedReaders) != len(other.UnresolvedReaders) {
		return false
	}

	if !h.sorted {
		sort.Sort(UIDList(h.Writers))
		sort.Sort(UIDList(h.Readers))
		sort.Sort(SocialAssertionList(h.UnresolvedWriters))
		sort.Sort(SocialAssertionList(h.UnresolvedReaders))
		h.sorted = true
	}
	if !other.sorted {
		sort.Sort(UIDList(other.Writers))
		sort.Sort(UIDList(other.Readers))
		sort.Sort(SocialAssertionList(other.UnresolvedWriters))
		sort.Sort(SocialAssertionList(other.UnresolvedReaders))
	}

	for i, v := range h.Writers {
		if other.Writers[i] != v {
			return false
		}
	}
	for i, v := range h.UnresolvedWriters {
		if other.UnresolvedWriters[i] != v {
			return false
		}
	}
	for i, v := range h.Readers {
		if other.Readers[i] != v {
			return false
		}
	}
	for i, v := range h.UnresolvedReaders {
		if other.UnresolvedReaders[i] != v {
			return false
		}
	}
	if h.IsConflict() != other.IsConflict() {
		return false
	}
	if h.IsFinal() != other.IsFinal() {
		return false
	}
	if h.ConflictInfo != nil &&
		h.ConflictInfo.String() != other.ConflictInfo.String() {
		return false
	}
	if h.FinalizedInfo != nil &&
		h.FinalizedInfo.String() != other.FinalizedInfo.String() {
		return false
	}

	return true
}

// checkUIDEquality returns true if `a` and `b` contain the same IDs,
// regardless of order.  However, if `a` contains duplicates, this
// function may return an incorrect value.
func checkUIDEquality(a, b []keybase1.UserOrTeamID) bool {
	aMap := make(map[keybase1.UserOrTeamID]bool)
	for _, u := range a {
		aMap[u] = true
	}
	for _, u := range b {
		if !aMap[u] {
			return false
		}
		delete(aMap, u)
	}
	return len(aMap) == 0
}

// ResolvedUsersEqual checks whether the resolved users of this TLF
// matches the provided lists of writers and readers.
func (h *Handle) ResolvedUsersEqual(
	writers []keybase1.UserOrTeamID, readers []keybase1.UserOrTeamID) bool {
	return checkUIDEquality(h.Writers, writers) &&
		checkUIDEquality(h.Readers, readers)
}
