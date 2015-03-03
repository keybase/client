//
//  KBDevicePromptView.m
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDevicePromptView.h"
#import "AppDelegate.h"

@interface KBDevicePromptView ()
@property KBTextField *deviceNameField;
@property KBButton *saveButton;
@end

@implementation KBDevicePromptView

- (void)viewInit {
  [super viewInit];
  GHWeakSelf gself = self;

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Set a Device Name" style:KBLabelStyleHeader appearance:KBAppearance.currentAppearance alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self.contentView addSubview:header];

  KBLabel *label = [[KBLabel alloc] init];
  [label setText:@"This is the first time you've logged into a device. You need to register this device by choosing a name. For example, Macbook or Desktop." style:KBLabelStyleDefault appearance:KBAppearance.currentAppearance];
  [self.contentView addSubview:label];

  _deviceNameField = [[KBTextField alloc] init];
  _deviceNameField.placeholder = @"e.g. Macbook";
  [self.contentView addSubview:_deviceNameField];

  _saveButton = [KBButton buttonWithText:@"Save" style:KBButtonStylePrimary];
  _saveButton.targetBlock = ^{
    [gself save];
  };
  [_saveButton setKeyEquivalent:@"\r"];
  [self.contentView addSubview:_saveButton];

  YOSelf yself = self;
  self.contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:header].size.height + 20;
    y += [layout centerWithSize:CGSizeMake(400, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:label].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.deviceNameField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.saveButton].size.height + 20;

    return CGSizeMake(MIN(480, size.width), y);
  }];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_deviceNameField];
}

- (void)save {
  NSString *deviceName = self.deviceNameField.text;

  if ([NSString gh_isBlank:deviceName]) {
    [AppDelegate setError:KBErrorAlert(@"You need to enter a device name.") sender:_deviceNameField];
    return;
  }

  self.completion(self, nil, deviceName);
}

@end
