package effects

// Rehydrate implements base.Rehydratable interface
func (sc *SignerCreated) Rehydrate() error {
	sc.Key = sc.PublicKey
	return nil
}

// Rehydrate implements base.Rehydratable interface
func (sr *SignerRemoved) Rehydrate() error {
	sr.Key = sr.PublicKey
	return nil
}

// Rehydrate implements base.Rehydratable interface
func (su *SignerUpdated) Rehydrate() error {
	su.Key = su.PublicKey
	return nil
}
