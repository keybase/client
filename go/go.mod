module github.com/keybase/client/go

go 1.17

require (
	bazil.org/fuse v0.0.0-20200424023519-3c101025617f
	camlistore.org v0.0.0-20161205184337-c55c8602d3ce
	github.com/PuerkitoBio/goquery v1.0.0
	github.com/akavel/rsrc v0.2.1-0.20151103204339-ba14da1f8271
	github.com/araddon/dateparse v0.0.0-20180729174819-cfd92a431d0e
	github.com/blang/semver v3.0.1+incompatible
	github.com/blevesearch/bleve v0.8.2-0.20191030071327-189ee421f71e
	github.com/btcsuite/btcutil v0.0.0-20180706230648-ab6388e0c60a
	github.com/buger/jsonparser v0.0.0-20180131123142-4be68c93a244
	github.com/coreos/go-systemd v0.0.0-20190620071333-e64a0ec8b42a
	github.com/davecgh/go-spew v1.1.1
	github.com/deckarep/golang-set v1.7.2-0.20180927150649-699df6a3acf6
	github.com/docopt/docopt-go v0.0.0-20160216232012-784ddc588536
	github.com/dustin/go-humanize v1.0.0
	github.com/eapache/channels v1.1.0
	github.com/gammazero/workerpool v0.0.0-20181230203049-86a96b5d5d92
	github.com/go-errors/errors v1.0.1
	github.com/go-sql-driver/mysql v1.5.1-0.20200311113236-681ffa848bae
	github.com/golang/groupcache v0.0.0-20200121045136-8c9f03a8e57e
	github.com/golang/mock v1.6.0
	github.com/hashicorp/golang-lru v0.5.4
	github.com/josephspurrier/goversioninfo v0.0.0-20160622020813-53f6213da3d7
	github.com/keybase/backoff v1.0.1-0.20160517061000-726b63b835ec
	github.com/keybase/cli v1.2.1-0.20191217150554-9323fd7ddfab
	github.com/keybase/clockwork v0.1.1-0.20161209210251-976f45f4a979
	github.com/keybase/colly v1.1.1-0.20190207010505-9a56fbe6c0e6
	github.com/keybase/go-codec v0.0.0-20180928230036-164397562123
	github.com/keybase/go-crypto v0.0.0-20200123003947-c1f55fb1d439
	github.com/keybase/go-framed-msgpack-rpc v0.0.0-20200311211234-26e5d1ace9c8
	github.com/keybase/go-jsonw v0.0.0-20200131153605-3e5b58caddd9
	github.com/keybase/go-kext v0.0.0-20190828021436-284cc5cce039
	github.com/keybase/go-keychain v0.0.0-20200325143049-65d7292bc904
	github.com/keybase/go-logging v0.0.0-20200422155153-09554349da10
	github.com/keybase/go-merkle-tree v0.0.0-20190828154848-e5a1d5d70a43
	github.com/keybase/go-porterstemmer v1.0.2-0.20181016185745-521f1ed5c3f7
	github.com/keybase/go-ps v0.0.0-20190827175125-91aafc93ba19
	github.com/keybase/go-triplesec v0.0.0-20190828014055-64e2936e9594
	github.com/keybase/go-triplesec-insecure v0.0.0-20190828015343-01d229502763
	github.com/keybase/go-updater v0.0.0-20200416153205-e86066838ee4
	github.com/keybase/go-winio v0.4.12-0.20180913221037-b1d96ab97b58
	github.com/keybase/go.dbus v0.0.0-20200324223359-a94be52c0b03
	github.com/keybase/golang-ico v0.0.0-20181117022008-819cbeb217c9
	github.com/keybase/gomounts v0.0.0-20180302000443-349507f4d353
	github.com/keybase/keybase-test-vectors v1.0.12-0.20200309162119-ea1e58fecd5d
	github.com/keybase/pipeliner v0.0.0-20190828022149-31ef4ee63659
	github.com/keybase/release v0.0.0-20200218014000-02d3535dfd5a
	github.com/keybase/saltpack v0.0.0-20200228190633-d75baa96bffb
	github.com/keybase/stellarnet v0.0.0-20200311180805-6c05850f9050
	github.com/kr/text v0.2.0
	github.com/kyokomi/emoji v2.2.2+incompatible
	github.com/mattn/go-isatty v0.0.14
	github.com/miekg/dns v1.1.35
	github.com/nfnt/resize v0.0.0-20160724205520-891127d8d1b5
	github.com/pkg/errors v0.9.1
	github.com/pkg/xattr v0.2.2
	github.com/qrtz/nativemessaging v0.0.0-20161221035708-f4769a80e040
	github.com/rcrowley/go-metrics v0.0.0-20161128210544-1f30fe9094a5
	github.com/sergi/go-diff v1.1.0
	github.com/shirou/gopsutil v2.18.13-0.20181231150826-db425313bfa8+incompatible
	github.com/stathat/go v1.0.0
	github.com/stellar/go v0.0.0-20191010205648-0fc3bfe3dfa7
	github.com/stretchr/testify v1.7.0
	github.com/syndtr/goleveldb v1.0.0
	github.com/urfave/cli v1.22.1
	github.com/vividcortex/ewma v1.1.2-0.20170804035156-43880d236f69
	go.uber.org/zap v1.17.0
	golang.org/x/crypto v0.0.0-20210921155107-089bfa567519
	golang.org/x/image v0.0.0-20190802002840-cff245a6509b
	golang.org/x/mobile v0.0.0-20211109191125-d61a72f26a1a
	golang.org/x/net v0.0.0-20210805182204-aaa1db679c0d
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/sys v0.0.0-20211108224332-cbcd623f202e
	golang.org/x/text v0.3.7
	golang.org/x/time v0.0.0-20200416051211-89c76fbcd5d1
	gopkg.in/src-d/go-billy.v4 v4.3.2
	gopkg.in/src-d/go-git.v4 v4.13.1
	mvdan.cc/xurls/v2 v2.0.0-00010101000000-000000000000
	rsc.io/qr v0.2.0
	stathat.com/c/ramcache v1.0.0
)

require (
	github.com/BurntSushi/toml v0.4.1 // indirect
	github.com/RoaringBitmap/roaring v0.4.22-0.20191112221735-4d53b29a8f7d // indirect
	github.com/StackExchange/wmi v1.2.1 // indirect
	github.com/alcortesm/tgz v0.0.0-20161220082320-9c5fe88206d7 // indirect
	github.com/alecthomas/template v0.0.0-20190718012654-fb15b899a751 // indirect
	github.com/alecthomas/units v0.0.0-20190717042225-c3de453c63f4 // indirect
	github.com/andybalholm/brotli v1.0.3 // indirect
	github.com/andybalholm/cascadia v0.0.0-20150730174459-3ad29d1ad1c4 // indirect
	github.com/anmitsu/go-shlex v0.0.0-20161002113705-648efa622239 // indirect
	github.com/antchfx/htmlquery v0.0.0-20180925020018-98389addba3d // indirect
	github.com/antchfx/xmlquery v0.0.0-20181024140136-98cdbc3221ed // indirect
	github.com/antchfx/xpath v0.0.0-20180922041825-3de91f3991a1 // indirect
	github.com/asaskevich/govalidator v0.0.0-20180319081651-7d2e70ef918f // indirect
	github.com/aws/aws-sdk-go v1.36.30 // indirect
	github.com/blevesearch/blevex v0.0.0-20190916190636-152f0fe5c040 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/segment v0.8.0 // indirect
	github.com/coreos/pkg v0.0.0-20180928190104-399ea9e2e55f // indirect
	github.com/couchbase/vellum v1.0.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.0 // indirect
	github.com/cznic/b v0.0.0-20181122101859-a26611c4d92d // indirect
	github.com/eapache/queue v1.1.1-0.20180227141424-093482f3f8ce // indirect
	github.com/edsrzf/mmap-go v1.0.1-0.20190108065903-904c4ced31cd // indirect
	github.com/emirpasic/gods v1.12.1-0.20181020102604-7c131f671417 // indirect
	github.com/etcd-io/bbolt v1.3.3 // indirect
	github.com/fsnotify/fsnotify v1.5.1 // indirect
	github.com/gammazero/deque v0.0.0-20180920172122-f6adf94963e4 // indirect
	github.com/gliderlabs/ssh v0.3.0 // indirect
	github.com/glycerine/go-unsnap-stream v0.0.0-20181221182339-f9677308dec2 // indirect
	github.com/go-ole/go-ole v1.2.6 // indirect
	github.com/gobwas/glob v0.2.4-0.20181002190808-e7a84e9525fe // indirect
	github.com/gocolly/colly v1.1.1-0.20190204140905-b3032e87d3ef // indirect
	github.com/golang/protobuf v1.5.2 // indirect
	github.com/golang/snappy v0.0.4 // indirect
	github.com/google/go-cmp v0.5.6 // indirect
	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/jmhodges/levigo v1.0.0 // indirect
	github.com/kennygrant/sanitize v1.2.4 // indirect
	github.com/kevinburke/ssh_config v0.0.0-20180830205328-81db2a75821e // indirect
	github.com/keybase/msgpackzip v0.0.0-20190828015335-de96f0e9b79a // indirect
	github.com/keybase/vcr v0.0.0-20191017153547-a32d93056205 // indirect
	github.com/klauspost/compress v1.13.5 // indirect
	github.com/lib/pq v1.10.3 // indirect
	github.com/manucorporat/sse v0.0.0-20160126180136-ee05b128a739 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mschoch/smat v0.0.0-20160514031455-90eadee771ae // indirect
	github.com/nf/cr2 v0.0.0-20140528043846-05d46fef4f2f // indirect
	github.com/onsi/ginkgo v1.16.4 // indirect
	github.com/onsi/gomega v1.16.0 // indirect
	github.com/pelletier/go-buffruneio v0.3.0 // indirect
	github.com/philhofer/fwd v1.0.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/reiver/go-oi v1.0.0 // indirect
	github.com/reiver/go-telnet v0.0.0-20180421082511-9ff0b2ab096e // indirect
	github.com/russross/blackfriday/v2 v2.0.1 // indirect
	github.com/rwcarlsen/goexif v0.0.0-20150520140647-709fab3d192d // indirect
	github.com/saintfish/chardet v0.0.0-20120816061221-3af4cd4741ca // indirect
	github.com/segmentio/go-loggly v0.5.1-0.20171222203950-eb91657e62b2 // indirect
	github.com/shopspring/decimal v1.1.1-0.20191009025716-f1972eb1d1f5 // indirect
	github.com/shurcooL/sanitized_anchor_name v1.0.0 // indirect
	github.com/simplereach/timeutils v1.2.0 // indirect
	github.com/sirupsen/logrus v1.8.1 // indirect
	github.com/src-d/gcfg v1.3.0 // indirect
	github.com/stellar/go-xdr v0.0.0-20180917104419-0bc96f33a18e // indirect
	github.com/steveyen/gtreap v0.0.0-20150807155958-0abe01ef9be2 // indirect
	github.com/stretchr/objx v0.2.0 // indirect
	github.com/strib/gomounts v0.0.0-20180215003523-d9ea4eaa52ca // indirect
	github.com/tecbot/gorocksdb v0.0.0-20191217155057-f0fad39f321c // indirect
	github.com/temoto/robotstxt v0.0.0-20180810133444-97ee4a9ee6ea // indirect
	github.com/tinylib/msgp v1.1.0 // indirect
	github.com/valyala/fasthttp v1.30.0 // indirect
	github.com/willf/bitset v1.1.11-0.20190404145324-77892cd8d53f // indirect
	github.com/xanzy/ssh-agent v0.2.0 // indirect
	github.com/yudai/gojsondiff v1.0.0 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	go.etcd.io/bbolt v1.3.4 // indirect
	go.uber.org/atomic v1.7.0 // indirect
	go.uber.org/multierr v1.6.0 // indirect
	go4.org v0.0.0-20161118210015-09d86de304dc // indirect
	golang.org/x/mod v0.5.0 // indirect
	golang.org/x/tools v0.1.8-0.20211022200916-316ba0b74098 // indirect
	golang.org/x/xerrors v0.0.0-20200804184101-5ec99f83aff1 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/protobuf v1.27.1 // indirect
	gopkg.in/alecthomas/kingpin.v2 v2.2.6 // indirect
	gopkg.in/mgo.v2 v2.0.0-20190816093944-a6b53ec6cb22 // indirect
	gopkg.in/src-d/go-git-fixtures.v3 v3.5.0 // indirect
	gopkg.in/warnings.v0 v0.1.2 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
)

// keybase maintained forks
replace (
	bazil.org/fuse => github.com/keybase/fuse v0.0.0-20210104232444-d36009698767
	bitbucket.org/ww/goautoneg => github.com/adjust/goautoneg v0.0.0-20150426214442-d788f35a0315
	github.com/stellar/go => github.com/keybase/stellar-org v0.0.0-20191010205648-0fc3bfe3dfa7
	github.com/syndtr/goleveldb => github.com/keybase/goleveldb v1.0.1-0.20211106225230-2a53fac0721c
	gopkg.in/src-d/go-billy.v4 => github.com/keybase/go-billy v3.1.1-0.20180828145748-b5a7b7bc2074+incompatible
	gopkg.in/src-d/go-git.v4 => github.com/keybase/go-git v4.0.0-rc9.0.20190209005256-3a78daa8ce8e+incompatible
	mvdan.cc/xurls/v2 => github.com/keybase/xurls/v2 v2.0.1-0.20190725180013-1e015cacd06c
)

// temporary workaround for https://github.com/blevesearch/bleve/issues/1360
// should be removed if bleve is updated to a commit past https://github.com/blevesearch/bleve/commit/a9895fdf9c72cfaa202128a963697d9a98765369
replace github.com/etcd-io/bbolt => go.etcd.io/bbolt v1.3.4-0.20191122203157-7f8bb47fcaf8
