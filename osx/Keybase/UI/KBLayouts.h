//
//  KBLayouts.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBLayouts : NSObject

+ (YOLayoutBlock)borderLayoutWithCenterView:(id)centerView topView:(id)topView bottomView:(id)bottomView margin:(UIEdgeInsets)margin padding:(CGFloat)padding maxSize:(CGSize)maxSize;

+ (YOLayoutBlock)gridLayoutForViews:(NSArray *)views viewSize:(CGSize)viewSize padding:(CGFloat)padding;

+ (YOLayoutBlock)center:(id)view;

@end

/*
typedef NS_OPTIONS(NSUInteger, YOViewAutoresizing) {
  YOViewAutoresizingNone                 = 0,
  YOViewAutoresizingFlexibleWidth        = 1 << 1,
  YOViewAutoresizingFlexibleHeight       = 1 << 4,
};

static inline YOViewAutoresizing YOViewAutoresizingMask(NSAutoresizingMaskOptions options) {
  YOViewAutoresizing mask = 0;
  if ((options & NSViewWidthSizable) != 0) mask |= YOViewAutoresizingFlexibleWidth;
  if ((options & NSViewHeightSizable) != 0) mask |= YOViewAutoresizingFlexibleHeight;
  return mask;
}
*/