//
//  KBFolderUsersListView.h
//  Keybase
//
//  Created by Gabriel on 4/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBImageLabel.h"
#import "KBUserPermission.h"

@interface KBFolderUsersListView : KBTableView

@end


@interface KBUserPermissionLabel : KBImageLabel

- (void)setUserPermission:(KBUserPermission *)userPermission;

@end