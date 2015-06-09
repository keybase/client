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
#import "KBPrefButton.h"
#import "KBDefines.h"
#import <ObjectiveSugar/ObjectiveSugar.h>

@interface KBPrefAdvancedView ()
@property KBPreferences *preferences;
@end

@implementation KBPrefAdvancedView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    [self setOptions:@{@"spacing": @"10", @"insets": @"40,0,40,0"}];
    _preferences = preferences;


    /*
    KBPrefPopUpView *apiHost = [[KBPrefPopUpView alloc] init];
    apiHost.preferences = preferences;
    NSArray *apiHostOptions = //@[@"https://api.keybase.io:443", @"http://localhost:3000"];
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

- (BOOL)installCLI:(NSError **)error {
  NSString *keybaseCmd = NSStringWithFormat(@"%@/bin/keybase", NSBundle.mainBundle.sharedSupportPath);
  NSURL *URL = [NSURL fileURLWithPath:keybaseCmd];
  NSURL *symlinkURL = [NSURL fileURLWithPath:@"/usr/local/bin/keybase"];

  if ([NSFileManager.defaultManager fileExistsAtPath:symlinkURL.path]) {
    if (error) *error = KBMakeErrorWithRecovery(-1, @"File already exists.", @"File already exists at %@. You need to remove it or manually symlink it to %@", symlinkURL.path, URL.path);
    return NO;
  }

  NSData *bookmarkData = [URL bookmarkDataWithOptions:NSURLBookmarkCreationSuitableForBookmarkFile includingResourceValuesForKeys:nil relativeToURL:nil error:error];
  if (!bookmarkData) return NO;

  return [NSURL writeBookmarkData:bookmarkData toURL:symlinkURL options:NSURLBookmarkCreationSuitableForBookmarkFile error:error];
}

@end
