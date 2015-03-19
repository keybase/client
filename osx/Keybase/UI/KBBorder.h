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

@property (nonatomic) NSColor *color; // Alias for shapeLayer.strokeColor
@property (nonatomic) CGFloat width; // Alias for shapeLayer.lineWidth
@property (nonatomic) CGFloat cornerRadius; // Alias for shapeLayer.cornerRadius

@property (readonly) CAShapeLayer *shapeLayer;

- (UIEdgeInsets)insets;

@end

CGPathRef KBCreatePath(CGRect rect, KBBorderType borderType, CGFloat strokeWidth, CGFloat cornerRadius);

@interface NSBezierPath (KBBorder)
- (CGPathRef)quartzPath;
@end