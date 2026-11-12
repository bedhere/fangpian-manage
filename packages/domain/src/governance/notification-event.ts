export type NotificationInput={id:string;title:string;body:string;createdAt:Date};
export const toNotificationEvent=(notification:NotificationInput)=>({id:notification.id,type:'notification',data:{id:notification.id,title:notification.title,body:notification.body,createdAt:notification.createdAt.toISOString()}});
