//
//  KBSourceOutlineView.h
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBUserStatusView.h"

typedef NS_ENUM (NSInteger, KBSourceViewItem) {
  KBSourceViewItemProfile = 1, // Should match row index
  KBSourceViewItemUsers,
  KBSourceViewItemDevices,
  KBSourceViewItemFolders,
};

@class KBSourceOutlineView;

@protocol KBSourceOutlineViewDelegate
- (void)sourceOutlineView:(KBSourceOutlineView *)sourceOutlineView didSelectItem:(KBSourceViewItem)item;
@end

@interface KBSourceOutlineView : YOView <NSOutlineViewDataSource, NSOutlineViewDelegate>

@property (weak) id<KBSourceOutlineViewDelegate> delegate;
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;

@property (readonly) KBUserStatusView *statusView;

- (void)selectItem:(KBSourceViewItem)item;

@end
