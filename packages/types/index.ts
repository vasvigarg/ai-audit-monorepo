export interface AuditRequestBody {
  contractCode: string;
}
export interface AuditReport {
  aiAudit?: string;
  // Add fields for Hardhat/Static analysis results if used
}
export interface AuditResponse {
  success: boolean;
  results?: AuditReport;
  error?: string;
}
