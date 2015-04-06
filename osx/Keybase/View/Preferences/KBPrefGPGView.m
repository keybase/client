//
//  KBPrefGPGView.m
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefGPGView.h"

#import "KBPrefCheckbox.h"
#import "KBPrefTextField.h"

@interface KBPrefGPGView ()
@property KBPreferences *preferences;
@end

@implementation KBPrefGPGView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    _preferences = preferences;

    [self setOptions:@{@"spacing": @"20", @"insets": @"40,40,40,40"}];

    KBPrefCheckbox *gpgEnabled = [[KBPrefCheckbox alloc] init];
    gpgEnabled.preferences = preferences;
    [gpgEnabled setLabelText:@"GPG Enabled" identifier:@"Preferences.GPGEnabled"];
    [self addSubview:gpgEnabled];

    KBPrefTextField *textField = [[KBPrefTextField alloc] init];
    textField.preferences = preferences;
    [textField setLabelText:@"GPG Options" infoText:@"Options to use when calling GPG" identifier:@"gpg-options"];
    [self addSubview:textField];
  }
  return self;
}

@end
