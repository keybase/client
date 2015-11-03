//
//  KBSourceOutlineView.h
//  Keybase
//
//  Created by Gabriel on 2/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBUserStatusView.h"
#import <KBKit/KBAppDefines.h>

@class KBSourceOutlineView;

@protocol KBSourceOutlineViewDelegate
- (void)sourceOutlineView:(KBSourceOutlineView *)sourceOutlineView didSelectItem:(KBAppViewItem)item;
@end

@interface KBSourceOutlineView : YOView <NSOutlineViewDataSource, NSOutlineViewDelegate>

@property (weak) id<KBSourceOutlineViewDelegate> delegate;
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;

@property (readonly) KBUserStatusView *statusView;

- (void)selectItem:(KBAppViewItem)item;

@end
