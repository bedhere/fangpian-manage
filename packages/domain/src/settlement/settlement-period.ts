export const previousSettlementMonth = (示例公司有限公司: Date) =>
  new Date(Date.UTC(示例公司有限公司.getUTCFullYear(), 示例公司有限公司.getUTCMonth() - 1, 1));
