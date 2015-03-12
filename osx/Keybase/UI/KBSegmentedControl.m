//
//  KBSegmentedControl.m
//  Keybase
//
//  Created by Gabriel on 3/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSegmentedControl.h"

@implementation KBSegmentedControl

/*
- (instancetype)initWithFrame:(NSRect)frame {
  if ((self = [super initWithFrame:frame])) {
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(_boundsChange) name:NSViewBoundsDidChangeNotification object:nil];
  }
  return self;
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}


- (void)_boundsChange {
  if (_fixedSegmentWidths) [self setFixedSegmentWidths];
}

- (void)setFixedSegmentWidths {
  CGFloat max = 0;
  for (NSInteger i = 0; i < self.segmentCount; i++) {
    CGFloat width = [self widthForSegment:i];
    if (width > max) max = width;
  }

  for (NSInteger i = 0; i < self.segmentCount; i++) {
    [self setWidth:max forSegment:i];
  }
}
 */

@end
