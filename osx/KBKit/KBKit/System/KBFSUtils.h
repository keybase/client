//
//  KBFSUtils.h
//  Keybase
//

#import <Foundation/Foundation.h>

@interface KBFSUtils : NSObject
+(BOOL)checkAbsolutePath:(NSString *)path hasAbsolutePrefix:(NSString *)prefix;
+(BOOL)checkIfPathIsFishy:(NSString *)path;
@end
