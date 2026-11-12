'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { apiClient } from '@/lib/api';

export function NotificationLink({id,href,className,children}:{id:string;href:string;className?:string;children:ReactNode}) {
  return <Link prefetch={false} href={href} className={className} onClick={()=>{
    // Read status is independent of routing: an unavailable read endpoint must not block processing.
    void apiClient.request(`/api/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'},false).catch(()=>undefined);
  }}>{children}</Link>;
}
