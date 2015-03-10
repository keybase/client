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
  [self.titleLabel setText:device.name font:KBAppearance.currentAppearance.boldLargeTextFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  [self.infoLabel setText:device.type font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.secondaryTextColor alignment:NSLeftTextAlignment];
  [self.imageView.imageLoader setImageSource:@"30-Hardware-black-computer-30"];
  self.imageSize = CGSizeMake(40, 40);
  self.tintImageForStyle = YES;
  [self setNeedsLayout];
}

@end
