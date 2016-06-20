package storage

import (
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/jonboulle/clockwork"
	"github.com/keybase/gregor"
	"github.com/keybase/gregor/schema"
)

func sqlWrapper(s string) string {
	return strings.Join(regexp.MustCompile(`\s+`).Split(s, -1), " ")
}

type SQLEngine struct {
	driver      *sql.DB
	objFactory  gregor.ObjFactory
	clock       clockwork.Clock
	stw         sqlTimeWriter
	updateLocks bool
}

func NewSQLEngine(d *sql.DB, of gregor.ObjFactory, stw sqlTimeWriter, cl clockwork.Clock, updateLocks bool) *SQLEngine {
	return &SQLEngine{driver: d, objFactory: of, stw: stw, clock: cl, updateLocks: updateLocks}
}

func NewMySQLEngine(d *sql.DB, of gregor.ObjFactory) *SQLEngine {
	return NewSQLEngine(d, of, mysqlTimeWriter{}, clockwork.NewRealClock(), true)
}

func NewTestMySQLEngine(d *sql.DB, of gregor.ObjFactory) (*SQLEngine, clockwork.FakeClock) {
	clock := clockwork.NewFakeClock()
	eng := NewSQLEngine(d, of, mysqlTimeWriter{}, clock, true)
	return eng, clock
}

func NewTestSqlLiteSQLEngine(d *sql.DB, of gregor.ObjFactory) *SQLEngine {
	return NewSQLEngine(d, of, sqliteTimeWriter{}, clockwork.NewFakeClock(), false)
}

type builder interface {
	Build(s string, args ...interface{})
}

type sqlTimeWriter interface {
	Now(b builder, cl clockwork.Clock)
	TimeOrOffset(b builder, cl clockwork.Clock, too gregor.TimeOrOffset)
	TimeArg(t time.Time) interface{}
}

type queryBuilder struct {
	args  []interface{}
	qry   []string
	clock clockwork.Clock
	stw   sqlTimeWriter
}

func (q *queryBuilder) Now() {
	q.stw.Now(q, q.clock)
}

func (q *queryBuilder) TimeOrOffset(too gregor.TimeOrOffset) {
	q.stw.TimeOrOffset(q, q.clock, too)
}

func (q *queryBuilder) InSet(s []string) {
	var qmarks []string
	for _, val := range s {
		qmarks = append(qmarks, "?")
		q.args = append(q.args, val)
	}
	q.Build("(" + strings.Join(qmarks, ",") + ")")
}

func (q *queryBuilder) TimeArg(t time.Time) interface{} {
	return q.stw.TimeArg(t)
}

func (q *queryBuilder) AddTime(t time.Time) {
	q.qry = append(q.qry, "?")
	q.args = append(q.args, q.TimeArg(t))
}

func (q *queryBuilder) Build(f string, args ...interface{}) {
	q.qry = append(q.qry, f)
	q.args = append(q.args, args...)
}

func (q *queryBuilder) Query() string       { return strings.Join(q.qry, " ") }
func (q *queryBuilder) Args() []interface{} { return q.args }

func (q *queryBuilder) Exec(tx *sql.Tx) error {
	stmt, err := tx.Prepare(q.Query())
	if err != nil {
		return err
	}
	defer stmt.Close()
	_, err = stmt.Exec(q.Args()...)
	return err
}

type byter interface {
	Bytes() []byte
}

func hexEnc(b byter) string { return hex.EncodeToString(b.Bytes()) }

func hexEncOrNull(b byter) interface{} {
	if b == nil {
		return nil
	}
	return hexEnc(b)
}

func (s *SQLEngine) newQueryBuilder() *queryBuilder {
	return &queryBuilder{clock: s.clock, stw: s.stw}
}

func (s *SQLEngine) consumeCreation(tx *sql.Tx, i gregor.Item) error {
	md := i.Metadata()
	qb := s.newQueryBuilder()
	qb.Build("INSERT INTO gregor_items(uid, msgid, category, body, dtime) VALUES(?,?,?,?,",
		hexEnc(md.UID()),
		hexEnc(md.MsgID()),
		i.Category().String(),
		i.Body().Bytes(),
	)
	qb.TimeOrOffset(i.DTime())
	qb.Build(")")
	err := qb.Exec(tx)
	if err != nil {
		return err
	}

	for i, t := range i.RemindTimes() {
		if t == nil {
			continue
		}
		nqb := s.newQueryBuilder()
		nqb.Build("INSERT INTO gregor_reminders(uid, msgid, seqno, rtime) VALUES(?,?,?,", hexEnc(md.UID()), hexEnc(md.MsgID()), i)
		nqb.TimeOrOffset(t)
		nqb.Build(")")
		err = nqb.Exec(tx)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLEngine) consumeMsgIDsToDismiss(tx *sql.Tx, u gregor.UID, mid gregor.MsgID, dmids []gregor.MsgID, ctime time.Time) error {
	ins, err := tx.Prepare("INSERT INTO gregor_dismissals_by_id(uid, msgid, dmsgid) VALUES(?, ?, ?)")
	if err != nil {
		return err
	}
	defer ins.Close()
	upd, err := tx.Prepare("UPDATE gregor_items SET dtime=? WHERE uid=? AND msgid=?")
	if err != nil {
		return err
	}
	defer upd.Close()

	ctimeArg := s.newQueryBuilder().TimeArg(ctime)
	hexUID := hexEnc(u)
	hexMID := hexEnc(mid)

	for _, dmid := range dmids {
		_, err = ins.Exec(hexUID, hexMID, hexEnc(dmid))
		if err != nil {
			return err
		}
		_, err = upd.Exec(ctimeArg, hexUID, hexEnc(dmid))
		if err != nil {
			return err
		}
	}
	return err
}

func (s *SQLEngine) ctimeFromMessage(tx *sql.Tx, u gregor.UID, mid gregor.MsgID) (time.Time, error) {
	row := tx.QueryRow("SELECT ctime FROM gregor_messages WHERE uid=? AND msgid=?", hexEnc(u), hexEnc(mid))
	var ctime timeScanner
	if err := row.Scan(&ctime); err != nil {
		return time.Time{}, err
	}
	return ctime.Time(), nil
}

func (s *SQLEngine) consumeRangesToDismiss(tx *sql.Tx, u gregor.UID, mid gregor.MsgID, mrs []gregor.MsgRange, ctime time.Time) error {
	for _, mr := range mrs {
		qb := s.newQueryBuilder()
		qb.Build("INSERT INTO gregor_dismissals_by_time(uid, msgid, category, dtime) VALUES (?,?,?,", hexEnc(u), hexEnc(mid), mr.Category().String())
		qb.TimeOrOffset(mr.EndTime())
		qb.Build(")")
		if err := qb.Exec(tx); err != nil {
			return err
		}

		// set dtime in items to the ctime of the dismissal message:
		qbu := s.newQueryBuilder()
		qbu.Build("UPDATE gregor_items SET dtime=? WHERE uid=? AND category=? AND msgid IN (SELECT msgid FROM gregor_messages WHERE uid=? AND ctime<=",
			qbu.TimeArg(ctime), hexEnc(u), mr.Category().String(), hexEnc(u))
		qbu.TimeOrOffset(mr.EndTime())
		qbu.Build(")")
		if err := qbu.Exec(tx); err != nil {
			return err
		}
	}
	return nil
}

func checkMetadataForInsert(m gregor.Metadata) error {
	if m.MsgID() == nil {
		return fmt.Errorf("bad metadata; nil MsgID")
	}
	if m.UID() == nil {
		return fmt.Errorf("bad metadata: nil UID")
	}
	return nil
}

func (s *SQLEngine) consumeInBandMessageMetadata(tx *sql.Tx, md gregor.Metadata, t gregor.InBandMsgType) (gregor.Metadata, error) {
	if err := checkMetadataForInsert(md); err != nil {
		return nil, err
	}
	if t != gregor.InBandMsgTypeUpdate && t != gregor.InBandMsgTypeSync {
		return nil, fmt.Errorf("bad metadata: unrecognized msg type")
	}
	qb := s.newQueryBuilder()
	qb.Build("INSERT INTO gregor_messages(uid, msgid, mtype, devid, ctime) VALUES(?, ?, ?, ?,",
		hexEnc(md.UID()), hexEnc(md.MsgID()), int(t), hexEncOrNull(md.DeviceID()))
	if md.CTime().IsZero() {
		qb.Now()
	} else {
		qb.AddTime(md.CTime())
	}
	qb.Build(")")
	if err := qb.Exec(tx); err != nil {
		return nil, err
	}

	if !md.CTime().IsZero() {
		return md, nil
	}

	// get the inserted ctime
	ctime, err := s.ctimeFromMessage(tx, md.UID(), md.MsgID())
	if err != nil {
		return nil, err
	}
	return s.objFactory.MakeMetadata(md.UID(), md.MsgID(), md.DeviceID(), ctime, md.InBandMsgType())
}

func (s *SQLEngine) ConsumeMessage(m gregor.Message) (time.Time, error) {
	switch {
	case m.ToInBandMessage() != nil:
		return s.consumeInBandMessage(m.ToInBandMessage())
	default:
		return time.Time{}, nil
	}
}

func (s *SQLEngine) consumeInBandMessage(m gregor.InBandMessage) (time.Time, error) {
	switch {
	case m.ToStateUpdateMessage() != nil:
		return s.consumeStateUpdateMessage(m.ToStateUpdateMessage())
	default:
		return time.Time{}, nil
	}
}

func (s *SQLEngine) consumeStateUpdateMessage(m gregor.StateUpdateMessage) (ctime time.Time, err error) {
	tx, err := s.driver.Begin()
	if err != nil {
		return time.Time{}, err
	}
	defer tx.Rollback()

	md := m.Metadata()
	if md, err = s.consumeInBandMessageMetadata(tx, md, gregor.InBandMsgTypeUpdate); err != nil {
		return time.Time{}, err
	}

	ctime = md.CTime()
	if m.Creation() != nil {
		if err = s.consumeCreation(tx, m.Creation()); err != nil {
			return ctime, err
		}
	}
	if m.Dismissal() != nil {
		if err = s.consumeMsgIDsToDismiss(tx, md.UID(), md.MsgID(), m.Dismissal().MsgIDsToDismiss(), md.CTime()); err != nil {
			return ctime, err
		}
		if err = s.consumeRangesToDismiss(tx, md.UID(), md.MsgID(), m.Dismissal().RangesToDismiss(), md.CTime()); err != nil {
			return ctime, err
		}
	}

	if err = tx.Commit(); err != nil {
		return time.Time{}, err
	}

	return ctime, nil
}

func (s *SQLEngine) rowToItem(u gregor.UID, rows *sql.Rows) (gregor.Item, error) {
	deviceID := deviceIDScanner{o: s.objFactory}
	msgID := msgIDScanner{o: s.objFactory}
	category := categoryScanner{o: s.objFactory}
	body := bodyScanner{o: s.objFactory}
	var dtime timeScanner
	var ctime timeScanner
	if err := rows.Scan(&msgID, &deviceID, &category, &dtime, &body, &ctime); err != nil {
		return nil, err
	}
	return s.objFactory.MakeItem(u, msgID.MsgID(), deviceID.DeviceID(), ctime.Time(), category.Category(), dtime.TimeOrNil(), body.Body())
}

func (s *SQLEngine) rowToReminder(rows *sql.Rows) (gregor.Reminder, error) {
	uid := uidScanner{o: s.objFactory}
	deviceID := deviceIDScanner{o: s.objFactory}
	msgID := msgIDScanner{o: s.objFactory}
	category := categoryScanner{o: s.objFactory}
	body := bodyScanner{o: s.objFactory}
	var dtime timeScanner
	var ctime timeScanner
	var rtime timeScanner
	var seqno int
	if err := rows.Scan(&uid, &msgID, &deviceID, &category, &dtime, &body, &ctime, &rtime, &seqno); err != nil {
		return nil, err
	}
	it, err := s.objFactory.MakeItem(uid.UID(), msgID.MsgID(), deviceID.DeviceID(), ctime.Time(), category.Category(), dtime.TimeOrNil(), body.Body())
	if err != nil {
		return nil, err
	}
	return s.objFactory.MakeReminder(it, seqno, rtime.Time())
}

func (s *SQLEngine) State(u gregor.UID, d gregor.DeviceID, t gregor.TimeOrOffset) (gregor.State, error) {
	items, err := s.items(u, d, t, nil, nil)
	if err != nil {
		return nil, err
	}
	return s.objFactory.MakeState(items)
}

func (s *SQLEngine) StateByCategoryPrefix(u gregor.UID, d gregor.DeviceID, t gregor.TimeOrOffset, cp gregor.Category) (gregor.State, error) {
	items, err := s.items(u, d, t, nil, cp)
	if err != nil {
		return nil, err
	}
	return s.objFactory.MakeState(items)
}

func (s *SQLEngine) items(u gregor.UID, d gregor.DeviceID, t gregor.TimeOrOffset, m gregor.MsgID, cp gregor.Category) ([]gregor.Item, error) {
	qry := `SELECT i.msgid, m.devid, i.category, i.dtime, i.body, m.ctime
	        FROM gregor_items AS i
	        INNER JOIN gregor_messages AS m ON (i.uid=m.uid AND i.msgid=m.msgid)
	        WHERE i.uid=? AND (i.dtime IS NULL OR i.dtime > `
	qb := s.newQueryBuilder()
	qb.Build(qry, hexEnc(u))
	if t != nil {
		qb.TimeOrOffset(t)
	} else {
		qb.Now()
	}
	qb.Build(")")
	if d != nil {
		// A "NULL" devid in this case means that the Item/message is intended for all
		// devices. So include that as well.
		qb.Build("AND (m.devid=? OR m.devid IS NULL)", hexEnc(d))
	}
	if t != nil {
		qb.Build("AND m.ctime <=")
		qb.TimeOrOffset(t)
	}
	if m != nil {
		qb.Build("AND i.msgid=?", hexEnc(m))
	}
	if cp != nil {
		qb.Build(" AND i.category LIKE ?", cp.String()+"%")
	}
	qb.Build("ORDER BY m.ctime ASC")
	stmt, err := s.driver.Prepare(qb.Query())
	if err != nil {
		return nil, err
	}
	defer stmt.Close()
	rows, err := stmt.Query(qb.Args()...)
	if err != nil {
		return nil, err
	}
	var items []gregor.Item
	for rows.Next() {
		item, err := s.rowToItem(u, rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *SQLEngine) rowToMetadata(rows *sql.Rows) (gregor.Metadata, error) {
	var ctime time.Time
	uid := uidScanner{o: s.objFactory}
	deviceID := deviceIDScanner{o: s.objFactory}
	msgID := msgIDScanner{o: s.objFactory}
	inBandMsgType := inBandMsgTypeScanner{}
	if err := rows.Scan(&uid, &msgID, &ctime, &deviceID, &inBandMsgType); err != nil {
		return nil, err
	}
	return s.objFactory.MakeMetadata(uid.UID(), msgID.MsgID(), deviceID.DeviceID(), ctime, inBandMsgType.InBandMsgType())
}

func (s *SQLEngine) inBandMetadataSince(u gregor.UID, t gregor.TimeOrOffset) ([]gregor.Metadata, error) {
	qry := `SELECT uid, msgid, ctime, devid, mtype FROM gregor_messages WHERE uid=?`
	qb := s.newQueryBuilder()
	qb.Build(qry, hexEnc(u))
	if t != nil {
		qb.Build("AND ctime >= ")
		qb.TimeOrOffset(t)
	}
	qb.Build("ORDER BY ctime ASC")
	stmt, err := s.driver.Prepare(qb.Query())
	if err != nil {
		return nil, err
	}
	defer stmt.Close()
	rows, err := stmt.Query(qb.Args()...)
	if err != nil {
		return nil, err
	}
	var ret []gregor.Metadata
	for rows.Next() {
		md, err := s.rowToMetadata(rows)
		if err != nil {
			return nil, err
		}
		ret = append(ret, md)
	}
	return ret, nil
}

func (s *SQLEngine) rowToInBandMessage(u gregor.UID, rows *sql.Rows) (gregor.InBandMessage, error) {
	msgID := msgIDScanner{o: s.objFactory}
	devID := deviceIDScanner{o: s.objFactory}
	var ctime timeScanner
	var mtype inBandMsgTypeScanner
	category := categoryScanner{o: s.objFactory}
	body := bodyScanner{o: s.objFactory}
	dCategory := categoryScanner{o: s.objFactory}
	var dTime timeScanner
	dMsgID := msgIDScanner{o: s.objFactory}

	if err := rows.Scan(&msgID, &devID, &ctime, &mtype, &category, &body, &dCategory, &dTime, &dMsgID); err != nil {
		return nil, err
	}

	switch {
	case category.IsSet():
		i, err := s.objFactory.MakeItem(u, msgID.MsgID(), devID.DeviceID(), ctime.Time(), category.Category(), nil, body.Body())
		if err != nil {
			return nil, err
		}
		return s.objFactory.MakeInBandMessageFromItem(i)
	case dCategory.IsSet() && dTime.TimeOrNil() != nil:
		return s.objFactory.MakeDismissalByRange(u, msgID.MsgID(), devID.DeviceID(), ctime.Time(), dCategory.Category(), dTime.Time())
	case dMsgID.MsgID() != nil:
		return s.objFactory.MakeDismissalByIDs(u, msgID.MsgID(), devID.DeviceID(), ctime.Time(), []gregor.MsgID{dMsgID.MsgID()})
	case mtype.InBandMsgType() == gregor.InBandMsgTypeSync:
		return s.objFactory.MakeStateSyncMessage(u, msgID.MsgID(), devID.DeviceID(), ctime.Time())
	}

	return nil, nil
}

func (s *SQLEngine) Clear() error {
	tx, err := s.driver.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, stmt := range schema.Schema("") {
		if _, err = tx.Exec(stmt); err != nil {
			return err
		}
	}

	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (s *SQLEngine) LatestCTime(u gregor.UID, d gregor.DeviceID) *time.Time {
	qry := `SELECT MAX(ctime)
			FROM gregor_messages
			WHERE uid = ? AND (devid = ? OR devid IS NULL)`
	var ctime timeScanner
	err := s.driver.QueryRow(qry, hexEnc(u), hexEnc(d)).Scan(&ctime)
	if err != nil {
		return nil
	}
	return ctime.TimeOrNil()
}

func (s *SQLEngine) InBandMessagesSince(u gregor.UID, d gregor.DeviceID, t time.Time) ([]gregor.InBandMessage, error) {
	qry := `SELECT m.msgid, m.devid, m.ctime, m.mtype,
               i.category, i.body,
               dt.category, dt.dtime,
               di.dmsgid
	        FROM gregor_messages AS m
	        LEFT JOIN gregor_items AS i ON (m.uid=i.UID AND m.msgid=i.msgid)
	        LEFT JOIN gregor_dismissals_by_time AS dt ON (m.uid=dt.uid AND m.msgid=dt.msgid)
	        LEFT JOIN gregor_dismissals_by_id AS di ON (m.uid=di.uid AND m.msgid=di.msgid)
	        WHERE m.uid=? AND (i.dtime IS NULL OR i.dtime > `
	qb := s.newQueryBuilder()
	qb.Build(qry, hexEnc(u))
	qb.Now()
	qb.Build(")")
	if d != nil {
		qb.Build("AND (m.devid=? OR m.devid IS NULL)", hexEnc(d))
	}

	qb.Build("AND m.ctime >= ")
	qb.AddTime(t)

	qb.Build("ORDER BY m.ctime ASC")
	stmt, err := s.driver.Prepare(qb.Query())
	if err != nil {
		return nil, err
	}
	defer stmt.Close()
	rows, err := stmt.Query(qb.Args()...)
	if err != nil {
		return nil, err
	}
	var ret []gregor.InBandMessage
	lookup := make(map[string]gregor.InBandMessage)
	for rows.Next() {
		ibm, err := s.rowToInBandMessage(u, rows)
		if err != nil {
			return nil, err
		}
		msgIDString := hexEnc(ibm.Metadata().MsgID())
		if ibm2 := lookup[msgIDString]; ibm2 != nil {
			if err = ibm2.Merge(ibm); err != nil {
				return nil, err
			}
		} else {
			ret = append(ret, ibm)
			lookup[msgIDString] = ibm
		}
	}
	return ret, nil
}

func (s *SQLEngine) Reminders(maxReminders int) (gregor.ReminderSet, error) {
	tx, err := s.driver.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	qb := s.newQueryBuilder()
	qb.Build(`SELECT i.uid, i.msgid, m.devid, i.category, i.dtime, i.body, m.ctime, r.rtime, r.seqno
	        FROM gregor_items AS i
	        INNER JOIN gregor_messages AS m ON (i.uid=m.uid AND i.msgid=m.msgid)
	        INNER JOIN gregor_reminders AS r ON (i.uid=r.uid AND i.msgid=r.msgid)
	        WHERE i.dtime IS NULL AND r.rtime <=`)
	qb.Now()
	qb.Build(`AND (r.lock_time IS NULL OR r.lock_time <=`)
	too, _ := s.objFactory.MakeTimeOrOffsetFromOffset(-s.ReminderLockDuration())
	qb.TimeOrOffset(too)
	limit := 1000
	if maxReminders > limit || maxReminders == 0 {
		maxReminders = limit
	}
	qb.Build(`) ORDER BY rtime DESC LIMIT ?`, maxReminders)
	if s.updateLocks {
		qb.Build("FOR UPDATE")
	}

	stmt, err := s.driver.Prepare(qb.Query())
	if err != nil {
		return nil, err
	}
	defer stmt.Close()
	rows, err := stmt.Query(qb.Args()...)
	if err != nil {
		return nil, err
	}

	var reminders []gregor.Reminder
	for rows.Next() {
		reminder, err := s.rowToReminder(rows)
		if err != nil {
			return nil, err
		}
		reminders = append(reminders, reminder)
	}

	for _, reminder := range reminders {
		qb = s.newQueryBuilder()
		qb.Build("UPDATE gregor_reminders SET lock_time=")
		qb.Now()
		qb.Build("WHERE uid=? AND msgid=? AND seqno=?",
			hexEnc(reminder.Item().Metadata().UID()),
			hexEnc(reminder.Item().Metadata().MsgID()),
			reminder.Seqno())
		if err = qb.Exec(tx); err != nil {
			return nil, err
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return s.objFactory.MakeReminderSetFromReminders(reminders, false)
}

func (s *SQLEngine) DeleteReminder(r gregor.ReminderID) error {
	qb := s.newQueryBuilder()
	qb.Build("DELETE FROM gregor_reminders WHERE uid=? AND msgid=? AND seqno=?", hexEnc(r.UID()), hexEnc(r.MsgID()), r.Seqno())
	_, err := s.driver.Exec(qb.Query(), qb.Args()...)
	return err
}

func (s *SQLEngine) IsEphemeral() bool {
	return false
}

func (s *SQLEngine) InitState(_ gregor.State) error {
	return errors.New("attempting to initialize non-ephemeral StateMachine")
}

func (s *SQLEngine) ObjFactory() gregor.ObjFactory {
	return s.objFactory
}

func (s *SQLEngine) Clock() clockwork.Clock {
	return s.clock
}

func (s *SQLEngine) ReminderLockDuration() time.Duration { return 10 * time.Minute }

var _ gregor.StateMachine = (*SQLEngine)(nil)
