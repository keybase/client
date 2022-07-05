// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/home.avdl

package keybase1

import (
	"errors"
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	context "golang.org/x/net/context"
	"time"
)

type HomeScreenItemID string

func (o HomeScreenItemID) DeepCopy() HomeScreenItemID {
	return o
}

type HomeScreenItemType int

const (
	HomeScreenItemType_TODO         HomeScreenItemType = 1
	HomeScreenItemType_PEOPLE       HomeScreenItemType = 2
	HomeScreenItemType_ANNOUNCEMENT HomeScreenItemType = 3
)

func (o HomeScreenItemType) DeepCopy() HomeScreenItemType { return o }

var HomeScreenItemTypeMap = map[string]HomeScreenItemType{
	"TODO":         1,
	"PEOPLE":       2,
	"ANNOUNCEMENT": 3,
}

var HomeScreenItemTypeRevMap = map[HomeScreenItemType]string{
	1: "TODO",
	2: "PEOPLE",
	3: "ANNOUNCEMENT",
}

func (e HomeScreenItemType) String() string {
	if v, ok := HomeScreenItemTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type HomeScreenItemData struct {
	T__            HomeScreenItemType            `codec:"t" json:"t"`
	Todo__         *HomeScreenTodo               `codec:"todo,omitempty" json:"todo,omitempty"`
	People__       *HomeScreenPeopleNotification `codec:"people,omitempty" json:"people,omitempty"`
	Announcement__ *HomeScreenAnnouncement       `codec:"announcement,omitempty" json:"announcement,omitempty"`
}

func (o *HomeScreenItemData) T() (ret HomeScreenItemType, err error) {
	switch o.T__ {
	case HomeScreenItemType_TODO:
		if o.Todo__ == nil {
			err = errors.New("unexpected nil value for Todo__")
			return ret, err
		}
	case HomeScreenItemType_PEOPLE:
		if o.People__ == nil {
			err = errors.New("unexpected nil value for People__")
			return ret, err
		}
	case HomeScreenItemType_ANNOUNCEMENT:
		if o.Announcement__ == nil {
			err = errors.New("unexpected nil value for Announcement__")
			return ret, err
		}
	}
	return o.T__, nil
}

func (o HomeScreenItemData) Todo() (res HomeScreenTodo) {
	if o.T__ != HomeScreenItemType_TODO {
		panic("wrong case accessed")
	}
	if o.Todo__ == nil {
		return
	}
	return *o.Todo__
}

func (o HomeScreenItemData) People() (res HomeScreenPeopleNotification) {
	if o.T__ != HomeScreenItemType_PEOPLE {
		panic("wrong case accessed")
	}
	if o.People__ == nil {
		return
	}
	return *o.People__
}

func (o HomeScreenItemData) Announcement() (res HomeScreenAnnouncement) {
	if o.T__ != HomeScreenItemType_ANNOUNCEMENT {
		panic("wrong case accessed")
	}
	if o.Announcement__ == nil {
		return
	}
	return *o.Announcement__
}

func NewHomeScreenItemDataWithTodo(v HomeScreenTodo) HomeScreenItemData {
	return HomeScreenItemData{
		T__:    HomeScreenItemType_TODO,
		Todo__: &v,
	}
}

func NewHomeScreenItemDataWithPeople(v HomeScreenPeopleNotification) HomeScreenItemData {
	return HomeScreenItemData{
		T__:      HomeScreenItemType_PEOPLE,
		People__: &v,
	}
}

func NewHomeScreenItemDataWithAnnouncement(v HomeScreenAnnouncement) HomeScreenItemData {
	return HomeScreenItemData{
		T__:            HomeScreenItemType_ANNOUNCEMENT,
		Announcement__: &v,
	}
}

func NewHomeScreenItemDataDefault(t HomeScreenItemType) HomeScreenItemData {
	return HomeScreenItemData{
		T__: t,
	}
}

func (o HomeScreenItemData) DeepCopy() HomeScreenItemData {
	return HomeScreenItemData{
		T__: o.T__.DeepCopy(),
		Todo__: (func(x *HomeScreenTodo) *HomeScreenTodo {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Todo__),
		People__: (func(x *HomeScreenPeopleNotification) *HomeScreenPeopleNotification {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.People__),
		Announcement__: (func(x *HomeScreenAnnouncement) *HomeScreenAnnouncement {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Announcement__),
	}
}

type HomeScreenItemDataExt struct {
	T__    HomeScreenItemType `codec:"t" json:"t"`
	Todo__ *HomeScreenTodoExt `codec:"todo,omitempty" json:"todo,omitempty"`
}

func (o *HomeScreenItemDataExt) T() (ret HomeScreenItemType, err error) {
	switch o.T__ {
	case HomeScreenItemType_TODO:
		if o.Todo__ == nil {
			err = errors.New("unexpected nil value for Todo__")
			return ret, err
		}
	}
	return o.T__, nil
}

func (o HomeScreenItemDataExt) Todo() (res HomeScreenTodoExt) {
	if o.T__ != HomeScreenItemType_TODO {
		panic("wrong case accessed")
	}
	if o.Todo__ == nil {
		return
	}
	return *o.Todo__
}

func NewHomeScreenItemDataExtWithTodo(v HomeScreenTodoExt) HomeScreenItemDataExt {
	return HomeScreenItemDataExt{
		T__:    HomeScreenItemType_TODO,
		Todo__: &v,
	}
}

func NewHomeScreenItemDataExtDefault(t HomeScreenItemType) HomeScreenItemDataExt {
	return HomeScreenItemDataExt{
		T__: t,
	}
}

func (o HomeScreenItemDataExt) DeepCopy() HomeScreenItemDataExt {
	return HomeScreenItemDataExt{
		T__: o.T__.DeepCopy(),
		Todo__: (func(x *HomeScreenTodoExt) *HomeScreenTodoExt {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Todo__),
	}
}

type AppLinkType int

const (
	AppLinkType_NONE     AppLinkType = 0
	AppLinkType_PEOPLE   AppLinkType = 1
	AppLinkType_CHAT     AppLinkType = 2
	AppLinkType_FILES    AppLinkType = 3
	AppLinkType_WALLET   AppLinkType = 4
	AppLinkType_GIT      AppLinkType = 5
	AppLinkType_DEVICES  AppLinkType = 6
	AppLinkType_SETTINGS AppLinkType = 7
	AppLinkType_TEAMS    AppLinkType = 8
)

func (o AppLinkType) DeepCopy() AppLinkType { return o }

var AppLinkTypeMap = map[string]AppLinkType{
	"NONE":     0,
	"PEOPLE":   1,
	"CHAT":     2,
	"FILES":    3,
	"WALLET":   4,
	"GIT":      5,
	"DEVICES":  6,
	"SETTINGS": 7,
	"TEAMS":    8,
}

var AppLinkTypeRevMap = map[AppLinkType]string{
	0: "NONE",
	1: "PEOPLE",
	2: "CHAT",
	3: "FILES",
	4: "WALLET",
	5: "GIT",
	6: "DEVICES",
	7: "SETTINGS",
	8: "TEAMS",
}

func (e AppLinkType) String() string {
	if v, ok := AppLinkTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type HomeScreenAnnouncementID int

func (o HomeScreenAnnouncementID) DeepCopy() HomeScreenAnnouncementID {
	return o
}

type HomeScreenAnnouncementVersion int

func (o HomeScreenAnnouncementVersion) DeepCopy() HomeScreenAnnouncementVersion {
	return o
}

type HomeScreenAnnouncement struct {
	Id           HomeScreenAnnouncementID      `codec:"id" json:"id"`
	Version      HomeScreenAnnouncementVersion `codec:"version" json:"version"`
	AppLink      AppLinkType                   `codec:"appLink" json:"appLink"`
	ConfirmLabel string                        `codec:"confirmLabel" json:"confirmLabel"`
	Dismissable  bool                          `codec:"dismissable" json:"dismissable"`
	IconUrl      string                        `codec:"iconUrl" json:"iconUrl"`
	Text         string                        `codec:"text" json:"text"`
	Url          string                        `codec:"url" json:"url"`
}

func (o HomeScreenAnnouncement) DeepCopy() HomeScreenAnnouncement {
	return HomeScreenAnnouncement{
		Id:           o.Id.DeepCopy(),
		Version:      o.Version.DeepCopy(),
		AppLink:      o.AppLink.DeepCopy(),
		ConfirmLabel: o.ConfirmLabel,
		Dismissable:  o.Dismissable,
		IconUrl:      o.IconUrl,
		Text:         o.Text,
		Url:          o.Url,
	}
}

type HomeScreenTodoType int

const (
	HomeScreenTodoType_NONE                    HomeScreenTodoType = 0
	HomeScreenTodoType_BIO                     HomeScreenTodoType = 1
	HomeScreenTodoType_PROOF                   HomeScreenTodoType = 2
	HomeScreenTodoType_DEVICE                  HomeScreenTodoType = 3
	HomeScreenTodoType_FOLLOW                  HomeScreenTodoType = 4
	HomeScreenTodoType_PAPERKEY                HomeScreenTodoType = 6
	HomeScreenTodoType_TEAM                    HomeScreenTodoType = 7
	HomeScreenTodoType_FOLDER                  HomeScreenTodoType = 8
	HomeScreenTodoType_GIT_REPO                HomeScreenTodoType = 9
	HomeScreenTodoType_TEAM_SHOWCASE           HomeScreenTodoType = 10
	HomeScreenTodoType_AVATAR_TEAM             HomeScreenTodoType = 12
	HomeScreenTodoType_ADD_PHONE_NUMBER        HomeScreenTodoType = 18
	HomeScreenTodoType_VERIFY_ALL_PHONE_NUMBER HomeScreenTodoType = 19
	HomeScreenTodoType_VERIFY_ALL_EMAIL        HomeScreenTodoType = 20
	HomeScreenTodoType_LEGACY_EMAIL_VISIBILITY HomeScreenTodoType = 21
	HomeScreenTodoType_ADD_EMAIL               HomeScreenTodoType = 22
	HomeScreenTodoType_AVATAR_USER             HomeScreenTodoType = 23
	HomeScreenTodoType_CHAT                    HomeScreenTodoType = 24
	HomeScreenTodoType_ANNONCEMENT_PLACEHOLDER HomeScreenTodoType = 10000
)

func (o HomeScreenTodoType) DeepCopy() HomeScreenTodoType { return o }

var HomeScreenTodoTypeMap = map[string]HomeScreenTodoType{
	"NONE":                    0,
	"BIO":                     1,
	"PROOF":                   2,
	"DEVICE":                  3,
	"FOLLOW":                  4,
	"PAPERKEY":                6,
	"TEAM":                    7,
	"FOLDER":                  8,
	"GIT_REPO":                9,
	"TEAM_SHOWCASE":           10,
	"AVATAR_TEAM":             12,
	"ADD_PHONE_NUMBER":        18,
	"VERIFY_ALL_PHONE_NUMBER": 19,
	"VERIFY_ALL_EMAIL":        20,
	"LEGACY_EMAIL_VISIBILITY": 21,
	"ADD_EMAIL":               22,
	"AVATAR_USER":             23,
	"CHAT":                    24,
	"ANNONCEMENT_PLACEHOLDER": 10000,
}

var HomeScreenTodoTypeRevMap = map[HomeScreenTodoType]string{
	0:     "NONE",
	1:     "BIO",
	2:     "PROOF",
	3:     "DEVICE",
	4:     "FOLLOW",
	6:     "PAPERKEY",
	7:     "TEAM",
	8:     "FOLDER",
	9:     "GIT_REPO",
	10:    "TEAM_SHOWCASE",
	12:    "AVATAR_TEAM",
	18:    "ADD_PHONE_NUMBER",
	19:    "VERIFY_ALL_PHONE_NUMBER",
	20:    "VERIFY_ALL_EMAIL",
	21:    "LEGACY_EMAIL_VISIBILITY",
	22:    "ADD_EMAIL",
	23:    "AVATAR_USER",
	24:    "CHAT",
	10000: "ANNONCEMENT_PLACEHOLDER",
}

func (e HomeScreenTodoType) String() string {
	if v, ok := HomeScreenTodoTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

// Most of TODO items do not carry additional data, but some do. e.g. TODO
// item to tell user to verify their email address will carry that email
// address.
//
// All new TODO data bundle types should be records rather than single fields
// to support adding new data to existing TODOs. If a legacy TODO (such as
// VERIFY_ALL_EMAIL) uses a single field, the "TodoExt" field should be used to
// introduce more data to the payload.
type HomeScreenTodo struct {
	T__                     HomeScreenTodoType `codec:"t" json:"t"`
	VerifyAllPhoneNumber__  *PhoneNumber       `codec:"verifyAllPhoneNumber,omitempty" json:"verifyAllPhoneNumber,omitempty"`
	VerifyAllEmail__        *EmailAddress      `codec:"verifyAllEmail,omitempty" json:"verifyAllEmail,omitempty"`
	LegacyEmailVisibility__ *EmailAddress      `codec:"legacyEmailVisibility,omitempty" json:"legacyEmailVisibility,omitempty"`
}

func (o *HomeScreenTodo) T() (ret HomeScreenTodoType, err error) {
	switch o.T__ {
	case HomeScreenTodoType_VERIFY_ALL_PHONE_NUMBER:
		if o.VerifyAllPhoneNumber__ == nil {
			err = errors.New("unexpected nil value for VerifyAllPhoneNumber__")
			return ret, err
		}
	case HomeScreenTodoType_VERIFY_ALL_EMAIL:
		if o.VerifyAllEmail__ == nil {
			err = errors.New("unexpected nil value for VerifyAllEmail__")
			return ret, err
		}
	case HomeScreenTodoType_LEGACY_EMAIL_VISIBILITY:
		if o.LegacyEmailVisibility__ == nil {
			err = errors.New("unexpected nil value for LegacyEmailVisibility__")
			return ret, err
		}
	}
	return o.T__, nil
}

func (o HomeScreenTodo) VerifyAllPhoneNumber() (res PhoneNumber) {
	if o.T__ != HomeScreenTodoType_VERIFY_ALL_PHONE_NUMBER {
		panic("wrong case accessed")
	}
	if o.VerifyAllPhoneNumber__ == nil {
		return
	}
	return *o.VerifyAllPhoneNumber__
}

func (o HomeScreenTodo) VerifyAllEmail() (res EmailAddress) {
	if o.T__ != HomeScreenTodoType_VERIFY_ALL_EMAIL {
		panic("wrong case accessed")
	}
	if o.VerifyAllEmail__ == nil {
		return
	}
	return *o.VerifyAllEmail__
}

func (o HomeScreenTodo) LegacyEmailVisibility() (res EmailAddress) {
	if o.T__ != HomeScreenTodoType_LEGACY_EMAIL_VISIBILITY {
		panic("wrong case accessed")
	}
	if o.LegacyEmailVisibility__ == nil {
		return
	}
	return *o.LegacyEmailVisibility__
}

func NewHomeScreenTodoWithVerifyAllPhoneNumber(v PhoneNumber) HomeScreenTodo {
	return HomeScreenTodo{
		T__:                    HomeScreenTodoType_VERIFY_ALL_PHONE_NUMBER,
		VerifyAllPhoneNumber__: &v,
	}
}

func NewHomeScreenTodoWithVerifyAllEmail(v EmailAddress) HomeScreenTodo {
	return HomeScreenTodo{
		T__:              HomeScreenTodoType_VERIFY_ALL_EMAIL,
		VerifyAllEmail__: &v,
	}
}

func NewHomeScreenTodoWithLegacyEmailVisibility(v EmailAddress) HomeScreenTodo {
	return HomeScreenTodo{
		T__:                     HomeScreenTodoType_LEGACY_EMAIL_VISIBILITY,
		LegacyEmailVisibility__: &v,
	}
}

func NewHomeScreenTodoDefault(t HomeScreenTodoType) HomeScreenTodo {
	return HomeScreenTodo{
		T__: t,
	}
}

func (o HomeScreenTodo) DeepCopy() HomeScreenTodo {
	return HomeScreenTodo{
		T__: o.T__.DeepCopy(),
		VerifyAllPhoneNumber__: (func(x *PhoneNumber) *PhoneNumber {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.VerifyAllPhoneNumber__),
		VerifyAllEmail__: (func(x *EmailAddress) *EmailAddress {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.VerifyAllEmail__),
		LegacyEmailVisibility__: (func(x *EmailAddress) *EmailAddress {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.LegacyEmailVisibility__),
	}
}

type HomeScreenTodoExt struct {
	T__              HomeScreenTodoType     `codec:"t" json:"t"`
	VerifyAllEmail__ *VerifyAllEmailTodoExt `codec:"verifyAllEmail,omitempty" json:"verifyAllEmail,omitempty"`
}

func (o *HomeScreenTodoExt) T() (ret HomeScreenTodoType, err error) {
	switch o.T__ {
	case HomeScreenTodoType_VERIFY_ALL_EMAIL:
		if o.VerifyAllEmail__ == nil {
			err = errors.New("unexpected nil value for VerifyAllEmail__")
			return ret, err
		}
	}
	return o.T__, nil
}

func (o HomeScreenTodoExt) VerifyAllEmail() (res VerifyAllEmailTodoExt) {
	if o.T__ != HomeScreenTodoType_VERIFY_ALL_EMAIL {
		panic("wrong case accessed")
	}
	if o.VerifyAllEmail__ == nil {
		return
	}
	return *o.VerifyAllEmail__
}

func NewHomeScreenTodoExtWithVerifyAllEmail(v VerifyAllEmailTodoExt) HomeScreenTodoExt {
	return HomeScreenTodoExt{
		T__:              HomeScreenTodoType_VERIFY_ALL_EMAIL,
		VerifyAllEmail__: &v,
	}
}

func NewHomeScreenTodoExtDefault(t HomeScreenTodoType) HomeScreenTodoExt {
	return HomeScreenTodoExt{
		T__: t,
	}
}

func (o HomeScreenTodoExt) DeepCopy() HomeScreenTodoExt {
	return HomeScreenTodoExt{
		T__: o.T__.DeepCopy(),
		VerifyAllEmail__: (func(x *VerifyAllEmailTodoExt) *VerifyAllEmailTodoExt {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.VerifyAllEmail__),
	}
}

type VerifyAllEmailTodoExt struct {
	LastVerifyEmailDate UnixTime `codec:"lastVerifyEmailDate" json:"lastVerifyEmailDate"`
}

func (o VerifyAllEmailTodoExt) DeepCopy() VerifyAllEmailTodoExt {
	return VerifyAllEmailTodoExt{
		LastVerifyEmailDate: o.LastVerifyEmailDate.DeepCopy(),
	}
}

type HomeScreenPeopleNotificationType int

const (
	HomeScreenPeopleNotificationType_FOLLOWED       HomeScreenPeopleNotificationType = 1
	HomeScreenPeopleNotificationType_FOLLOWED_MULTI HomeScreenPeopleNotificationType = 2
	HomeScreenPeopleNotificationType_CONTACT        HomeScreenPeopleNotificationType = 3
	HomeScreenPeopleNotificationType_CONTACT_MULTI  HomeScreenPeopleNotificationType = 4
)

func (o HomeScreenPeopleNotificationType) DeepCopy() HomeScreenPeopleNotificationType { return o }

var HomeScreenPeopleNotificationTypeMap = map[string]HomeScreenPeopleNotificationType{
	"FOLLOWED":       1,
	"FOLLOWED_MULTI": 2,
	"CONTACT":        3,
	"CONTACT_MULTI":  4,
}

var HomeScreenPeopleNotificationTypeRevMap = map[HomeScreenPeopleNotificationType]string{
	1: "FOLLOWED",
	2: "FOLLOWED_MULTI",
	3: "CONTACT",
	4: "CONTACT_MULTI",
}

func (e HomeScreenPeopleNotificationType) String() string {
	if v, ok := HomeScreenPeopleNotificationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type HomeScreenPeopleNotificationFollowed struct {
	FollowTime   Time        `codec:"followTime" json:"followTime"`
	FollowedBack bool        `codec:"followedBack" json:"followedBack"`
	User         UserSummary `codec:"user" json:"user"`
}

func (o HomeScreenPeopleNotificationFollowed) DeepCopy() HomeScreenPeopleNotificationFollowed {
	return HomeScreenPeopleNotificationFollowed{
		FollowTime:   o.FollowTime.DeepCopy(),
		FollowedBack: o.FollowedBack,
		User:         o.User.DeepCopy(),
	}
}

type HomeScreenPeopleNotificationFollowedMulti struct {
	Followers []HomeScreenPeopleNotificationFollowed `codec:"followers" json:"followers"`
	NumOthers int                                    `codec:"numOthers" json:"numOthers"`
}

func (o HomeScreenPeopleNotificationFollowedMulti) DeepCopy() HomeScreenPeopleNotificationFollowedMulti {
	return HomeScreenPeopleNotificationFollowedMulti{
		Followers: (func(x []HomeScreenPeopleNotificationFollowed) []HomeScreenPeopleNotificationFollowed {
			if x == nil {
				return nil
			}
			ret := make([]HomeScreenPeopleNotificationFollowed, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Followers),
		NumOthers: o.NumOthers,
	}
}

type HomeScreenPeopleNotificationContact struct {
	ResolveTime         Time   `codec:"resolveTime" json:"resolveTime"`
	Username            string `codec:"username" json:"username"`
	Description         string `codec:"description" json:"description"`
	ResolvedContactBlob string `codec:"resolvedContactBlob" json:"resolvedContactBlob"`
}

func (o HomeScreenPeopleNotificationContact) DeepCopy() HomeScreenPeopleNotificationContact {
	return HomeScreenPeopleNotificationContact{
		ResolveTime:         o.ResolveTime.DeepCopy(),
		Username:            o.Username,
		Description:         o.Description,
		ResolvedContactBlob: o.ResolvedContactBlob,
	}
}

type HomeScreenPeopleNotificationContactMulti struct {
	Contacts  []HomeScreenPeopleNotificationContact `codec:"contacts" json:"contacts"`
	NumOthers int                                   `codec:"numOthers" json:"numOthers"`
}

func (o HomeScreenPeopleNotificationContactMulti) DeepCopy() HomeScreenPeopleNotificationContactMulti {
	return HomeScreenPeopleNotificationContactMulti{
		Contacts: (func(x []HomeScreenPeopleNotificationContact) []HomeScreenPeopleNotificationContact {
			if x == nil {
				return nil
			}
			ret := make([]HomeScreenPeopleNotificationContact, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Contacts),
		NumOthers: o.NumOthers,
	}
}

type HomeScreenPeopleNotification struct {
	T__             HomeScreenPeopleNotificationType           `codec:"t" json:"t"`
	Followed__      *HomeScreenPeopleNotificationFollowed      `codec:"followed,omitempty" json:"followed,omitempty"`
	FollowedMulti__ *HomeScreenPeopleNotificationFollowedMulti `codec:"followedMulti,omitempty" json:"followedMulti,omitempty"`
	Contact__       *HomeScreenPeopleNotificationContact       `codec:"contact,omitempty" json:"contact,omitempty"`
	ContactMulti__  *HomeScreenPeopleNotificationContactMulti  `codec:"contactMulti,omitempty" json:"contactMulti,omitempty"`
}

func (o *HomeScreenPeopleNotification) T() (ret HomeScreenPeopleNotificationType, err error) {
	switch o.T__ {
	case HomeScreenPeopleNotificationType_FOLLOWED:
		if o.Followed__ == nil {
			err = errors.New("unexpected nil value for Followed__")
			return ret, err
		}
	case HomeScreenPeopleNotificationType_FOLLOWED_MULTI:
		if o.FollowedMulti__ == nil {
			err = errors.New("unexpected nil value for FollowedMulti__")
			return ret, err
		}
	case HomeScreenPeopleNotificationType_CONTACT:
		if o.Contact__ == nil {
			err = errors.New("unexpected nil value for Contact__")
			return ret, err
		}
	case HomeScreenPeopleNotificationType_CONTACT_MULTI:
		if o.ContactMulti__ == nil {
			err = errors.New("unexpected nil value for ContactMulti__")
			return ret, err
		}
	}
	return o.T__, nil
}

func (o HomeScreenPeopleNotification) Followed() (res HomeScreenPeopleNotificationFollowed) {
	if o.T__ != HomeScreenPeopleNotificationType_FOLLOWED {
		panic("wrong case accessed")
	}
	if o.Followed__ == nil {
		return
	}
	return *o.Followed__
}

func (o HomeScreenPeopleNotification) FollowedMulti() (res HomeScreenPeopleNotificationFollowedMulti) {
	if o.T__ != HomeScreenPeopleNotificationType_FOLLOWED_MULTI {
		panic("wrong case accessed")
	}
	if o.FollowedMulti__ == nil {
		return
	}
	return *o.FollowedMulti__
}

func (o HomeScreenPeopleNotification) Contact() (res HomeScreenPeopleNotificationContact) {
	if o.T__ != HomeScreenPeopleNotificationType_CONTACT {
		panic("wrong case accessed")
	}
	if o.Contact__ == nil {
		return
	}
	return *o.Contact__
}

func (o HomeScreenPeopleNotification) ContactMulti() (res HomeScreenPeopleNotificationContactMulti) {
	if o.T__ != HomeScreenPeopleNotificationType_CONTACT_MULTI {
		panic("wrong case accessed")
	}
	if o.ContactMulti__ == nil {
		return
	}
	return *o.ContactMulti__
}

func NewHomeScreenPeopleNotificationWithFollowed(v HomeScreenPeopleNotificationFollowed) HomeScreenPeopleNotification {
	return HomeScreenPeopleNotification{
		T__:        HomeScreenPeopleNotificationType_FOLLOWED,
		Followed__: &v,
	}
}

func NewHomeScreenPeopleNotificationWithFollowedMulti(v HomeScreenPeopleNotificationFollowedMulti) HomeScreenPeopleNotification {
	return HomeScreenPeopleNotification{
		T__:             HomeScreenPeopleNotificationType_FOLLOWED_MULTI,
		FollowedMulti__: &v,
	}
}

func NewHomeScreenPeopleNotificationWithContact(v HomeScreenPeopleNotificationContact) HomeScreenPeopleNotification {
	return HomeScreenPeopleNotification{
		T__:       HomeScreenPeopleNotificationType_CONTACT,
		Contact__: &v,
	}
}

func NewHomeScreenPeopleNotificationWithContactMulti(v HomeScreenPeopleNotificationContactMulti) HomeScreenPeopleNotification {
	return HomeScreenPeopleNotification{
		T__:            HomeScreenPeopleNotificationType_CONTACT_MULTI,
		ContactMulti__: &v,
	}
}

func (o HomeScreenPeopleNotification) DeepCopy() HomeScreenPeopleNotification {
	return HomeScreenPeopleNotification{
		T__: o.T__.DeepCopy(),
		Followed__: (func(x *HomeScreenPeopleNotificationFollowed) *HomeScreenPeopleNotificationFollowed {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Followed__),
		FollowedMulti__: (func(x *HomeScreenPeopleNotificationFollowedMulti) *HomeScreenPeopleNotificationFollowedMulti {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.FollowedMulti__),
		Contact__: (func(x *HomeScreenPeopleNotificationContact) *HomeScreenPeopleNotificationContact {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Contact__),
		ContactMulti__: (func(x *HomeScreenPeopleNotificationContactMulti) *HomeScreenPeopleNotificationContactMulti {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ContactMulti__),
	}
}

type HomeScreenItem struct {
	Badged  bool                  `codec:"badged" json:"badged"`
	Data    HomeScreenItemData    `codec:"data" json:"data"`
	DataExt HomeScreenItemDataExt `codec:"dataExt" json:"dataExt"`
}

func (o HomeScreenItem) DeepCopy() HomeScreenItem {
	return HomeScreenItem{
		Badged:  o.Badged,
		Data:    o.Data.DeepCopy(),
		DataExt: o.DataExt.DeepCopy(),
	}
}

type Pics struct {
	Square40  string `codec:"square40" json:"square_40"`
	Square200 string `codec:"square200" json:"square_200"`
	Square360 string `codec:"square360" json:"square_360"`
}

func (o Pics) DeepCopy() Pics {
	return Pics{
		Square40:  o.Square40,
		Square200: o.Square200,
		Square360: o.Square360,
	}
}

type HomeUserSummary struct {
	Uid      UID    `codec:"uid" json:"uid"`
	Username string `codec:"username" json:"username"`
	Bio      string `codec:"bio" json:"bio"`
	FullName string `codec:"fullName" json:"full_name"`
	Pics     *Pics  `codec:"pics,omitempty" json:"pics,omitempty"`
}

func (o HomeUserSummary) DeepCopy() HomeUserSummary {
	return HomeUserSummary{
		Uid:      o.Uid.DeepCopy(),
		Username: o.Username,
		Bio:      o.Bio,
		FullName: o.FullName,
		Pics: (func(x *Pics) *Pics {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Pics),
	}
}

type HomeScreen struct {
	LastViewed           Time              `codec:"lastViewed" json:"lastViewed"`
	Version              int               `codec:"version" json:"version"`
	Visits               int               `codec:"visits" json:"visits"`
	Items                []HomeScreenItem  `codec:"items" json:"items"`
	FollowSuggestions    []HomeUserSummary `codec:"followSuggestions" json:"followSuggestions"`
	AnnouncementsVersion int               `codec:"announcementsVersion" json:"announcementsVersion"`
}

func (o HomeScreen) DeepCopy() HomeScreen {
	return HomeScreen{
		LastViewed: o.LastViewed.DeepCopy(),
		Version:    o.Version,
		Visits:     o.Visits,
		Items: (func(x []HomeScreenItem) []HomeScreenItem {
			if x == nil {
				return nil
			}
			ret := make([]HomeScreenItem, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Items),
		FollowSuggestions: (func(x []HomeUserSummary) []HomeUserSummary {
			if x == nil {
				return nil
			}
			ret := make([]HomeUserSummary, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.FollowSuggestions),
		AnnouncementsVersion: o.AnnouncementsVersion,
	}
}

type HomeGetScreenArg struct {
	MarkViewed                 bool `codec:"markViewed" json:"markViewed"`
	NumFollowSuggestionsWanted int  `codec:"numFollowSuggestionsWanted" json:"numFollowSuggestionsWanted"`
}

type HomeSkipTodoTypeArg struct {
	T HomeScreenTodoType `codec:"t" json:"t"`
}

type HomeDismissAnnouncementArg struct {
	I HomeScreenAnnouncementID `codec:"i" json:"i"`
}

type HomeActionTakenArg struct {
}

type HomeMarkViewedArg struct {
}

type HomeInterface interface {
	// HomeGetScreen returns the home screen for the current user.
	// If `markViewed` is specified, the server will mark this version of the
	// home screen "viewed", potentially updating some badges.
	// `numFollowSuggestionsWanted` controls the number of people to return.
	// If not specified, it will default to `0`, so no people.  If `-1` is specified,
	// the default number will be returned (10).  Otherwise, the caller should
	// specify.
	HomeGetScreen(context.Context, HomeGetScreenArg) (HomeScreen, error)
	HomeSkipTodoType(context.Context, HomeScreenTodoType) error
	HomeDismissAnnouncement(context.Context, HomeScreenAnnouncementID) error
	HomeActionTaken(context.Context) error
	HomeMarkViewed(context.Context) error
}

func HomeProtocol(i HomeInterface) rpc.Protocol {
	return rpc.Protocol{
		Name: "keybase.1.home",
		Methods: map[string]rpc.ServeHandlerDescription{
			"homeGetScreen": {
				MakeArg: func() interface{} {
					var ret [1]HomeGetScreenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HomeGetScreenArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HomeGetScreenArg)(nil), args)
						return
					}
					ret, err = i.HomeGetScreen(ctx, typedArgs[0])
					return
				},
			},
			"homeSkipTodoType": {
				MakeArg: func() interface{} {
					var ret [1]HomeSkipTodoTypeArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HomeSkipTodoTypeArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HomeSkipTodoTypeArg)(nil), args)
						return
					}
					err = i.HomeSkipTodoType(ctx, typedArgs[0].T)
					return
				},
			},
			"homeDismissAnnouncement": {
				MakeArg: func() interface{} {
					var ret [1]HomeDismissAnnouncementArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					typedArgs, ok := args.(*[1]HomeDismissAnnouncementArg)
					if !ok {
						err = rpc.NewTypeError((*[1]HomeDismissAnnouncementArg)(nil), args)
						return
					}
					err = i.HomeDismissAnnouncement(ctx, typedArgs[0].I)
					return
				},
			},
			"homeActionTaken": {
				MakeArg: func() interface{} {
					var ret [1]HomeActionTakenArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.HomeActionTaken(ctx)
					return
				},
			},
			"homeMarkViewed": {
				MakeArg: func() interface{} {
					var ret [1]HomeMarkViewedArg
					return &ret
				},
				Handler: func(ctx context.Context, args interface{}) (ret interface{}, err error) {
					err = i.HomeMarkViewed(ctx)
					return
				},
			},
		},
	}
}

type HomeClient struct {
	Cli rpc.GenericClient
}

// HomeGetScreen returns the home screen for the current user.
// If `markViewed` is specified, the server will mark this version of the
// home screen "viewed", potentially updating some badges.
// `numFollowSuggestionsWanted` controls the number of people to return.
// If not specified, it will default to `0`, so no people.  If `-1` is specified,
// the default number will be returned (10).  Otherwise, the caller should
// specify.
func (c HomeClient) HomeGetScreen(ctx context.Context, __arg HomeGetScreenArg) (res HomeScreen, err error) {
	err = c.Cli.Call(ctx, "keybase.1.home.homeGetScreen", []interface{}{__arg}, &res, 0*time.Millisecond)
	return
}

func (c HomeClient) HomeSkipTodoType(ctx context.Context, t HomeScreenTodoType) (err error) {
	__arg := HomeSkipTodoTypeArg{T: t}
	err = c.Cli.Call(ctx, "keybase.1.home.homeSkipTodoType", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c HomeClient) HomeDismissAnnouncement(ctx context.Context, i HomeScreenAnnouncementID) (err error) {
	__arg := HomeDismissAnnouncementArg{I: i}
	err = c.Cli.Call(ctx, "keybase.1.home.homeDismissAnnouncement", []interface{}{__arg}, nil, 0*time.Millisecond)
	return
}

func (c HomeClient) HomeActionTaken(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.home.homeActionTaken", []interface{}{HomeActionTakenArg{}}, nil, 0*time.Millisecond)
	return
}

func (c HomeClient) HomeMarkViewed(ctx context.Context) (err error) {
	err = c.Cli.Call(ctx, "keybase.1.home.homeMarkViewed", []interface{}{HomeMarkViewedArg{}}, nil, 0*time.Millisecond)
	return
}
