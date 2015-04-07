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

    [self setOptions:@{@"spacing": @"10", @"insets": @"40,0,40,0"}];

    /*
    KBPrefCheckbox *gpgEnabled = [[KBPrefCheckbox alloc] init];
    [gpgEnabled setLabelText:@"GPG Enabled" identifier:@"Preferences.GPGEnabled" preferences:preferences];
    [self addSubview:gpgEnabled];

    KBPrefTextField *textField = [[KBPrefTextField alloc] init];
    [textField setLabelText:@"GPG Options" infoText:@"Options to use when calling GPG" identifier:@"gpg-options" preferences:preferences];
    [self addSubview:textField];
     */
  }
  return self;
}

@end
