//
//  KBImageView.m
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageView.h"

@implementation KBImageView

- (void)setURLString:(NSString *)URLString {
  _URLString = URLString;
  if (URLString) {
    NSImage *image = [[NSImage alloc] initWithContentsOfURL:[NSURL URLWithString:URLString]];
    self.image = image;
  } else {
    self.image = nil;
  }
}

@end
