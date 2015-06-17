//
//  KBBorder.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBBorder.h"
#import "KBAppearance.h"

@interface KBBorder ()
@property CAShapeLayer *shapeLayer;
@property CGSize pathSize;
@end

@implementation KBBorder

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _shapeLayer = [[CAShapeLayer alloc] init];
    _shapeLayer.fillColor = nil;
    _shapeLayer.lineJoin = kCALineCapRound;
    _shapeLayer.needsDisplayOnBoundsChange = YES;
    self.layer = _shapeLayer;

    // TODO: Support subviews
    //self.wantsLayer = YES;
    //[self.layer addSublayer:_shapeLayer];

    self.width = 1.0;
    self.color = KBAppearance.currentAppearance.lineColor;
  }
  return self;
}

- (NSView *)hitTest:(NSPoint)p {
  for (NSView *subView in [self subviews]) {
    if ([subView hitTest:p])
      return subView;
  }
  return nil;
}

- (BOOL)isFlipped { return YES; }

- (void)updatePath {
  // TODO There must be a simpler way?
  CGPathRef path = KBCreatePath(self.bounds, self.width, self.shapeLayer.cornerRadius);
  [_shapeLayer setPath:path];
  _shapeLayer.bounds = self.bounds;
  CGPathRelease(path);
}

- (void)setFrame:(NSRect)frame {
  [super setFrame:frame];

  BOOL dirty = (_pathSize.width == 0 || _pathSize.width != self.bounds.size.width || _pathSize.height != self.bounds.size.height);
  if (!dirty) return;
  [self updatePath];
  _pathSize = self.bounds.size;
}

- (UIEdgeInsets)insets {
  return UIEdgeInsetsMake(self.width, self.width, self.width, self.width);
}

- (void)setWidth:(CGFloat)width {
  _width = width;
  _shapeLayer.lineWidth = width;
  [self updatePath];
  [_shapeLayer setNeedsDisplay];
}

- (void)setColor:(NSColor *)color {
  _color = color;
  _shapeLayer.strokeColor = color.CGColor;
  [_shapeLayer setNeedsDisplay];
}

- (void)setCornerRadius:(CGFloat)cornerRadius {
  _cornerRadius = cornerRadius;
  _shapeLayer.cornerRadius = cornerRadius;
  [self updatePath];
  [_shapeLayer setNeedsDisplay];
}

- (CGSize)sizeThatFits:(CGSize)size { return size; }

@end


CGPathRef KBCreatePath(CGRect rect, CGFloat strokeWidth, CGFloat cornerRadius) {

  if (rect.size.width == 0 || rect.size.height == 0) return NULL;

  // Need to adjust path rect to inset (since the stroke is drawn from the middle of the path)
  CGFloat strokeInset = strokeWidth/2.0f;
  rect = CGRectInset(rect, strokeInset, strokeInset);

  if (cornerRadius > 0) {
    NSBezierPath *path = [NSBezierPath bezierPathWithRoundedRect:rect xRadius:cornerRadius yRadius:cornerRadius];
    [path setLineWidth:strokeWidth];
    return [path quartzPath];
  } else {
    NSBezierPath *path = [NSBezierPath bezierPathWithRect:rect];
    [path setLineWidth:strokeWidth];
    return [path quartzPath];
  }
}

@implementation NSBezierPath (KBBorder)

- (CGPathRef)quartzPath {
  if (self.elementCount == 0) return NULL;

  CGMutablePathRef path = CGPathCreateMutable();
  NSPoint points[3];
  BOOL didClosePath = YES;

  for (NSInteger i = 0; i < self.elementCount; i++) {
    switch ([self elementAtIndex:i associatedPoints:points]) {
      case NSMoveToBezierPathElement:
        CGPathMoveToPoint(path, NULL, points[0].x, points[0].y);
        break;

      case NSLineToBezierPathElement:
        CGPathAddLineToPoint(path, NULL, points[0].x, points[0].y);
        didClosePath = NO;
        break;

      case NSCurveToBezierPathElement:
        CGPathAddCurveToPoint(path, NULL, points[0].x, points[0].y,
                              points[1].x, points[1].y,
                              points[2].x, points[2].y);
        didClosePath = NO;
        break;

      case NSClosePathBezierPathElement:
        CGPathCloseSubpath(path);
        didClosePath = YES;
        break;
    }
  }

  if (!didClosePath) {
    CGPathCloseSubpath(path);
  }

  return path;
}
@end