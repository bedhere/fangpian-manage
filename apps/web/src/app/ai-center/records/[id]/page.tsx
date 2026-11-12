import { AiRecordPage } from '@/features/ai-center/record-page';

export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{notice?:string;date?:string}>}) {
  const {id}=await params;
  const query=await searchParams;
  return <AiRecordPage recordId={id} notice={query.notice} noticeDate={query.date}/>;
}
