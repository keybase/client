//
//  KBDeviceView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceView.h"

@implementation KBDeviceView

- (void)setDevice:(KBRDevice *)device {
  [self.titleLabel setText:device.name font:[NSFont boldSystemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  self.imageSize = CGSizeMake(40, 40);
  [self setTitle:device.name info:device.type imageSource:@"30-Hardware-black-computer-30"];
  [self setNeedsLayout];
}

@end
