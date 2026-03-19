export interface Kotgroup {
  id: string;
  name: string;
  address: string | null;
  created_at: string;
  created_by: string | null;
}

export interface KotgroupDetail extends Kotgroup {
  rules: string | null;
  wifi_ssid: string | null;
  wifi_password: string | null;
}

export interface CreateKotgroupData {
  name: string;
  address?: string;
}

export interface UpdateKotgroupData {
  name?: string;
  address?: string | null;
  rules?: string | null;
  wifi_ssid?: string | null;
  wifi_password?: string | null;
}

export interface MemberContract {
  member_id: string;
  url: string;
}
