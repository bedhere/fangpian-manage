import { describe, it, expect, vi } from 'vitest';
import { TeamWorkEvidenceService } from './team-work.evidence.js';
describe('import evidence access', () => {
  it('does not expose the whole company workbook through one visible task',async()=>{
    const tasks={list:vi.fn().mockResolvedValue({tasks:[{id:'mine',evidence:[{name:'原表',storageKey:'imports/source.xlsx'}]}]})};
    const service=new TeamWorkEvidenceService({get:(_k:string,fallback:unknown)=>fallback,getOrThrow:()=> 'test'}as any,tasks as any);
    const sign=vi.fn().mockResolvedValue('signed');(service as any).client={presignedGetObject:sign};
    await expect(service.get({role:'member'}as any,'mine','0')).rejects.toThrow('完整原表');
    await expect(service.get({role:'admin',managedDepartmentIds:['dept']}as any,'mine','0')).rejects.toThrow('完整原表');
    expect(sign).not.toHaveBeenCalled();
    await expect(service.get({role:'admin'}as any,'mine','0')).resolves.toMatchObject({url:'signed'});
  });
  it('only signs attachments of visible tasks and never accepts arbitrary storage keys', async () => {
    const sign = vi.fn().mockResolvedValue('https://files.example/signed');
    const tasks = { list: vi.fn().mockResolvedValue({ tasks: [{ id: 'mine', evidence: [{ name: '截图', storageKey: 'imports/image.png' }] }] }) };
    const service = new TeamWorkEvidenceService({ get: (_k: string, fallback: unknown) => fallback, getOrThrow: () => 'test' } as any, tasks as any);
    (service as any).client = { presignedGetObject: sign };
    await expect(service.get({} as any, 'other', '0')).rejects.toThrow();
    await expect(service.get({} as any, 'mine', '-1')).rejects.toThrow();
    await expect(service.get({} as any, 'mine', '100')).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
    await expect(service.get({} as any, 'mine', '0')).resolves.toEqual({ name: '截图', url: 'https://files.example/signed' });
  });
});
