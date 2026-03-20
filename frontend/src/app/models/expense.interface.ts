export interface ExpenseParticipant {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface Expense {
  id: string;
  kotgroup_id: string;
  paid_by: string;
  payer: ExpenseParticipant | null;
  title: string;
  amount: number;
  participants: ExpenseParticipant[];
  created_at: string;
  updated_at: string;
}

export interface BalanceEntry {
  userId: string;
  name: string;
  avatar_url: string | null;
  netBalance: number;
}

export interface SettlementEntry {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface BalancesResponse {
  balances: BalanceEntry[];
  settlements: SettlementEntry[];
}
