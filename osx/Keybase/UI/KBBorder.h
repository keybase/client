//
//  KBBorder.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import <Quartz/Quartz.h>

typedef NS_OPTIONS (NSInteger, KBBorderType) {
  KBBorderTypeTop,
  KBBorderTypeRight,
  KBBorderTypeBottom,
  KBBorderTypeLeft,

  KBBorderTypeAll = KBBorderTypeTop|KBBorderTypeRight|KBBorderTypeBottom|KBBorderTypeLeft,
};

@interface KBBorder : NSView

@property KBBorderType borderType;

@property (nonatomic) NSColor *color;
@property (nonatomic) CGFloat width;
@property (nonatomic) CGFloat cornerRadius;

@property (readonly) CAShapeLayer *shapeLayer;

- (UIEdgeInsets)insets;

@end

CGPathRef KBCreatePath(CGRect rect, KBBorderType borderType, CGFloat strokeWidth, CGFloat cornerRadius);

@interface NSBezierPath (KBBorder)
- (CGPathRef)quartzPath;
@end