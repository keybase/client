//
//  KBKeySelectView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBKeySelectView.h"

#import "AppDelegate.h"

@implementation KBKeySelectView

- (void)viewInit {
  [super viewInit];

  [AppDelegate.client registerMethod:@"keybase.1.gpgUi.SelectKey" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //KBRGPGKeySet *keyset = [MTLJSONAdapter modelOfClass:KBRGPGKeySet.class fromJSONDictionary:params[0][@"keyset"] error:nil];



  }];
}

@end
