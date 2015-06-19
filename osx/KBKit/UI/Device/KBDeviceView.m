//
//  KBDeviceView.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDeviceView.h"
#import "KBDeviceSignerOption.h"

@implementation KBDeviceView

- (void)setDevice:(KBRDevice *)device {
  NSString *deviceName = [device.name gh_present];
  if ([NSString gh_isBlank:deviceName]) deviceName = [device.type capitalizedString];

  [self.titleLabel setText:deviceName style:KBTextStyleDefault options:KBTextOptionsStrong alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  [self.infoLabel setText:device.type style:KBTextStyleSecondaryText options:KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];

  self.imageView.image = KBImageForDeviceType(device.type);

  //self.imageSize = CGSizeMake(40, 40);
  self.tintImageForStyle = YES;
  [self setNeedsLayout];
}

@end

@implementation KBDeviceCell

- (void)viewInit {
  [super viewInit];
  self.border.position = KBBoxPositionBottom;
}

@end