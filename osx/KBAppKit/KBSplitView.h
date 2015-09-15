//
//  KBSplitView.h
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBBox.h"

/*!
 This is a really dumb split view.
 You should use MDPSplitView instead.
 */
@interface KBSplitView : YOView

@property CGFloat dividerPosition;
@property float dividerRatio;

@property KBBox *divider;


// Compatibility with NSSplitView
@property BOOL vertical;
@property NSSplitViewDividerStyle dividerStyle;

- (void)adjustSubviews;
- (void)setPosition:(CGFloat)position ofDividerAtIndex:(NSInteger)dividerIndex animated:(BOOL)animated;

@end
