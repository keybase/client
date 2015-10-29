//
//  KBUserListView.h
//  Keybase
//
//  Created by Gabriel on 4/1/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBUserProfileView.h"

@interface KBUserListView : YOView

@property (readonly) KBListView *listView;

- (void)setUserSummaries:(NSArray *)userSummaries update:(BOOL)update;

@end
