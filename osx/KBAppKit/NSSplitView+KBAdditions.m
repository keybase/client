//
//  NSSplitView+KBAdditions.m
//  KBAppKit
//
//  Created by Gabriel on 9/15/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import "NSSplitView+KBAdditions.h"

@implementation NSSplitView (KBAdditions)

- (CGFloat)kb_positionOfDividerAtIndex:(NSInteger)dividerIndex {
  while (dividerIndex >= 0 && [self isSubviewCollapsed:[[self subviews] objectAtIndex:dividerIndex]]) {
    dividerIndex--;
  }
  if (dividerIndex < 0) return 0;

  NSRect priorViewFrame = [[[self subviews] objectAtIndex:dividerIndex] frame];
  return [self isVertical] ? NSMaxX(priorViewFrame) : NSMaxY(priorViewFrame);
}

@end
