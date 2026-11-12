export function nextSettingVersion(current:number,expected:number){if(current!==expected)throw new Error('SETTING_VERSION_CONFLICT');return current+1;}
