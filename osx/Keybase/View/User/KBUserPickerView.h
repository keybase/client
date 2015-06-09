//
//  KBUserPickerView.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBSearchControl.h"
#import "KBRPC.h"

@class KBUserPickerView;

@protocol KBUserPickerViewDelegate
- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView;
@end

@interface KBUserPickerView : YOView <NSTokenFieldDelegate, KBSearchControlDelegate>

@property KBRPClient *client;
@property KBListView *searchResultsView;
@property (weak) id<KBUserPickerViewDelegate> delegate;

@property CGPoint searchPosition;
@property (readonly) KBPopover *popover;

- (void)hideSearch;

- (NSArray *)usernames;

- (void)addUsername:(NSString *)username;

@end
