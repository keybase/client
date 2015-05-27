package libkb

type NaclKeyPair interface {
	GenericKey
}

type NaclGenerator func() (NaclKeyPair, error)

type NaclKeyGenArg struct {
	Signer      GenericKey // who is going to sign us into the Chain
	ExpiresIn   int
	Generator   NaclGenerator
	Me          *User
	Sibkey      bool
	ExpireIn    int // how long it lasts
	EldestKeyID KID // the eldest KID for this epoch
	LogUI       LogUI
	Device      *Device
	RevSig      string // optional reverse sig.  set to nil for autogenerate.
}

type NaclKeyGen struct {
	arg  *NaclKeyGenArg
	pair NaclKeyPair
}

func NewNaclKeyGen(arg NaclKeyGenArg) *NaclKeyGen {
	return &NaclKeyGen{arg: &arg}
}

func (g *NaclKeyGen) Generate() (err error) {
	g.pair, err = g.arg.Generator()
	return
}

func (g *NaclKeyGen) SaveLKS(lks *LKSec, lctx LoginContext) error {
	_, err := WriteLksSKBToKeyring(g.pair, lks, g.arg.LogUI, lctx)
	return err
}

func (g *NaclKeyGen) Push(lctx LoginContext) (mt MerkleTriple, err error) {
	d := Delegator{
		NewKey:      g.pair,
		RevSig:      g.arg.RevSig,
		Device:      g.arg.Device,
		Expire:      g.arg.ExpireIn,
		Sibkey:      g.arg.Sibkey,
		ExistingKey: g.arg.Signer,
		Me:          g.arg.Me,
		EldestKID:   g.arg.EldestKeyID,
	}
	if err = d.Run(lctx); err != nil {
		return
	}
	return d.GetMerkleTriple(), err
}

func (g *NaclKeyGen) GetKeyPair() NaclKeyPair {
	return g.pair
}

func (g *NaclKeyGen) UpdateArg(signer GenericKey, eldestKID KID, sibkey bool, user *User) {
	g.arg.Signer = signer
	g.arg.EldestKeyID = eldestKID
	g.arg.Sibkey = sibkey
	// if a user is passed in, then update the user pointer
	// this is necessary if the sigchain changed between generation and push.
	if user != nil {
		g.arg.Me = user
	}
}
