
#include "fs.h"
#include "KBHelperDefines.h"


@implementation KBFSUtils

+(NSURL *)copyToTemporary:(NSString *)bin name:(NSString *)name fileType:(NSFileAttributeType)fileType error:(NSError **)error {

    NSURL *directoryURL = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[[NSProcessInfo processInfo] globallyUniqueString]] isDirectory:YES];
    NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
    attributes[NSFilePosixPermissions] = [NSNumber numberWithShort:0700];
    attributes[NSFileOwnerAccountID] = 0;
    attributes[NSFileGroupOwnerAccountID] = 0;
    if (![[NSFileManager defaultManager] createDirectoryAtURL:directoryURL withIntermediateDirectories:YES attributes:attributes error:error]) {
      return nil;
    }

    NSURL *srcURL = [NSURL fileURLWithPath:bin];
    NSURL *dstURL = [directoryURL URLByAppendingPathComponent:name isDirectory:NO];
    if (![[NSFileManager defaultManager] copyItemAtURL:srcURL toURL:dstURL error:error]) {
      return nil;
    }

    // Once it's copied into the root-only area, make sure it's not a
    // symlink, since then a non-root user could change the binary
    // after we check the signature.
    NSString *dstPath = [dstURL path];
    if (![KBFSUtils checkFile:dstPath isType:fileType]) {
        *error = KBMakeError(-1, @"Install component was of the wrong type");
        return nil;
    }

    return dstURL;
}

+(BOOL)checkFile:(NSString *)linkPath isType:(NSFileAttributeType)fileType {
	NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:linkPath error:nil];
	if (!attributes) {
    	return NO;
  	}
  	return [attributes[NSFileType] isEqual:fileType];
}

+(void)checkKeybaseResource:(NSURL *)bin identifier:(NSString *)identifier error:(NSError **)error {

    SecStaticCodeRef staticCode = NULL;
    CFURLRef url = (__bridge CFURLRef)bin;
    SecStaticCodeCreateWithPath(url, kSecCSDefaultFlags, &staticCode);
    SecRequirementRef keybaseRequirement = NULL;
    // This requirement string is taken from Installer/Info.plist.

    if (identifier == nil) {
      identifier = @"";
    }
    NSString *nsRequirement = [NSString stringWithFormat:@"anchor apple generic %@ and (certificate leaf[field.1.2.840.113635.100.6.1.9] /* exists */ or certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = \"99229SGT5K\")", identifier];

    SecRequirementCreateWithString((__bridge CFStringRef)nsRequirement,kSecCSDefaultFlags, &keybaseRequirement);
    OSStatus codeCheckResult = SecStaticCodeCheckValidityWithErrors(staticCode, (kSecCSDefaultFlags | kSecCSStrictValidate | kSecCSCheckNestedCode | kSecCSCheckAllArchitectures | kSecCSEnforceRevocationChecks), keybaseRequirement, NULL);
    if (codeCheckResult != errSecSuccess) {
      *error = KBMakeError(codeCheckResult, @"Binary not signed by Keybase");
    }
    if (staticCode) CFRelease(staticCode);
    if (keybaseRequirement) CFRelease(keybaseRequirement);
}

+(BOOL)checkIfPathIsFishy:(NSString *)path {
    NSArray *v = [path componentsSeparatedByString:@"/"];
    for (int i = 0; i < v.count; i++) {
        if ([v[i] isEqualToString:@".."]) {
            return YES;
        }
        if ([v[i] isEqualToString:@"."]) {
            return YES;
        }
    }

    // Only allow vanilla characters in our paths. A whitelist approach, as opposed to a
    // blacklist.
    NSError *error = NULL;
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"^[a-zA-Z0-9./_() -]+$" options:0 error:&error];
    if (!regex) {
        return YES;
    }
    NSTextCheckingResult *match = [regex firstMatchInString:path options:0 range:NSMakeRange(0, [path length])];
    if (!match) {
        return YES;
    }
    return NO;
}

/*
 * check that the path path has the prefix prefix, being wise to
 * whatever attacks people will throw at us, like /a/b/../../.., etc
 */
+(BOOL)checkAbsolutePath:(NSString *)path hasAbsolutePrefix:(NSString *)prefix {
    if (!prefix.absolutePath) {
        return NO;
    }
    if (!path.absolutePath) {
        return NO;
    }
    if ([self checkIfPathIsFishy:path]) {
        return NO;
    }
    if ([self checkIfPathIsFishy:prefix]) {
        return NO;
    }
    NSArray *a = [path   componentsSeparatedByString:@"/"];
    NSArray *b = [prefix componentsSeparatedByString:@"/"];
    if (a.count < b.count) {
        return NO;
    }

    for (int i = 0; i < b.count; i++) {
        if (![a[i] isEqualToString:b[i]]) {
            return NO;
        }
    }
    return YES;

}

@end

