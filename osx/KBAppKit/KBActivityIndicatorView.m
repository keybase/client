//
//  KBActivityIndicatorView.m
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

// Adapted from MRActivityIndicatorView
//
//  MRActivityIndicatorView.m
//  MRProgress
//
//  Created by Marius Rackwitz on 10.10.13.
//  Copyright (c) 2013 Marius Rackwitz. All rights reserved.
//

#import "KBActivityIndicatorView.h"
#import "KBAppearance.h"

#import <CocoaLumberjack/CocoaLumberjack.h>
static const int ddLogLevel = DDLogLevelDebug;

@interface KBActivityIndicatorView ()
@property (nonatomic, weak) CAShapeLayer *shapeLayer;
@end

@interface NSBezierPath (KBCGPath)
- (CGPathRef)kb_CGPath;
@end

@implementation KBActivityIndicatorView

- (void)viewInit {
  [super viewInit];

  _hidesWhenStopped = YES;
  self.hidden = YES;

  CAShapeLayer *shapeLayer = [CAShapeLayer new];
  shapeLayer.borderWidth = 0;
  shapeLayer.fillColor = NSColor.clearColor.CGColor;
  shapeLayer.strokeColor = KBAppearance.currentAppearance.selectColor.CGColor;// [NSColor colorWithRed:10.0/255.0 green:96.0/255.0 blue:254.0/255.0 alpha:1].CGColor;
  shapeLayer.lineWidth = 2;
  self.wantsLayer = YES;
  [self.layer addSublayer:shapeLayer];
  self.shapeLayer = shapeLayer;
}

- (void)layout {
  [super layout];
  CGRect frame = self.bounds;
  if (ABS(frame.size.width - frame.size.height) < CGFLOAT_MIN) {
    // Ensure that we have a square frame
    CGFloat s = MIN(frame.size.width, frame.size.height);
    frame.size.width = s;
    frame.size.height = s;
  }

  // Our frame changed. If we are animating we should remove and re-add,
  // which will cause a flicker (TODO).
  if (!CGSizeEqualToSize(self.shapeLayer.frame.size, frame.size)) {
    if (_animating && !self.hidden) [self removeAnimation];

    self.shapeLayer.frame = frame;
    self.shapeLayer.path = [[self layoutPath] kb_CGPath];

    if (_animating && !self.hidden) [self addAnimation];
  }
}

- (void)setLineWidth:(CGFloat)lineWidth {
  self.shapeLayer.lineWidth = lineWidth;
}

- (CGFloat)lineWidth {
  return self.shapeLayer.lineWidth;
}

- (NSBezierPath *)layoutPath {
//  const double TWO_M_PI = 2.0*M_PI;
//  double startAngle = 0.75 * TWO_M_PI;
//  double endAngle = startAngle + TWO_M_PI * 0.9;

  CGFloat width = self.bounds.size.width;
  NSBezierPath *bezierPath = [[NSBezierPath alloc] init];
  [bezierPath appendBezierPathWithArcWithCenter:CGPointMake(width/2.0f, width/2.0f) radius:width/2.2f startAngle:0 endAngle:54 clockwise:YES];
  return bezierPath;
}

- (void)setAnimating:(BOOL)animating {
  if (_animating == animating) return;
  animating ? [self startAnimating] : [self stopAnimating];
}

- (void)startAnimating {
  if (_animating) return;
  _animating = YES;

  [self addAnimation];

  if (self.hidesWhenStopped) self.hidden = NO;
}

- (void)stopAnimating {
  if (!_animating) return;
  _animating = NO;

  [self removeAnimation];

  if (self.hidesWhenStopped) self.hidden = YES;
}

static NSString *const KBActivityIndicatorViewSpinAnimationKey = @"KBActivityIndicatorViewSpinAnimationKey";

- (void)addAnimation {
  CABasicAnimation *spinAnimation = [CABasicAnimation animationWithKeyPath:@"transform.rotation"];
  spinAnimation.toValue = @(1*2*M_PI);
  spinAnimation.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionLinear];
  spinAnimation.duration = 1.0;
  spinAnimation.repeatCount = INFINITY;
  [self.shapeLayer addAnimation:spinAnimation forKey:KBActivityIndicatorViewSpinAnimationKey];
}

- (void)removeAnimation {
  [self.shapeLayer removeAnimationForKey:KBActivityIndicatorViewSpinAnimationKey];
}

@end



@implementation NSBezierPath (KBCGPath)

- (CGPathRef)kb_CGPath {
  CGPathRef immutablePath = NULL;

  NSInteger numElements = [self elementCount];
  if (numElements > 0) {
    CGMutablePathRef path = CGPathCreateMutable();
    NSPoint points[3];
    BOOL didClosePath = YES;

    for (NSInteger i = 0; i < numElements; i++) {
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

    // Be sure the path is closed or Quartz may not do valid hit detection.
    //if (!didClosePath)
      //CGPathCloseSubpath(path);

    immutablePath = CGPathCreateCopy(path);
    CGPathRelease(path);
  }

  return immutablePath;
}
@end