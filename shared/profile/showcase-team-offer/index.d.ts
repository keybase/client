import * as React from 'react'
import * as Types from '../../constants/types/teams'

export type RowProps = {
  canShowcase: boolean,
  name: Types.Teamname,
  isOpen: boolean,
  membercount: number,
  onPromote: (promote: boolean) => void,
  showcased: boolean,
  waiting: boolean,
  isExplicitMember: boolean
};

export type Props = {
  customCancelText: string,
  customComponent?: React.ElementType | null,
  headerStyle?: Object | null,
  onCancel: () => void,
  onPromote: (name: Types.Teamname, promote: boolean) => void,
  teammembercounts: {
    [K in string]: number;
  },
  teamnames: Array<Types.Teamname>,
  teamNameToIsOpen: {
    [K in string]: boolean;
  },
  teamNameToAllowPromote: {
    [K in string]: boolean;
  },
  teamNameToIsShowcasing: {
    [K in string]: boolean;
  },
  teamNameToRole: {
    [K in string]: boolean;
  },
  waiting: {
    [K in string]: number;
  }
};

export default class ShowcaseTeamOffer extends React.Component<Props> {}
