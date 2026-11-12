import { describe,expect,it } from 'vitest';import { nextSettingVersion } from './setting-version.js';
describe('system setting version policy',()=>{it('increments the current version',()=>expect(nextSettingVersion(3,3)).toBe(4));it('rejects stale admin updates',()=>expect(()=>nextSettingVersion(3,2)).toThrow('SETTING_VERSION_CONFLICT'));});
