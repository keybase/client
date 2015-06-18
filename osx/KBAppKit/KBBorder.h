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

@interface KBBorder : NSView

@property (nonatomic) NSColor *color;
@property (nonatomic) CGFloat width;
@property (nonatomic) CGFloat cornerRadius;

@property (readonly) CAShapeLayer *shapeLayer;

- (UIEdgeInsets)insets;

- (void)updatePath;

@end

CGPathRef KBCreatePath(CGRect rect, CGFloat strokeWidth, CGFloat cornerRadius);

@interface NSBezierPath (KBBorder)
- (CGPathRef)quartzPath;
@end