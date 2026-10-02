export type DraftType =
  | 'MONEY_IN'
  | 'FUND_TRANSFER'
  | 'EXPENSE'
  | 'GOODS_PURCHASE'
  | 'ATTENDANCE'
  | 'WORK_RECORD'
  | 'WORKER_PAYMENT'
  | 'BANK_DEPOSIT'
  | 'BANK_WITHDRAWAL';

export interface DraftFieldOption {
  id: string;
  name: string;
  subtext?: string;
}

export interface DraftConfirmationPayload {
  draftId: string;
  draftType: DraftType;
  title: string;
  badgeText: string;
  status: 'PENDING' | 'SAVING' | 'SAVED' | 'CANCELLED';
  senderUserId: string;
  senderUserName: string;
  date: string; // YYYY-MM-DD
  amount?: number;
  // Specific targets
  receiverId?: string;
  receiverName?: string;
  receiverType?: 'WORKER' | 'USER' | 'SUPPLIER';
  projectId?: string;
  projectName?: string;
  purpose?: string;
  isNewPurpose?: boolean;
  notes?: string;
  // Goods Purchase
  materialId?: string;
  materialName?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  supplierName?: string;
  // Attendance
  attendanceRecords?: Array<{
    workerId?: string;
    workerName: string;
    status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
    overtimeHours?: number;
  }>;
  // Work Record
  workItem?: string;
  // Bank Account
  bankAccountId?: string;
  bankAccountName?: string;
  receivedIn?: 'WALLET' | 'BANK';
  // Available options for quick dropdown change in the card
  options?: {
    workers?: DraftFieldOption[];
    partners?: DraftFieldOption[];
    projects?: DraftFieldOption[];
    purposes?: DraftFieldOption[];
    bankAccounts?: DraftFieldOption[];
  };
  // Result details after save
  resultMessage?: string;
  newBalance?: number;
}
