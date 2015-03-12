//
//  KBBorder.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import <CoreGraphics/CoreGraphics.h>

typedef NS_ENUM (NSInteger, KBBorderType) {
  KBBorderTypeTop = 1 << 0,
  KBBorderTypeRight = 1 << 1,
  KBBorderTypeBottom = 1 << 2,
  KBBorderTypeLeft = 1 << 3,
};

@interface KBBorder : NSView

@property KBBorderType borderType;
@property (nonatomic) NSColor *color;
@property (nonatomic) CGFloat width;

- (UIEdgeInsets)insets;

@end

CGPathRef KBCreatePath(CGRect rect, KBBorderType borderType, CGFloat strokeWidth);
