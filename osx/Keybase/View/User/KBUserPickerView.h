//
//  KBUserPickerView.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBSearchControl.h"

@class KBUserPickerView;

@protocol KBUserPickerViewDelegate
- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView;
@end

@interface KBUserPickerView : YOView <NSTokenFieldDelegate, KBSearchControlDelegate>

@property KBListView *searchResultsView;
@property (weak) id<KBUserPickerViewDelegate> delegate;

- (void)hideSearch;

- (NSArray *)usernames;

- (void)addUsername:(NSString *)username;

@end
