//
//  KBUserPickerView.h
//  Keybase
//
//  Created by Gabriel on 3/20/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>

#import "KBSearchControl.h"
#import "KBRPC.h"

@class KBUserPickerView;

@protocol KBUserPickerViewDelegate
- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView;
- (void)userPickerView:(KBUserPickerView *)userPickerView didUpdateSearch:(BOOL)visible;
@end

@interface KBUserPickerView : YOView <NSTokenFieldDelegate, KBSearchControlDelegate>

@property KBRPClient *client;
@property (weak) id<KBUserPickerViewDelegate> delegate;

//@property KBListView *searchResultsView;
- (void)setSearchResultsFrame:(CGRect)searchResultsFrame inView:(NSView *)inView;

- (void)hideSearch;

- (NSArray *)usernames;

- (void)addUsername:(NSString *)username;

@end
