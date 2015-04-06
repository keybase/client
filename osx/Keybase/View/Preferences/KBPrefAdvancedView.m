//
//  KBPrefAdvancedView.m
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefAdvancedView.h"

#import "KBPrefPopUpView.h"
#import "KBPrefFileView.h"

@interface KBPrefAdvancedView ()
@property KBPreferences *preferences;
@end

@implementation KBPrefAdvancedView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    [self setOptions:@{@"spacing": @"10", @"insets": @"40,40,40,40"}];
    _preferences = preferences;

    /*
    KBPrefPopUpView *apiHost = [[KBPrefPopUpView alloc] init];
    apiHost.preferences = preferences;
    NSArray *apiHostOptions = @[@"https://api.keybase.io:443", @"http://localhost:3000"];
    [apiHost setLabelText:@"API Host" options:apiHostOptions identifier:@"server"];
    [self addSubview:apiHost];

    KBPrefFileView *fileView = [[KBPrefFileView alloc] init];
    fileView.preferences = preferences;
    [fileView setLabelText:@"Home" identifier:@"home"];
    [self addSubview:fileView];
     */
  }
  return self;
}

@end
