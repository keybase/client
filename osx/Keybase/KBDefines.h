//
//  KBDefines.h
//  Keybase
//
//  Created by Gabriel on 12/16/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <GHKit/GHKit.h>
#import <ObjectiveSugar/ObjectiveSugar.h>
#import <YOLayout/YOLayout.h>

typedef void (^KBCompletionBlock)(NSError *error);
typedef void (^KBErrorBlock)(NSError *error);

#define KBMakeError(CODE, MSG, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey:[NSString stringWithFormat:MSG, ##__VA_ARGS__], NSLocalizedRecoveryOptionsErrorKey: @[@"OK"]}]

#define KBMakeErrorWithRecovery(CODE, MSG, RECOVERY, ...) [NSError errorWithDomain:@"Keybase" code:CODE userInfo:@{NSLocalizedDescriptionKey: MSG, NSLocalizedRecoveryOptionsErrorKey: @[@"OK"], NSLocalizedRecoverySuggestionErrorKey:[NSString stringWithFormat:RECOVERY, ##__VA_ARGS__]}]

extern NSString *const KBTrackingListDidChangeNotification;

NSString *KBDisplayURLStringForUsername(NSString *username);
NSString *KBURLStringForUsername(NSString *username);
NSString *KBHexString(NSData *data);


static inline CGRect KBCGRectInset(CGRect rect, UIEdgeInsets insets) {
  CGSize size = rect.size;
  return CGRectMake(insets.left, insets.top, size.width - insets.right - insets.left, size.height - insets.top - insets.bottom);
}