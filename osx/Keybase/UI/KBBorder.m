//
//  KBBorder.m
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBBorder.h"

@interface KBBorder ()
@property CAShapeLayer *shapeLayer;
@property CGSize pathSize;
@end

@implementation KBBorder

- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    _borderType = KBBorderTypeLeft | KBBorderTypeTop | KBBorderTypeRight | KBBorderTypeBottom;
    _shapeLayer = [[CAShapeLayer alloc] init];
    _shapeLayer.fillColor = nil;
    _shapeLayer.lineJoin = kCALineCapRound;
    _shapeLayer.needsDisplayOnBoundsChange = YES;
    self.layer = _shapeLayer;

    // TODO: Support subviews
    //self.wantsLayer = YES;
    //[self.layer addSublayer:_shapeLayer];

    self.width = 1.0;
    self.color = NSColor.blackColor;
  }
  return self;
}

- (BOOL)isFlipped { return YES; }

- (void)_updatePath {
  // TODO There must be a simpler way?
  BOOL dirty = (_pathSize.width == 0 || _pathSize.width != self.bounds.size.width || _pathSize.height != self.bounds.size.height);
  if (!dirty) return;
  CGPathRef path = KBCreatePath(self.bounds, _borderType, self.width, self.shapeLayer.cornerRadius);
  [_shapeLayer setPath:path];
  _shapeLayer.bounds = self.bounds;
  CGPathRelease(path);
  _pathSize = self.bounds.size;
}

- (void)setFrame:(NSRect)frame {
  [super setFrame:frame];
  [self _updatePath];
}

- (UIEdgeInsets)insets {
  UIEdgeInsets insets = UIEdgeInsetsZero;
  if ((_borderType & KBBorderTypeLeft) != 0) insets.left = self.width;
  if ((_borderType & KBBorderTypeRight) != 0) insets.right += self.width;
  if ((_borderType & KBBorderTypeTop) != 0) insets.top += self.width;
  if ((_borderType & KBBorderTypeBottom) != 0) insets.bottom += self.width;
  return insets;
}

- (void)setWidth:(CGFloat)width {
  _shapeLayer.lineWidth = width;
  [_shapeLayer setNeedsDisplay];
}

- (CGFloat)width {
  return _shapeLayer.lineWidth;
}

- (void)setColor:(NSColor *)color {
  _shapeLayer.strokeColor = color.CGColor;
  [_shapeLayer setNeedsDisplay];
}

- (NSColor *)color {
  return [NSColor colorWithCGColor:_shapeLayer.strokeColor];
}

- (void)setCornerRadius:(CGFloat)cornerRadius {
  _shapeLayer.cornerRadius = cornerRadius;
  [self _updatePath];
  [_shapeLayer setNeedsDisplay];
}

- (CGFloat)cornerRadius {
  return _shapeLayer.cornerRadius;
}

- (CGSize)sizeThatFits:(CGSize)size { return size; }

//- (void)drawRect:(NSRect)rect {
//  CGContextRef context = [[NSGraphicsContext currentContext] graphicsPort];
//
//  CGPathRef path = KBCreatePath(self.frame, _borderType, _width, 0);
//  CGContextAddPath(context, path);
//  CGPathRelease(path);
//
//  CGContextSetStrokeColorWithColor(context, _color.CGColor);
//  CGContextSetLineWidth(context, _width);
//  CGContextDrawPath(context, kCGPathStroke);
//}

@end


CGPathRef KBCreatePath(CGRect rect, KBBorderType borderType, CGFloat strokeWidth, CGFloat cornerRadius) {

  if (cornerRadius > 0) {
    NSBezierPath *path = [NSBezierPath bezierPathWithRoundedRect:rect xRadius:cornerRadius yRadius:cornerRadius];
    [path setLineWidth:strokeWidth];
    return [path quartzPath];
  }

  CGFloat strokeInset = strokeWidth/2.0f;

  // Need to adjust path rect to inset (since the stroke is drawn from the middle of the path)
  CGRect insetBounds = CGRectMake(rect.origin.x, rect.origin.y, rect.size.width, rect.size.height);

  if ((borderType & KBBorderTypeLeft) != 0) {
    insetBounds.origin.x += strokeInset;
    insetBounds.size.width -= strokeInset;
  }

  if ((borderType & KBBorderTypeRight) != 0) {
    insetBounds.size.width -= strokeInset;
  }

  if ((borderType & KBBorderTypeTop) != 0) {
    insetBounds.origin.y += strokeInset;
    insetBounds.size.height -= strokeInset;
  }

  if ((borderType & KBBorderTypeBottom) != 0) {
    insetBounds.size.height -= strokeInset;
  }

  rect = insetBounds;

  CGAffineTransform transform = CGAffineTransformIdentity;
  transform = CGAffineTransformTranslate(transform, CGRectGetMinX(rect), CGRectGetMinY(rect));
  CGFloat fw = CGRectGetWidth(rect);
  CGFloat fh = CGRectGetHeight(rect);

  CGMutablePathRef path = CGPathCreateMutable();

  CGPathMoveToPoint(path, &transform, 0, fh);
  if ((borderType & KBBorderTypeLeft) != 0) {
    CGPathAddLineToPoint(path, &transform, 0, 0);
  } else {
    CGPathMoveToPoint(path, &transform, 0, 0);
  }

  if ((borderType & KBBorderTypeTop) != 0) {
    CGPathAddLineToPoint(path, &transform, fw, 0);
  }  else {
    CGPathMoveToPoint(path, &transform, fw, 0);
  }

  if ((borderType & KBBorderTypeRight) != 0) {
    CGPathAddLineToPoint(path, &transform, fw, fh);
  }  else {
    CGPathMoveToPoint(path, &transform, fw, fh);
  }

  if ((borderType & KBBorderTypeBottom) != 0) {
    CGPathAddLineToPoint(path, &transform, 0, fh);
  }  else {
    CGPathMoveToPoint(path, &transform, 0, fh);
  }

  return path;
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