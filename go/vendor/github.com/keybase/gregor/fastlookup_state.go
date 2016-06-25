package gregor

type FastLookupState struct {
	state State
	table map[string]Item
}

func NewFastLookupState(state State, table map[string]Item) FastLookupState {
	return FastLookupState{
		state: state,
		table: table,
	}
}

func (fs FastLookupState) GetItem(msgID MsgID) (Item, bool) {
	if item, ok := fs.table[msgID.String()]; ok {
		return item, true
	}
	return nil, false
}

func (fs FastLookupState) Items() ([]Item, error) {
	return fs.state.Items()
}

func (fs FastLookupState) ItemsInCategory(c Category) ([]Item, error) {
	return fs.state.ItemsInCategory(c)
}

func (fs FastLookupState) ItemsWithCategoryPrefix(c Category) ([]Item, error) {
	return fs.state.ItemsWithCategoryPrefix(c)
}

func (fs FastLookupState) Marshal() ([]byte, error) {
	return fs.state.Marshal()
}

func (fs FastLookupState) Hash() ([]byte, error) {
	return fs.state.Hash()
}

func (fs FastLookupState) GetUnderlyingState() State {
	return fs.state
}

type FastLookupObjFactory struct {
	ObjFactory
}

var _ ObjFactory = FastLookupObjFactory{}

func (fo FastLookupObjFactory) MakeStateWithLookupTable(items []Item,
	table map[string]Item) (State, error) {

	state, err := fo.MakeState(items)
	if err != nil {
		return nil, err
	}

	return NewFastLookupState(state, table), nil
}

func (fo FastLookupObjFactory) ExportState(s State) (State, error) {
	if fs, ok := s.(FastLookupState); ok {
		return fo.ObjFactory.ExportState(fs.GetUnderlyingState())
	} else {
		return fo.ObjFactory.ExportState(s)
	}
}
