import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface HealthData {
  steps: number | null;
  sleepHours: number | null;
}

// HealthKit access requires react-native-health (bare/dev-client workflow).
// Info.plist keys required: NSHealthShareUsageDescription, NSHealthUpdateUsageDescription.
// Until that package is installed and linked, this hook returns null for all values.
//
// To wire up once react-native-health is installed:
//   import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';
//   const perms: HealthKitPermissions = {
//     permissions: {
//       read: [AppleHealthKit.Constants.Permissions.Steps, AppleHealthKit.Constants.Permissions.SleepAnalysis],
//       write: [],
//     },
//   };
//   AppleHealthKit.initHealthKit(perms, (err) => {
//     if (err) return;
//     AppleHealthKit.getStepCount({ date: new Date().toISOString() }, (e, r) => setSteps(r?.value ?? null));
//     AppleHealthKit.getSleepSamples({ startDate: ..., endDate: ... }, (e, r) => setSleep(totalHours(r)));
//   });
export function useHealthKit(): HealthData {
  const [steps, setSteps] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // Wire up react-native-health here once installed.
  }, []);

  return { steps, sleepHours };
}
